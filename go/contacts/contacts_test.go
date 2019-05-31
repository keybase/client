// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"errors"
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type mockLookupUser struct {
	UID      keybase1.UID
	Username string
	Fullname string
}

type MockContactsProvider struct {
	t            *testing.T
	phoneNumbers map[keybase1.RawPhoneNumber]mockLookupUser
	emails       map[keybase1.EmailAddress]mockLookupUser
	following    map[keybase1.UID]bool
}

func makeProvider(t *testing.T) *MockContactsProvider {
	return &MockContactsProvider{
		t:            t,
		phoneNumbers: make(map[keybase1.RawPhoneNumber]mockLookupUser),
		emails:       make(map[keybase1.EmailAddress]mockLookupUser),
		following:    make(map[keybase1.UID]bool),
	}
}

func (c *MockContactsProvider) LookupAll(mctx libkb.MetaContext, emails []keybase1.EmailAddress,
	numbers []keybase1.RawPhoneNumber, userRegion keybase1.RegionCode) (ContactLookupMap, error) {

	ret := make(ContactLookupMap)
	for _, email := range emails {
		if user, found := c.emails[email]; found {
			ret[fmt.Sprintf("e:%s", string(email))] = ContactLookupResult{UID: user.UID}
		}
	}
	for _, number := range numbers {
		if user, found := c.phoneNumbers[number]; found {
			ret[fmt.Sprintf("p:%s", string(number))] = ContactLookupResult{UID: user.UID}
		}
	}
	return ret, nil
}

func (c *MockContactsProvider) FillUsernames(mctx libkb.MetaContext, res []keybase1.ProcessedContact) {
	for i, v := range res {
		require.False(c.t, v.Uid.IsNil())
		if v.Resolved {
			var found bool
			for _, y := range c.phoneNumbers {
				if y.UID.Equal(v.Uid) {
					res[i].Username = y.Username
					res[i].FullName = y.Fullname
					found = true
					break
				}
			}
			if found {
				continue
			}
			for _, y := range c.emails {
				if y.UID.Equal(v.Uid) {
					res[i].Username = y.Username
					res[i].FullName = y.Fullname
					break
				}
			}
		}
	}
}

func (c *MockContactsProvider) FillFollowing(mctx libkb.MetaContext, res []keybase1.ProcessedContact) {
	for i, v := range res {
		require.False(c.t, v.Uid.IsNil())
		if _, found := c.following[v.Uid]; found {
			res[i].Following = true
		}
	}
}

type ErrorContactsProvider struct {
	t *testing.T
}

func (c *ErrorContactsProvider) LookupAll(mctx libkb.MetaContext, emails []keybase1.EmailAddress,
	numbers []keybase1.RawPhoneNumber, userRegion keybase1.RegionCode) (ret ContactLookupMap, err error) {
	c.t.Errorf("Call to ErrorContactsProvider.LookupAll")
	err = errors.New("error contacts provider")
	return
}

func (c *ErrorContactsProvider) FillUsernames(libkb.MetaContext, []keybase1.ProcessedContact) {
	c.t.Errorf("Call to ErrorContactsProvider.FillUsernames")
}

func (c *ErrorContactsProvider) FillFollowing(libkb.MetaContext, []keybase1.ProcessedContact) {
	c.t.Errorf("Call to ErrorContactsProvider.FillFollowing")
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

func stringifyResults(res []keybase1.ProcessedContact) (ret []string) {
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
			ret[i] = fmt.Sprintf("%s %s (%s)", r.DisplayName, phoneOrEmail, r.Component.Label)
		}
	}
	return ret
}

func displayResults(res []keybase1.ProcessedContact) (ret []string) {
	ret = make([]string, len(res))
	for i, v := range res {
		ret[i] = fmt.Sprintf("%q %q", v.DisplayName, v.DisplayLabel)
	}
	return ret
}

func TestLookupEmptyList(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookupContacts", 1)
	defer tc.Cleanup()

	provider := &ErrorContactsProvider{t}
	contactList := []keybase1.Contact{}

	res, err := ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 0)
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

	provider := makeProvider(t)

	// None of the contact components resolved (empty mock provider). Return all
	// 3 unresolved components to the caller.
	res, err := ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 3)
	for _, r := range res {
		require.Equal(t, "Joe", r.DisplayName)
		require.False(t, r.Resolved)
		require.True(t, r.Uid.IsNil())
	}

	// At least one of the components resolves the user, return just that one
	// contact.
	provider.phoneNumbers["+1111222"] = mockLookupUser{UID: keybase1.UID("1"), Username: "joe", Fullname: "JOE"}
	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 1)
	require.Equal(t, "joe", res[0].DisplayName)
	require.Equal(t, "JOE", res[0].FullName)
	require.Equal(t, "Home", res[0].Component.Label)
	require.NotNil(t, res[0].Component.PhoneNumber)
	require.Nil(t, res[0].Component.Email)
	require.EqualValues(t, "+1111222", *res[0].Component.PhoneNumber)
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
	require.Equal(t, []string{
		"joe (1)",
		"ed (2)",
	}, stringifyResults(res))

	// Test with email
	provider = makeProvider(t)
	provider.emails["joe@linux.org"] = mockLookupUser{UID: keybase1.UID("1"), Username: "joe"}
	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 1)
	require.Equal(t, "joe", res[0].DisplayName)
	require.Equal(t, "E-mail", res[0].Component.Label)
	require.Nil(t, res[0].Component.PhoneNumber)
	require.NotNil(t, res[0].Component.Email)
	require.EqualValues(t, "joe@linux.org", *res[0].Component.Email)
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

	provider := makeProvider(t)

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
		"charlie (2)",
		"bob (1)",
		"Alice +1111222 (Home)",
		"Alice +199123 (Work)",
	}
	require.Equal(t, expected, stringifyResults(res))
	expected = []string{
		`"charlie" "Charlie"`,
		`"bob" "Bob"`,
		`"Alice" "+1111222 (Home)"`,
		`"Alice" "+199123 (Work)"`,
	}
	require.Equal(t, expected, displayResults(res))
}

func TestEmptyComponentLabels(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookupContacts", 1)
	defer tc.Cleanup()

	contactList := []keybase1.Contact{
		keybase1.Contact{
			Name: "Alice",
			Components: []keybase1.ContactComponent{
				makePhoneComponent("", "+1111222"),
				makeEmailComponent("", "alice+test@keyba.se"),
			},
		},
	}

	provider := makeProvider(t)

	res, err := ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	expected := []string{
		"Alice +1111222 ()",
		"Alice alice+test@keyba.se ()",
	}
	require.Equal(t, expected, stringifyResults(res))
	expected = []string{
		`"Alice" "+1111222"`,
		`"Alice" "alice+test@keyba.se"`,
	}
	require.Equal(t, expected, displayResults(res))

	provider.emails["alice+test@keyba.se"] = mockLookupUser{UID: keybase1.UID("1111"), Username: "alice", Fullname: "A L I C E"}
	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 1)
	require.True(t, res[0].Resolved)
	require.Equal(t, "alice", res[0].Username)
	require.Equal(t, "A L I C E", res[0].FullName)
	require.EqualValues(t, "1111", res[0].Uid)
	require.False(t, res[0].Following)
	require.Equal(t, "alice", res[0].DisplayName)
	require.Equal(t, "Alice", res[0].DisplayLabel) // Because we are not following, contact name is used instead of full name.
}

func TestFollowing(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookupContacts", 1)
	defer tc.Cleanup()

	contactList := []keybase1.Contact{
		keybase1.Contact{
			Name: "Alice",
			Components: []keybase1.ContactComponent{
				makePhoneComponent("", "+1111222"),
			},
		},
		keybase1.Contact{
			Name: "Bob",
			Components: []keybase1.ContactComponent{
				makeEmailComponent("", "bob+test@keyba.se"),
			},
		},
		keybase1.Contact{
			Name: "Charlie",
			Components: []keybase1.ContactComponent{
				makeEmailComponent("", "charlie+test@keyba.se"),
			},
		},
		keybase1.Contact{
			Name: "",
			Components: []keybase1.ContactComponent{
				makeEmailComponent("", "doug+test@keyba.se"),
			},
		},
	}

	provider := makeProvider(t)

	provider.phoneNumbers["+1111222"] = mockLookupUser{UID: keybase1.UID("1111"), Username: "alice", Fullname: "CryptoAlice"}
	provider.emails["bob+test@keyba.se"] = mockLookupUser{UID: keybase1.UID("2222"), Username: "bob", Fullname: ""}
	provider.emails["charlie+test@keyba.se"] = mockLookupUser{UID: keybase1.UID("3333"), Username: "charlie", Fullname: ""}
	provider.emails["doug+test@keyba.se"] = mockLookupUser{UID: keybase1.UID("4444"), Username: "doug", Fullname: ""}

	provider.following[keybase1.UID("1111")] = true
	provider.following[keybase1.UID("3333")] = true

	res, err := ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 4)
	expected := []string{
		`"bob" "Bob"`,                 // not followed, no full name, take contact name
		`"charlie" "Charlie"`,         // followed but no full name, take contact name
		`"doug" "doug+test@keyba.se"`, // not followed, no full name, no contact name, take component
		`"alice" "CryptoAlice"`,       // followed and have full name, take full name
	}
	require.Equal(t, expected, displayResults(res))
}
