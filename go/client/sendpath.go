// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"os"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func SendPath(g *libkb.GlobalContext) error {
	cli, err := GetConfigClient(g)
	if err != nil {
		return err
	}

	arg := keybase1.SetPathArg{
		Path: os.Getenv("PATH"),
	}
	return cli.SetPath(context.TODO(), arg)
}
