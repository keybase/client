// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package phonenumbers

import (
	"errors"
	"testing"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type MockContactsProvider struct {
	phoneNumbers map[keybase1.RawPhoneNumber]keybase1.UID
}

func makeProvider() *MockContactsProvider {
	return &MockContactsProvider{
		phoneNumbers: make(map[keybase1.RawPhoneNumber]keybase1.UID),
	}
}

func (c *MockContactsProvider) LookupPhoneNumbers(mctx libkb.MetaContext, numbers []keybase1.RawPhoneNumber, userRegion keybase1.RegionCode) (res []ContactLookupResult, err error) {
	for _, number := range numbers {
		result := ContactLookupResult{}
		if uid, found := c.phoneNumbers[number]; found {
			result.Found = true
			result.UID = uid
		}
		res = append(res, result)
	}
	return res, nil
}

func (c *MockContactsProvider) LookupEmails(mctx libkb.MetaContext, emails []keybase1.EmailAddress) (res []ContactLookupResult, err error) {
	return res, errors.New("not implemented")
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

	// At least one of the components resolves the user, return just that one
	// contact.
	provider.phoneNumbers["+1111222"] = keybase1.UID("1")
	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	spew.Dump(res)
	require.Len(t, res, 1)
	require.Equal(t, "Joe", res[0].Name)
	require.Equal(t, "Home", res[0].Component.Label)
	require.NotNil(t, res[0].Component.PhoneNumber)
	require.EqualValues(t, "+1111222", *res[0].Component.PhoneNumber)
	require.Nil(t, res[0].Component.Email)
	require.Nil(t, res[0].Err)
	require.NotNil(t, res[0].Uid)
	require.EqualValues(t, "1", *res[0].Uid)

	// More than one components resolve, still return only the first resolution.
	// TODO: What if they resolve to different users?
	provider.phoneNumbers["+199123"] = keybase1.UID("1")
	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 1)
}
