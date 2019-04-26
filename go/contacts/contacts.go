// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type ContactLookupResult struct {
	Found bool
	UID   keybase1.UID
	// TODO: The following are not returned by lookup API endpoints.
	KeybaseUsername string
	KeybaseFullName string
}

type ContactsProvider interface {
	LookupPhoneNumbers(libkb.MetaContext, []keybase1.RawPhoneNumber, keybase1.RegionCode) ([]ContactLookupResult, error)
	LookupEmails(libkb.MetaContext, []keybase1.EmailAddress) ([]ContactLookupResult, error)
	FillUsernames(libkb.MetaContext, []keybase1.ProcessedContact)
}

// ResolveContacts resolves contacts with cache for UI. See API documentation
// in phone_numbers.avdl
//
// regionCode is optional, user region should be provided if it's known. It's
// used when resolving local phone numbers, they are assumed to be local to the
// user, so in the same region.
func ResolveContacts(mctx libkb.MetaContext, provider ContactsProvider, contacts []keybase1.Contact,
	regionCode keybase1.RegionCode) (res []keybase1.ProcessedContact, err error) {

	type contactRef struct {
		// Use this struct to point back from phoneNumbers or emails entry to
		// our contacts list.
		contactIndex   int
		componentIndex int
	}
	var phoneNumbers []keybase1.RawPhoneNumber
	var phoneComps []contactRef
	var emails []keybase1.EmailAddress
	var emailComps []contactRef
	for contactI, k := range contacts {
		for compI, component := range k.Components {
			if component.Email != nil {
				emails = append(emails, *component.Email)
				emailComps = append(emailComps, contactRef{
					contactIndex:   contactI,
					componentIndex: compI,
				})
			}
			if component.PhoneNumber != nil {
				phoneNumbers = append(phoneNumbers, *component.PhoneNumber)
				phoneComps = append(phoneComps, contactRef{
					contactIndex:   contactI,
					componentIndex: compI,
				})
			}
		}
	}

	// contactIndex -> true for all contacts that have at least one compoonent resolved.
	contactsFound := make(map[int]struct{})
	usersFound := make(map[keybase1.UID]struct{})

	insertResult := func(lookupRes ContactLookupResult, toContact contactRef) {
		contactsFound[toContact.contactIndex] = struct{}{}

		if _, found := usersFound[lookupRes.UID]; found {
			// This user was already resolved by looking up another
			// component or another contact.
			return
		}
		contact := contacts[toContact.contactIndex]
		component := contact.Components[toContact.componentIndex]

		usersFound[lookupRes.UID] = struct{}{}

		res = append(res, keybase1.ProcessedContact{
			DisplayName:  lookupRes.KeybaseUsername, // if found, return username
			ContactIndex: toContact.contactIndex,
			Component:    component,
			Resolved:     true,
			Uid:          lookupRes.UID,
			Username:     lookupRes.KeybaseUsername,
		})
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

	if len(res) > 0 {
		// Uidmap everything to get Keybase usernames and full names.

		// TODO: The uidmapper part might not be needed if we change the lookup
		// endpoints to return usernames and full names. This is fine since
		// phone/email is server trust, and also UIDMapper trusts sever for
		// full names anyway.
		provider.FillUsernames(mctx, res)
	}

	// Add all components from all contacts that were not resolved by any
	// component.
	for i, c := range contacts {
		if _, found := contactsFound[i]; found {
			continue
		}

		for _, component := range c.Components {
			res = append(res, keybase1.ProcessedContact{
				DisplayName: c.Name, // contact not resolved, return name from contact list
				Component:   component,
				Resolved:    false,
			})
		}
	}

	return res, nil
}
