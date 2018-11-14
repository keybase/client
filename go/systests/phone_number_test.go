package systests

import (
	"context"
	"fmt"
	"testing"

	"github.com/keybase/client/go/client"
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

type mockListener struct {
	libkb.NoopNotifyListener
	addedPhones      []keybase1.PhoneNumber
	verifiedPhones   []keybase1.PhoneNumber
	supersededPhones []keybase1.PhoneNumber
}

var _ libkb.NotifyListener = (*mockListener)(nil)

func (n *mockListener) PhoneNumberAdded(phoneNumber keybase1.PhoneNumber) {
	n.addedPhones = append(n.addedPhones, phoneNumber)
}

func (n *mockListener) PhoneNumberVerified(phoneNumber keybase1.PhoneNumber) {
	n.verifiedPhones = append(n.verifiedPhones, phoneNumber)
}

func (n *mockListener) PhoneNumberSuperseded(phoneNumber keybase1.PhoneNumber) {
	n.supersededPhones = append(n.supersededPhones, phoneNumber)
}

func setupUserWithMockListener(user *userPlusDevice) *mockListener {
	userListener := &mockListener{
		addedPhones:      []keybase1.PhoneNumber(nil),
		verifiedPhones:   []keybase1.PhoneNumber(nil),
		supersededPhones: []keybase1.PhoneNumber(nil),
	}
	user.tc.G.SetService()
	user.tc.G.NotifyRouter.SetListener(userListener)
	return userListener
}

func TestPhoneNumberNotifications(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()
	ann := tt.addUser("ann")
	annListener := setupUserWithMockListener(ann)
	defer ann.tc.Cleanup()
	bob := tt.addUser("bob")
	bobListener := setupUserWithMockListener(bob)
	defer bob.tc.Cleanup()
	tt.logUserNames()

	phone := "+" + kbtest.GenerateTestPhoneNumber()
	kbPhone := keybase1.PhoneNumber(phone)
	expectedNotification := []keybase1.PhoneNumber{kbPhone}
	cli := &client.CmdAddPhoneNumber{
		Contextified: libkb.NewContextified(ann.tc.G),
		PhoneNumber:  phone,
	}
	err := cli.Run()
	require.NoError(t, err)

	// adding the phone number generates a notification
	ann.drainGregor()
	require.Equal(t, annListener.addedPhones, expectedNotification)

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
	require.Equal(t, annListener.verifiedPhones, expectedNotification)
	require.Equal(t, annListener.supersededPhones, []keybase1.PhoneNumber(nil))

	// if bob now adds and verifies that same number, he should have new notifications for add and verify
	// and ann should have one that her number was superseded
	cli3 := &client.CmdAddPhoneNumber{
		Contextified: libkb.NewContextified(bob.tc.G),
		PhoneNumber:  phone,
	}
	err = cli3.Run()
	require.NoError(t, err)
	bob.drainGregor()
	require.Equal(t, bobListener.addedPhones, expectedNotification)
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
	require.Equal(t, bobListener.verifiedPhones, expectedNotification)
	require.Equal(t, annListener.supersededPhones, expectedNotification)
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
	err = kbtest.VerifyEmailAuto(bob.MetaContext(), email)
	require.NoError(t, err)

	ann.pollForTeamSeqnoLinkWithLoadArgs(keybase1.LoadTeamArg{ID: teamID}, seqnoAfterResolve)
}
