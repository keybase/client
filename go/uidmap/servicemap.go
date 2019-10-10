package uidmap

import (
	"fmt"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// Like UIDMapper, a local service to obtain server-trust service summary (or
// "serviceMap") for UIDs, cached in memory and in leveldb.

// DefaultNetworkBudget is a networkBudget const which will make the request
// use default timeout / retry settings.
const DefaultNetworkBudget = time.Duration(0)

// DisallowNetworkBudget is a networkBudget const equal to 1 ns, where we won't
// even bother making a request that would inevitably not finish in time.
const DisallowNetworkBudget = time.Duration(1)

type ServiceSummaryMap struct {
	sync.Mutex
	memCache *lru.Cache
}

func NewServiceSummaryMap(memSize int) *ServiceSummaryMap {
	memcache, err := lru.New(memSize)
	if err != nil {
		panic(fmt.Sprintf("failed to make LRU size=%d: %s", memSize, err))
	}
	return &ServiceSummaryMap{
		memCache: memcache,
	}
}

func serviceMapDBKey(u keybase1.UID) libkb.DbKey {
	return libkb.DbKey{Typ: libkb.DBUidToServiceMap, Key: string(u)}
}

func (s *ServiceSummaryMap) findServiceSummaryLocally(ctx context.Context, g libkb.UIDMapperContext,
	uid keybase1.UID, freshness time.Duration) (res libkb.UserServiceSummaryPackage, found bool, err error) {

	voidp, ok := s.memCache.Get(uid)
	if ok {
		tmp, ok := voidp.(libkb.UserServiceSummaryPackage)
		if !ok {
			g.GetLog().CDebugf(ctx, "Found non-ServiceSummary in LRU cache for uid=%s", uid)
		} else {
			if freshness != time.Duration(0) && g.GetClock().Since(keybase1.FromTime(tmp.CachedAt)) > freshness {
				// Data too stale for the request. Do not remove from caches
				// though - maybe other callers will have more relaxed
				// freshness requirements.
				return res, false, nil
			}
			res = tmp
		}
	}

	key := serviceMapDBKey(uid)
	var tmp libkb.UserServiceSummaryPackage
	found, err = g.GetKVStore().GetInto(&tmp, key)
	if err != nil {
		g.GetLog().CInfof(ctx, "failed to get servicemap dbkey %v: %s", key, err)
		return res, false, err
	}
	if !found {
		return res, false, nil
	}

	s.memCache.Add(uid, tmp)
	if freshness != time.Duration(0) && g.GetClock().Since(keybase1.FromTime(tmp.CachedAt)) > freshness {
		// We got the data back from disk cache but it's too stale for this
		// caller.
		return res, false, nil
	}
	return tmp, true, nil
}

// MapUIDsToServiceSummaries retrieves serviceMap for uids.
//
// - `freshness` determines time duration after which data is considered stale
// and will be re-fetched (or not returned, depending if network requests are
// possible and allowed). Default value of 0 makes all data eligible to return
// no matter how old.
//
// - `networkTimeBudget` sets the timeout for network request. Default value of
// 0 triggers the default API behavior. Special value `DisallowNetworkBudget`
// (equal to tiny budget of 1 nanosecond) disallows any network access and will
// result in only cached data being returned.
//
// If UID is present as a key in the result map, it means that it was either
// found in cache or fetched from API server. The value for the key may be nil,
// though, it means that the user has no services proven. To summarize, there is
// a possibility that not all `uids` will be present as keys in the result map,
// and also that not all keys will have non-nil value.
//
// This function does not return errors, but it might not return any requested
// values if neither cache nor API connection is available.
func (s *ServiceSummaryMap) MapUIDsToServiceSummaries(ctx context.Context, g libkb.UIDMapperContext, uids []keybase1.UID,
	freshness time.Duration, networkTimeBudget time.Duration) (res map[keybase1.UID]libkb.UserServiceSummaryPackage) {

	s.Lock()
	defer s.Unlock()

	res = make(map[keybase1.UID]libkb.UserServiceSummaryPackage, len(uids))
	var uidsToQuery []keybase1.UID
	for _, uid := range uids {
		serviceMapPkg, found, err := s.findServiceSummaryLocally(ctx, g, uid, freshness)
		if err != nil {
			g.GetLog().CDebugf(ctx, "Failed to get cached serviceMap for %s: %s", uid, err)
		} else if found {
			res[uid] = serviceMapPkg
		} else {
			uidsToQuery = append(uidsToQuery, uid)
		}
	}

	if len(uidsToQuery) > 0 {
		if networkTimeBudget == DisallowNetworkBudget {
			g.GetLog().CDebugf(ctx, "Not making the network request for %d UIDs because of networkBudget=disallow",
				len(uidsToQuery))
			return res
		}

		g.GetLog().CDebugf(ctx, "Looking up %d UIDs using API", len(uidsToQuery))

		now := keybase1.ToTime(g.GetClock().Now())
		apiResults, err := lookupServiceSummariesFromServer(ctx, g, uidsToQuery, networkTimeBudget)
		if err != nil {
			g.GetLog().CDebugf(ctx, "Failed API call for service maps: %s", err)
		} else {
			for _, uid := range uidsToQuery {
				serviceMap := apiResults[uid]
				// Returning or storing nil maps is fine
				pkg := libkb.UserServiceSummaryPackage{
					CachedAt:   now,
					ServiceMap: serviceMap,
				}
				res[uid] = pkg
				s.memCache.Add(uid, pkg)
				key := serviceMapDBKey(uid)
				err := g.GetKVStore().PutObj(key, nil, pkg)
				if err != nil {
					g.GetLog().CInfof(ctx, "Failed to put service map cache for %v: %s", key, err)
				}
			}
		}
	}

	return res
}

func lookupServiceSummariesFromServer(ctx context.Context, g libkb.UIDMapperContext, uids []keybase1.UID, networkTimeBudget time.Duration) (map[keybase1.UID]libkb.UserServiceSummary, error) {
	if len(uids) == 0 {
		return make(map[keybase1.UID]libkb.UserServiceSummary), nil
	}

	type lookupRes struct {
		libkb.AppStatusEmbed
		ServiceMaps map[keybase1.UID]libkb.UserServiceSummary `json:"service_maps"`
	}

	arg := libkb.NewAPIArg("user/service_maps")
	arg.SessionType = libkb.APISessionTypeNONE
	arg.Args = libkb.HTTPArgs{
		"uids": libkb.S{Val: libkb.UidsToString(uids)},
	}
	if networkTimeBudget > time.Duration(0) {
		arg.InitialTimeout = networkTimeBudget
		arg.RetryCount = 0
	}
	var resp lookupRes
	err := g.GetAPI().PostDecodeCtx(ctx, arg, &resp)
	if err != nil {
		return nil, err
	}
	return resp.ServiceMaps, nil
}

func (s *ServiceSummaryMap) InformOfServiceSummary(ctx context.Context, g libkb.UIDMapperContext,
	uid keybase1.UID, summary libkb.UserServiceSummary) error {

	pkg := libkb.UserServiceSummaryPackage{
		CachedAt:   keybase1.ToTime(g.GetClock().Now()),
		ServiceMap: summary,
	}
	s.memCache.Add(uid, pkg)
	key := serviceMapDBKey(uid)
	return g.GetKVStore().PutObj(key, nil, pkg)
}

var _ libkb.ServiceSummaryMapper = (*ServiceSummaryMap)(nil)

type OfflineServiceSummaryMap struct{}

func NewOfflineServiceSummaryMap() *OfflineServiceSummaryMap {
	return &OfflineServiceSummaryMap{}
}

func (s *OfflineServiceSummaryMap) MapUIDsToServiceSummaries(ctx context.Context, g libkb.UIDMapperContext, uids []keybase1.UID,
	freshness time.Duration, networkTimeBudget time.Duration) (res map[keybase1.UID]libkb.UserServiceSummaryPackage) {
	// Return empty map.
	return make(map[keybase1.UID]libkb.UserServiceSummaryPackage)
}

func (s *OfflineServiceSummaryMap) InformOfServiceSummary(ctx context.Context, g libkb.UIDMapperContext,
	uid keybase1.UID, summary libkb.UserServiceSummary) error {
	// Do nothing, successfully.
	return nil
}

var _ libkb.ServiceSummaryMapper = (*OfflineServiceSummaryMap)(nil)
