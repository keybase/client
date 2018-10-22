// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package emails

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func AddEmail(mctx libkb.MetaContext, email keybase1.EmailAddress) error {
	payload := make(libkb.JSONPayload)
	payload["email"] = email

	arg := libkb.APIArg{
		Endpoint:    "email/add",
		JSONPayload: payload,
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err := mctx.G().API.PostJSON(arg)
	return err
}

func DeleteEmail(mctx libkb.MetaContext, email keybase1.EmailAddress) error {
	payload := make(libkb.JSONPayload)
	payload["email"] = email

	arg := libkb.APIArg{
		Endpoint:    "email/delete",
		JSONPayload: payload,
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err := mctx.G().API.PostJSON(arg)
	return err
}

func SetPrimaryEmail(mctx libkb.MetaContext, email keybase1.EmailAddress) error {
	payload := make(libkb.JSONPayload)
	payload["email"] = email

	arg := libkb.APIArg{
		Endpoint:    "email/set-primary",
		JSONPayload: payload,
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err := mctx.G().API.PostJSON(arg)
	return err
}

func EditEmail(mctx libkb.MetaContext, oldEmail keybase1.EmailAddress, email keybase1.EmailAddress) error {
	payload := make(libkb.JSONPayload)
	payload["old_email"] = oldEmail
	payload["email"] = email

	arg := libkb.APIArg{
		Endpoint:    "email/edit",
		JSONPayload: payload,
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err := mctx.G().API.PostJSON(arg)
	return err
}

func SendVerificationEmail(mctx libkb.MetaContext, email keybase1.EmailAddress) error {
	payload := make(libkb.JSONPayload)
	payload["email"] = email

	arg := libkb.APIArg{
		Endpoint:    "email/send-verify",
		JSONPayload: payload,
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err := mctx.G().API.PostJSON(arg)
	return err
}

func GetEmails(mctx libkb.MetaContext) ([]keybase1.Email, error) {
	return libkb.LoadUserEmails(mctx.G())
}
