// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"errors"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type ContactLookupResult struct {
	Found bool
	UID   keybase1.UID
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

	if len(contacts) == 0 {
		mctx.Debug("`contacts` is empty, nothing to resolve")
		return res, nil
	}

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

	mctx.Debug("Going to look up %d emails and %d phone numbers", len(emails), len(phoneNumbers))

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
			ContactIndex: toContact.contactIndex,
			ContactName:  contact.Name,
			Component:    component,
			Resolved:     true,
			Uid:          lookupRes.UID,
			Following:    true, // assume following=true for now because this creates better display label.

			// following, username (TODO???), and full name are filled later.
			// unless endpoints start providing this data through
			// ContactLookupResult
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
		// full names anyway. Also might need to return follow information.
		provider.FillUsernames(mctx, res)

		// And now that we have Keybase names and following information, make a
		// decision about displayName and displayLabel.
		for i, v := range res {
			if !v.Resolved || v.Uid.IsNil() {
				// Sanity check - should only have resolveds now.
				return res, errors.New("found unresolved contact in display name processing")
			}

			res[i].DisplayName = v.Username
			if v.Following && v.FullName != "" {
				res[i].DisplayLabel = v.FullName
			} else if v.ContactName != "" {
				res[i].DisplayLabel = v.ContactName
			} else {
				res[i].DisplayLabel = v.Component.ValueString()
			}
		}
	}

	// Add all components from all contacts that were not resolved by any
	// component.
	for i, c := range contacts {
		if _, found := contactsFound[i]; found {
			continue
		}

		for _, component := range c.Components {
			res = append(res, keybase1.ProcessedContact{
				ContactIndex: i,
				ContactName:  c.Name,
				Component:    component,
				Resolved:     false,

				DisplayName:  c.Name,
				DisplayLabel: component.ValueString(),
			})
		}
	}

	return res, nil
}
