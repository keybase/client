// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type cmdUploadAvatar struct {
	libkb.Contextified
	filename string
	teamname string
}

func newCmdUploadAvatar(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdUploadAvatar{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "upload-avatar",
		ArgumentHelp: "[--team <teamname>] <filename>",
		Usage:        "Upload avatar for user or team",
		Description:  "Upload avatar for user or team",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "team",
				Usage: "Uploads avatar for given team instead of user.",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "upload-avatar", c)
		},
	}
}

func (c *cmdUploadAvatar) ParseArgv(ctx *cli.Context) error {
	args := ctx.Args()
	if len(args) > 1 {
		return errors.New("one filename required, multiple arguments found")
	} else if len(args) == 0 {
		return errors.New("filename argument not found")
	}

	c.filename = args[0]
	c.teamname = ctx.String("team")
	return nil
}

func (c *cmdUploadAvatar) Run() error {

	// arg := keybase1.UploadUserAvatarArg{
	// 	Filename: c.filename,
	// }
	if c.teamname != "" {
		cli, err := GetTeamsClient(c.G())
		if err != nil {
			return err
		}

		arg := keybase1.UploadTeamAvatarArg{
			Teamname: c.teamname,
			Filename: c.filename,
		}
		return cli.UploadTeamAvatar(context.Background(), arg)
	}

	cli, err := GetUserClient(c.G())
	if err != nil {
		return err
	}
	return cli.UploadUserAvatar(context.Background(), c.filename)
}

func (c *cmdUploadAvatar) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
