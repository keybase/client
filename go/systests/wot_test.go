package systests

import (
	"testing"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/service"
	"github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
)

func TestWotNotifications(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	alice := tt.addUser("alice")
	bob := tt.addUser("bob")
	tt.logUserNames()
	iui := newSimpleIdentifyUI()
	attachIdentifyUI(t, bob.tc.G, iui)
	iui.confirmRes = keybase1.ConfirmResult{IdentityConfirmed: true, RemoteConfirmed: true, AutoConfirmed: true}
	bob.track(alice.username)
	iui = newSimpleIdentifyUI()
	attachIdentifyUI(t, alice.tc.G, iui)
	iui.confirmRes = keybase1.ConfirmResult{IdentityConfirmed: true, RemoteConfirmed: true, AutoConfirmed: true}
	alice.track(bob.username)

	getWotUpdate := func(user *userPlusDevice) keybase1.WotUpdate {
		pollForTrue(t, user.tc.G, func(i int) bool {
			badges := getBadgeState(t, user)
			return len(badges.WotUpdates) > 0
		})
		badgeState := getBadgeState(t, user)
		wotUpdates := badgeState.WotUpdates
		require.Equal(t, 1, len(wotUpdates))
		return wotUpdates[0]
	}

	dismiss := func(user *userPlusDevice) {
		wotHandler := service.NewWebOfTrustHandler(nil, user.tc.G)
		wotHandler.DismissWotNotifications(context.TODO(), keybase1.DismissWotNotificationsArg{
			Voucher: alice.username,
			Vouchee: bob.username,
		})
		pollForTrue(t, user.tc.G, func(i int) bool {
			badges := getBadgeState(t, user)
			return len(badges.WotUpdates) == 0
		})
	}

	// alice vouches for bob - bob gets a notification
	cliV := &client.CmdWotVouch{
		Contextified: libkb.NewContextified(alice.tc.G),
		Assertion:    bob.username,
		Message:      "whatever whatever",
		Confidence: keybase1.Confidence{
			UsernameVerifiedVia: keybase1.UsernameVerificationType_IN_PERSON,
		},
	}
	err := cliV.Run()
	require.NoError(t, err)
	wotUpdate := getWotUpdate(bob)
	require.Equal(t, wotUpdate.Status, keybase1.WotStatusType_PROPOSED)
	require.Equal(t, wotUpdate.Voucher, alice.username)
	require.Equal(t, wotUpdate.Vouchee, bob.username)
	dismiss(bob)

	// bob accepts - alice gets a notification
	cliA := &client.CmdWotAccept{
		Contextified: libkb.NewContextified(bob.tc.G),
		Username:     alice.username,
	}
	err = cliA.Run()
	require.NoError(t, err)
	wotUpdate = getWotUpdate(alice)
	require.Equal(t, wotUpdate.Status, keybase1.WotStatusType_ACCEPTED)
	require.Equal(t, wotUpdate.Voucher, alice.username)
	require.Equal(t, wotUpdate.Vouchee, bob.username)
	dismiss(alice)

	// bob rejects - alice gets a notification
	cliR := &client.CmdWotReject{
		Contextified: libkb.NewContextified(bob.tc.G),
		Username:     alice.username,
	}
	err = cliR.Run()
	require.NoError(t, err)
	wotUpdate = getWotUpdate(alice)
	require.Equal(t, wotUpdate.Status, keybase1.WotStatusType_REJECTED)
	require.Equal(t, wotUpdate.Voucher, alice.username)
	require.Equal(t, wotUpdate.Vouchee, bob.username)
	dismiss(alice)
}
