// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
// +build darwin windows

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func platformSpecificCtlCommands(cl *libcmdline.CommandLine, g *libkb.GlobalContext) []cli.Command {
	return nil
}
