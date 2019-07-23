// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func BulkLookupContacts(mctx libkb.MetaContext, emailsContacts []keybase1.EmailAddress,
	phoneNumberContacts []keybase1.RawPhoneNumber, userRegionCode keybase1.RegionCode) (ContactLookupMap, error) {

	type lookupArg struct {
		Email       string `json:"e,omitempty"`
		PhoneNumber string `json:"p,omitempty"`
	}

	type lookupRes struct {
		libkb.AppStatusEmbed
		Resolutions ContactLookupMap `json:"resolutions"`
	}

	lookups := make([]lookupArg, len(phoneNumberContacts)+len(emailsContacts))
	for i, phoneNumber := range phoneNumberContacts {
		lookups[i] = lookupArg{PhoneNumber: string(phoneNumber)}
	}
	for i, email := range emailsContacts {
		lookups[i] = lookupArg{Email: string(email)}
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
