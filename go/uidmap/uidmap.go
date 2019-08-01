package uidmap

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type UIDMap struct {
	sync.Mutex
	usernameCache     map[keybase1.UID]libkb.NormalizedUsername
	fullNameCache     *lru.Cache
	testBatchIterHook func()
	testNoCachingMode bool
	serverRefreshers  map[keybase1.UID]keybase1.Seqno
}

func NewUIDMap(fullNameCacheSize int) *UIDMap {
	cache, err := lru.New(fullNameCacheSize)
	if err != nil {
		panic(fmt.Sprintf("failed to make an LRU size=%d: %s", fullNameCacheSize, err))
	}
	return &UIDMap{
		usernameCache:    make(map[keybase1.UID]libkb.NormalizedUsername),
		fullNameCache:    cache,
		serverRefreshers: make(map[keybase1.UID]keybase1.Seqno),
	}
}

func usernameDBKey(u keybase1.UID) libkb.DbKey {
	return libkb.DbKey{Typ: libkb.DBUidToUsername, Key: string(u)}
}

func fullNameDBKey(u keybase1.UID) libkb.DbKey {
	return libkb.DbKey{Typ: libkb.DBUidToFullName, Key: string(u)}
}

type mapStatus int

const (
	foundHardCoded mapStatus = iota
	foundInMem     mapStatus = iota
	foundOnDisk    mapStatus = iota
	notFound       mapStatus = iota
	stale          mapStatus = iota
)

// The number of UIDs per batch to send. It's not `const` so we can twiddle it in our tests.
var batchSize = 250

func (u *UIDMap) SetTestingNoCachingMode(enabled bool) {
	u.testNoCachingMode = enabled
}

func (u *UIDMap) Clear() {
	u.Lock()
	defer u.Unlock()
	u.usernameCache = make(map[keybase1.UID]libkb.NormalizedUsername)
	u.fullNameCache.Purge()
}

func (u *UIDMap) findUsernamePackageLocally(ctx context.Context, g libkb.UIDMapperContext, uid keybase1.UID, fullNameFreshness time.Duration) (ret *libkb.UsernamePackage, stats mapStatus) {
	nun, usernameStatus := u.findUsernameLocally(ctx, g, uid)
	if usernameStatus == notFound {
		return nil, notFound
	}
	fullName, fullNameStatus := u.findFullNameLocally(ctx, g, uid, fullNameFreshness)
	return &libkb.UsernamePackage{NormalizedUsername: nun, FullName: fullName}, fullNameStatus
}

const CurrentFullNamePackageVersion = keybase1.FullNamePackageVersion_V2

func isStale(g libkb.UIDMapperContext, m keybase1.FullNamePackage, dur time.Duration) (time.Duration, bool) {
	if dur == time.Duration(0) {
		return time.Duration(0), false
	}
	now := g.GetClock().Now()
	cachedAt := m.CachedAt.Time()
	diff := now.Sub(cachedAt)
	expired := (diff > dur)
	return diff, expired
}

func (u *UIDMap) findFullNameLocally(ctx context.Context, g libkb.UIDMapperContext, uid keybase1.UID, fullNameFreshness time.Duration) (ret *keybase1.FullNamePackage, status mapStatus) {

	var staleFullName *keybase1.FullNamePackage
	var staleExpired time.Duration

	doNotFoundReturn := func() (*keybase1.FullNamePackage, mapStatus) {
		if staleFullName != nil {
			return staleFullName, stale
		}
		return nil, notFound
	}

	voidp, ok := u.fullNameCache.Get(uid)
	if ok {
		tmp, ok := voidp.(keybase1.FullNamePackage)
		if !ok {
			g.GetLog().CDebugf(ctx, "Found non-FullNamePackage in LRU cache for uid=%s", uid)
		} else if when, expired := isStale(g, tmp, fullNameFreshness); expired {
			staleFullName = &tmp
			staleExpired = when
			g.GetVDebugLog().CLogf(ctx, libkb.VLog0, "fullName memory mapping %s -> %+v is expired (%s ago)", uid, tmp, when)
		} else {
			ret = &tmp
			return ret, foundInMem
		}
	}

	var tmp keybase1.FullNamePackage
	key := fullNameDBKey(uid)
	found, err := g.GetKVStore().GetInto(&tmp, key)
	if err != nil {
		g.GetLog().CInfof(ctx, "failed to get dbkey %v: %s", key, err)
		return doNotFoundReturn()
	}
	if !found {
		return doNotFoundReturn()
	}

	if tmp.Version != CurrentFullNamePackageVersion {
		g.GetLog().CDebugf(ctx, "Old version (=%d) found for dbkey %s", tmp.Version, key)
		return doNotFoundReturn()
	}

	if when, expired := isStale(g, tmp, fullNameFreshness); expired {
		g.GetVDebugLog().CLogf(ctx, libkb.VLog0, "fullName disk mapping %s -> %+v is expired (%s ago)", uid, tmp, when)
		if when < staleExpired {
			staleFullName = &tmp
		}
		return doNotFoundReturn()
	}

	u.fullNameCache.Add(uid, tmp)
	return ret, foundOnDisk
}

func (u *UIDMap) findUsernameLocally(ctx context.Context, g libkb.UIDMapperContext, uid keybase1.UID) (libkb.NormalizedUsername, mapStatus) {
	un := findHardcoded(uid)
	if !un.IsNil() {
		return un, foundHardCoded
	}
	un, ok := u.usernameCache[uid]
	if ok {
		return un, foundInMem
	}
	var s string
	key := usernameDBKey(uid)
	found, err := g.GetKVStore().GetInto(&s, key)
	if err != nil {
		g.GetLog().CInfof(ctx, "failed to get dbkey %v: %s", key, err)
		return libkb.NormalizedUsername(""), notFound
	}
	if !found {
		return libkb.NormalizedUsername(""), notFound
	}
	ret := libkb.NewNormalizedUsername(s)
	u.usernameCache[uid] = ret
	return ret, foundOnDisk
}

type apiRow struct {
	Username    string              `json:"username"`
	FullName    string              `json:"full_name,omitempty"`
	EldestSeqno keybase1.Seqno      `json:"eldest_seqno"`
	Status      keybase1.StatusCode `json:"status"`
}

type apiReply struct {
	Status libkb.AppStatus         `json:"status"`
	Users  map[keybase1.UID]apiRow `json:"users"`
}

func (a *apiReply) GetAppStatus() *libkb.AppStatus {
	return &a.Status
}

func uidsToStringForLog(uids []keybase1.UID) string {
	if len(uids) < 5 {
		return libkb.UidsToString(uids)
	}

	return fmt.Sprintf("%s,...,%s [%d total UIDs]", uids[0], uids[len(uids)-1], len(uids))
}

func (u *UIDMap) refreshersForUIDs(uids []keybase1.UID) string {
	var v []string
	for _, uid := range uids {
		if eldestSeqno, found := u.serverRefreshers[uid]; found {
			v = append(v, (keybase1.UserVersion{Uid: uid, EldestSeqno: eldestSeqno}).String())
		}
	}
	return strings.Join(v, ",")
}

func (u *UIDMap) lookupFromServerBatch(ctx context.Context, g libkb.UIDMapperContext, uids []keybase1.UID, networkTimeBudget time.Duration) ([]libkb.UsernamePackage, error) {
	noCache := u.testNoCachingMode
	arg := libkb.NewRetryAPIArg("user/names")
	arg.SessionType = libkb.APISessionTypeNONE
	refreshers := u.refreshersForUIDs(uids)
	if len(refreshers) > 0 {
		g.GetLog().CDebugf(ctx, "user/names refreshers: %s", refreshers)
	}
	arg.Args = libkb.HTTPArgs{
		"uids":       libkb.S{Val: libkb.UidsToString(uids)},
		"no_cache":   libkb.B{Val: noCache},
		"refreshers": libkb.S{Val: refreshers},
	}
	if networkTimeBudget > time.Duration(0) {
		arg.InitialTimeout = networkTimeBudget
		arg.RetryCount = 0
	}
	var r apiReply
	err := g.GetAPI().PostDecodeCtx(ctx, arg, &r)
	if err != nil {
		return nil, err
	}
	ret := make([]libkb.UsernamePackage, len(uids))
	cachedAt := keybase1.ToTime(g.GetClock().Now())
	for i, uid := range uids {
		if row, ok := r.Users[uid]; ok {
			nun := libkb.NewNormalizedUsername(row.Username)
			if !u.CheckUIDAgainstUsername(uid, nun) {
				g.GetLog().CWarningf(ctx, "Server returned bad UID -> username mapping: %s -> %s", uid, nun)
			} else {
				ret[i] = libkb.UsernamePackage{
					NormalizedUsername: nun,
					FullName: &keybase1.FullNamePackage{
						Version:     CurrentFullNamePackageVersion,
						FullName:    keybase1.FullName(row.FullName),
						EldestSeqno: row.EldestSeqno,
						Status:      row.Status,
						CachedAt:    cachedAt,
					},
				}
			}
		}
	}
	return ret, nil
}

func (u *UIDMap) lookupFromServer(ctx context.Context, g libkb.UIDMapperContext, uids []keybase1.UID, networkTimeBudget time.Duration) ([]libkb.UsernamePackage, error) {

	start := g.GetClock().Now()
	end := start.Add(networkTimeBudget)

	var ret []libkb.UsernamePackage
	for i := 0; i < len(uids); i += batchSize {
		high := i + batchSize
		if high > len(uids) {
			high = len(uids)
		}
		inb := uids[i:high]
		var budget time.Duration

		// Only useful for testing...
		if u.testBatchIterHook != nil {
			u.testBatchIterHook()
		}

		if networkTimeBudget > time.Duration(0) {
			now := g.GetClock().Now()
			if now.After(end) {
				return ret, errors.New("ran out of time")
			}
			budget = end.Sub(now)
		}
		outb, err := u.lookupFromServerBatch(ctx, g, inb, budget)
		if err != nil {
			return ret, err
		}
		ret = append(ret, outb...)
	}
	return ret, nil
}

// InformOfEldestSeqno informs the mapper of an up-to-date (uid,eldestSeqno) pair.
// If the cache has a different value, it will clear the cache and then plumb
// the pair all the way through to the server, whose cache may also be in need
// of busting. Will return true if the cached value was up-to-date, and false
// otherwise.
func (u *UIDMap) InformOfEldestSeqno(ctx context.Context, g libkb.UIDMapperContext, uv keybase1.UserVersion) (isCurrent bool, err error) {

	// No entry/exit tracing, or common-case tracing, in this function since otherwise
	// the spam is overwhelming.

	u.Lock()
	defer u.Unlock()

	uid := uv.Uid
	isCurrent = true
	updateDisk := true

	voidp, ok := u.fullNameCache.Get(uid)
	if ok {
		tmp, ok := voidp.(keybase1.FullNamePackage)
		switch {
		case !ok:
			g.GetLog().CDebugf(ctx, "Found non-FullNamePackage in LRU cache for uid=%s", uid)
		case tmp.EldestSeqno < uv.EldestSeqno:
			g.GetLog().CDebugf(ctx, "Stale eldest memory mapping for uid=%s; we had %d, but latest is %d", uid, tmp.EldestSeqno, uv.EldestSeqno)
			u.fullNameCache.Remove(uid)
			isCurrent = false
		default:
			// If the memory state of this UID->Eldest mapping is correct,
			// then there is no reason to check the disk state, since we should
			// never have a case that the memory state is newer than the disk
			// state. And hopefully this is the common case!
			updateDisk = false
		}
	}

	if updateDisk {
		var tmp keybase1.FullNamePackage
		key := fullNameDBKey(uid)
		found, err := g.GetKVStore().GetInto(&tmp, key)
		if err != nil {
			g.GetLog().CDebugf(ctx, "Error reading %s from UID map disk-backed cache: %s", uid, err)
		}
		if found && tmp.EldestSeqno < uv.EldestSeqno {
			g.GetLog().CDebugf(ctx, "Stale eldest disk mapping for uid=%s; we had %d, but latest is %d", uid, tmp.EldestSeqno, uv.EldestSeqno)
			if err := g.GetKVStore().Delete(key); err != nil {
				return false, err
			}
			isCurrent = false
		}
	}

	if !isCurrent {
		u.serverRefreshers[uid] = uv.EldestSeqno
	}

	return isCurrent, nil
}

// MapUIDsToUsernamePackages maps the given set of UIDs to the username
// packages, which include a username and a fullname, and when the mapping was
// loaded from the server. It blocks on the network until all usernames are
// known. If the `forceNetworkForFullNames` flag is specified, it will block on
// the network too. If the flag is not specified, then stale values (or unknown
// values) are OK, we won't go to network if we lack them. All network calls
// are limited by the given timeBudget, or if 0 is specified, there is
// indefinite budget. In the response, a nil FullNamePackage means that the
// lookup failed. A non-nil FullNamePackage means that some previous lookup
// worked, but might be arbitrarily out of date (depending on the cachedAt
// time). A non-nil FullNamePackage with an empty fullName field means that the
// user just hasn't supplied a fullName.  FullNames can be cached bt the
// UIDMap, but expire after networkTimeBudget duration. If that value is 0,
// then infinitely stale names are allowed. If non-zero, and some names aren't
// stale, we'll have to go to the network.
//
// *NOTE* that this function can return useful data and an error. In this
// regard, the error is more like a warning. But if, for instance, the mapper
// runs out of time budget, it will return the data it was able to get, and
// also the error.
func (u *UIDMap) MapUIDsToUsernamePackages(ctx context.Context, g libkb.UIDMapperContext,
	uids []keybase1.UID, fullNameFreshness, networkTimeBudget time.Duration,
	forceNetworkForFullNames bool) (res []libkb.UsernamePackage, err error) {
	defer libkb.CTrace(ctx, g.GetLog(), fmt.Sprintf("MapUIDsToUserPackages(%s)", uidsToStringForLog(uids)), func() error { return err })()

	u.Lock()
	defer u.Unlock()

	res = make([]libkb.UsernamePackage, len(uids))
	apiLookupIndex := make(map[int]int)

	var uidsToLookup []keybase1.UID
	for i, uid := range uids {
		up, status := u.findUsernamePackageLocally(ctx, g, uid, fullNameFreshness)
		// If we successfully looked up some of the user, set the return slot here.
		if up != nil {
			res[i] = *up
		}

		// There are 3 important cases when we should go to network:
		//
		//  1. No username is found (up == nil)
		//  2. No FullName found and we've asked to force network lookups (status == notFound && forceNetworkForNullNames)
		//  3. The FullName found was stale (status == stale).
		//
		// Thus, if you provide forceNetworkForFullName=false, and fullNameFreshness=0, you can avoid
		// the network trip as long as all of your username lookups hit the cache or are hardcoded.
		if u.testNoCachingMode || up == nil ||
			(status == notFound && forceNetworkForFullNames) || (status == stale) {
			apiLookupIndex[len(uidsToLookup)] = i
			uidsToLookup = append(uidsToLookup, uid)
		}
	}

	if len(uidsToLookup) > 0 {
		var apiResults []libkb.UsernamePackage

		apiResults, err = u.lookupFromServer(ctx, g, uidsToLookup, networkTimeBudget)
		if err == nil {

			for i, row := range apiResults {
				uid := uidsToLookup[i]
				if row.FullName != nil {
					g.GetVDebugLog().CLogf(ctx, libkb.VLog0, "| API server resolution %s -> (%s, %v, %v)", uid,
						row.NormalizedUsername, row.FullName.FullName, row.FullName.EldestSeqno)
				} else {
					g.GetVDebugLog().CLogf(ctx, libkb.VLog0, "| API server resolution %s -> (%s, <no fn res>)", uid,
						row.NormalizedUsername)
				}

				// Always write these results out if the cached value is unset.
				// Or, see below for other case...
				writeResults := res[apiLookupIndex[i]].NormalizedUsername.IsNil()

				// Fill in caches independently after a successful return. First fill in
				// the username cache...
				if nun := row.NormalizedUsername; !nun.IsNil() {

					// If we get a non-nil NormalizedUsername from the server, then also
					// write results out...
					writeResults = true
					u.usernameCache[uid] = nun
					key := usernameDBKey(uid)
					err := g.GetKVStore().PutObj(key, nil, nun.String())
					if err != nil {
						g.GetLog().CInfof(ctx, "failed to put %v -> %s: %s", key, nun, err)
					}
				}

				// Then fill in the fullName cache...
				if fn := row.FullName; fn != nil {
					u.fullNameCache.Add(uid, *fn)
					key := fullNameDBKey(uid)
					err := g.GetKVStore().PutObj(key, nil, *fn)
					if err != nil {
						g.GetLog().CInfof(ctx, "failed to put %v -> %v: %s", key, *fn, err)
					}
					// If we had previously busted this lookup, then clear the refresher
					// on the server, so we don't have to do it next time through.
					delete(u.serverRefreshers, uid)
				}

				if writeResults {
					// Overwrite the row with whatever was returned from the server.
					res[apiLookupIndex[i]] = row
				}
			}
		}
	}

	return res, err
}

func (u *UIDMap) CheckUIDAgainstUsername(uid keybase1.UID, un libkb.NormalizedUsername) bool {
	return checkUIDAgainstUsername(uid, un)
}

func (u *UIDMap) MapHardcodedUsernameToUID(un libkb.NormalizedUsername) keybase1.UID {
	return findHardcodedUsername(un)
}

func (u *UIDMap) ClearUIDAtEldestSeqno(ctx context.Context, g libkb.UIDMapperContext, uid keybase1.UID, s keybase1.Seqno) error {
	u.Lock()
	defer u.Unlock()

	voidp, ok := u.fullNameCache.Get(uid)
	clearDB := false
	if ok {
		tmp, ok := voidp.(keybase1.FullNamePackage)
		if !ok || tmp.EldestSeqno == s {
			g.GetLog().CDebugf(ctx, "UIDMap: Clearing %s%%%d", uid, s)
			u.fullNameCache.Remove(uid)
			clearDB = true
		}
	} else {
		clearDB = true
	}
	if clearDB {
		key := fullNameDBKey(uid)
		if err := g.GetKVStore().Delete(key); err != nil {
			return err
		}
	}
	return nil
}

func (u *UIDMap) MapUIDsToUsernamePackagesOffline(ctx context.Context, g libkb.UIDMapperContext,
	uids []keybase1.UID, fullNameFreshness time.Duration) (res []libkb.UsernamePackage, err error) {
	// Like MapUIDsToUsernamePackages, but never makes any network calls,
	// returns only cached values. UIDs that were not cached at all result in
	// default UsernamePackage, caller has to check if the result is present
	// using `res[i].NormalizedUsername.IsNil()`.
	defer libkb.CTrace(ctx, g.GetLog(), fmt.Sprintf("MapUIDsToUsernamePackagesOffline(%s)", uidsToStringForLog(uids)), func() error { return err })()

	u.Lock()
	defer u.Unlock()

	res = make([]libkb.UsernamePackage, len(uids))
	for i, uid := range uids {
		up, _ := u.findUsernamePackageLocally(ctx, g, uid, fullNameFreshness)
		// If we successfully looked up some of the user, set the return slot here.
		if up != nil {
			res[i] = *up
		}
	}

	return res, nil
}

func MapUIDsReturnMap(ctx context.Context, u libkb.UIDMapper, g libkb.UIDMapperContext, uids []keybase1.UID, fullNameFreshness time.Duration,
	networkTimeBudget time.Duration, forceNetworkForFullNames bool) (res map[keybase1.UID]libkb.UsernamePackage, err error) {

	var uidList []keybase1.UID
	uidSet := map[keybase1.UID]bool{}

	for _, uid := range uids {
		_, found := uidSet[uid]
		if !found {
			uidSet[uid] = true
			uidList = append(uidList, uid)
		}
	}

	resultList, err := u.MapUIDsToUsernamePackages(ctx, g, uidList, fullNameFreshness, networkTimeBudget, forceNetworkForFullNames)
	if err != nil && len(resultList) != len(uidList) {
		return res, err
	}

	res = make(map[keybase1.UID]libkb.UsernamePackage)
	for i, uid := range uidList {
		res[uid] = resultList[i]
	}
	return res, err
}

func MapUIDsReturnMapMctx(mctx libkb.MetaContext, uids []keybase1.UID, fullNameFreshness time.Duration, networkTimeBudget time.Duration,
	forceNetworkForFullNames bool) (res map[keybase1.UID]libkb.UsernamePackage, err error) {
	// Same as MapUIDsReturnMap, but takes less arguments because of mctx,
	// which encapsulates ctx, g, and u (g.UIDMapper).
	g := mctx.G()
	return MapUIDsReturnMap(mctx.Ctx(), g.UIDMapper, g, uids, fullNameFreshness, networkTimeBudget, forceNetworkForFullNames)
}

var _ libkb.UIDMapper = (*UIDMap)(nil)

type OfflineUIDMap struct{}

func (o *OfflineUIDMap) CheckUIDAgainstUsername(uid keybase1.UID, un libkb.NormalizedUsername) bool {
	return true
}

func (o *OfflineUIDMap) MapHardcodedUsernameToUID(un libkb.NormalizedUsername) keybase1.UID {
	return findHardcodedUsername(un)
}

func (o *OfflineUIDMap) MapUIDsToUsernamePackages(ctx context.Context, g libkb.UIDMapperContext, uids []keybase1.UID, fullNameFreshness time.Duration, networktimeBudget time.Duration, forceNetworkForFullNames bool) ([]libkb.UsernamePackage, error) {
	return nil, errors.New("offline uid map always fails")
}

func (o *OfflineUIDMap) SetTestingNoCachingMode(enabled bool) {

}

func (o *OfflineUIDMap) ClearUIDAtEldestSeqno(ctx context.Context, g libkb.UIDMapperContext, uid keybase1.UID, s keybase1.Seqno) error {
	return nil
}

func (o *OfflineUIDMap) InformOfEldestSeqno(ctx context.Context, g libkb.UIDMapperContext, uv keybase1.UserVersion) (bool, error) {
	return true, nil
}

func (o *OfflineUIDMap) MapUIDsToUsernamePackagesOffline(ctx context.Context, g libkb.UIDMapperContext, uids []keybase1.UID, fullNameFreshness time.Duration) (res []libkb.UsernamePackage, err error) {
	// Offline uid map offline call always succeeds but returns nothing.
	res = make([]libkb.UsernamePackage, len(uids))
	return res, nil
}

var _ libkb.UIDMapper = (*OfflineUIDMap)(nil)
