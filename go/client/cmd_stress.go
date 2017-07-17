// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production

// this command is only for testing purposes
package client

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func NewCmdStress(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "stress",
		Usage: "Run some stressful commands on the service (devel only)",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdStress{}, "stress", c)
		},
		Flags: []cli.Flag{
			cli.IntFlag{
				Name:  "n",
				Usage: "Number of concurrent users to simulate.",
			},
		},
	}
}

// CmdStress is used for testing concurrency in the daemon.
// Build the daemon with `-race`, then run this command.
type CmdStress struct {
	numUsers   int
	passphrase string
}

func (c *CmdStress) rpcClient() (*rpc.Client, error) {
	cli, _, err := GetRPCClient()
	if err != nil {
		return nil, err
	}
	protocols := []rpc.Protocol{
		NewStreamUIProtocol(G),
		c.secretUIProtocol(),
		NewIdentifyUIProtocol(G),
		c.gpgUIProtocol(),
		NewLoginUIProtocol(G),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return nil, err
	}
	return cli, nil
}

func (c *CmdStress) Run() error {
	cli, err := c.rpcClient()
	if err != nil {
		return err
	}

	username, passphrase, err := c.signup(cli)
	if err != nil {
		return err
	}

	var wg sync.WaitGroup
	for i := 0; i < c.numUsers; i++ {
		wg.Add(1)
		go func() {
			c.simulate(username, passphrase)
			wg.Done()
		}()
	}
	wg.Wait()

	return nil
}

func (c *CmdStress) ParseArgv(ctx *cli.Context) error {
	c.numUsers = ctx.Int("n")
	if c.numUsers < 1 {
		return errors.New("n must be at least 1")
	}
	return nil
}

func (c *CmdStress) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

func (c *CmdStress) signup(cli *rpc.Client) (username, passphrase string, err error) {
	buf := make([]byte, 5)
	if _, err = rand.Read(buf); err != nil {
		return
	}
	username = fmt.Sprintf("login_%s", hex.EncodeToString(buf))
	email := fmt.Sprintf("%s@noemail.keybase.io", username)
	buf = make([]byte, 12)
	if _, err = rand.Read(buf); err != nil {
		return
	}
	c.passphrase = hex.EncodeToString(buf)

	G.Log.Info("username: %q, email: %q, passphrase: %q", username, email, c.passphrase)

	scli := keybase1.SignupClient{Cli: cli}
	res, err := scli.Signup(context.TODO(), keybase1.SignupArg{
		Email:      email,
		InviteCode: "202020202020202020202020",
		Passphrase: c.passphrase,
		Username:   username,
		DeviceName: "signup test device",
	})
	if err != nil {
		return "", "", err
	}
	G.Log.Info("signup res: %+v", res)
	return
}

func (c *CmdStress) simulate(username, passphrase string) {
	funcs := []func(){
		c.deviceList,
		c.idAlice,
		c.idSelf,
		c.listTrackers,
		c.listTracking,
		c.status,
		c.trackSomeone,
	}
	for i := 0; i < 10; i++ {
		f := funcs[libkb.RandIntn(len(funcs))]
		f()
	}

	// now add logout to the mix
	funcs = append(funcs, c.logout)
	for i := 0; i < 10; i++ {
		f := funcs[libkb.RandIntn(len(funcs))]
		f()
	}
}

func (c *CmdStress) idSelf() {
	cli, err := c.rpcClient()
	if err != nil {
		G.Log.Warning("rpcClient error: %s", err)
		return
	}
	icli := keybase1.IdentifyClient{Cli: cli}
	_, err = icli.Identify(context.TODO(), keybase1.IdentifyArg{})
	if err != nil {
		G.Log.Warning("id self error: %s", err)
	}
}

func (c *CmdStress) idAlice() {
	cli, err := c.rpcClient()
	if err != nil {
		G.Log.Warning("rpcClient error: %s", err)
		return
	}
	icli := keybase1.IdentifyClient{Cli: cli}
	_, err = icli.Identify(context.TODO(), keybase1.IdentifyArg{UserAssertion: "t_alice"})
	if err != nil {
		G.Log.Warning("id t_alice error: %s", err)
	}
}

func (c *CmdStress) trackSomeone() {
	cli, err := c.rpcClient()
	if err != nil {
		G.Log.Warning("rpcClient error: %s", err)
		return
	}

	usernames := []string{"t_alice", "t_bob", "t_charlie", "t_doug"}
	username := usernames[libkb.RandIntn(len(usernames))]

	tcli := keybase1.TrackClient{Cli: cli}
	options := keybase1.TrackOptions{LocalOnly: false, BypassConfirm: true}
	_, err = tcli.Track(context.TODO(), keybase1.TrackArg{UserAssertion: username, Options: options})
	if err != nil {
		G.Log.Warning("follow %s error: %s", username, err)

	}
	if libkb.RandIntn(2) == 0 {
		return
	}
	err = tcli.Untrack(context.TODO(), keybase1.UntrackArg{Username: username})
	if err != nil {
		G.Log.Warning("unfollow %s error: %s", username, err)
	}
}

func (c *CmdStress) listTrackers() {
	cli, err := c.rpcClient()
	if err != nil {
		G.Log.Warning("rpcClient error: %s", err)
		return
	}
	ucli := keybase1.UserClient{Cli: cli}
	_, err = ucli.ListTrackers2(context.TODO(), keybase1.ListTrackers2Arg{})
	if err != nil {
		G.Log.Warning("list followers error: %s", err)
	}
}

func (c *CmdStress) listTracking() {
	cli, err := c.rpcClient()
	if err != nil {
		G.Log.Warning("rpcClient error: %s", err)
		return
	}
	ucli := keybase1.UserClient{Cli: cli}
	_, err = ucli.ListTracking(context.TODO(), keybase1.ListTrackingArg{})
	if err != nil {
		G.Log.Warning("list following error: %s", err)
	}
}

func (c *CmdStress) deviceList() {
	cli, err := c.rpcClient()
	if err != nil {
		G.Log.Warning("rpcClient error: %s", err)
		return
	}
	dcli := keybase1.DeviceClient{Cli: cli}
	_, err = dcli.DeviceList(context.TODO(), 0)
	if err != nil {
		G.Log.Warning("device list error: %s", err)
	}
}

func (c *CmdStress) status() {
	cli, err := c.rpcClient()
	if err != nil {
		G.Log.Warning("rpcClient error: %s", err)
		return
	}
	ccli := keybase1.ConfigClient{Cli: cli}
	currentStatus, err := ccli.GetCurrentStatus(context.TODO(), 0)
	if err != nil {
		G.Log.Warning("status error: %s", err)
		return
	}
	if !currentStatus.LoggedIn {
		G.Log.Warning("Not logged in.")
		return
	}
	myUID := currentStatus.User.Uid

	ucli := keybase1.UserClient{Cli: cli}
	_, err = ucli.LoadUser(context.TODO(), keybase1.LoadUserArg{Uid: myUID})
	if err != nil {
		G.Log.Warning("load user error: %s", err)
	}
}

func (c *CmdStress) logout() {
	cli, err := GetLoginClient(G)
	if err != nil {
		G.Log.Warning("GetLoginClient error: %s", err)
		return
	}
	err = cli.Logout(context.TODO(), 0)
	if err != nil {
		G.Log.Warning("Logout error: %s", err)
		return
	}
}

func (c *CmdStress) gpgUIProtocol() rpc.Protocol {
	return keybase1.GpgUiProtocol(c)
}

func (c *CmdStress) SelectKey(_ context.Context, arg keybase1.SelectKeyArg) (string, error) {
	return "", nil
}
func (c *CmdStress) SelectKeyAndPushOption(_ context.Context, arg keybase1.SelectKeyAndPushOptionArg) (res keybase1.SelectKeyRes, err error) {
	return
}
func (c *CmdStress) WantToAddGPGKey(_ context.Context, _ int) (bool, error) {
	return false, nil
}
func (c *CmdStress) ConfirmDuplicateKeyChosen(_ context.Context, _ int) (bool, error) {
	return false, nil
}

func (c *CmdStress) secretUIProtocol() rpc.Protocol {
	return keybase1.SecretUiProtocol(c)
}

func (c *CmdStress) GetPassphrase(_ context.Context, arg keybase1.GetPassphraseArg) (res keybase1.GetPassphraseRes, err error) {
	return
}
func (c *CmdStress) Sign(_ context.Context, arg keybase1.SignArg) (string, error) {
	return "", nil
}
func (c *CmdStress) GetTTY(_ context.Context) (string, error) {
	return "", nil
}
