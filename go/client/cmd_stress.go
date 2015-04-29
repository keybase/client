package main

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"

	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func NewCmdStress(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "stress",
		Usage:       "keybase stress",
		Description: "run some stressful commands on the daemon",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdStress{}, "stress", c)
		},
		Flags: []cli.Flag{
			cli.IntFlag{
				Name:  "n",
				Usage: "number of concurrent users to simulate",
			},
		},
	}
}

// CmdStress is used for testing concurrency in the daemon.
// Build the daemon with `-race`, then run this command.
type CmdStress struct {
	numUsers int
}

func (c *CmdStress) Run() error {
	return errors.New("stress command only designed for client/daemon mode")
}

func (c *CmdStress) rpcClient() (*rpc2.Client, error) {
	cli, _, err := GetRpcClient()
	if err != nil {
		return nil, err
	}
	protocols := []rpc2.Protocol{
		NewStreamUiProtocol(),
		NewSecretUIProtocol(),
		NewIdentifyUIProtocol(),
		c.gpgUIProtocol(),
		NewLogUIProtocol(),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return nil, err
	}
	return cli, nil
}

func (c *CmdStress) RunClient() error {
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

func (c *CmdStress) signup(cli *rpc2.Client) (username, passphrase string, err error) {
	buf := make([]byte, 5)
	if _, err = rand.Read(buf); err != nil {
		return
	}
	username = fmt.Sprintf("login_%s", hex.EncodeToString(buf))
	email := fmt.Sprintf("%s@email.com", username)
	buf = make([]byte, 12)
	if _, err = rand.Read(buf); err != nil {
		return
	}
	passphrase = hex.EncodeToString(buf)

	G.Log.Info("username: %q, email: %q, passphrase: %q", username, email, passphrase)

	scli := keybase_1.SignupClient{Cli: cli}
	res, err := scli.Signup(keybase_1.SignupArg{
		Email:      email,
		InviteCode: "202020202020202020202020",
		Passphrase: passphrase,
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
	cli, err := c.rpcClient()
	if err != nil {
		G.Log.Warning("error getting rpc client: %s", err)
		return
	}
	for i := 0; i < 10; i++ {
		c.idSelf(cli)
		c.idAlice(cli)
		c.listTrackers(cli)
	}
}

func (c *CmdStress) idSelf(cli *rpc2.Client) {
	icli := keybase_1.IdentifyClient{Cli: cli}
	_, err := icli.Identify(keybase_1.IdentifyArg{})
	if err != nil {
		G.Log.Warning("id self error: %s", err)
	}
}

func (c *CmdStress) idAlice(cli *rpc2.Client) {
	icli := keybase_1.IdentifyClient{Cli: cli}
	_, err := icli.Identify(keybase_1.IdentifyArg{UserAssertion: "t_alice"})
	if err != nil {
		G.Log.Warning("id t_alice error: %s", err)
	}
}

func (c *CmdStress) listTrackers(cli *rpc2.Client) {
	ucli := keybase_1.UserClient{Cli: cli}
	_, err := ucli.ListTrackersSelf(0)
	if err != nil {
		G.Log.Warning("list trackers error: %s", err)
	}
}

func (c *CmdStress) gpgUIProtocol() rpc2.Protocol {
	return keybase_1.GpgUiProtocol(c)
}

func (c *CmdStress) SelectKey(arg keybase_1.SelectKeyArg) (string, error) {
	return "", nil
}
func (c *CmdStress) SelectKeyAndPushOption(arg keybase_1.SelectKeyAndPushOptionArg) (res keybase_1.SelectKeyRes, err error) {
	return
}
func (c *CmdStress) WantToAddGPGKey(dummy int) (bool, error) {
	return false, nil
}
