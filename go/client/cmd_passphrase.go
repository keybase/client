// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
)

func NewCmdPassphrase(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "passphrase",
		Usage: "Change or recover your keybase passphrase",
		Subcommands: []cli.Command{
			NewCmdPassphraseChange(cl),
			NewCmdPassphraseRecover(cl),
		},
	}
}
