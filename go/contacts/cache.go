// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CachedContactsProvider struct {
	Provider ContactsProvider
}

var _ ContactsProvider = (*CachedContactsProvider)(nil)

type CachedLookupResult struct {
	ContactLookupResult
	Resolved bool
	cachedAt time.Time
}

type ContactsCache struct {
	Lookups map[string]CachedLookupResult
	Version struct {
		Major int
		Minor int
	}
}

func makeNewContactsCache() (ret ContactsCache) {
	ret = ContactsCache{
		Lookups: make(map[string]CachedLookupResult),
	}
	ret.Version.Major = cacheCurrentMajorVersion
	ret.Version.Minor = cacheCurrentMinorVersion
	return ret
}

const cacheCurrentMajorVersion = 1
const cacheCurrentMinorVersion = 0

func cachedResultFromLookupResult(v ContactLookupResult, now time.Time) CachedLookupResult {
	return CachedLookupResult{
		ContactLookupResult: v,
		Resolved:            true,
		cachedAt:            now,
	}
}

func (c *CachedContactsProvider) LookupAll(mctx libkb.MetaContext, emails []keybase1.EmailAddress,
	numbers []keybase1.RawPhoneNumber, userRegion keybase1.RegionCode) (res ContactLookupMap, err error) {

	defer mctx.TraceTimed(fmt.Sprintf("CachedContactsProvider#LookupAll(len=%d)", len(emails)+len(numbers)),
		func() error { return nil })()

	res = make(ContactLookupMap)
	if len(emails)+len(numbers) == 0 {
		return res, nil
	}

	now := mctx.G().Clock().Now()

	var conCache ContactsCache
	cacheKey := libkb.DbKey{
		Typ: libkb.DBContactResolution,
		Key: fmt.Sprintf("%v-%s", mctx.CurrentUID(), userRegion),
	}
	found, cerr := mctx.G().GetKVStore().GetInto(&conCache, cacheKey)
	if cerr != nil {
		mctx.Warning("Unable to pull cache: %s", cerr)
	} else if !found {
		conCache = makeNewContactsCache()
		mctx.Debug("There was no cache, making a new cache object")
	} else {
		mctx.Debug("Fetched cache, current cache size: %d", len(conCache.Lookups))
	}

	var remainingEmails []keybase1.EmailAddress
	var remainingNumbers []keybase1.RawPhoneNumber

	for _, v := range emails {
		key := makeEmailLookupKey(v)
		if cache, found := conCache.Lookups[key]; found {
			if cache.Resolved {
				res[key] = cache.ContactLookupResult
			}
		} else {
			// Pre-insert to the cache. If Provider.LookupAll does not find
			// these, they will stay in the cache as unresolved, otherwise they
			// are overwritten.
			conCache.Lookups[key] = CachedLookupResult{Resolved: false, cachedAt: now}
			remainingEmails = append(remainingEmails, v)
		}
	}

	for _, v := range numbers {
		key := makePhoneLookupKey(v)
		if cache, found := conCache.Lookups[key]; found {
			if cache.Resolved {
				res[key] = cache.ContactLookupResult
			}
		} else {
			// Pre-insert to the cache, same as for emails.
			conCache.Lookups[key] = CachedLookupResult{Resolved: false, cachedAt: now}
			remainingNumbers = append(remainingNumbers, v)
		}
	}

	mctx.Debug("After checking cache, %d emails and %d numbers left to be looked up", len(remainingEmails), len(remainingNumbers))

	if len(remainingEmails)+len(remainingNumbers) > 0 {
		apiRes, err := c.Provider.LookupAll(mctx, remainingEmails, remainingNumbers, userRegion)
		if err == nil {
			for k, v := range apiRes {
				res[k] = v
				conCache.Lookups[k] = cachedResultFromLookupResult(v, now)
			}
		} else {
			mctx.Warning("Unable to call Provider.LookupAll, returning only cached results: %s", err)
		}

		cerr := mctx.G().GetKVStore().PutObj(cacheKey, nil, conCache)
		if cerr != nil {
			mctx.Warning("Unable to update cache: %s", cerr)
		}
	}

	return res, nil
}

func (c *CachedContactsProvider) FillUsernames(mctx libkb.MetaContext, res []keybase1.ProcessedContact) {
	c.Provider.FillUsernames(mctx, res)
}
