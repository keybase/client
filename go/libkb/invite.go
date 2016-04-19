// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import keybase1 "github.com/keybase/client/go/protocol"

// InviteArg contains optional invitation arguments.
type InviteArg struct {
	Message    string
	NoteToSelf string
}

type Invitation struct {
	ID        string
	ShortCode string
}

func (i InviteArg) ToHTTPArgs() HTTPArgs {
	return HTTPArgs{
		"invitation_message": S{Val: i.Message},
		"note_to_self":       S{Val: i.NoteToSelf},
	}
}

func SendInvitation(g *GlobalContext, email string, arg InviteArg) (*Invitation, error) {
	hargs := arg.ToHTTPArgs()
	hargs["email"] = S{Val: email}
	return callSendInvitation(g, hargs)
}

func GenerateInvitationCode(g *GlobalContext, arg InviteArg) (*Invitation, error) {
	return callSendInvitation(g, arg.ToHTTPArgs())
}

func GenerateInvitationCodeForAssertion(g *GlobalContext, assertion keybase1.SocialAssertion, arg InviteArg) (*Invitation, error) {
	hargs := arg.ToHTTPArgs()
	hargs["assertion"] = S{Val: assertion.String()}
	return callSendInvitation(g, hargs)
}

func callSendInvitation(g *GlobalContext, params HTTPArgs) (*Invitation, error) {
	arg := APIArg{
		Endpoint:     "send_invitation",
		NeedSession:  true,
		Contextified: NewContextified(g),
		Args:         params,
	}
	res, err := g.API.Post(arg)
	if err != nil {
		return nil, err
	}

	var inv Invitation
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
