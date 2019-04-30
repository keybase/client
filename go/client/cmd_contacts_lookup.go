// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"errors"
	"io/ioutil"
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdContactLookup struct {
	libkb.Contextified
}

func NewCmdContactLookup(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdContactLookup{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name: "contact-lookup",
		// No usage field, command is hidden in `help`.
		ArgumentHelp: "",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "contact-lookup", c)
		},
	}
}

func (c *CmdContactLookup) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("command takes no arguments")
	}
	return nil
}

func (c *CmdContactLookup) Run() error {
	cli, err := GetContactsClient(c.G())
	if err != nil {
		return err
	}
	bytes, err := ioutil.ReadAll(os.Stdin)
	if err != nil {
		return err
	}
	var contacts []keybase1.Contact
	err = json.Unmarshal(bytes, &contacts)
	if err != nil {
		return err
	}
	ret, err := cli.LookupContactList(context.Background(), keybase1.LookupContactListArg{
		Contacts: contacts,
	})
	if err != nil {
		return err
	}
	s, err := json.MarshalIndent(ret, "", "  ")
	if err != nil {
		return err
	}
	c.G().UI.GetTerminalUI().Printf("%s", s)
	return nil
}

func (c *CmdContactLookup) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
