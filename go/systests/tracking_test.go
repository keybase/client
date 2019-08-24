// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

import (
	"testing"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/service"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
)

type trackingUI struct {
	signupUI
}

func (n *trackingUI) GetIdentifyTrackUI() libkb.IdentifyUI {
	return &identifyUI{}
}

type identifyUI struct {
}

func (*identifyUI) Confirm(libkb.MetaContext, *keybase1.IdentifyOutcome) (keybase1.ConfirmResult, error) {
	return keybase1.ConfirmResult{
		IdentityConfirmed: true,
		RemoteConfirmed:   true,
	}, nil
}
func (*identifyUI) Start(libkb.MetaContext, string, keybase1.IdentifyReason, bool) error {
	return nil
}
func (*identifyUI) FinishWebProofCheck(libkb.MetaContext, keybase1.RemoteProof, keybase1.LinkCheckResult) error {
	return nil
}
func (*identifyUI) FinishSocialProofCheck(libkb.MetaContext, keybase1.RemoteProof, keybase1.LinkCheckResult) error {
	return nil
}
func (*identifyUI) DisplayCryptocurrency(libkb.MetaContext, keybase1.Cryptocurrency) error {
	return nil
}
func (*identifyUI) DisplayStellarAccount(libkb.MetaContext, keybase1.StellarAccount) error {
	return nil
}
func (*identifyUI) DisplayKey(libkb.MetaContext, keybase1.IdentifyKey) error {
	return nil
}
func (*identifyUI) ReportLastTrack(libkb.MetaContext, *keybase1.TrackSummary) error {
	return nil
}
func (*identifyUI) LaunchNetworkChecks(libkb.MetaContext, *keybase1.Identity, *keybase1.User) error {
	return nil
}
func (*identifyUI) DisplayTrackStatement(libkb.MetaContext, string) error {
	return nil
}
func (*identifyUI) DisplayUserCard(libkb.MetaContext, keybase1.UserCard) error {
	return nil
}
func (*identifyUI) ReportTrackToken(libkb.MetaContext, keybase1.TrackToken) error {
	return nil
}
func (*identifyUI) SetStrict(b bool) {}
func (*identifyUI) Cancel(libkb.MetaContext) error {
	return nil
}
func (*identifyUI) Finish(libkb.MetaContext) error {
	return nil
}
func (*identifyUI) Dismiss(libkb.MetaContext, string, keybase1.DismissReason) error {
	return nil
}

func (*identifyUI) DisplayTLFCreateWithInvite(libkb.MetaContext, keybase1.DisplayTLFCreateWithInviteArg) error {
	return nil
}

type trackingNotifyHandler struct {
	trackingCh chan keybase1.TrackingChangedArg
	errCh      chan error
}

func newTrackingNotifyHandler() *trackingNotifyHandler {
	return &trackingNotifyHandler{
		trackingCh: make(chan keybase1.TrackingChangedArg),
		errCh:      make(chan error),
	}
}

func (h *trackingNotifyHandler) TrackingChanged(_ context.Context, arg keybase1.TrackingChangedArg) error {
	h.trackingCh <- arg
	return nil
}

func (h *trackingNotifyHandler) TrackingInfo(context.Context, keybase1.TrackingInfoArg) error {
	return nil
}

func TestTrackingNotifications(t *testing.T) {
	tc := setupTest(t, "signup")
	defer tc.Cleanup()
	tc2 := cloneContext(tc)
	defer tc2.Cleanup()
	tc5 := cloneContext(tc)
	defer tc5.Cleanup()

	// Hack the various portions of the service that aren't
	// properly contextified.

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

	userInfo := randomUser("sgnup")

	tui := trackingUI{
		signupUI: signupUI{
			info:         userInfo,
			Contextified: libkb.NewContextified(tc2.G),
		},
	}
	tc2.G.SetUI(&tui)
	signup := client.NewCmdSignupRunner(tc2.G)
	signup.SetTest()

	<-startCh

	if err := signup.Run(); err != nil {
		t.Fatal(err)
	}
	nh := newTrackingNotifyHandler()

	// Launch the server that will listen for tracking notifications.
	launchServer := func(nh *trackingNotifyHandler) error {
		cli, xp, err := client.GetRPCClientWithContext(tc5.G)
		if err != nil {
			return err
		}
		srv := rpc.NewServer(xp, nil)
		if err = srv.Register(keybase1.NotifyTrackingProtocol(nh)); err != nil {
			return err
		}
		ncli := keybase1.NotifyCtlClient{Cli: cli}
		return ncli.SetNotifications(context.TODO(), keybase1.NotificationChannels{
			Tracking: true,
		})
	}

	// Actually launch it in the background
	go func() {
		err := launchServer(nh)
		if err != nil {
			nh.errCh <- err
		}
	}()

	// Have our test user track t_alice.
	trackCmd := client.NewCmdTrackRunner(tc2.G)
	trackCmd.SetUser("t_alice")
	trackCmd.SetOptions(keybase1.TrackOptions{BypassConfirm: true})
	err := trackCmd.Run()
	if err != nil {
		t.Fatal(err)
	}

	// Do a check for new tracking statements that should fire off a
	// notification. Currently the track command above does not fetch the new
	// chain link from the server, so this call is required. It's possible that
	// TrackEngine (or our signature caching code) might change in the future,
	// making this call unnecessary.
	checkTrackingCmd := client.NewCmdCheckTrackingRunner(tc2.G)
	err = checkTrackingCmd.Run()
	if err != nil {
		t.Fatal(err)
	}

	// Wait to get a notification back as we expect.
	// NOTE: If this test ever starts deadlocking here, it's possible that
	// we've changed how we cache signatures that we make on the local client,
	// in such a way that the fetch done by CheckTracking above doesn't find
	// any "isOwnNewLinkFromServer" links. If so, one way to fix this test
	// would be to blow away the local db before calling CheckTracking.
	tc.G.Log.Debug("Waiting for two tracking notifications.")
	for i := 0; i < 2; i++ {
		select {
		case err := <-nh.errCh:
			t.Fatalf("Error before notify: %v", err)
		case arg := <-nh.trackingCh:
			tAliceUID := keybase1.UID("295a7eea607af32040647123732bc819")
			tc.G.Log.Debug("Got tracking changed notification (%#v)", arg)
			if "t_alice" == arg.Username {
				if !tAliceUID.Equal(arg.Uid) {
					t.Fatalf("Bad UID back: %s != %s", tAliceUID, arg.Uid)
				}
			} else if userInfo.username == arg.Username {
				if !tc.G.Env.GetUID().Equal(arg.Uid) {
					t.Fatalf("Bad UID back: %s != %s", tc.G.Env.GetUID(), arg.Uid)
				}
			} else {
				t.Fatalf("Bad username back: %s != %s || %s", arg.Username, "t_alice", userInfo.username)
			}
		}
	}

	if err := CtlStop(tc2.G); err != nil {
		t.Fatal(err)
	}

	// If the server failed, it's also an error
	if err := <-stopCh; err != nil {
		t.Fatal(err)
	}
}

func TestV2Compressed(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ctx := context.TODO()

	alice := tt.addUser("alice")
	aliceG := alice.tc.G

	tt.addUser("wong")
	wong := tt.users[1]
	wongG := wong.tc.G
	upk, err := wongG.GetUPAKLoader().LoadUserPlusKeys(ctx, wong.uid, "")
	require.NoError(t, err)

	iuiW := newSimpleIdentifyUI()
	attachIdentifyUI(t, wongG, iuiW)
	iuiW.confirmRes = keybase1.ConfirmResult{IdentityConfirmed: true, RemoteConfirmed: true, AutoConfirmed: true}

	idAndListFollowers := func(username string) {
		cli1, err := client.GetIdentifyClient(aliceG)
		require.NoError(t, err)
		_, err = cli1.Identify2(ctx, keybase1.Identify2Arg{
			UserAssertion:    username,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_GUI,
		})
		require.NoError(t, err)

		cli2, err := client.GetUserClient(aliceG)
		require.NoError(t, err)
		_, err = cli2.ListTrackers2(ctx, keybase1.ListTrackers2Arg{
			Assertion: username,
			Reverse:   false,
		})
		require.NoError(t, err)
	}

	aliceG.ProofCache.DisableDisk()
	wongG.ProofCache.DisableDisk()
	// The track/untrack statements will be stubbed links, the proveRooter will
	// not
	wong.track(alice.username)
	// ensure we don't stub a non-stubable
	wong.proveRooter()
	idAndListFollowers(wong.username)

	// ensure we don't stub tail since we need to check against the merkle tree
	wong.untrack(alice.username)
	idAndListFollowers(wong.username)

	wong.reset()
	wong.loginAfterReset()
	tt.addUser("bob")
	bob := tt.users[2]
	bobG := bob.tc.G
	for _, dk := range upk.DeviceKeys {
		user, upak, _, err := bobG.GetUPAKLoader().LoadKeyV2(ctx, wong.uid, dk.KID)
		require.NoError(t, err)
		require.NotNil(t, user)
		require.NotNil(t, upak)
	}
}
