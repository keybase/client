// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package phonenumbers

import (
	"github.com/keybase/client/go/contacts"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// AddPhoneNumber calls API to add phone number to currently logged in account.
func AddPhoneNumber(mctx libkb.MetaContext, phoneNumber keybase1.PhoneNumber, visibility keybase1.IdentityVisibility) error {
	// First try to delete if we have a superseded item for this phone number already
	nums, err := GetPhoneNumbers(mctx)
	if err == nil {
		for _, num := range nums {
			if num.Superseded && num.PhoneNumber == phoneNumber {
				err = DeletePhoneNumber(mctx, num.PhoneNumber)
				if err != nil {
					mctx.Warning("error deleting superseded number on add: %s", err)
				}
			}
		}
	} else {
		mctx.Warning("error fetching numbers on add: %s", err)
	}

	payload := make(libkb.JSONPayload)
	payload["phone_number"] = phoneNumber
	payload["visibility"] = visibility

	arg := libkb.APIArg{
		Endpoint:    "user/phone_numbers",
		JSONPayload: payload,
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err = mctx.G().API.PostJSON(mctx, arg)
	return err
}

// VerifyPhoneNumber calls API to verify previously added phone number using
// verification code.
func VerifyPhoneNumber(mctx libkb.MetaContext, phoneNumber keybase1.PhoneNumber, code string) error {
	payload := make(libkb.JSONPayload)
	payload["phone_number"] = phoneNumber
	payload["verification_code"] = code

	arg := libkb.APIArg{
		Endpoint:    "user/phone_number_verify",
		JSONPayload: payload,
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err := mctx.G().API.PostJSON(mctx, arg)
	return err
}

type phoneNumbersResponse struct {
	libkb.AppStatusEmbed
	PhoneNumbers []keybase1.UserPhoneNumber `json:"phone_numbers"`
}

// GetPhoneNumbers calls API to fetch list of phone numbers attached to
// currently logged user.
func GetPhoneNumbers(mctx libkb.MetaContext) ([]keybase1.UserPhoneNumber, error) {
	arg := libkb.APIArg{
		Endpoint:    "user/phone_numbers",
		SessionType: libkb.APISessionTypeREQUIRED,
	}
	var resp phoneNumbersResponse
	err := mctx.G().API.GetDecode(mctx, arg, &resp)
	if err != nil {
		return nil, err
	}
	return resp.PhoneNumbers, nil
}

func clearPhoneNumbersFromContactCache(mctx libkb.MetaContext, phoneNumber keybase1.PhoneNumber) {
	// Now remove this number from contact lookup cache and from synced
	// contacts.
	cache := contacts.NewContactCacheStore(mctx.G())
	cache.RemoveContactsCacheEntries(mctx, &phoneNumber, nil /* email */)
	if sync := mctx.G().SyncedContactList; sync != nil {
		sync.UnresolveContactsWithComponent(mctx, &phoneNumber, nil /* email */)
	}
}

func DeletePhoneNumber(mctx libkb.MetaContext, phoneNumber keybase1.PhoneNumber) error {
	payload := make(libkb.JSONPayload)
	payload["phone_number"] = phoneNumber

	arg := libkb.APIArg{
		Endpoint:    "user/phone_numbers",
		JSONPayload: payload,
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err := mctx.G().API.Delete(mctx, arg)
	if err != nil {
		return err
	}
	clearPhoneNumbersFromContactCache(mctx, phoneNumber)
	return nil
}

func SetVisibilityPhoneNumber(mctx libkb.MetaContext, phoneNumber keybase1.PhoneNumber, visibility keybase1.IdentityVisibility) error {
	payload := make(libkb.JSONPayload)
	payload["phone_number"] = phoneNumber
	payload["visibility"] = visibility

	arg := libkb.APIArg{
		Endpoint:    "user/phone_number_visibility",
		JSONPayload: payload,
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err := mctx.G().API.PostJSON(mctx, arg)
	if err != nil {
		return nil
	}
	if visibility == keybase1.IdentityVisibility_PRIVATE {
		clearPhoneNumbersFromContactCache(mctx, phoneNumber)
	}
	return nil
}

func SetVisibilityAllPhoneNumber(mctx libkb.MetaContext, visibility keybase1.IdentityVisibility) error {
	payload := make(libkb.JSONPayload)
	payload["visibility"] = visibility
	payload["all"] = true

	arg := libkb.APIArg{
		Endpoint:    "user/phone_number_visibility",
		JSONPayload: payload,
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err := mctx.G().API.PostJSON(mctx, arg)
	return err
}
