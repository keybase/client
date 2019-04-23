// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type mockLookupUser struct {
	UID      keybase1.UID
	Username string
}

type MockContactsProvider struct {
	phoneNumbers map[keybase1.RawPhoneNumber]mockLookupUser
	emails       map[keybase1.EmailAddress]mockLookupUser
}

func makeProvider() *MockContactsProvider {
	return &MockContactsProvider{
		phoneNumbers: make(map[keybase1.RawPhoneNumber]mockLookupUser),
		emails:       make(map[keybase1.EmailAddress]mockLookupUser),
	}
}

func (c *MockContactsProvider) LookupPhoneNumbers(mctx libkb.MetaContext, numbers []keybase1.RawPhoneNumber, userRegion keybase1.RegionCode) (res []ContactLookupResult, err error) {
	for _, number := range numbers {
		result := ContactLookupResult{}
		if user, found := c.phoneNumbers[number]; found {
			result.Found = true
			result.UID = user.UID
			result.Username = user.Username
		}
		res = append(res, result)
	}
	return res, nil
}

func (c *MockContactsProvider) LookupEmails(mctx libkb.MetaContext, emails []keybase1.EmailAddress) (res []ContactLookupResult, err error) {
	for _, email := range emails {
		result := ContactLookupResult{}
		if user, found := c.emails[email]; found {
			result.Found = true
			result.UID = user.UID
			result.Username = user.Username
		}
		res = append(res, result)
	}
	return res, nil
}

func makePhoneComponent(label string, phone string) keybase1.ContactComponent {
	num := keybase1.RawPhoneNumber(phone)
	return keybase1.ContactComponent{
		Label:       label,
		PhoneNumber: &num,
	}
}

func makeEmailComponent(label string, email string) keybase1.ContactComponent {
	em := keybase1.EmailAddress(email)
	return keybase1.ContactComponent{
		Label: label,
		Email: &em,
	}
}

func stringifyResults(res []keybase1.ResolvedContact) (ret []string) {
	ret = make([]string, len(res))
	for i, r := range res {
		if r.Resolved {
			ret[i] = fmt.Sprintf("%s (%s)", r.Username, r.Uid)
		} else {
			var phoneOrEmail string
			if r.Component.PhoneNumber != nil {
				phoneOrEmail = string(*r.Component.PhoneNumber)
			} else if r.Component.Email != nil {
				phoneOrEmail = string(*r.Component.Email)
			}
			ret[i] = fmt.Sprintf("%s %s (%s)", r.Name, phoneOrEmail, r.Component.Label)
		}
	}
	return ret
}

func TestLookupContacts(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookupContacts", 1)
	defer tc.Cleanup()

	contactList := []keybase1.Contact{
		keybase1.Contact{
			Name: "Joe",
			Components: []keybase1.ContactComponent{
				makePhoneComponent("Home", "+1111222"),
				makePhoneComponent("Work", "+199123"),
				makeEmailComponent("E-mail", "joe@linux.org"),
			},
		},
	}

	provider := makeProvider()

	// None of the contact components resolved (empty mock provider). Return all
	// 3 unresolved components to the caller.
	res, err := ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 3)
	for _, r := range res {
		require.Equal(t, "Joe", r.Name)
		require.False(t, r.Resolved)
		require.True(t, r.Uid.IsNil())
	}

	// At least one of the components resolves the user, return just that one
	// contact.
	provider.phoneNumbers["+1111222"] = mockLookupUser{UID: keybase1.UID("1"), Username: "joe"}
	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 1)
	require.Equal(t, "joe", res[0].Name)
	require.Equal(t, "Home", res[0].Component.Label)
	require.NotNil(t, res[0].Component.PhoneNumber)
	require.Nil(t, res[0].Component.Email)
	require.EqualValues(t, "+1111222", *res[0].Component.PhoneNumber)
	require.Nil(t, res[0].Err)
	require.True(t, res[0].Resolved)
	require.EqualValues(t, "1", res[0].Uid)

	// More than one components resolve, still return only the first resolution.
	provider.phoneNumbers["+199123"] = mockLookupUser{UID: keybase1.UID("1"), Username: "joe"}
	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 1)

	// Suddenly this number resolves to someone else, despite being in same contact.
	provider.phoneNumbers["+199123"] = mockLookupUser{UID: keybase1.UID("2"), Username: "ed"}
	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 2)

	// Test with email
	provider = makeProvider()
	provider.emails["joe@linux.org"] = mockLookupUser{UID: keybase1.UID("1"), Username: "joe"}
	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 1)
	require.Equal(t, "joe", res[0].Name)
	require.Equal(t, "E-mail", res[0].Component.Label)
	require.Nil(t, res[0].Component.PhoneNumber)
	require.NotNil(t, res[0].Component.Email)
	require.EqualValues(t, "joe@linux.org", *res[0].Component.Email)
	require.Nil(t, res[0].Err)
	require.True(t, res[0].Resolved)
	require.EqualValues(t, "1", res[0].Uid)
}

func TestLookupContactsMultipleUsers(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookupContacts", 1)
	defer tc.Cleanup()

	contactList := []keybase1.Contact{
		keybase1.Contact{
			Name: "Alice",
			Components: []keybase1.ContactComponent{
				makePhoneComponent("Home", "+1111222"),
				makePhoneComponent("Work", "+199123"),
			},
		},
		keybase1.Contact{
			Name: "Bob",
			Components: []keybase1.ContactComponent{
				makePhoneComponent("Home", "+123456"),
			},
		},
		keybase1.Contact{
			Name: "Charlie",
			Components: []keybase1.ContactComponent{
				makeEmailComponent("E-mail", "charlie+test@keyba.se"),
			},
		},
	}

	provider := makeProvider()

	res, err := ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	expected := []string{
		"Alice +1111222 (Home)",
		"Alice +199123 (Work)",
		"Bob +123456 (Home)",
		"Charlie charlie+test@keyba.se (E-mail)",
	}
	require.Equal(t, expected, stringifyResults(res))

	provider.phoneNumbers["+123456"] = mockLookupUser{UID: keybase1.UID("1"), Username: "bob"}
	provider.emails["charlie+test@keyba.se"] = mockLookupUser{UID: keybase1.UID("2"), Username: "charlie"}

	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	expected = []string{
		"bob (1)",
		"charlie (2)",
		"Alice +1111222 (Home)",
		"Alice +199123 (Work)",
	}
	require.Equal(t, expected, stringifyResults(res))
}
