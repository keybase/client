// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production

package client

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// Devel commands for testing contact syncing.

func NwCmdContacts(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "contacts",
		Usage:        "commands for testing contact sync on desktop",
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			NewCmdContactLookup(cl, g),
			NewCmdSaveContacts(cl, g),
		},
	}
}

// ------------------------

// `keybase contacts lookup`

type CmdContactLookup struct {
	libkb.Contextified
}

func NewCmdContactLookup(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdContactLookup{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "lookup",
		Usage:        "resolve contact list",
		ArgumentHelp: "",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "lookup", c)
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

// ------------------------

// `keybase contacts save`

type CmdSaveContacts struct {
	libkb.Contextified
}

func NewCmdSaveContacts(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdSaveContacts{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "save",
		Usage:        "save contact list",
		ArgumentHelp: "",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "save", c)
		},
	}
}

func (c *CmdSaveContacts) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("command takes no arguments")
	}
	return nil
}

func (c *CmdSaveContacts) Run() error {
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
	_, err = cli.SaveContactList(context.Background(), keybase1.SaveContactListArg{
		Contacts: contacts,
	})
	if err != nil {
		return err
	}
	fmt.Fprintf(c.G().UI.GetTerminalUI().ErrorWriter(), "Contacts saved.\n")
	return nil
}

func (c *CmdSaveContacts) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
