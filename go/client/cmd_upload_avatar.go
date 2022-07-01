// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"path/filepath"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type cmdUploadAvatar struct {
	libkb.Contextified
	Filename             string
	Team                 string
	SkipChatNotification bool
}

func newCmdUploadAvatar(cl *libcmdline.CommandLine, g *libkb.GlobalContext, hidden bool) cli.Command {
	cmd := &cmdUploadAvatar{
		Contextified: libkb.NewContextified(g),
	}
	clicmd := cli.Command{
		Name:         "upload-avatar",
		ArgumentHelp: "[--team <teamname>] <filename>",
		Description:  "Upload avatar for user or team",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "team",
				Usage: "Uploads avatar for given team instead of user.",
			},
			cli.BoolFlag{
				Name:  "s, skip-chat-message",
				Usage: "skip chat message when changing avatar for a team",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "upload-avatar", c)
		},
	}
	if !hidden {
		clicmd.Usage = "Upload avatar for user or team"
	}

	return clicmd
}

func (c *cmdUploadAvatar) ParseArgv(ctx *cli.Context) error {
	args := ctx.Args()
	if len(args) > 1 {
		return errors.New("one filename required, multiple arguments found")
	} else if len(args) == 0 {
		return errors.New("filename argument not found")
	}

	c.Filename = args[0]
	c.Team = ctx.String("team")
	c.SkipChatNotification = ctx.Bool("skip-chat-message")
	return nil
}

func (c *cmdUploadAvatar) Run() error {
	path, err := filepath.Abs(c.Filename)
	if err != nil {
		return err
	}

	if c.Team != "" {
		cli, err := GetTeamsClient(c.G())
		if err != nil {
			return err
		}

		arg := keybase1.UploadTeamAvatarArg{
			Teamname:             c.Team,
			Filename:             path,
			SendChatNotification: !c.SkipChatNotification,
		}
		return cli.UploadTeamAvatar(context.Background(), arg)
	}

	cli, err := GetUserClient(c.G())
	if err != nil {
		return err
	}
	arg := keybase1.UploadUserAvatarArg{
		Filename: path,
	}
	return cli.UploadUserAvatar(context.Background(), arg)
}

func (c *cmdUploadAvatar) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
