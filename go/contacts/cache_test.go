// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"testing"
	"time"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/clockwork"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type anotherMockContactsProvider struct {
	provider   *MockContactsProvider
	t          *testing.T
	disabled   bool
	queryCount int
}

func (c *anotherMockContactsProvider) LookupAll(mctx libkb.MetaContext, emails []keybase1.EmailAddress,
	numbers []keybase1.RawPhoneNumber, userRegion keybase1.RegionCode) (ContactLookupResults, error) {

	if c.disabled {
		require.FailNow(c.t, "unexpected call to provider, after being disabled")
	}
	c.queryCount += len(emails) + len(numbers)
	return c.provider.LookupAll(mctx, emails, numbers, userRegion)
}

func (c *anotherMockContactsProvider) FindUsernames(mctx libkb.MetaContext, uids []keybase1.UID) (map[keybase1.UID]ContactUsernameAndFullName, error) {
	return c.provider.FindUsernames(mctx, uids)
}

func (c *anotherMockContactsProvider) FindFollowing(mctx libkb.MetaContext, uids []keybase1.UID) (map[keybase1.UID]bool, error) {
	return c.provider.FindFollowing(mctx, uids)
}

func TestCacheProvider(t *testing.T) {
	tc := libkb.SetupTest(t, "TestCacheProvider", 1)
	defer tc.Cleanup()

	mockProvider := MakeMockProvider(t)
	cacheProvider := &CachedContactsProvider{
		Provider: mockProvider,
		Store:    NewContactCacheStore(tc.G),
	}

	res, err := cacheProvider.LookupAll(libkb.NewMetaContextForTest(tc), []keybase1.EmailAddress{}, []keybase1.RawPhoneNumber{}, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res.Results, 0)
}

func setupTestCacheProviders(t *testing.T, tc libkb.TestContext) (provider *anotherMockContactsProvider,
	cacheProvider *CachedContactsProvider) {

	mockProvider := MakeMockProvider(t)
	provider = &anotherMockContactsProvider{
		provider: mockProvider,
		t:        t,
	}
	cacheProvider = &CachedContactsProvider{
		Provider: provider,
		Store:    NewContactCacheStore(tc.G),
	}

	return provider, cacheProvider
}

func TestLookupCache(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookupContacts", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("tofu", tc.G)
	require.NoError(t, err)

	provider, cacheProvider := setupTestCacheProviders(t, tc)
	mockProvider := provider.provider

	// Test empty contact list
	res0, err := ResolveContacts(libkb.NewMetaContextForTest(tc), cacheProvider, []keybase1.Contact{}, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res0, 0)

	contactList := []keybase1.Contact{
		{
			Name: "Joe",
			Components: []keybase1.ContactComponent{
				MakePhoneComponent("Home", "+1111222"),
				MakePhoneComponent("Work", "+199123"),
				MakeEmailComponent("E-mail", "bob@keyba.se"),
				MakeEmailComponent("E-mail 2", "b@keyba.se"),
			},
		},
	}

	mockProvider.PhoneNumbers["+1111222"] = MockLookupUser{UID: keybase1.UID("01ffffffffffffffffffffffffffff00"), Username: "bob"}
	mockProvider.Emails["bob@keyba.se"] = MockLookupUser{UID: keybase1.UID("01ffffffffffffffffffffffffffff00"), Username: "bob"}
	mockProvider.PhoneNumbers["+199123"] = MockLookupUser{UID: keybase1.UID("02ffffffffffffffffffffffffffff00"), Username: "other_bob"}

	res1, err := ResolveContacts(libkb.NewMetaContextForTest(tc), cacheProvider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)

	// All components were processed.
	require.Len(t, res1, 4)
	// 4 calls to the provider, all components were queried
	require.Equal(t, 4, provider.queryCount)

	// Query again with the same contact list, we should not call cached
	// provider's inner provider again. Everything should be obtained from
	// cache, including components that did not yield a resolution during last
	// call.
	provider.disabled = true

	res2, err := ResolveContacts(libkb.NewMetaContextForTest(tc), cacheProvider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Equal(t, res1, res2)

	// Add new component to the contact list, it will need to query again.
	provider.disabled = false
	provider.queryCount = 0

	contactList[0].Components = append(contactList[0].Components, MakeEmailComponent("E-mail", "tester2@keyba.se"))

	res2, err = ResolveContacts(libkb.NewMetaContextForTest(tc), cacheProvider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res2, 5)
	require.Equal(t, res1, res2[0:4])                               // first 4 elements are the same
	require.Equal(t, "[tester2@keyba.se]@email", res2[4].Assertion) // new processed contact for new email
	require.False(t, res2[4].Resolved)

	require.Equal(t, 1, provider.queryCount) // only queried the new email

	// Disable provider again.
	provider.disabled = true
	provider.queryCount = 0

	res3, err := ResolveContacts(libkb.NewMetaContextForTest(tc), cacheProvider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Equal(t, res2, res3)
	require.Equal(t, 0, provider.queryCount) // new email got cached as well
}

func TestLookupCacheExpiration(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookupContacts", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("tofu", tc.G)
	require.NoError(t, err)

	clock := clockwork.NewFakeClock()
	tc.G.SetClock(clock)

	provider, cacheProvider := setupTestCacheProviders(t, tc)
	mockProvider := provider.provider

	contactList := []keybase1.Contact{
		MakeContact("Joe",
			MakePhoneComponent("Home", "+1111222"),
			MakePhoneComponent("Work", "+199123"),
			MakeEmailComponent("E-mail", "bob@keyba.se"),
			MakeEmailComponent("E-mail 2", "b@keyba.se"),
		),
	}

	mockProvider.PhoneNumbers["+1111222"] = MockLookupUser{UID: keybase1.UID("01ffffffffffffffffffffffffffff00"), Username: "bob"}

	res1, err := ResolveContacts(libkb.NewMetaContextForTest(tc), cacheProvider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)

	// All components were looked up.
	require.Equal(t, 4, provider.queryCount)

	{
		// Query again with provider disabled, all results should be fetched from cache.
		provider.disabled = true

		res, err := ResolveContacts(libkb.NewMetaContextForTest(tc), cacheProvider, contactList, keybase1.RegionCode(""))
		require.NoError(t, err)
		require.Equal(t, res1, res)

		provider.disabled = false
		provider.queryCount = 0
	}

	{
		// Push us over unresolved contact cache expiration time.
		clock.Advance(25 * time.Hour) // see *MockContactsProvider::LookupAll for correct value

		res, err := ResolveContacts(libkb.NewMetaContextForTest(tc), cacheProvider, contactList, keybase1.RegionCode(""))
		require.NoError(t, err)
		require.Equal(t, res1, res)

		// Expect to look up unresolved components (unresolved freshness is shorter than resolved)
		require.Equal(t, 3, provider.queryCount)

		provider.queryCount = 0
	}

	{
		// Push us over resolved contact cache expiration time.
		clock.Advance(10*24*time.Hour + time.Hour) // see *MockContactsProvider::LookupAll for correct value

		res, err := ResolveContacts(libkb.NewMetaContextForTest(tc), cacheProvider, contactList, keybase1.RegionCode(""))
		require.NoError(t, err)
		require.Equal(t, res1, res)

		// Expect to look up all components.
		require.Equal(t, 4, provider.queryCount)

		provider.queryCount = 0
	}

	{
		// Go really far forward to trigger cleanup. Test provider returns
		// 10-day freshness for resolved entries and 1-day for unresolved. This
		// combined with `minimumFreshness` time gives 55 days after which all
		// current entries should be evicted.
		clock.Advance(55*24*time.Hour + time.Hour)

		mctx := libkb.NewMetaContextForTest(tc)
		contactList := []keybase1.Contact{
			MakeContact("Robert",
				MakePhoneComponent("Phone", "+48111222333"),
			),
		}

		res, err := ResolveContacts(mctx, cacheProvider, contactList, keybase1.RegionCode(""))
		require.NoError(t, err)
		require.Len(t, res, 1)

		// Expect to look up all components from new contactList.
		require.Equal(t, 1, provider.queryCount)

		// Old entries from previous lookups should have been cleared, only
		// last lookup should be cached.
		cacheObj, created := cacheProvider.Store.getCache(mctx)
		require.False(t, created)
		require.Len(t, cacheObj.Lookups, 1)
		_, ok := cacheObj.Lookups[MakePhoneLookupKey("+48111222333")]
		require.True(t, ok)
	}

}
