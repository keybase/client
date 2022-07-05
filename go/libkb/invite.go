// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"path"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// InviteArg contains optional invitation arguments.
type InviteArg struct {
	Message    string
	NoteToSelf string
}

type Invitation struct {
	ID        string
	ShortCode string
	Throttled bool
}

func (i Invitation) Link() string {
	if i.Throttled {
		return ""
	}
	return path.Join(CanonicalHost, "inv", i.ID[0:10])
}

func (i InviteArg) ToHTTPArgs() HTTPArgs {
	return HTTPArgs{
		"invitation_message": S{Val: i.Message},
		"note_to_self":       S{Val: i.NoteToSelf},
	}
}

func SendInvitation(mctx MetaContext, email string, arg InviteArg) (*Invitation, error) {
	hargs := arg.ToHTTPArgs()
	hargs["email"] = S{Val: email}
	return callSendInvitation(mctx, hargs)
}

func GenerateInvitationCode(mctx MetaContext, arg InviteArg) (*Invitation, error) {
	return callSendInvitation(mctx, arg.ToHTTPArgs())
}

func GenerateInvitationCodeForAssertion(mctx MetaContext, assertion keybase1.SocialAssertion, arg InviteArg) (*Invitation, error) {
	hargs := arg.ToHTTPArgs()
	hargs["assertion"] = S{Val: assertion.String()}
	return callSendInvitation(mctx, hargs)
}

func callSendInvitation(mctx MetaContext, params HTTPArgs) (*Invitation, error) {
	arg := APIArg{
		Endpoint:       "send_invitation",
		SessionType:    APISessionTypeREQUIRED,
		Args:           params,
		AppStatusCodes: []int{SCOk, SCThrottleControl},
	}
	res, err := mctx.G().API.Post(mctx, arg)
	if err != nil {
		return nil, err
	}

	var inv Invitation

	if res.AppStatus.Code == SCThrottleControl {
		mctx.Debug("send_invitation returned SCThrottleControl: user is out of invites")
		inv.Throttled = true
		return &inv, nil
	}

	inv.ID, err = res.Body.AtKey("invitation_id").GetString()
	if err != nil {
		return nil, err
	}
	inv.ShortCode, err = res.Body.AtKey("short_code").GetString()
	if err != nil {
		return nil, err
	}
	return &inv, nil
}
