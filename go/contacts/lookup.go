// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type lookupArg struct {
	Email       string `json:"e,omitempty"`
	PhoneNumber string `json:"p,omitempty"`
}

type ContactLookupResult struct {
	UID     keybase1.UID `json:"uid,omitempty"`
	Coerced bool         `json:"coerced,omitempty"`
}

type ContactLookupMap map[string]ContactLookupResult

type BulkLookupResult struct {
	Emails       ContactLookupMap `json:"emails"`
	PhoneNumbers ContactLookupMap `json:"phone_numbers"`
}

func (r *BulkLookupResult) FindComponent(component keybase1.ContactComponent) (res ContactLookupResult, found bool) {
	switch {
	case component.Email != nil:
		res, found = r.Emails[string(*component.Email)]
	case component.PhoneNumber != nil:
		res, found = r.PhoneNumbers[string(*component.PhoneNumber)]
	}
	return res, found
}

func MakeBulkLookupResult() BulkLookupResult {
	return BulkLookupResult{
		Emails:       make(ContactLookupMap),
		PhoneNumbers: make(ContactLookupMap),
	}
}

type lookupRes struct {
	libkb.AppStatusEmbed
	BulkLookupResult
}

func BulkLookupContacts(mctx libkb.MetaContext, emailsContacts []keybase1.EmailAddress,
	phoneNumberContacts []keybase1.RawPhoneNumber, userRegionCode keybase1.RegionCode) (BulkLookupResult, error) {

	lookups := make([]lookupArg, 0, len(phoneNumberContacts)+len(emailsContacts))
	for _, v := range phoneNumberContacts {
		lookups = append(lookups, lookupArg{PhoneNumber: string(v)})
	}
	for _, v := range emailsContacts {
		lookups = append(lookups, lookupArg{Email: string(v)})
	}

	payload := make(libkb.JSONPayload)
	payload["contacts"] = lookups
	if !userRegionCode.IsNil() {
		payload["user_region_code"] = userRegionCode
	}

	arg := libkb.APIArg{
		Endpoint:    "contacts/lookup",
		JSONPayload: payload,
		SessionType: libkb.APISessionTypeREQUIRED,
	}
	var resp lookupRes
	err := mctx.G().API.PostDecode(mctx, arg, &resp)
	if err != nil {
		return BulkLookupResult{}, err
	}
	return resp.BulkLookupResult, nil
}
