// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"context"
	"fmt"
	"sync"
	"time"

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

// NewContactCacheStore creates new ContactCacheStore for global context. The
// store is used to securely store cached contact resolutions.
func NewContactCacheStore(g *libkb.GlobalContext) *ContactCacheStore {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return encrypteddb.GetSecretBoxKey(ctx, g, encrypteddb.DefaultSecretUI,
			libkb.EncryptionReasonContactsLocalStorage, "encrypting contact resolution cache")
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
	Resolved  bool
	ExpiresAt time.Time
}

type lookupResultCache struct {
	Lookups map[ContactLookupKey]cachedLookupResult
	Version struct {
		Major int
		Minor int
	}
}

func newLookupResultCache() (ret lookupResultCache) {
	ret = lookupResultCache{
		Lookups: make(map[ContactLookupKey]cachedLookupResult),
	}
	ret.Version.Major = cacheCurrentMajorVersion
	ret.Version.Minor = cacheCurrentMinorVersion
	return ret
}

const cacheCurrentMajorVersion = 2
const cacheCurrentMinorVersion = 0

func cachedResultFromLookupResult(v ContactLookupResult, expires time.Time) cachedLookupResult {
	return cachedLookupResult{
		ContactLookupResult: v,
		Resolved:            true,
		ExpiresAt:           expires,
	}
}

// Time after we throw away the result and not return it anymore. When a cached
// entry expires, we will try to update it, but if we fail to do so, we will
// still return it - so user does not lose all their cache if they happen to be
// offline after expiration time. But if a cached entry has not been refreshed
// for duration of server provided expiration time plus cacheEvictionTime, it's
// discarded entirely.
const cacheEvictionTime = 45 * 24 * time.Hour // approx 45 days

func (c cachedLookupResult) getEvictionTime() time.Time {
	return c.ExpiresAt.Add(cacheEvictionTime)
}

func (c *lookupResultCache) findFreshOrSetEmpty(mctx libkb.MetaContext, key ContactLookupKey) (res cachedLookupResult, stale bool, found bool) {
	now := mctx.G().Clock().Now()
	res, found = c.Lookups[key]
	if !found || now.After(res.getEvictionTime()) {
		// Pre-insert to the cache. If Provider.LookupAll does not find
		// these, they will stay in the cache as unresolved, otherwise they
		// are overwritten.

		// Caller is supposed to set proper ExpiresAt value.
		res = cachedLookupResult{Resolved: false, ExpiresAt: now}
		c.Lookups[key] = res
		return res, false, false
	}
	return res, now.After(res.ExpiresAt), true
}

func (c *lookupResultCache) cleanup(mctx libkb.MetaContext) {
	now := mctx.G().Clock().Now()
	for key, val := range c.Lookups {
		if now.After(val.getEvictionTime()) {
			delete(c.Lookups, key)
		}
	}
}

func (s *ContactCacheStore) getCache(mctx libkb.MetaContext) (obj lookupResultCache, created bool) {
	var conCache lookupResultCache
	var createCache bool
	cacheKey := s.dbKey(mctx.CurrentUID())
	found, err := s.encryptedDB.Get(mctx.Ctx(), cacheKey, &conCache)
	switch {
	case err != nil:
		mctx.Warning("Unable to pull contact lookup cache: %s", err)
		createCache = true
	case !found:
		mctx.Debug("No contact lookup cache found, creating new cache object")
		createCache = true
	case conCache.Version.Major != cacheCurrentMajorVersion:
		mctx.Debug("Found contact cache object but major version is %d (need %d)", conCache.Version.Major, cacheCurrentMajorVersion)
		createCache = true
	}
	// NOTE: If we ever have a cache change that keeps major version same but
	// increases minor version, do the object upgrade here.

	if createCache {
		conCache = newLookupResultCache()
	}
	return conCache, createCache
}

func (s *ContactCacheStore) putCache(mctx libkb.MetaContext, cacheObj lookupResultCache) error {
	cacheKey := s.dbKey(mctx.CurrentUID())
	return s.encryptedDB.Put(mctx.Ctx(), cacheKey, cacheObj)
}

func (s *ContactCacheStore) ClearCache(mctx libkb.MetaContext) error {
	cacheKey := s.dbKey(mctx.CurrentUID())
	return s.encryptedDB.Delete(mctx.Ctx(), cacheKey)
}

func (c *CachedContactsProvider) LookupAll(mctx libkb.MetaContext, emails []keybase1.EmailAddress,
	numbers []keybase1.RawPhoneNumber, userRegion keybase1.RegionCode) (res ContactLookupResults, err error) {

	defer mctx.TraceTimed(fmt.Sprintf("CachedContactsProvider#LookupAll(len=%d)", len(emails)+len(numbers)),
		func() error { return nil })()

	res = NewContactLookupResults()
	if len(emails)+len(numbers) == 0 {
		return res, nil
	}

	// This is a rather long-lived lock, because normally it will be held
	// through the entire duration of the lookup, but:
	// - We don't expect this to be called concurrently, or repeatedly, without
	//   user's interaction.
	// - We want to avoid looking up the same assertion multiple times (burning
	//   through the rate limit), while keeping the locking strategy simple.
	c.lock.Lock()
	defer c.lock.Unlock()

	conCache, _ := c.Store.getCache(mctx)

	var remainingEmails []keybase1.EmailAddress
	var remainingNumbers []keybase1.RawPhoneNumber

	mctx.Debug("Populating results from cache")

	// List of keys of new or stale cache entries, to set ExpireAt value after
	// we do parent provider LookupAll call.
	newCacheEntries := make([]ContactLookupKey, 0, len(remainingEmails)+len(remainingNumbers))

	for _, email := range emails {
		key := MakeEmailLookupKey(email)
		cache, stale, found := conCache.findFreshOrSetEmpty(mctx, key)
		if found && cache.Resolved {
			// Store result even if stale, but may be overwritten by API query later.
			res.Results[key] = cache.ContactLookupResult
		}
		if !found || stale {
			remainingEmails = append(remainingEmails, email)
			newCacheEntries = append(newCacheEntries, key)
		}
	}

	for _, number := range numbers {
		key := MakePhoneLookupKey(number)
		cache, stale, found := conCache.findFreshOrSetEmpty(mctx, key)
		if found && cache.Resolved {
			// Store result even if stale, but may be overwritten by API query later.
			res.Results[key] = cache.ContactLookupResult
		}
		if !found || stale {
			remainingNumbers = append(remainingNumbers, number)
			newCacheEntries = append(newCacheEntries, key)
		}
	}

	mctx.Debug("After checking cache, %d emails and %d numbers left to be looked up", len(remainingEmails), len(remainingNumbers))

	if len(remainingEmails)+len(remainingNumbers) > 0 {
		apiRes, err := c.Provider.LookupAll(mctx, remainingEmails, remainingNumbers, userRegion)
		if err == nil {
			now := mctx.G().Clock().Now()
			expiresAt := now.Add(apiRes.ResolvedFreshness)
			for k, v := range apiRes.Results {
				res.Results[k] = v
				conCache.Lookups[k] = cachedResultFromLookupResult(v, expiresAt)
			}
			// Loop through entries that we asked for and find these we did not get
			// resolutions for. Set ExpiresAt now that we know UnresolvedFreshness.
			unresolvedExpiresAt := now.Add(apiRes.UnresolvedFreshness)
			for _, key := range newCacheEntries {
				val := conCache.Lookups[key]
				if !val.Resolved {
					val.ExpiresAt = unresolvedExpiresAt
					conCache.Lookups[key] = val
				}
			}
		} else {
			mctx.Warning("Unable to call Provider.LookupAll, returning only cached results: %s", err)
		}

		conCache.cleanup(mctx)
		cerr := c.Store.putCache(mctx, conCache)
		if cerr != nil {
			mctx.Warning("Unable to update cache: %s", cerr)
		}
	}

	return res, nil
}

func (c *CachedContactsProvider) FindUsernames(mctx libkb.MetaContext, uids []keybase1.UID) (map[keybase1.UID]ContactUsernameAndFullName, error) {
	return c.Provider.FindUsernames(mctx, uids)
}

func (c *CachedContactsProvider) FindFollowing(mctx libkb.MetaContext, uids []keybase1.UID) (map[keybase1.UID]bool, error) {
	return c.Provider.FindFollowing(mctx, uids)
}

// RemoveContactsCachePhoneEntry removes cached lookup for phone number.
func (s *ContactCacheStore) RemoveContactsCacheEntries(mctx libkb.MetaContext,
	phone *keybase1.PhoneNumber, email *keybase1.EmailAddress) {
	// TODO: Use a phoneNumber | email variant instead of two pointers.
	cacheObj, created := s.getCache(mctx)
	if created {
		// There was no cache.
		return
	}
	if phone != nil {
		// TODO: this type conversion shouldn't have to be here,
		//  since this cache should take `PhoneNumber`s.
		delete(cacheObj.Lookups, MakePhoneLookupKey(keybase1.RawPhoneNumber(*phone)))
		mctx.Debug("ContactCacheStore: Removing phone number %q from lookup cache", *phone)
	}
	if email != nil {
		delete(cacheObj.Lookups, MakeEmailLookupKey(*email))
		mctx.Debug("ContactCacheStore: Removing email %q from lookup cache", *email)
	}
	err := s.putCache(mctx, cacheObj)
	if err != nil {
		mctx.Warning("ContactCacheStore: Unable to update cache: %s", err)
	}
}
