// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"fmt"
	"time"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CachedContactsProvider struct {
	Provider ContactsProvider
}

type CachedLookupResult struct {
	ContactLookupResult
	Resolved bool
	cachedAt time.Time
}

type CachedLookupResultMap map[string]CachedLookupResult

type CachedBulkLookupResult struct {
	Emails       CachedLookupResultMap
	PhoneNumbers CachedLookupResultMap
}

func cachedResultFromLookupResult(v ContactLookupResult, now time.Time) CachedLookupResult {
	return CachedLookupResult{
		ContactLookupResult: v,
		Resolved:            true,
		cachedAt:            now,
	}
}

func (c *CachedContactsProvider) LookupAll(mctx libkb.MetaContext, emails []keybase1.EmailAddress,
	numbers []keybase1.RawPhoneNumber, userRegion keybase1.RegionCode) (res BulkLookupResult, err error) {

	defer mctx.TraceTimed(fmt.Sprintf("CachedContactsProvider#LookupAll(len=%d)", len(emails)+len(numbers)),
		func() error { return nil })()

	res = MakeBulkLookupResult()
	if len(emails)+len(numbers) == 0 {
		return res, nil
	}

	now := mctx.G().Clock().Now()

	var cachedMap CachedBulkLookupResult
	cacheKey := libkb.DbKey{
		Typ: libkb.DBContactResolution,
		Key: fmt.Sprintf("%v-%s", mctx.CurrentUID(), userRegion),
	}
	found, cerr := mctx.G().GetKVStore().GetInto(&cachedMap, cacheKey)
	if cerr != nil {
		mctx.Warning("Unable to pull cache: %s", cerr)
	} else if !found {
		cachedMap = CachedBulkLookupResult{
			Emails:       make(CachedLookupResultMap),
			PhoneNumbers: make(CachedLookupResultMap),
		}
	}

	var remainingEmails []keybase1.EmailAddress
	var remainingNumbers []keybase1.RawPhoneNumber

	for _, v := range emails {
		if cache, found := cachedMap.Emails[string(v)]; found {
			if cache.Resolved {
				res.Emails[string(v)] = cache.ContactLookupResult
			}
		} else {
			cachedMap.Emails[string(v)] = CachedLookupResult{Resolved: false, cachedAt: now}
			remainingEmails = append(remainingEmails, v)
		}
	}

	for _, v := range numbers {
		if cache, found := cachedMap.PhoneNumbers[string(v)]; found {
			if cache.Resolved {
				res.PhoneNumbers[string(v)] = cache.ContactLookupResult
			}
		} else {
			cachedMap.PhoneNumbers[string(v)] = CachedLookupResult{Resolved: false, cachedAt: now}
			remainingNumbers = append(remainingNumbers, v)
		}
	}

	mctx.Debug("After fetching cache, %d emails and %d numbers left to be looked up", len(remainingEmails), len(remainingNumbers))

	if len(remainingEmails)+len(remainingNumbers) > 0 {
		apiRes, err := c.Provider.LookupAll(mctx, remainingEmails, remainingNumbers, userRegion)
		if err == nil {
			for k, v := range apiRes.Emails {
				res.Emails[k] = v
				cachedMap.Emails[k] = cachedResultFromLookupResult(v, now)
			}
			for k, v := range apiRes.PhoneNumbers {
				res.PhoneNumbers[k] = v
				cachedMap.PhoneNumbers[k] = cachedResultFromLookupResult(v, now)
			}
		} else {
			mctx.Warning("Unable to call Provider.LookupAll, returning only cached results: %s", err)
		}

		spew.Dump("Update cache", cachedMap)
		cerr := mctx.G().GetKVStore().PutObj(cacheKey, nil, cachedMap)
		if cerr != nil {
			mctx.Warning("Unable to update cache: %s", cerr)
		}
	}

	return res, nil
}

func (c *CachedContactsProvider) FillUsernames(mctx libkb.MetaContext, res []keybase1.ProcessedContact) {
	c.Provider.FillUsernames(mctx, res)
}
