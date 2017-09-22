package uidmap

import (
	"fmt"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
	"strings"
	"sync"
)

type UIDMap struct {
	sync.Mutex
	m map[keybase1.UID]libkb.NormalizedUsername
}

func NewUIDMap() *UIDMap {
	return &UIDMap{
		m: make(map[keybase1.UID]libkb.NormalizedUsername),
	}
}

func dbKey(u keybase1.UID) libkb.DbKey {
	return libkb.DbKey{Typ: libkb.DBUidToUsername, Key: string(u)}
}

type mapStatus int

const (
	foundHardCoded mapStatus = iota
	foundInMem     mapStatus = iota
	foundOnDisk    mapStatus = iota
	notFound       mapStatus = iota
)

func (u *UIDMap) Clear() {
	u.Lock()
	defer u.Unlock()
	u.m = make(map[keybase1.UID]libkb.NormalizedUsername)
}

func (u *UIDMap) findOneLocally(ctx context.Context, g libkb.UIDMapperContext, uid keybase1.UID) (libkb.NormalizedUsername, mapStatus) {
	un := findHardcoded(uid)
	if !un.IsNil() {
		return un, foundHardCoded
	}
	un, ok := u.m[uid]
	if ok {
		return un, foundInMem
	}
	var s string
	key := dbKey(uid)
	found, err := g.GetKVStore().GetInto(&s, key)
	if err != nil {
		g.GetLog().CInfof(ctx, "failed to get dbkey %v: %s", key, err)
		return libkb.NormalizedUsername(""), notFound
	}
	if !found {
		return libkb.NormalizedUsername(""), notFound
	}
	ret := libkb.NewNormalizedUsername(s)
	u.m[uid] = ret
	return ret, foundOnDisk
}

type apiReply struct {
	Status    libkb.AppStatus         `json:"status"`
	Usernames map[keybase1.UID]string `json:"usernames"`
}

func (a *apiReply) GetAppStatus() *libkb.AppStatus {
	return &a.Status
}

func uidsToString(uids []keybase1.UID) string {
	var s []string
	for _, uid := range uids {
		s = append(s, string(uid))
	}
	return strings.Join(s, ",")
}

func (u *UIDMap) lookupUIDsFromServer(ctx context.Context, g libkb.UIDMapperContext, uids []keybase1.UID) ([]libkb.NormalizedUsername, error) {
	arg := libkb.NewRetryAPIArg("user/uid_to_username")
	arg.NetContext = ctx
	arg.SessionType = libkb.APISessionTypeNONE
	arg.Args = libkb.HTTPArgs{
		"uids": libkb.S{Val: uidsToString(uids)},
	}
	var r apiReply
	err := g.GetAPI().GetDecode(arg, &r)
	if err != nil {
		return nil, err
	}
	ret := make([]libkb.NormalizedUsername, len(uids), len(uids))
	for i, uid := range uids {
		if un, ok := r.Usernames[uid]; ok {
			nun := libkb.NewNormalizedUsername(un)
			if !u.CheckUIDAgainstUsername(uid, nun) {
				g.GetLog().CWarningf(ctx, "Server returned bad UID -> username mapping: %s -> %s", uid, nun)
			} else {
				ret[i] = nun
			}
		}
	}
	return ret, nil
}

func (u *UIDMap) MapUIDsToUsernames(ctx context.Context, g libkb.UIDMapperContext, uids []keybase1.UID) (res []libkb.NormalizedUsername, err error) {
	defer libkb.CTrace(ctx, g.GetLog(), fmt.Sprintf("MapUIDsToUsernames(%s)", uidsToString(uids)), func() error { return err })()

	u.Lock()
	defer u.Unlock()

	res = make([]libkb.NormalizedUsername, len(uids), len(uids))
	apiLookupIndex := make(map[int]int)

	var uidsToLookup []keybase1.UID

	for i, uid := range uids {
		un, status := u.findOneLocally(ctx, g, uid)
		if status != notFound {
			res[i] = un
			g.GetLog().CDebugf(ctx, "| found lookup resolution %s -> %s (status=%d)", uid, un, status)
			continue
		}
		apiLookupIndex[len(uidsToLookup)] = i
		uidsToLookup = append(uidsToLookup, uid)
	}

	if len(uidsToLookup) > 0 {
		var apiUsernames []libkb.NormalizedUsername

		apiUsernames, err = u.lookupUIDsFromServer(ctx, g, uidsToLookup)
		if err != nil {
			return nil, err
		}

		for i, un := range apiUsernames {
			uid := uidsToLookup[i]
			g.GetLog().CDebugf(ctx, "| API server resolution %s -> %s", uid, un)
			if !un.IsNil() {
				u.m[uid] = un
				key := dbKey(uid)
				err := g.GetKVStore().PutObj(key, nil, un.String())
				if err != nil {
					g.GetLog().CInfof(ctx, "failed to put %v -> %s: %s", key, un, err)
				}
			}
			res[apiLookupIndex[i]] = un
		}
	}

	return res, nil
}

func (u *UIDMap) CheckUIDAgainstUsername(uid keybase1.UID, un libkb.NormalizedUsername) bool {
	return checkUIDAgainstUsername(uid, un)
}

var _ libkb.UIDMapper = (*UIDMap)(nil)
