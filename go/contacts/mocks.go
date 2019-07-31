// +build !production

package contacts

import (
	"errors"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// Contacts package things that are useful for testing within contacts package
// but also in other packages if necessary (mostly service/contacts_test.go).

type MockLookupUser struct {
	UID      keybase1.UID
	Username string
	Fullname string
}

func MakeMockLookupUser(username, fullname string) MockLookupUser {
	return MockLookupUser{
		Username: username,
		UID:      libkb.UsernameToUID(username),
		Fullname: fullname,
	}
}

type MockContactsProvider struct {
	T                 libkb.TestingTB
	PhoneNumbers      map[keybase1.RawPhoneNumber]MockLookupUser
	PhoneNumberErrors map[keybase1.RawPhoneNumber]string
	Emails            map[keybase1.EmailAddress]MockLookupUser
	Following         map[keybase1.UID]bool
}

func MakeMockProvider(t libkb.TestingTB) *MockContactsProvider {
	return &MockContactsProvider{
		T:                 t,
		PhoneNumbers:      make(map[keybase1.RawPhoneNumber]MockLookupUser),
		PhoneNumberErrors: make(map[keybase1.RawPhoneNumber]string),
		Emails:            make(map[keybase1.EmailAddress]MockLookupUser),
		Following:         make(map[keybase1.UID]bool),
	}
}

func (c *MockContactsProvider) LookupAll(mctx libkb.MetaContext, emails []keybase1.EmailAddress,
	numbers []keybase1.RawPhoneNumber, userRegion keybase1.RegionCode) (ContactLookupResults, error) {

	ret := NewContactLookupResults()
	for _, email := range emails {
		if user, found := c.Emails[email]; found {
			ret.Results[MakeEmailLookupKey(email)] = ContactLookupResult{UID: user.UID}
		}
	}
	for _, number := range numbers {
		if user, found := c.PhoneNumbers[number]; found {
			ret.Results[MakePhoneLookupKey(number)] = ContactLookupResult{UID: user.UID}
		}
		if errStr, found := c.PhoneNumberErrors[number]; found {
			ret.Results[MakePhoneLookupKey(number)] = ContactLookupResult{Error: errStr}
		}
	}
	ret.ResolvedFreshness = 10 * 24 * time.Hour  // approx 10 days
	ret.UnresolvedFreshness = 1 * 24 * time.Hour // approx one day
	return ret, nil
}

func (c *MockContactsProvider) FindUsernames(mctx libkb.MetaContext, uids []keybase1.UID) (map[keybase1.UID]ContactUsernameAndFullName, error) {
	res := make(map[keybase1.UID]ContactUsernameAndFullName)
	uidSet := make(map[keybase1.UID]struct{}, len(uids))
	for _, v := range uids {
		uidSet[v] = struct{}{}
	}

	for _, v := range c.PhoneNumbers {
		if _, found := uidSet[v.UID]; found {
			res[v.UID] = ContactUsernameAndFullName{
				Username: v.Username,
				Fullname: v.Fullname,
			}
		}
	}
	for _, v := range c.Emails {
		if _, found := uidSet[v.UID]; found {
			res[v.UID] = ContactUsernameAndFullName{
				Username: v.Username,
				Fullname: v.Fullname,
			}
		}
	}
	return res, nil
}

func (c *MockContactsProvider) FindFollowing(mctx libkb.MetaContext, uids []keybase1.UID) (map[keybase1.UID]bool, error) {
	res := make(map[keybase1.UID]bool)
	for _, uid := range uids {
		res[uid] = c.Following[uid]
	}
	return res, nil
}

type ErrorContactsProvider struct {
	t libkb.TestingTB
}

func (c *ErrorContactsProvider) LookupAll(mctx libkb.MetaContext, emails []keybase1.EmailAddress,
	numbers []keybase1.RawPhoneNumber, userRegion keybase1.RegionCode) (ret ContactLookupResults, err error) {
	c.t.Errorf("Call to ErrorContactsProvider.LookupAll")
	err = errors.New("error contacts provider")
	return
}

func (c *ErrorContactsProvider) FindUsernames(mctx libkb.MetaContext, uids []keybase1.UID) (map[keybase1.UID]ContactUsernameAndFullName, error) {
	c.t.Errorf("Call to ErrorContactsProvider.FindUsernames")
	return nil, errors.New("mock error")
}

func (c *ErrorContactsProvider) FindFollowing(mctx libkb.MetaContext, uids []keybase1.UID) (map[keybase1.UID]bool, error) {
	c.t.Errorf("Call to ErrorContactsProvider.FindFollowing")
	return nil, errors.New("mock error")
}

func MakePhoneComponent(label string, phone string) keybase1.ContactComponent {
	num := keybase1.RawPhoneNumber(phone)
	return keybase1.ContactComponent{
		Label:       label,
		PhoneNumber: &num,
	}
}

func MakeEmailComponent(label string, email string) keybase1.ContactComponent {
	em := keybase1.EmailAddress(email)
	return keybase1.ContactComponent{
		Label: label,
		Email: &em,
	}
}

func MakeContact(name string, args ...keybase1.ContactComponent) keybase1.Contact {
	return keybase1.Contact{
		Name:       name,
		Components: args,
	}
}
