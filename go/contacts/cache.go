// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func contactCacheStoreKey(meUID keybase1.UID, query interface{}) libkb.DbKey {
	switch query.(type) {
	case keybase1.RawPhoneNumber:
		return libkb.DbKey{
			Typ: libkb.DBContactResolution,
			Key: fmt.Sprintf("%v-phone-%s", meUID, query.(keybase1.RawPhoneNumber)),
		}
	case keybase1.EmailAddress:
		return libkb.DbKey{
			Typ: libkb.DBContactResolution,
			Key: fmt.Sprintf("%v-email-%s", meUID, query.(keybase1.EmailAddress)),
		}
	default:
		panic("unknown object passed to contactCacheStoreKey")
	}
}

type CachedContactsProvider struct {
	Provider ContactsProvider
}

type cachedResolutions map[string]ContactLookupResult

func (c *CachedContactsProvider) LookupPhoneNumbers(mctx libkb.MetaContext, numbers []keybase1.RawPhoneNumber,
	userRegion keybase1.RegionCode) (res []ContactLookupResult, err error) {

	defer mctx.TraceTimed(fmt.Sprintf("CachedContactsProvider#LookupPhoneNumbers(len=%d)", len(numbers)),
		func() error { return err })()

	if len(numbers) == 0 {
		return res, nil
	}

	res = make([]ContactLookupResult, len(numbers))

	var remaining []keybase1.RawPhoneNumber
	cacheKey := libkb.DbKey{
		Typ: libkb.DBContactResolution,
		Key: fmt.Sprintf("%v-phone", mctx.CurrentUID()),
	}
	var phoneNumberCache cachedResolutions
	found, cerr := mctx.G().GetKVStore().GetInto(&phoneNumberCache, cacheKey)
	if cerr != nil {
		return nil, cerr
	}
	if !found {
		remaining = numbers
	} else {
		for i, v := range numbers {
			cached, found := phoneNumberCache[string(v)]
			if !found {
				remaining = append(remaining, v)
			}
			res[i] = cached
		}
	}

	apiRes, err := c.Provider.LookupPhoneNumbers(mctx, remaining, userRegion)
	if err != nil {
		mctx.Warning("Error in LookupPhoneNumbers, only returning cached data: %s", err)
	} else {
		if len(remaining) == len(numbers) {
			// if we queried for everything, we can just pass the result.
			res = apiRes
		}
	}
	return res, nil
}

func (c *CachedContactsProvider) LookupEmails(mctx libkb.MetaContext, emails []keybase1.EmailAddress) (res []ContactLookupResult, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("CachedContactsProvider#LookupEmails(len=%d)", len(emails)),
		func() error { return err })()

	if len(emails) == 0 {
		return res, nil
	}
	return c.Provider.LookupEmails(mctx, emails)
}

func (c *CachedContactsProvider) LookupAll(mctx libkb.MetaContext, emails []keybase1.EmailAddress,
	numbers []keybase1.RawPhoneNumber, userRegion keybase1.RegionCode) (ContactLookupMap, error) {

	return c.Provider.LookupAll(mctx, emails, numbers, userRegion)
}

func (c *CachedContactsProvider) FillUsernames(mctx libkb.MetaContext, res []keybase1.ProcessedContact) {
	c.Provider.FillUsernames(mctx, res)
}
