// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"fmt"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type CmdID struct {
	libkb.Contextified
	json           bool
	user           string
	useDelegateUI  bool
	skipProofCache bool
	forceDisplay   bool
}

func (v *CmdID) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	if nargs > 1 {
		return fmt.Errorf("Identify only takes one argument, the user to lookup.")
	}

	if nargs == 1 {
		v.user = ctx.Args()[0]
	}
	v.json = ctx.Bool("json")
	v.useDelegateUI = ctx.Bool("ui")
	v.skipProofCache = ctx.Bool("skip-proof-cache")
	v.forceDisplay = ctx.Bool("force-display")
	return nil
}

func (v *CmdID) makeArg() keybase1.Identify2Arg {
	return keybase1.Identify2Arg{
		UserAssertion:    v.user,
		UseDelegateUI:    v.useDelegateUI || v.forceDisplay,
		ForceDisplay:     v.forceDisplay,
		Reason:           keybase1.IdentifyReason{Reason: "CLI id command"},
		ForceRemoteCheck: v.skipProofCache,
		AlwaysBlock:      true,
		NeedProofSet:     true,
		AllowEmptySelfID: true,
		NoSkipSelf:       true,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CLI,
	}
}

func (v *CmdID) Run() error {
	var cli keybase1.IdentifyClient
	protocols := []rpc.Protocol{}

	if v.json {
		v.G().UI = idCmdJSONUIWrapper{
			UI: v.G().UI,
		}
	}

	// always register this, even if ui is delegated, so that
	// fallback to terminal UI works.
	protocols = append(protocols, NewIdentifyUIProtocol(v.G()))
	cli, err := GetIdentifyClient(v.G())
	if err != nil {
		return err
	}
	if err := RegisterProtocolsWithContext(protocols, v.G()); err != nil {
		return err
	}

	arg := v.makeArg()
	_, err = cli.Identify2(context.TODO(), arg)
	if _, ok := err.(libkb.SelfNotFoundError); ok {
		msg := `Could not find UID or username for you on this device.
You can either specify a user to id: keybase id <username>
Or log in once on this device and run "keybase id" again.
`
		v.G().UI.GetDumbOutputUI().PrintfStderr(msg)
		return nil
	}
	return err
}

type idCmdJSONUIWrapper struct {
	libkb.UI
}

func (i idCmdJSONUIWrapper) GetIdentifyUI() libkb.IdentifyUI {
	return &idCmdIdentifyUI{
		parent: i.UI,
	}
}

type idCmdIdentifyUI struct {
	parent           libkb.UI
	Username         string                     `json:"username"`
	LastTrack        *idCmdIdentifyUILastTrack  `json:"lastTrack"`
	Cryptocurrencies []keybase1.Cryptocurrency  `json:"cryptocurrencies"`
	Stellar          *keybase1.StellarAccount   `json:"stellar"`
	IdentifyKey      *keybase1.IdentifyKey      `json:"identifyKey"`
	Proofs           []idCmdIdentifyUIProofPair `json:"proofs"`
}

type idCmdIdentifyUILastTrack struct {
	Remote bool      `json:"remote"`
	Time   time.Time `json:"time"`
}

type idCmdIdentifyUIProofPair struct {
	Proof  keybase1.RemoteProof     `json:"proof"`
	Result keybase1.LinkCheckResult `json:"result"`
}

func (ui *idCmdIdentifyUI) DisplayUserCard(libkb.MetaContext, keybase1.UserCard) error {
	return nil
}

func (ui *idCmdIdentifyUI) Start(_ libkb.MetaContext, username string, _ keybase1.IdentifyReason, _ bool) error {
	ui.Username = username
	return nil
}

func (ui *idCmdIdentifyUI) DisplayTrackStatement(_ libkb.MetaContext, stmt string) error {
	return nil
}

func (ui *idCmdIdentifyUI) ReportTrackToken(_ libkb.MetaContext, _ keybase1.TrackToken) error {
	return nil
}

func (ui *idCmdIdentifyUI) Cancel(_ libkb.MetaContext) error {
	return nil
}

func (ui *idCmdIdentifyUI) Finish(_ libkb.MetaContext) error {
	b, err := json.MarshalIndent(ui, "", "    ")
	if err != nil {
		return err
	}
	dui := ui.parent.GetDumbOutputUI()
	_, err = dui.Printf(string(b) + "\n")
	return err
}

func (ui *idCmdIdentifyUI) Dismiss(_ libkb.MetaContext, _ string, _ keybase1.DismissReason) error {
	return nil
}

func (ui *idCmdIdentifyUI) Confirm(_ libkb.MetaContext, o *keybase1.IdentifyOutcome) (keybase1.ConfirmResult, error) {
	return keybase1.ConfirmResult{IdentityConfirmed: false, RemoteConfirmed: false}, nil
}

func (ui *idCmdIdentifyUI) LaunchNetworkChecks(_ libkb.MetaContext, _ *keybase1.Identity, _ *keybase1.User) error {
	return nil
}

func (ui *idCmdIdentifyUI) DisplayTLFCreateWithInvite(_ libkb.MetaContext, _ keybase1.DisplayTLFCreateWithInviteArg) error {
	return nil
}

func (ui *idCmdIdentifyUI) FinishSocialProofCheck(_ libkb.MetaContext, p keybase1.RemoteProof, l keybase1.LinkCheckResult) error {
	ui.Proofs = append(ui.Proofs, idCmdIdentifyUIProofPair{
		Proof:  p,
		Result: l,
	})
	return nil
}

func (ui *idCmdIdentifyUI) FinishWebProofCheck(_ libkb.MetaContext, p keybase1.RemoteProof, l keybase1.LinkCheckResult) error {
	ui.Proofs = append(ui.Proofs, idCmdIdentifyUIProofPair{
		Proof:  p,
		Result: l,
	})
	return nil
}

func (ui *idCmdIdentifyUI) DisplayCryptocurrency(_ libkb.MetaContext, l keybase1.Cryptocurrency) error {
	ui.Cryptocurrencies = append(ui.Cryptocurrencies, l)
	return nil
}

func (ui *idCmdIdentifyUI) DisplayStellarAccount(_ libkb.MetaContext, l keybase1.StellarAccount) error {
	ui.Stellar = &l
	return nil
}

func (ui *idCmdIdentifyUI) DisplayKey(_ libkb.MetaContext, key keybase1.IdentifyKey) error {
	ui.IdentifyKey = &key
	return nil
}

func (ui *idCmdIdentifyUI) ReportLastTrack(_ libkb.MetaContext, tl *keybase1.TrackSummary) error {
	if t := libkb.ImportTrackSummary(tl); t != nil {
		ui.LastTrack = &idCmdIdentifyUILastTrack{
			Remote: t.IsRemote(),
			Time:   t.GetCTime(),
		}
	}
	return nil
}

func NewCmdID(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	ret := cli.Command{
		Name:         "id",
		ArgumentHelp: "[username]",
		Usage:        "Identify a user and check their signature chain",
		Description:  "Identify a user and check their signature chain. Don't specify a username to identify yourself. You can also specify proof assertions like user@twitter.",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "j, json",
				Usage: "Output requests as JSON",
			},
			cli.BoolFlag{
				Name:      "ui",
				Usage:     "Use identify UI.",
				HideUsage: !develUsage,
			},
			cli.BoolFlag{
				Name:      "force-display",
				Usage:     "Force identify UI to draw (even if still fresh)",
				HideUsage: !develUsage,
			},
			cli.BoolFlag{
				Name:  "s, skip-proof-cache",
				Usage: "Skip cached proofs, force re-check",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdIDRunner(g), "id", c)
		},
	}
	return ret
}

func NewCmdIDRunner(g *libkb.GlobalContext) *CmdID {
	return &CmdID{Contextified: libkb.NewContextified(g)}
}

func (v *CmdID) SetUser(s string) {
	v.user = s
}

func (v *CmdID) UseDelegateUI() {
	v.useDelegateUI = true
}

func (v *CmdID) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
