// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
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

	cli, err := GetTeamsClient(g)
	if err != nil {
		return nil, err
	}
	_, err = cli.TeamGet(ctx, keybase1.TeamGetArg{Name: name, ForceRepoll: false})
	if err != nil {
		return nil, err
	}
	if err == nil {
		ret := keybase1.UserOrTeamResult_TEAM
		return &ret, nil
	}
	// concat errs intelligently..notfound NAW
	return nil, err
}
