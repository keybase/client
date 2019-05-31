// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package emails

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func AddEmail(mctx libkb.MetaContext, email keybase1.EmailAddress, visibility keybase1.IdentityVisibility) error {
	payload := make(libkb.JSONPayload)
	payload["email"] = email
	payload["visibility"] = visibility

	arg := libkb.APIArg{
		Endpoint:    "email/add",
		JSONPayload: payload,
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err := mctx.G().API.PostJSON(mctx, arg)
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

	_, err := mctx.G().API.PostJSON(mctx, arg)
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

	_, err := mctx.G().API.PostJSON(mctx, arg)
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

	_, err := mctx.G().API.PostJSON(mctx, arg)
	return err
}

func SetVisibilityEmail(mctx libkb.MetaContext, email keybase1.EmailAddress, visibility keybase1.IdentityVisibility) error {
	payload := make(libkb.JSONPayload)
	payload["email"] = email
	payload["visibility"] = visibility

	arg := libkb.APIArg{
		Endpoint:    "email/set-visibility",
		JSONPayload: payload,
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err := mctx.G().API.PostJSON(mctx, arg)
	return err
}

func SetVisibilityAllEmail(mctx libkb.MetaContext, visibility keybase1.IdentityVisibility) error {
	payload := make(libkb.JSONPayload)
	payload["visibility"] = visibility
	payload["all"] = true

	arg := libkb.APIArg{
		Endpoint:    "email/set-visibility",
		JSONPayload: payload,
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err := mctx.G().API.PostJSON(mctx, arg)
	return err
}

func GetEmails(mctx libkb.MetaContext) ([]keybase1.Email, error) {
	return libkb.LoadUserEmails(mctx)
}
