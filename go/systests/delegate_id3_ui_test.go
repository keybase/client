// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

import (
	"sync"
	"testing"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/service"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
)

type delegateID3UI struct {
	sync.Mutex
	T  *testing.T
	ch chan struct{}

	guiid         keybase1.Identify3GUIID
	displayedCard bool

	launchedGithub  bool
	foundGithub     bool
	launchedTwitter bool
	foundTwitter    bool
}

// delegateUI implements the keybase1.IdentifyUiInterface
var _ keybase1.Identify3UiInterface = (*delegateID3UI)(nil)

func (d *delegateID3UI) Identify3ShowTracker(_ context.Context, arg keybase1.Identify3ShowTrackerArg) error {
	d.Lock()
	defer d.Unlock()
	d.guiid = arg.GuiID
	require.Equal(d.T, string(arg.Assertion), "t_alice")
	return nil
}

func (d *delegateID3UI) Identify3UpdateRow(_ context.Context, arg keybase1.Identify3UpdateRowArg) error {
	d.Lock()
	defer d.Unlock()
	require.Equal(d.T, d.guiid, arg.GuiID)

	poke := func(launched *bool, found *bool) {
		switch arg.State {
		case keybase1.Identify3RowState_CHECKING:
			require.False(d.T, *found)
			require.False(d.T, *launched)
			*launched = true
		case keybase1.Identify3RowState_VALID:
			require.True(d.T, *launched)
			require.False(d.T, *found)
			*found = true
		default:
			require.Fail(d.T, "unexpected state: %+v", arg)
		}
	}
	switch arg.Key {
	case "twitter":
		poke(&d.launchedTwitter, &d.foundTwitter)
	case "github":
		poke(&d.launchedGithub, &d.foundGithub)
	}
	return nil
}

func (d *delegateID3UI) Identify3UserReset(context.Context, keybase1.Identify3GUIID) error {
	require.Fail(d.T, "did not exect reset user scenario")
	return nil
}

func (d *delegateID3UI) Identify3UpdateUserCard(_ context.Context, arg keybase1.Identify3UpdateUserCardArg) error {
	d.Lock()
	defer d.Unlock()
	require.Equal(d.T, d.guiid, arg.GuiID)
	d.displayedCard = true
	return nil
}

func (d *delegateID3UI) Identify3TrackerTimedOut(context.Context, keybase1.Identify3GUIID) error {
	require.Fail(d.T, "did not expect a tracker time out")
	return nil
}

func (d *delegateID3UI) Identify3Result(_ context.Context, arg keybase1.Identify3ResultArg) error {
	d.Lock()
	require.Equal(d.T, arg.GuiID, d.guiid)
	require.Equal(d.T, arg.Result, keybase1.Identify3ResultType_OK)
	d.Unlock()
	close(d.ch)
	return nil
}

func newDelegateID3UI(t *testing.T) *delegateID3UI {
	return &delegateID3UI{
		T:  t,
		ch: make(chan struct{}),
	}
}

func (d *delegateID3UI) checkSuccess() {
	d.Lock()
	defer d.Unlock()
	require.True(d.T, d.foundTwitter)
	require.True(d.T, d.foundGithub)
	require.True(d.T, d.displayedCard)
}

func TestDelegateIdentify3UI(t *testing.T) {
	tc := setupTest(t, "delegate_ui")
	tc1 := cloneContext(tc)
	tc2 := cloneContext(tc)

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
	dui := newDelegateID3UI(t)

	launchDelegateUI := func(dui *delegateID3UI) error {
		cli, xp, err := client.GetRPCClientWithContext(tc2.G)
		if err != nil {
			return err
		}
		srv := rpc.NewServer(xp, nil)
		if err = srv.Register(keybase1.Identify3UiProtocol(dui)); err != nil {
			return err
		}
		ncli := keybase1.DelegateUiCtlClient{Cli: cli}
		return ncli.RegisterIdentify3UI(context.TODO())
	}

	// Launch the delegate UI
	err := launchDelegateUI(dui)
	require.NoError(t, err)

	id := client.NewCmdIDRunner(tc1.G)
	id.SetUser("t_alice")
	id.UseDelegateUI()
	err = id.Run()
	require.NoError(t, err)

	// We should get a close on this channel when the UI is read to go.
	_, eof := <-dui.ch
	require.False(t, eof)
	dui.checkSuccess()

	err = client.CtlServiceStop(tc1.G)
	require.NoError(t, err)

	// If the server failed, it's also an error
	err = <-stopCh
	require.NoError(t, err)
}
