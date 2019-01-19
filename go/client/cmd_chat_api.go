// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdChatAPI struct {
	libkb.Contextified
	cmdAPI
}

func newCmdChatAPI(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return newCmdAPI(cl, NewCmdChatAPIRunner(g), "JSON API", chatAPIDoc)
}

func NewCmdChatAPIRunner(g *libkb.GlobalContext) *CmdChatAPI {
	return &CmdChatAPI{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdChatAPI) Run() error {
	h := newChatServiceHandler(c.G())
	d := NewChatAPIVersionHandler(&ChatAPI{svcHandler: h, indent: c.indent})

	return c.runHandler(d)
}
