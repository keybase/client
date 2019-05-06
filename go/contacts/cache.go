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

type cachedResolutions map[string]CachedLookupResult

func (c *CachedContactsProvider) LookupAll(mctx libkb.MetaContext, emails []keybase1.EmailAddress,
	numbers []keybase1.RawPhoneNumber, userRegion keybase1.RegionCode) (res ContactLookupMap, err error) {

	defer mctx.TraceTimed(fmt.Sprintf("bulkLookupContactsProvider#LookupAll(len=%d)", len(emails)+len(numbers)),
		func() error { return nil })()

	res = make(ContactLookupMap)
	if len(emails)+len(numbers) == 0 {
		return res, nil
	}

	now := mctx.G().Clock().Now()

	var cachedMap cachedResolutions
	cacheKey := libkb.DbKey{
		Typ: libkb.DBContactResolution,
		Key: fmt.Sprintf("%v-%s", mctx.CurrentUID(), userRegion),
	}
	found, cerr := mctx.G().GetKVStore().GetInto(&cachedMap, cacheKey)
	if cerr != nil {
		mctx.Warning("Unable to pull cache: %s", cerr)
	} else if !found {
		cachedMap = make(cachedResolutions)
	}

	var remainingEmails []keybase1.EmailAddress
	var remainingNumbers []keybase1.RawPhoneNumber

	for _, v := range emails {
		if cache, found := cachedMap[string(v)]; found {
			if cache.Resolved {
				res[string(v)] = cache.ContactLookupResult
			}
		} else {
			cachedMap[string(v)] = CachedLookupResult{Resolved: false, cachedAt: now}
			remainingEmails = append(remainingEmails, v)
		}
	}

	for _, v := range numbers {
		if cache, found := cachedMap[string(v)]; found {
			if cache.Resolved {
				res[string(v)] = cache.ContactLookupResult
			}
		} else {
			cachedMap[string(v)] = CachedLookupResult{Resolved: false, cachedAt: now}
			remainingNumbers = append(remainingNumbers, v)
		}
	}

	if len(remainingEmails)+len(remainingNumbers) > 0 {
		apiRes, err := c.Provider.LookupAll(mctx, remainingEmails, remainingNumbers, userRegion)
		if err == nil {
			for k, v := range apiRes {
				res[k] = v
				cachedMap[k] = CachedLookupResult{
					ContactLookupResult: v,
					Resolved:            true,
					cachedAt:            now,
				}
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
