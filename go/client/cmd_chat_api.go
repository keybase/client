// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdChatAPI struct {
	libkb.Contextified
}

func newCmdChatAPI(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "api",
		Usage: "JSON api",
		Action: func(c *cli.Context) {
			cmd := &CmdChatAPI{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "api", c)
		},
	}
}

func (c *CmdChatAPI) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("api takes no arguments")
	}
	return nil
}

func (c *CmdChatAPI) Run() error {
	d := NewChatAPIDecoder(&ChatAPI{svcHandler: c})

	// TODO: flags for not using stdin, stdout

	if err := d.Decode(os.Stdin, os.Stdout); err != nil {
		return err
	}

	return nil
}

func (c *CmdChatAPI) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}

func (c *CmdChatAPI) ListV1() Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}

	// XXX plumb context through?
	inbox, err := client.GetInboxLocal(context.Background(), nil)
	if err != nil {
		return c.errReply(err)
	}

	fmt.Printf("inbox: %+v\n", inbox)

	// XXX convert inbox to something else...

	return Reply{}
}

func (c *CmdChatAPI) ReadV1(opts readOptionsV1) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}

	if opts.ConversationID == 0 {
		// resolve conversation id
	}

	arg := keybase1.GetThreadLocalArg{
		ConversationID: opts.ConversationID,
		MarkAsRead:     true,
	}
	// XXX plumb context through?
	thread, err := client.GetThreadLocal(context.Background(), arg)
	if err != nil {
		return c.errReply(err)
	}

	// XXX convert thread to something else...
	fmt.Printf("thread: %+v\n", thread)

	return Reply{}
}

func (c *CmdChatAPI) SendV1(opts sendOptionsV1) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	_ = client

	return Reply{}
}

func (c *CmdChatAPI) errReply(err error) Reply {
	return Reply{Error: &CallError{Message: err.Error()}}
}
