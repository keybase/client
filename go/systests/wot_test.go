package systests

import (
	"testing"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type mockWotNotification struct {
	category   string
	voucherUID *keybase1.UID
	voucheeUID *keybase1.UID
}

type mockWotListener struct {
	libkb.NoopNotifyListener
	notifications []mockWotNotification
}

var _ libkb.NotifyListener = (*mockWotListener)(nil)

func (n *mockWotListener) DrainWotNotifications() (ret []mockWotNotification) {
	ret = n.notifications
	n.notifications = nil
	return ret
}

func (n *mockWotListener) WotChanged(category string, voucherUID *keybase1.UID, voucheeUID *keybase1.UID) {
	n.notifications = append(n.notifications, mockWotNotification{
		category, voucherUID, voucheeUID,
	})
}

func setupUserWithMockWotListener(user *userPlusDevice) *mockWotListener {
	userListener := &mockWotListener{}
	user.tc.G.SetService()
	user.tc.G.NotifyRouter.AddListener(userListener)
	return userListener
}

func TestWotNotifications(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	alice := tt.addUser("alice")
	aliceListener := setupUserWithMockWotListener(alice)
	bob := tt.addUser("bob")
	bobListener := setupUserWithMockWotListener(bob)
	tt.logUserNames()
	iui := newSimpleIdentifyUI()
	attachIdentifyUI(t, bob.tc.G, iui)
	iui.confirmRes = keybase1.ConfirmResult{IdentityConfirmed: true, RemoteConfirmed: true, AutoConfirmed: true}
	bob.track(alice.username)
	iui = newSimpleIdentifyUI()
	attachIdentifyUI(t, alice.tc.G, iui)
	iui.confirmRes = keybase1.ConfirmResult{IdentityConfirmed: true, RemoteConfirmed: true, AutoConfirmed: true}
	alice.track(bob.username)

	assertNotificationGet := func(listener *mockWotListener, category string, voucher *keybase1.UID, vouchee *keybase1.UID) {
		notifications := listener.DrainWotNotifications()
		require.Len(t, notifications, 1)
		require.Equal(t, category, notifications[0].category)
		if voucher != nil {
			require.Equal(t, *voucher, *notifications[0].voucherUID)
		}
		if vouchee != nil {
			require.Equal(t, *vouchee, *notifications[0].voucheeUID)
		}
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
	bob.drainGregor()
	assertNotificationGet(bobListener, "wot.new_vouch", &alice.uid, nil)

	// bob accepts - alice gets a notification
	cliA := &client.CmdWotAccept{
		Contextified: libkb.NewContextified(bob.tc.G),
		Username:     alice.username,
	}
	err = cliA.Run()
	require.NoError(t, err)
	alice.drainGregor()
	assertNotificationGet(aliceListener, "wot.accepted", nil, &bob.uid)

	// bob rejects - alice gets a notification
	cliR := &client.CmdWotReject{
		Contextified: libkb.NewContextified(bob.tc.G),
		Username:     alice.username,
	}
	err = cliR.Run()
	require.NoError(t, err)
	alice.drainGregor()
	assertNotificationGet(aliceListener, "wot.rejected", nil, &bob.uid)
}
