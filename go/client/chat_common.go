// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
)

func CheckUserOrTeamName(ctx context.Context, g *libkb.GlobalContext, name string) (*keybase1.UserOrTeamResult, error) {
	userCli, err := GetUserClient(g)
	if err != nil {
		return nil, err
	}
	_, err = userCli.LoadUserByName(ctx, keybase1.LoadUserByNameArg{Username: name})
	if err == nil {
		ret := keybase1.UserOrTeamResult_USER
		return &ret, nil
	}
	_, notFound := err.(libkb.NotFoundError)
	_, invalidUsername := err.(libkb.BadUsernameError)
	if !(notFound || invalidUsername || strings.HasPrefix(err.Error(), "bad keybase username")) {
		return nil, err
	}

	cli, err := GetTeamsClient(g)
	if err != nil {
		return nil, err
	}
	_, err = cli.TeamGet(ctx, keybase1.TeamGetArg{Name: name, ForceRepoll: false})
	if err == nil {
		ret := keybase1.UserOrTeamResult_TEAM
		return &ret, nil
	}
	_, notFound = err.(teams.TeamDoesNotExistError)
	if !notFound && !strings.HasSuffix(err.Error(), "does not exist") && !strings.HasPrefix(err.Error(), "invalid team name") {
		return nil, err
	}

	tlfCli, err := GetTlfClient(g)
	if err != nil {
		return nil, err
	}
	tlfQuery := keybase1.TLFQuery{
		TlfName:          name,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	}
	_, err = tlfCli.CompleteAndCanonicalizePrivateTlfName(ctx, tlfQuery)
	if err == nil {
		ret := keybase1.UserOrTeamResult_USER
		return &ret, nil
	}
	_, notFound = err.(libkb.NotFoundError)
	_, badTLFName := err.(utils.BadTLFNameError)
	_, noSuchUser := err.(utils.NoSuchUserError)
	if !notFound && !badTLFName && !noSuchUser {
		return nil, err
	}
	return nil, libkb.NotFoundError{Msg: fmt.Sprintf("%s is neither a valid username, list of usernames, or team name.", name)}
}
