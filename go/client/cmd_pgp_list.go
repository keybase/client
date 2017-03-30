// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func NewCmdPGPList(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "list",
		Usage: "List the active PGP keys in your account.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPList{Contextified: libkb.NewContextified(g)}, "list", c)
		},
	}
}

type CmdPGPList struct {
	libkb.Contextified
}

func (s *CmdPGPList) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("pgp list")
	}

	return nil
}

func (s *CmdPGPList) Run() error {
	configCli, err := GetConfigClient(s.G())
	if err != nil {
		return err
	}

	currentStatus, err := configCli.GetCurrentStatus(context.TODO(), 0)
	if err != nil {
		return err
	}
	if !currentStatus.LoggedIn {
		return libkb.LoginRequiredError{}
	}

	userCli, err := GetUserClient(s.G())
	if err != nil {
		return err
	}

	publicKeys, err := userCli.LoadPublicKeys(context.TODO(), keybase1.LoadPublicKeysArg{Uid: currentStatus.User.Uid})
	if err != nil {
		return err
	}

	dui := s.G().UI.GetDumbOutputUI()
	for _, key := range publicKeys {
		if len(key.PGPFingerprint) == 0 {
			continue
		}
		dui.Printf("Keybase Key ID:  %s\n", key.KID)
		dui.Printf("PGP Fingerprint: %s\n", libkb.PGPFingerprintFromHexNoError(key.PGPFingerprint).ToQuads())
		if len(key.PGPIdentities) > 0 {
			dui.Printf("PGP Identities:\n")
			for _, id := range key.PGPIdentities {
				var comment string
				if len(id.Comment) > 0 {
					comment = fmt.Sprintf(" (%s)", id.Comment)
				}
				var email string
				if len(id.Email) > 0 {
					email = fmt.Sprintf(" <%s>", id.Email)
				}
				var revoked string
				if key.IsRevoked {
					revoked = "[Revoked] "
				}
				dui.Printf("   %s%s%s%s\n", revoked, id.Username, comment, email)
			}
		}
		dui.Printf("\n")
	}

	return nil
}

func (s *CmdPGPList) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
