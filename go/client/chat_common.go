// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"strings"

	"golang.org/x/net/context"

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
	_, okNotFound := err.(libkb.NotFoundError)
	_, okInvalidUsername := err.(libkb.BadUsernameError)
	if !(okNotFound || okInvalidUsername) {
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

	ase, okNet := err.(libkb.AppStatusError)
	_, okNotFound = err.(teams.TeamDoesNotExistError)

	if !(okNet && keybase1.StatusCode(ase.Code) == keybase1.StatusCode_SCTeamNotFound) && !okNotFound && !strings.HasSuffix(err.Error(), "does not exist") {
		return nil, err
	}

	return nil, libkb.NotFoundError{Msg: fmt.Sprintf("%s is neither a username or a team name.", name)}
}
