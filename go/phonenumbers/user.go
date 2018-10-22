// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package phonenumbers

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// AddPhoneNumber calls API to add phone number to currently logged in account.
func AddPhoneNumber(mctx libkb.MetaContext, phoneNumber keybase1.PhoneNumber) error {
	payload := make(libkb.JSONPayload)
	payload["phone_number"] = phoneNumber

	arg := libkb.APIArg{
		Endpoint:    "user/phone_numbers",
		JSONPayload: payload,
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err := mctx.G().API.PostJSON(arg)
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

	_, err := mctx.G().API.PostJSON(arg)
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
	err := mctx.G().API.GetDecode(arg, &resp)
	if err != nil {
		return nil, err
	}
	return resp.PhoneNumbers, nil
}

func DeletePhoneNumber(mctx libkb.MetaContext, phoneNumber keybase1.PhoneNumber) error {
	payload := make(libkb.JSONPayload)
	payload["phone_number"] = phoneNumber

	arg := libkb.APIArg{
		Endpoint:    "user/phone_numbers",
		JSONPayload: payload,
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err := mctx.G().API.Delete(arg)
	return err
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

	_, err := mctx.G().API.PostJSON(arg)
	return err
}
