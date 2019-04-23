// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"errors"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type ContactLookupResult struct {
	Found    bool
	UID      keybase1.UID
	Username string
}

type ContactsProvider interface {
	LookupPhoneNumbers(libkb.MetaContext, []keybase1.RawPhoneNumber, keybase1.RegionCode) ([]ContactLookupResult, error)
	LookupEmails(libkb.MetaContext, []keybase1.EmailAddress) ([]ContactLookupResult, error)
}

type CachedContactsProvider struct {
}

func (c *CachedContactsProvider) LookupPhoneNumbers(mctx libkb.MetaContext, numbers []keybase1.RawPhoneNumber,
	userRegion keybase1.RegionCode) (res []ContactLookupResult, err error) {
	// TODO: Call BulkLookupPhoneNumbers
	return res, errors.New("not implemented")
}

func (c *CachedContactsProvider) LookupEmails(mctx libkb.MetaContext, emails []keybase1.EmailAddress) (res []ContactLookupResult, err error) {
	// TODO: Call something that bulk looks up emails, needs to add API to
	// kbweb.
	return res, errors.New("not implemented")
}

// ResolveContacts resolves contacts with cache for UI. See API documentation
// in phone_numbers.avdl
//
// regionCode is optional, user region should be provided if it's know. It's
// used when resolving local phone numbers, they are assumed to be local to the
// user, so in the same region.
func ResolveContacts(mctx libkb.MetaContext, provider ContactsProvider, contacts []keybase1.Contact,
	regionCode keybase1.RegionCode) (res []keybase1.ResolvedContact, err error) {

	type phoneToContact struct {
		// Use this struct to point back from phoneNumbers entry (input to
		// LookupPhoneNumbers) to our contacts list.
		contactIndex   int
		componentIndex int
	}
	var phoneNumbers []keybase1.RawPhoneNumber
	var phoneComps []phoneToContact
	var emails []keybase1.EmailAddress
	var emailComps []phoneToContact
	for contactI, k := range contacts {
		for compI, component := range k.Components {
			if component.PhoneNumber != nil {
				phoneNumbers = append(phoneNumbers, *component.PhoneNumber)
				phoneComps = append(phoneComps, phoneToContact{
					contactIndex:   contactI,
					componentIndex: compI,
				})
			}
			if component.Email != nil {
				emails = append(emails, *component.Email)
				emailComps = append(emailComps, phoneToContact{
					contactIndex:   contactI,
					componentIndex: compI,
				})
			}
		}
	}

	// contactIndex -> true for all contacts that have at least one compoonent resolved.
	contactsFound := make(map[int]bool)
	usersFound := make(map[keybase1.UID]bool)

	insertResult := func(lookupRes ContactLookupResult, toContact phoneToContact) {
		contactsFound[toContact.contactIndex] = true

		if _, found := usersFound[lookupRes.UID]; found {
			// This user was already resolved by looking up another
			// component or another contact.
			return
		}
		contact := contacts[toContact.contactIndex]
		component := contact.Components[toContact.componentIndex]

		usersFound[lookupRes.UID] = true

		res = append(res, keybase1.ResolvedContact{
			Name:         lookupRes.Username, // if found, return username
			ContactIndex: toContact.contactIndex,
			Component:    component,
			Resolved:     true,
			Uid:          lookupRes.UID,
			Username:     lookupRes.Username,
		})
	}

	if len(phoneNumbers) > 0 {
		phoneRes, err := provider.LookupPhoneNumbers(mctx, phoneNumbers, regionCode)
		if err != nil {
			return res, err
		}

		for i, k := range phoneRes {
			if !k.Found {
				continue
			}

			insertResult(k, phoneComps[i])
		}
	}

	if len(emails) > 0 {
		emailRes, err := provider.LookupEmails(mctx, emails)
		if err != nil {
			return res, err
		}

		for i, k := range emailRes {
			if !k.Found {
				continue
			}

			insertResult(k, emailComps[i])
		}
	}

	// Add all components from all contacts that were not resolved by any
	// component.
	for i, c := range contacts {
		if _, found := contactsFound[i]; found {
			continue
		}

		for _, component := range c.Components {
			res = append(res, keybase1.ResolvedContact{
				Name:      c.Name, // contact not resolved, return name from contact list
				Component: component,
				Resolved:  false,
			})
		}
	}

	return res, nil
}
