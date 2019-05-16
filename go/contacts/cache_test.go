// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"testing"

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
	numbers []keybase1.RawPhoneNumber, userRegion keybase1.RegionCode) (ContactLookupMap, error) {

	if c.disabled {
		require.FailNow(c.t, "unexpected call to provider, after being disabled")
	}
	c.queryCount += len(emails) + len(numbers)
	return c.provider.LookupAll(mctx, emails, numbers, userRegion)
}

func (c *anotherMockContactsProvider) FillUsernames(mctx libkb.MetaContext, res []keybase1.ProcessedContact) {
	c.provider.FillUsernames(mctx, res)
}

func (c *anotherMockContactsProvider) FillFollowing(mctx libkb.MetaContext, res []keybase1.ProcessedContact) {
	c.provider.FillFollowing(mctx, res)
}

func TestCacheProvider(t *testing.T) {
	tc := libkb.SetupTest(t, "TestCacheProvider", 1)
	defer tc.Cleanup()

	mockProvider := makeProvider(t)
	cacheProvider := &CachedContactsProvider{
		Provider: mockProvider,
		Store:    NewContactCacheStore(tc.G),
	}

	res, err := cacheProvider.LookupAll(libkb.NewMetaContextForTest(tc), []keybase1.EmailAddress{}, []keybase1.RawPhoneNumber{}, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 0)
}

func setupTestCacheProviders(t *testing.T, tc libkb.TestContext) (provider *anotherMockContactsProvider,
	cacheProvider *CachedContactsProvider) {

	mockProvider := makeProvider(t)
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
		keybase1.Contact{
			Name: "Joe",
			Components: []keybase1.ContactComponent{
				makePhoneComponent("Home", "+1111222"),
				makePhoneComponent("Work", "+199123"),
				makeEmailComponent("E-mail", "bob@keyba.se"),
				makeEmailComponent("E-mail 2", "b@keyba.se"),
			},
		},
	}

	mockProvider.phoneNumbers["+1111222"] = mockLookupUser{UID: keybase1.UID("01ffffffffffffffffffffffffffff00"), Username: "bob"}
	mockProvider.emails["bob@keyba.se"] = mockLookupUser{UID: keybase1.UID("01ffffffffffffffffffffffffffff00"), Username: "bob"}
	mockProvider.phoneNumbers["+199123"] = mockLookupUser{UID: keybase1.UID("02ffffffffffffffffffffffffffff00"), Username: "other_bob"}

	res1, err := ResolveContacts(libkb.NewMetaContextForTest(tc), cacheProvider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)

	// One result in list, there is one contact with a component that resolves to a Keybase user.
	require.Len(t, res1, 1)
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

	contactList[0].Components = append(contactList[0].Components, makeEmailComponent("E-mail", "tester2@keyba.se"))

	res2, err = ResolveContacts(libkb.NewMetaContextForTest(tc), cacheProvider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Equal(t, res1, res2) // list is the same because new component did not resolve

	require.Equal(t, 1, provider.queryCount) // only queried the new email

	// Disable provider again.
	provider.disabled = true
	provider.queryCount = 0

	res2, err = ResolveContacts(libkb.NewMetaContextForTest(tc), cacheProvider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Equal(t, res1, res2)
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
		keybase1.Contact{
			Name: "Joe",
			Components: []keybase1.ContactComponent{
				makePhoneComponent("Home", "+1111222"),
				makePhoneComponent("Work", "+199123"),
				makeEmailComponent("E-mail", "bob@keyba.se"),
				makeEmailComponent("E-mail 2", "b@keyba.se"),
			},
		},
	}

	mockProvider.phoneNumbers["+1111222"] = mockLookupUser{UID: keybase1.UID("01ffffffffffffffffffffffffffff00"), Username: "bob"}

	res1, err := ResolveContacts(libkb.NewMetaContextForTest(tc), cacheProvider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)

	// All components were looked up.
	require.Equal(t, 4, provider.queryCount)

	// Query again with provider disabled, all results should be fetched from cache.
	provider.disabled = true

	res2, err := ResolveContacts(libkb.NewMetaContextForTest(tc), cacheProvider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Equal(t, res1, res2)

	provider.disabled = false
	provider.queryCount = 0

	// Push us over contact cache expiration time.
	clock.Advance(contactCacheFreshness + 1)

	res3, err := ResolveContacts(libkb.NewMetaContextForTest(tc), cacheProvider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Equal(t, res1, res3)

	// Expect to look up all components again.
	require.Equal(t, 4, provider.queryCount)
}
