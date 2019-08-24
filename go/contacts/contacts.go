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
		value = strings.ToLower(strings.TrimSpace(value))
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
		if v.Resolved {
			if unamePkg, found := usernames[v.Uid]; found {
				v.Username = unamePkg.Username
				v.FullName = unamePkg.Fullname
			}
			if follow, found := following[v.Uid]; found {
				v.Following = follow
			}
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

	errorComponents := make(map[string]string)
	userUIDSet := make(map[keybase1.UID]struct{})

	// Discard duplicate components that come from contacts with the same
	// contact name and hold the same assertion. Will also skip same assertions
	// within one contact (duplicated components with same value and same or
	// different name)
	type contactAssertionPair struct {
		contactName    string
		componentValue string
	}
	contactAssertionsSeen := make(map[contactAssertionPair]struct{})

	if len(emailSet)+len(phoneSet) == 0 {
		// There is nothing to resolve.
		return res, nil
	}

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

	for contactIndex, contact := range contacts {
		var addLabel = len(contact.Components) > 1
		for _, component := range contact.Components {
			assertion, err := AssertionFromComponent(actx, component, "")
			if err != nil {
				mctx.Warning("Couldn't make assertion from component: %+v, %q: error: %s", component, component.ValueString(), err)
				continue
			}

			cvp := contactAssertionPair{contact.Name, assertion}
			if _, seen := contactAssertionsSeen[cvp]; seen {
				// Already seen the exact contact name and assertion.
				continue
			}

			if lookupRes, found := providerRes.FindComponent(component); found {
				if lookupRes.Error != "" {
					errorComponents[component.ValueString()] = lookupRes.Error
					mctx.Debug("Could not look up component: %+v, %q, error: %s", component, component.ValueString(), lookupRes.Error)
					continue
				}

				if lookupRes.Coerced != "" {
					// Create assertion again if server gave us coerced version.
					assertion, err = AssertionFromComponent(actx, component, lookupRes.Coerced)
					if err != nil {
						mctx.Warning("Couldn't make assertion from coerced value: %+v, %s: error: %s", component, lookupRes.Coerced, err)
						continue
					}
				}

				res = append(res, keybase1.ProcessedContact{
					ContactIndex: contactIndex,
					ContactName:  contact.Name,
					Component:    component,
					Resolved:     true,

					Uid: lookupRes.UID,

					Assertion: assertion,
				})

				userUIDSet[lookupRes.UID] = struct{}{}
			} else {
				res = append(res, keybase1.ProcessedContact{
					ContactIndex: contactIndex,
					ContactName:  contact.Name,
					Component:    component,
					Resolved:     false,

					DisplayName:  contact.Name,
					DisplayLabel: component.FormatDisplayLabel(addLabel),

					Assertion: assertion,
				})
			}

			// Mark as seen if we got this far.
			contactAssertionsSeen[cvp] = struct{}{}
		}
	}

	if len(res) > 0 {
		findUsernamesAndFollowing(mctx, provider, userUIDSet, res)

		// And now that we have Keybase names and following information, make a
		// decision about displayName and displayLabel.
		for i := range res {
			v := &res[i]
			if v.Resolved {
				v.DisplayName = v.Username
				switch {
				case v.Following && v.FullName != "":
					v.DisplayLabel = v.FullName
				case v.ContactName != "":
					v.DisplayLabel = v.ContactName
				default:
					v.DisplayLabel = v.Component.ValueString()
				}
			}
		}
	}

	return res, nil
}
