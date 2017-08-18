// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdDeprovision struct {
	libkb.Contextified
	loggedIn bool
}

func NewCmdDeprovision(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "deprovision",
		Usage: "Revoke the current device, log out, and delete local state.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDeprovision{
				Contextified: libkb.NewContextified(g),
			}, "deprovision", c)
		},
	}
}

func (c *CmdDeprovision) Run() (err error) {
	protocols := []rpc.Protocol{
		NewLogUIProtocol(),
		NewSecretUIProtocol(c.G()),
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}

	username, err := c.getUsernameToDeprovision()
	if err != nil {
		return err
	}

	warning, err := c.getBigScaryWarning(username)
	if err != nil {
		return err
	}
	if err = c.G().UI.GetTerminalUI().PromptForConfirmation(warning); err != nil {
		return err
	}

	loginCli, err := GetLoginClient(c.G())
	if err != nil {
		return err
	}
	// XXX: This RPC deletes secret keys!
	return loginCli.Deprovision(context.TODO(), keybase1.DeprovisionArg{
		SessionID: 0,
		Username:  username,
		DoRevoke:  c.loggedIn,
	})
}

func (c *CmdDeprovision) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		Config:    true,
		KbKeyring: true,
	}
}

func (c *CmdDeprovision) ParseArgv(*cli.Context) error { return nil }

func (c *CmdDeprovision) getUsernameToDeprovision() (string, error) {
	configCli, err := GetConfigClient(c.G())
	if err != nil {
		return "", err
	}
	currentStatus, err := configCli.GetCurrentStatus(context.TODO(), 0)
	if err != nil {
		return "", err
	}

	// If there is a user logged in, just return that user.
	if currentStatus.LoggedIn {
		c.loggedIn = true
		return currentStatus.User.Username, nil
	}

	// Otherwise, find all the users in the config file.
	current, others, err := c.G().Env.GetConfig().GetAllUsernames()
	if err != nil {
		return "", err
	}
	allUsers := []libkb.NormalizedUsername{}
	if current.String() != "" {
		allUsers = append(allUsers, current)
	}
	allUsers = append(allUsers, others...)

	// If there's no one in the config file, there's nothing to do.
	if len(allUsers) == 0 {
		return "", fmt.Errorf("Can't find a user to deprovision.")
	}

	// If there's only one user in the config file, just pick that one.
	if len(allUsers) == 1 {
		return allUsers[0].String(), nil
	}

	fmt.Printf("No one currently logged in. Which user would you like to deprovision?\n")
	for i, user := range allUsers {
		fmt.Printf("%d) %s\n", i+1, user.String())
	}
	choice, err := PromptSelectionOrCancel(PromptDescriptorDeprovisionWhichUser,
		c.G().UI.GetTerminalUI(), "Choose a user", 1, len(allUsers))
	if err != nil {
		return "", err
	}
	return allUsers[choice-1].String(), nil
}

func (c *CmdDeprovision) getBigScaryWarning(username string) (string, error) {
	// If the user is logged out, warn that we won't revoke their keys.
	loggedOutWarning := ""
	if !c.loggedIn {
		loggedOutWarning = `

Note that you aren't currently logged in. That means we won't publicly revoke
this device's keys. To do that from another device, use 'keybase device remove'.`
	}

	// If the user has PGP secret keys in the SKBKeyring, print an additional warning.
	keyring, err := libkb.LoadSKBKeyring(libkb.NewNormalizedUsername(username), c.G())
	if err != nil {
		return "", err
	}
	pgpWarning := ""
	if keyring.HasPGPKeys() {
		pgpWarning = fmt.Sprintf(`

Also, the secret keyring you're about to delete contains PGP keys. To list them
or copy them, use %s.`, "`keybase pgp export`")
	}

	// TODO: Print a list of the other devices on the user's account.
	return fmt.Sprintf(`
%s, BE CAREFUL!  \('o')/

You are about to delete this device from your account, including its secret
keys. If you don't have any other devices, you'll lose access to your account
and all your data!%s%s

Proceed?`, username, loggedOutWarning, pgpWarning), nil
}
