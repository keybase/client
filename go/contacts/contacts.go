// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"errors"
	"strings"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func AssertionFromComponent(actx libkb.AssertionContext, c keybase1.ContactComponent, coercedValue string) (string, error) {
	key := c.AssertionType()
	var value string
	if coercedValue != "" {
		value = coercedValue
	} else {
		value = c.ValueString()
	}
	if key == "phone" {
		// ContactComponent has the PhoneNumber type which is E164 phone
		// number starting with `+`, we need to remove all non-digits for
		// the assertion.
		value = keybase1.PhoneNumberToAssertionValue(value)
	} else {
		value = strings.TrimSpace(strings.ToLower(value))
	}
	if key == "" || value == "" {
		return "", errors.New("invalid variant value in contact component")
	}
	ret, err := libkb.ParseAssertionURLKeyValue(actx, key, value, true /* strict */)
	if err != nil {
		return "", err
	}
	return ret.String(), nil
}

func findUsernamesAndFollowing(mctx libkb.MetaContext, provider ContactsProvider, uidSet map[keybase1.UID]struct{},
	contacts []keybase1.ProcessedContact) {

	uidList := make([]keybase1.UID, 0, len(uidSet))
	for uid := range uidSet {
		uidList = append(uidList, uid)
	}

	// Uidmap everything to get Keybase usernames and full names.
	usernames, err := provider.FindUsernames(mctx, uidList)
	if err != nil {
		mctx.Warning("Unable to find usernames for contacts: %s", err)
		usernames = make(map[keybase1.UID]ContactUsernameAndFullName)
	}

	// Get tracking info and set "Following" field for contacts.
	following, err := provider.FindFollowing(mctx, uidList)
	if err != nil {
		mctx.Warning("Unable to find tracking info for contacts: %s", err)
		following = make(map[keybase1.UID]bool)
	}

	for i := range contacts {
		v := &contacts[i]

		if unamePkg, found := usernames[v.Uid]; found {
			v.Username = unamePkg.Username
			v.FullName = unamePkg.Fullname
		}
		if follow, found := following[v.Uid]; found {
			v.Following = follow
		}
	}
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

	// Collect sets of email addresses and phones for provider lookup. Use sets
	// for deduplication.
	emailSet := make(map[keybase1.EmailAddress]struct{})
	phoneSet := make(map[keybase1.RawPhoneNumber]struct{})

	for _, contact := range contacts {
		for _, component := range contact.Components {
			if component.Email != nil {
				emailSet[*component.Email] = struct{}{}
			}
			if component.PhoneNumber != nil {
				phoneSet[*component.PhoneNumber] = struct{}{}
			}
		}
	}

	mctx.Debug("Going to look up %d emails and %d phone numbers using provider", len(emailSet), len(phoneSet))

	actx := externals.MakeStaticAssertionContext(mctx.Ctx())

	// Set of contactIndexes for all contacts that have at least one component
	// resolved. Once one component from a contact resolved, discard rest of
	// that contact's components.
	contactsFound := make(map[int]struct{})
	// Deduplicate on resolved UIDs - so if multiple contacts / components
	// resolve to the same user, only one should show up in the final list.
	usersFound := make(map[keybase1.UID]struct{})
	errorComponents := make(map[string]string)

	if len(emailSet) > 0 || len(phoneSet) > 0 {
		phones := make([]keybase1.RawPhoneNumber, 0, len(phoneSet))
		emails := make([]keybase1.EmailAddress, 0, len(emailSet))
		for phone := range phoneSet {
			phones = append(phones, phone)
		}
		for email := range emailSet {
			emails = append(emails, email)
		}
		providerRes, err := provider.LookupAll(mctx, emails, phones, regionCode)
		if err != nil {
			return res, err
		}

		// Loop twice, because:
		// - We want e-mails to go first, while still be in order of how the
		// contacts and components came in.
		// - We want only one resolution from each contact (if there is any),
		// but still, with emails going first and in order they came in within
		// contact.
		loopOnce := func(email bool) {
			for contactI, contact := range contacts {
				if _, alreadyResolved := contactsFound[contactI]; alreadyResolved {
					continue
				}

				for _, component := range contact.Components {
					if component.Email == nil && email {
						continue
					}

					if lookupRes, found := providerRes.FindComponent(component); found {
						if _, userFound := usersFound[lookupRes.UID]; userFound {
							// This user was already resolved by looking up another
							// component or another contact.

							// Make sure we mark it so it does not show up as
							// unresolved later on.
							contactsFound[contactI] = struct{}{}
							continue
						}

						if lookupRes.Error != "" {
							errorComponents[component.ValueString()] = lookupRes.Error
							mctx.Debug("Could not look up component: %+v, %q, error: %s", component, component.ValueString(), lookupRes.Error)
							continue
						}

						assertion, err := AssertionFromComponent(actx, component, lookupRes.Coerced)
						if err != nil {
							mctx.Warning("Couldn't make assertion from component: %+v, %q: error: %s", component, component.ValueString(), err)
							continue
						}

						res = append(res, keybase1.ProcessedContact{
							ContactIndex: contactI,
							ContactName:  contact.Name,
							Component:    component,
							InputCoerced: lookupRes.Coerced,
							Resolved:     true,
							Uid:          lookupRes.UID,
							Assertion:    assertion,
						})
						contactsFound[contactI] = struct{}{}
						usersFound[lookupRes.UID] = struct{}{}
					}
				}
			}
		}

		loopOnce(true /* email */)
		loopOnce(false /* email */)
	}

	if len(res) > 0 {
		findUsernamesAndFollowing(mctx, provider, usersFound, res)

		// And now that we have Keybase names and following information, make a
		// decision about displayName and displayLabel.
		for i := range res {
			v := &res[i]
			if !v.Resolved || v.Uid.IsNil() {
				// Sanity check - should only have resolveds now.
				return res, errors.New("found unresolved contact in display name processing")
			}

			v.DisplayName = v.Username
			if v.Following && v.FullName != "" {
				v.DisplayLabel = v.FullName
			} else if v.ContactName != "" {
				v.DisplayLabel = v.ContactName
			} else {
				v.DisplayLabel = v.Component.ValueString()
			}
		}
	}

	// Add all components from all contacts that were not resolved by any
	// component.

	// Discard duplicate components that come from contacts with the same
	// contact name and hold the same assertion. Will also skip same assertions
	// within one contact (duplicated components with same value and same or
	// different name)
	type contactAssertionPair struct {
		contactName    string
		componentValue string
	}
	contactAssertionsSeen := make(map[contactAssertionPair]struct{})

	for i, c := range contacts {
		if _, found := contactsFound[i]; found {
			continue
		}

		// Add e.g. "(Work)" labels to display labels if there are multiple
		// components in a contact.
		var addLabel = len(c.Components) > 1
		for _, component := range c.Components {
			if _, foundErr := errorComponents[component.ValueString()]; foundErr {
				// Do not return error components. If server said they are
				// invalid, they can't be used for SBS either.
				continue
			}

			assertion, err := AssertionFromComponent(actx, component, "")
			if err != nil {
				mctx.Warning("Couldn't make assertion from component: %+v, %q: error: %s", component, component.ValueString(), err)
				continue
			}

			cvp := contactAssertionPair{c.Name, assertion}
			if _, seen := contactAssertionsSeen[cvp]; seen {
				// Already seen the exact contact name and assertion.
				continue
			}

			res = append(res, keybase1.ProcessedContact{
				ContactIndex: i,
				ContactName:  c.Name,
				Component:    component,
				Resolved:     false,

				DisplayName:  c.Name,
				DisplayLabel: component.FormatDisplayLabel(addLabel),

				Assertion: assertion,
			})
			contactAssertionsSeen[cvp] = struct{}{}
		}
	}

	return res, nil
}
