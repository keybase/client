// +build !release

// this command is only for testing purposes
package client

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
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
	numUsers   int
	passphrase string
}

func (c *CmdStress) Run() error {
	return errors.New("stress command only designed for client/daemon mode")
}

func (c *CmdStress) rpcClient() (*rpc2.Client, error) {
	cli, _, err := GetRPCClient()
	if err != nil {
		return nil, err
	}
	protocols := []rpc2.Protocol{
		NewStreamUIProtocol(),
		c.secretUIProtocol(),
		NewIdentifyUIProtocol(),
		c.gpgUIProtocol(),
		NewLogUIProtocol(),
		NewDoctorUIProtocol(),
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
	c.passphrase = hex.EncodeToString(buf)

	G.Log.Info("username: %q, email: %q, passphrase: %q", username, email, c.passphrase)

	scli := keybase1.SignupClient{Cli: cli}
	res, err := scli.Signup(keybase1.SignupArg{
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
		c.deviceAdd,
		c.deviceList,
		c.doctor,
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
	_, err = icli.Identify(keybase1.IdentifyArg{})
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
	_, err = icli.Identify(keybase1.IdentifyArg{UserAssertion: "t_alice"})
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

	users := []string{"t_alice", "t_bob", "t_charlie", "t_doug"}
	user := users[libkb.RandIntn(len(users))]

	tcli := keybase1.TrackClient{Cli: cli}
	err = tcli.Track(keybase1.TrackArg{TheirName: user, ApproveRemote: true})
	if err != nil {
		G.Log.Warning("track %s error: %s", user, err)
	}

	if libkb.RandIntn(2) == 0 {
		return
	}
	err = tcli.Untrack(keybase1.UntrackArg{TheirName: user})
	if err != nil {
		G.Log.Warning("untrack %s error: %s", user, err)
	}
}

func (c *CmdStress) listTrackers() {
	cli, err := c.rpcClient()
	if err != nil {
		G.Log.Warning("rpcClient error: %s", err)
		return
	}
	ucli := keybase1.UserClient{Cli: cli}
	_, err = ucli.ListTrackersSelf(0)
	if err != nil {
		G.Log.Warning("list trackers error: %s", err)
	}
}

func (c *CmdStress) listTracking() {
	cli, err := c.rpcClient()
	if err != nil {
		G.Log.Warning("rpcClient error: %s", err)
		return
	}
	ucli := keybase1.UserClient{Cli: cli}
	_, err = ucli.ListTracking("")
	if err != nil {
		G.Log.Warning("list tracking error: %s", err)
	}
}

func (c *CmdStress) deviceList() {
	cli, err := c.rpcClient()
	if err != nil {
		G.Log.Warning("rpcClient error: %s", err)
		return
	}
	dcli := keybase1.DeviceClient{Cli: cli}
	_, err = dcli.DeviceList(0)
	if err != nil {
		G.Log.Warning("device list error: %s", err)
	}
}

func (c *CmdStress) deviceAdd() {
	cli, err := c.rpcClient()
	if err != nil {
		G.Log.Warning("rpcClient error: %s", err)
		return
	}
	dcli := keybase1.DeviceClient{Cli: cli}
	sessionID, err := libkb.RandInt()
	if err != nil {
		G.Log.Warning("RandInt error: %s", err)
		return
	}
	phrase, err := libkb.RandBytes(50)
	if err != nil {
		G.Log.Warning("RandBytes error: %s", err)
		return
	}
	err = dcli.DeviceAdd(keybase1.DeviceAddArg{SecretPhrase: string(phrase), SessionID: sessionID})
	if err != nil {
		G.Log.Warning("device add error: %s", err)
	}
	go func() {
		time.Sleep(10 * time.Millisecond)
		err := dcli.DeviceAddCancel(sessionID)
		if err != nil {
			G.Log.Warning("device add cancel error: %s", err)
		}
	}()
}

func (c *CmdStress) doctor() {
	cli, err := c.rpcClient()
	if err != nil {
		G.Log.Warning("rpcClient error: %s", err)
		return
	}
	dcli := keybase1.DoctorClient{Cli: cli}
	err = dcli.Doctor(0)
	if err != nil {
		G.Log.Warning("doctor error: %s", err)
	}
}

func (c *CmdStress) status() {
	cli, err := c.rpcClient()
	if err != nil {
		G.Log.Warning("rpcClient error: %s", err)
		return
	}
	ccli := keybase1.ConfigClient{Cli: cli}
	currentStatus, err := ccli.GetCurrentStatus()
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
	_, err = ucli.LoadUser(keybase1.LoadUserArg{Uid: &myUID})
	if err != nil {
		G.Log.Warning("load user error: %s", err)
	}
}

func (c *CmdStress) logout() {
	cli, err := GetLoginClient()
	if err != nil {
		G.Log.Warning("GetLoginClient error: %s", err)
		return
	}
	err = cli.Logout()
	if err != nil {
		G.Log.Warning("Logout error: %s", err)
		return
	}
}

func (c *CmdStress) gpgUIProtocol() rpc2.Protocol {
	return keybase1.GpgUiProtocol(c)
}

func (c *CmdStress) SelectKey(arg keybase1.SelectKeyArg) (string, error) {
	return "", nil
}
func (c *CmdStress) SelectKeyAndPushOption(arg keybase1.SelectKeyAndPushOptionArg) (res keybase1.SelectKeyRes, err error) {
	return
}
func (c *CmdStress) WantToAddGPGKey(dummy int) (bool, error) {
	return false, nil
}

func (c *CmdStress) secretUIProtocol() rpc2.Protocol {
	return keybase1.SecretUiProtocol(c)
}

func (c *CmdStress) GetKeybasePassphrase(arg keybase1.GetKeybasePassphraseArg) (string, error) {
	return c.passphrase, nil
}

func (c *CmdStress) GetNewPassphrase(arg keybase1.GetNewPassphraseArg) (string, error) {
	return c.passphrase, nil
}

func (c *CmdStress) GetSecret(arg keybase1.GetSecretArg) (res keybase1.SecretEntryRes, err error) {
	return
}
