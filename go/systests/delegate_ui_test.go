// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/service"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
)

type delegateUI struct {
	ch        chan error
	delegated bool
	started   bool
	finished  bool
	canceled  bool

	launchedGithub  bool
	foundGithub     bool
	launchedTwitter bool
	foundTwitter    bool
}

// delegateUI implements the keybase1.IdentifyUiInterface
var _ keybase1.IdentifyUiInterface = (*delegateUI)(nil)

func (d *delegateUI) checkDelegated() error {
	if !d.delegated {
		return d.setError(fmt.Errorf("Can't run UI since it wasn't properly delegated"))
	}
	return nil
}

func (d *delegateUI) setError(e error) error {
	go func() { d.ch <- e }()
	return e
}

func (d *delegateUI) checkStarted() error {
	if err := d.checkDelegated(); err != nil {
		return err
	}
	if !d.started {
		return d.setError(fmt.Errorf("Can't run UI since it wasn't properly started"))
	}
	if d.canceled {
		return d.setError(fmt.Errorf("Can't run UI after Cancel() was called"))
	}
	return nil
}

func (d *delegateUI) DelegateIdentifyUI(context.Context) (int, error) {
	d.delegated = true
	return 1, nil
}
func (d *delegateUI) Start(context.Context, keybase1.StartArg) error {
	if err := d.checkDelegated(); err != nil {
		return err
	}
	d.started = true
	return nil
}

func (d *delegateUI) DisplayKey(context.Context, keybase1.DisplayKeyArg) error {
	if err := d.checkStarted(); err != nil {
		return err
	}
	return nil
}
func (d *delegateUI) ReportLastTrack(context.Context, keybase1.ReportLastTrackArg) error {
	if err := d.checkStarted(); err != nil {
		return err
	}
	return nil
}
func (d *delegateUI) LaunchNetworkChecks(_ context.Context, arg keybase1.LaunchNetworkChecksArg) error {
	if err := d.checkStarted(); err != nil {
		return err
	}
	for _, proof := range arg.Identity.Proofs {
		switch proof.Proof.Key {
		case "twitter":
			d.launchedTwitter = true
		case "github":
			d.launchedGithub = true
		}
	}
	return nil
}
func (d *delegateUI) DisplayTrackStatement(context.Context, keybase1.DisplayTrackStatementArg) error {
	if err := d.checkStarted(); err != nil {
		return err
	}
	return nil
}
func (d *delegateUI) ReportTrackToken(context.Context, keybase1.ReportTrackTokenArg) error {
	if err := d.checkStarted(); err != nil {
		return err
	}
	return nil
}
func (d *delegateUI) FinishWebProofCheck(context.Context, keybase1.FinishWebProofCheckArg) error {
	if err := d.checkStarted(); err != nil {
		return err
	}
	return nil
}
func (d *delegateUI) FinishSocialProofCheck(_ context.Context, arg keybase1.FinishSocialProofCheckArg) error {
	if err := d.checkStarted(); err != nil {
		return err
	}
	switch arg.Rp.Key {
	case "twitter":
		d.foundTwitter = true
	case "github":
		d.foundGithub = true
	}
	return nil
}
func (d *delegateUI) DisplayCryptocurrency(context.Context, keybase1.DisplayCryptocurrencyArg) error {
	if err := d.checkStarted(); err != nil {
		return err
	}
	return nil
}
func (d *delegateUI) DisplayUserCard(context.Context, keybase1.DisplayUserCardArg) error {
	if err := d.checkStarted(); err != nil {
		return err
	}
	return nil
}
func (d *delegateUI) Confirm(context.Context, keybase1.ConfirmArg) (res keybase1.ConfirmResult, err error) {
	if err = d.checkStarted(); err != nil {
		return res, err
	}
	res.IdentityConfirmed = true
	res.RemoteConfirmed = true
	return res, nil
}
func (d *delegateUI) Cancel(context.Context, int) error {
	if err := d.checkStarted(); err != nil {
		return err
	}
	d.canceled = true
	close(d.ch)
	return nil
}
func (d *delegateUI) Finish(context.Context, int) error {
	if err := d.checkStarted(); err != nil {
		return err
	}
	d.finished = true
	return nil
}
func (d *delegateUI) Dismiss(context.Context, keybase1.DismissArg) error {
	if err := d.checkStarted(); err != nil {
		return err
	}
	return nil
}

func (d *delegateUI) DisplayTLFCreateWithInvite(context.Context, keybase1.DisplayTLFCreateWithInviteArg) error {
	return nil
}

func (d *delegateUI) checkSuccess() error {
	if !d.launchedGithub || !d.foundGithub || !d.launchedTwitter || !d.foundTwitter || !d.canceled {
		return fmt.Errorf("Bad final state for delegate UI: %+v", d)
	}
	return nil
}

func newDelegateUI() *delegateUI {
	return &delegateUI{
		ch: make(chan error),
	}
}

func TestDelegateUI(t *testing.T) {
	tc := setupTest(t, "delegate_ui")
	tc1 := cloneContext(tc)
	tc2 := cloneContext(tc)

	// Make sure we're not using G anywhere in our tests.
	libkb.G.LocalDb = nil

	defer tc.Cleanup()

	stopCh := make(chan error)
	svc := service.NewService(tc.G, false)
	startCh := svc.GetStartChannel()
	go func() {
		err := svc.Run()
		if err != nil {
			t.Logf("Running the service produced an error: %v", err)
		}
		stopCh <- err
	}()

	// Wait for the server to start up
	<-startCh
	dui := newDelegateUI()

	launchDelegateUI := func(dui *delegateUI) error {
		cli, xp, err := client.GetRPCClientWithContext(tc2.G)
		if err != nil {
			return err
		}
		srv := rpc.NewServer(xp, nil)
		if err = srv.Register(keybase1.IdentifyUiProtocol(dui)); err != nil {
			return err
		}
		ncli := keybase1.DelegateUiCtlClient{Cli: cli}
		if err = ncli.RegisterIdentifyUI(context.TODO()); err != nil {
			return err
		}
		return nil
	}

	// Launch the delegate UI
	if err := launchDelegateUI(dui); err != nil {
		t.Fatal(err)
	}

	id := client.NewCmdIDRunner(tc1.G)
	id.SetUser("t_alice")
	id.UseDelegateUI()
	if err := id.Run(); err != nil {
		t.Fatalf("Error in Run: %v", err)
	}

	// We should get either a 'done' or an 'error' from the delegateUI.
	err, ok := <-dui.ch
	if err != nil {
		t.Errorf("Error with delegate UI: %v", err)
	} else if ok {
		t.Errorf("Delegate UI didn't close the channel properly")
	} else if err = dui.checkSuccess(); err != nil {
		t.Error(err)
	}

	if err := client.CtlServiceStop(tc1.G); err != nil {
		t.Errorf("Error in stopping service: %v", err)
	}

	// If the server failed, it's also an error
	if err := <-stopCh; err != nil {
		t.Fatal(err)
	}
}
