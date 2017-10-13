// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func CheckUserOrTeamName(ctx context.Context, g *libkb.GlobalContext, name string) (*keybase1.UserOrTeamResult, error) {
	resolver, err := newChatConversationResolver(g)
	if err != nil {
		return nil, err
	}
	var req chatConversationResolvingRequest
	req.ctx = new(chatConversationResolvingRequestContext)
	var tlfError error
	if tlfError = resolver.completeAndCanonicalizeTLFName(ctx, name, req); tlfError != nil {
		ret := keybase1.UserOrTeamResult_USER
		return &ret, nil
	}

	cli, teamError := GetTeamsClient(g)
	if teamError == nil {
		_, teamError = cli.TeamGet(ctx, keybase1.TeamGetArg{Name: name, ForceRepoll: false})
		if teamError == nil {
			ret := keybase1.UserOrTeamResult_TEAM
			return &ret, nil
		}
	}

	msg := `Unable to find conversation.
When considering %s as a username or a list of usernames, received error: %v.
When considering %s as a team name, received error: %v.`

	return nil, libkb.NotFoundError{Msg: fmt.Sprintf(msg, name, tlfError, name, teamError)}
}
