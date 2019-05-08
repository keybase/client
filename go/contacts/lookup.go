// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type lookupArg struct {
	Email       string `json:"e,omitempty"`
	PhoneNumber string `json:"p,omitempty"`
}

type ContactLookupResult struct {
	UID     keybase1.UID `json:"uid,omitempty"`
	Coerced string       `json:"coerced,omitempty"`
}

type ContactLookupMap map[string]ContactLookupResult

func (r ContactLookupMap) FindComponent(component keybase1.ContactComponent) (res ContactLookupResult, found bool) {
	var key string
	switch {
	case component.Email != nil:
		key = fmt.Sprintf("e:%s", *component.Email)
	case component.PhoneNumber != nil:
		key = fmt.Sprintf("p:%s", *component.PhoneNumber)
	default:
		return res, false
	}
	res, found = r[key]
	return res, found
}

func makeEmailLookupKey(e keybase1.EmailAddress) string {
	return fmt.Sprintf("e:%s", string(e))
}

func makePhoneLookupKey(p keybase1.RawPhoneNumber) string {
	return fmt.Sprintf("p:%s", string(p))
}

type lookupRes struct {
	libkb.AppStatusEmbed
	Resolutions ContactLookupMap `json:"resolutions"`
}

func BulkLookupContacts(mctx libkb.MetaContext, emailsContacts []keybase1.EmailAddress,
	phoneNumberContacts []keybase1.RawPhoneNumber, userRegionCode keybase1.RegionCode) (ContactLookupMap, error) {

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
		return nil, err
	}
	return resp.Resolutions, err
}
