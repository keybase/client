// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// ContactCacheStore is used by CachedContactsProvider to store contact cache
// encrypted with device key.
type ContactCacheStore struct {
	encryptedDB *encrypteddb.EncryptedDB
}

func (s *ContactCacheStore) dbKey(uid keybase1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBContactResolution,
		Key: fmt.Sprintf("%v", uid),
	}
}

// NewContactCacheStore creates new ContactCacheStore for given global context.
func NewContactCacheStore(g *libkb.GlobalContext) *ContactCacheStore {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return storage.GetSecretBoxKey(ctx, g, storage.DefaultSecretUI)
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalDb
	}
	return &ContactCacheStore{
		encryptedDB: encrypteddb.New(g, dbFn, keyFn),
	}
}

type CachedContactsProvider struct {
	lock sync.Mutex

	Provider ContactsProvider
	Store    *ContactCacheStore
}

var _ ContactsProvider = (*CachedContactsProvider)(nil)

type cachedLookupResult struct {
	ContactLookupResult
	Resolved bool
	CachedAt time.Time
}

type contactsCache struct {
	Lookups map[string]cachedLookupResult
	Version struct {
		Major int
		Minor int
	}
}

func makeNewContactsCache() (ret contactsCache) {
	ret = contactsCache{
		Lookups: make(map[string]cachedLookupResult),
	}
	ret.Version.Major = cacheCurrentMajorVersion
	ret.Version.Minor = cacheCurrentMinorVersion
	return ret
}

const cacheCurrentMajorVersion = 1
const cacheCurrentMinorVersion = 0

func cachedResultFromLookupResult(v ContactLookupResult, now time.Time) cachedLookupResult {
	return cachedLookupResult{
		ContactLookupResult: v,
		Resolved:            true,
		CachedAt:            now,
	}
}

const contactCacheFreshness = 30 * 24 * time.Hour // approx a month

func (c *contactsCache) findFreshOrSetEmpty(mctx libkb.MetaContext, key string) (res cachedLookupResult, found bool) {
	clock := mctx.G().Clock()
	res, found = c.Lookups[key]
	if !found || clock.Since(res.CachedAt) > contactCacheFreshness {
		// Pre-insert to the cache. If Provider.LookupAll does not find
		// these, they will stay in the cache as unresolved, otherwise they
		// are overwritten.
		res = cachedLookupResult{Resolved: false, CachedAt: clock.Now()}
		c.Lookups[key] = res
		return res, false
	}
	return res, found
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

	// This is a rather long-lived lock, because normally it will be held
	// through the entire duration of the lookup, but:
	// - We don't expect this to be called concurrently, or repeatedly, without
	//   user's interaction.
	// - We want to avoid looking up the same assertion multiple times (burning
	//   through the rate limit), while keeping the locking strategy simple.
	c.lock.Lock()
	defer c.lock.Unlock()

	var conCache contactsCache
	cacheKey := c.Store.dbKey(mctx.CurrentUID())
	found, cerr := c.Store.encryptedDB.Get(mctx.Ctx(), cacheKey, &conCache)
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
		if cache, found := conCache.findFreshOrSetEmpty(mctx, key); found {
			if cache.Resolved {
				res[key] = cache.ContactLookupResult
			}
		} else {
			remainingEmails = append(remainingEmails, v)
		}
	}

	for _, v := range numbers {
		key := makePhoneLookupKey(v)
		if cache, found := conCache.findFreshOrSetEmpty(mctx, key); found {
			if cache.Resolved {
				res[key] = cache.ContactLookupResult
			}
		} else {
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

		cerr := c.Store.encryptedDB.Put(mctx.Ctx(), cacheKey, conCache)
		if cerr != nil {
			mctx.Warning("Unable to update cache: %s", cerr)
		}
	}

	return res, nil
}

func (c *CachedContactsProvider) FillUsernames(mctx libkb.MetaContext, res []keybase1.ProcessedContact) {
	c.Provider.FillUsernames(mctx, res)
}

func (c *CachedContactsProvider) FillFollowing(mctx libkb.MetaContext, res []keybase1.ProcessedContact) {
	c.Provider.FillFollowing(mctx, res)
}
