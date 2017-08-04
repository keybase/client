// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
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
	_, err = teams.GetForTeamManagementByStringName(ctx, g, name, false)
	if err == nil {
		ret := keybase1.UserOrTeamResult_TEAM
		return &ret, nil
	}
	// concat errs intelligently..notfound NAW
	return nil, err
}
