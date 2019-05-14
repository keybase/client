package systests

import (
	"context"
	"fmt"
	"testing"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/emails"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestTeamWithPhoneNumber(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")

	phone := kbtest.GenerateTestPhoneNumber()
	impteamName := fmt.Sprintf("%s@phone,%s", phone, ann.username)
	teamID, err := ann.lookupImplicitTeam(true /* create */, impteamName, false /* public */)
	require.NoError(t, err)

	t.Logf("Created team %s -> %s", impteamName, teamID)

	teamObj := ann.loadTeamByID(teamID, true /* admin */)
	require.Equal(t, 1, teamObj.NumActiveInvites())
	var invite keybase1.TeamInvite
	for _, invite = range teamObj.GetActiveAndObsoleteInvites() {
		// Get first invite to local var
	}
	require.EqualValues(t, phone, invite.Name)
	invCat, err := invite.Type.C()
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamInviteCategory_PHONE, invCat)

	name, err := teamObj.ImplicitTeamDisplayName(context.Background())
	require.NoError(t, err)
	require.Len(t, name.Writers.KeybaseUsers, 1)
	require.Len(t, name.Writers.UnresolvedUsers, 1)
	require.Equal(t, impteamName, name.String())
}

func TestResolvePhoneToUser(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	bob := tt.addUser("bob")
	tt.logUserNames()

	phone := kbtest.GenerateTestPhoneNumber()

	assertion := fmt.Sprintf("%s@phone", phone)
	for _, u := range tt.users {
		_, res, err := u.tc.G.Resolver.ResolveUser(u.MetaContext(), assertion)
		require.Error(t, err)
		require.IsType(t, libkb.ResolutionError{}, err)
		require.Contains(t, err.Error(), assertion)
		require.Contains(t, err.Error(), "No resolution found")
		require.Empty(t, res.GetUID())
		require.Empty(t, res.GetUsername())
	}

	cli := &client.CmdAddPhoneNumber{
		Contextified: libkb.NewContextified(bob.tc.G),
		PhoneNumber:  "+" + phone,
	}
	err := cli.Run()
	require.NoError(t, err)

	code, err := kbtest.GetPhoneVerificationCode(bob.MetaContext(), keybase1.PhoneNumber("+"+phone))
	require.NoError(t, err)

	cli2 := &client.CmdVerifyPhoneNumber{
		Contextified: libkb.NewContextified(bob.tc.G),
		PhoneNumber:  "+" + phone,
		Code:         code,
	}
	err = cli2.Run()
	require.NoError(t, err)

	cli3 := &client.CmdSetVisibilityPhoneNumber{
		Contextified: libkb.NewContextified(bob.tc.G),
		PhoneNumber:  "+" + phone,
		Visibility:   keybase1.IdentityVisibility_PUBLIC,
	}
	err = cli3.Run()
	require.NoError(t, err)

	for _, u := range tt.users {
		usr, res, err := u.tc.G.Resolver.ResolveUser(u.MetaContext(), assertion)
		require.NoError(t, err)
		require.Equal(t, bob.username, res.GetUsername())
		require.Equal(t, bob.username, usr.Username)
		require.Equal(t, bob.uid, res.GetUID())
		require.Equal(t, bob.uid, usr.Uid)
		require.True(t, res.IsServerTrust())
	}

	// Try to create impteam with now-resolvable phone number.
	impteamName := fmt.Sprintf("%s,%s", assertion, ann.username)
	lookupRes, err := ann.lookupImplicitTeam2(true /* create */, impteamName, false /* public */)
	require.NoError(t, err)
	require.Equal(t, fmt.Sprintf("%s,%s", ann.username, bob.username), lookupRes.DisplayName.String())
}

func TestServerTrustResolveInvalidInput(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")

	checkErr := func(err error) {
		require.Error(t, err)
		require.IsType(t, libkb.ResolutionError{}, err)
		resErr := err.(libkb.ResolutionError)
		require.Equal(t, libkb.ResolutionErrorInvalidInput, resErr.Kind)
	}

	_, _, err := ann.tc.G.Resolver.ResolveUser(ann.MetaContext(), "111@phone")
	checkErr(err)
	_, _, err = ann.tc.G.Resolver.ResolveUser(ann.MetaContext(), "[notvalid@x]@email")
	checkErr(err)
}

type mockPhoneNotification struct {
	list        []keybase1.UserPhoneNumber
	category    string
	phoneNumber keybase1.PhoneNumber
}

type mockPhoneListener struct {
	libkb.NoopNotifyListener
	notifications []mockPhoneNotification
}

var _ libkb.NotifyListener = (*mockPhoneListener)(nil)

func (n *mockPhoneListener) PhoneNumbersChanged(list []keybase1.UserPhoneNumber, category string, phoneNumber keybase1.PhoneNumber) {
	n.notifications = append(n.notifications, mockPhoneNotification{
		list, category, phoneNumber,
	})
}

func (n *mockPhoneListener) DrainPhoneNumberNotifications() (ret []mockPhoneNotification) {
	ret = n.notifications
	n.notifications = nil
	return ret
}

func setupUserWithMockPhoneListener(user *userPlusDevice) *mockPhoneListener {
	userListener := &mockPhoneListener{}
	user.tc.G.SetService()
	user.tc.G.NotifyRouter.AddListener(userListener)
	return userListener
}

func TestPhoneNumberNotifications(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	annListener := setupUserWithMockPhoneListener(ann)
	bob := tt.addUser("bob")
	bobListener := setupUserWithMockPhoneListener(bob)
	tt.logUserNames()

	phone := "+" + kbtest.GenerateTestPhoneNumber()
	kbPhone := keybase1.PhoneNumber(phone)
	cli := &client.CmdAddPhoneNumber{
		Contextified: libkb.NewContextified(ann.tc.G),
		PhoneNumber:  phone,
	}
	err := cli.Run()
	require.NoError(t, err)

	assertNotificationGetList := func(listener *mockPhoneListener, phoneNumber keybase1.PhoneNumber, category string) []keybase1.UserPhoneNumber {
		notifications := listener.DrainPhoneNumberNotifications()
		require.Len(t, notifications, 1)
		require.Equal(t, kbPhone, notifications[0].phoneNumber)
		require.Equal(t, category, notifications[0].category)
		return notifications[0].list
	}

	// adding the phone number generates a notification
	ann.drainGregor()
	list := assertNotificationGetList(annListener, kbPhone, "phone.added")
	require.Len(t, list, 1)
	require.Equal(t, kbPhone, list[0].PhoneNumber)
	require.False(t, list[0].Verified)
	require.False(t, list[0].Superseded)

	// verifying the phone number generates a notification
	code, err := kbtest.GetPhoneVerificationCode(ann.MetaContext(), kbPhone)
	require.NoError(t, err)
	cli2 := &client.CmdVerifyPhoneNumber{
		Contextified: libkb.NewContextified(ann.tc.G),
		PhoneNumber:  phone,
		Code:         code,
	}
	err = cli2.Run()
	require.NoError(t, err)
	ann.drainGregor()
	list = assertNotificationGetList(annListener, kbPhone, "phone.verified")
	require.Len(t, list, 1)
	require.Equal(t, kbPhone, list[0].PhoneNumber)
	require.True(t, list[0].Verified)
	require.False(t, list[0].Superseded)

	// if bob now adds and verifies that same number, he should have new notifications for add and verify
	// and ann should have one that her number was superseded
	cli3 := &client.CmdAddPhoneNumber{
		Contextified: libkb.NewContextified(bob.tc.G),
		PhoneNumber:  phone,
	}
	err = cli3.Run()
	require.NoError(t, err)
	bob.drainGregor()
	list = assertNotificationGetList(bobListener, kbPhone, "phone.added")
	require.Len(t, list, 1)
	code, err = kbtest.GetPhoneVerificationCode(bob.MetaContext(), kbPhone)
	require.NoError(t, err)
	cli4 := &client.CmdVerifyPhoneNumber{
		Contextified: libkb.NewContextified(bob.tc.G),
		PhoneNumber:  phone,
		Code:         code,
	}
	err = cli4.Run()
	require.NoError(t, err)

	bob.drainGregor()
	list = assertNotificationGetList(bobListener, kbPhone, "phone.verified")
	require.Len(t, list, 1)
	require.Equal(t, kbPhone, list[0].PhoneNumber)
	require.True(t, list[0].Verified)
	require.False(t, list[0].Superseded)

	ann.drainGregor()
	list = assertNotificationGetList(annListener, kbPhone, "phone.superseded")
	require.Len(t, list, 1)
	require.Equal(t, kbPhone, list[0].PhoneNumber)
	require.True(t, list[0].Verified)
	require.True(t, list[0].Superseded)
}

func TestImplicitTeamWithEmail(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	bob := tt.addUser("bob")

	email := bob.userInfo.email
	assertion := fmt.Sprintf("[%s]@email", email)

	impteamName := fmt.Sprintf("%s,%s", ann.username, assertion)
	teamID, err := ann.lookupImplicitTeam(true /* create */, impteamName, false /* public */)
	require.NoError(t, err)

	teamObj := ann.loadTeamByID(teamID, true /* admin */)
	require.Equal(t, 1, teamObj.NumActiveInvites())
	var invite keybase1.TeamInvite
	for _, invite = range teamObj.GetActiveAndObsoleteInvites() {
		// Get first invite to local var
	}
	require.EqualValues(t, email, invite.Name)
	invCat, err := invite.Type.C()
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamInviteCategory_EMAIL, invCat)

	name, err := teamObj.ImplicitTeamDisplayName(context.Background())
	require.NoError(t, err)
	require.Len(t, name.Writers.KeybaseUsers, 1)
	require.Len(t, name.Writers.UnresolvedUsers, 1)
	require.Equal(t, fmt.Sprintf("%s,%s", assertion, ann.username), name.String())

	t.Logf("Got display name back: %q", name.String())

	seqnoAfterResolve := teamObj.NextSeqno()

	// Verifying an email should RSVP the invitation which will notify
	// (using SBS gregor msg) ann to resolve it.
	err = kbtest.VerifyEmailAuto(bob.MetaContext(), keybase1.EmailAddress(email))
	require.NoError(t, err)
	err = emails.SetVisibilityEmail(bob.MetaContext(), keybase1.EmailAddress(email), keybase1.IdentityVisibility_PUBLIC)
	require.NoError(t, err)

	ann.pollForTeamSeqnoLinkWithLoadArgs(keybase1.LoadTeamArg{ID: teamID}, seqnoAfterResolve)
}
