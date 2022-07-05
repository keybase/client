package systests

import (
	"testing"

	"github.com/keybase/client/go/teams"

	"github.com/keybase/client/go/emails"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/phonenumbers"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
)

func assertionFromKV(t *testing.T, key, value string) libkb.AssertionURL {
	actx := externals.MakeStaticAssertionContext(context.TODO())
	ret, err := libkb.ParseAssertionURLKeyValue(actx, key, value, true /* strict */)
	require.NoError(t, err)
	return ret
}

// Same SBS test can run against different SBS types, where each one has
// different way of proving (verifying), revoking etc. Encapsulate all that
// under a type that implements `userSBSProvider` and pass it to the "generic"
// SBS test function.
type userSBSProvider interface {
	SetUser(user *userPlusDevice)
	GetAssertionKV() (key string, value string)
	Verify()
	Revoke()
}

// Phone numbers
type userSBSPhoneNumber struct {
	u           *userPlusDevice
	phoneNumber string //without `+`
}

func (p *userSBSPhoneNumber) SetUser(user *userPlusDevice) {
	p.u = user
	p.phoneNumber = kbtest.GenerateTestPhoneNumber()
}

func (p *userSBSPhoneNumber) GetAssertionKV() (key string, value string) {
	return "phone", p.phoneNumber
}

func (p *userSBSPhoneNumber) Verify() {
	mctx := p.u.MetaContext()
	tctx := p.u.tc
	phoneNumber := keybase1.PhoneNumber("+" + p.phoneNumber)
	require.NoError(tctx.T, phonenumbers.AddPhoneNumber(mctx, phoneNumber, keybase1.IdentityVisibility_PUBLIC))
	code, err := kbtest.GetPhoneVerificationCode(libkb.NewMetaContextTODO(tctx.G), phoneNumber)
	require.NoError(tctx.T, err)
	require.NoError(tctx.T, phonenumbers.VerifyPhoneNumber(mctx, phoneNumber, code))
}

func (p *userSBSPhoneNumber) Revoke() {
	err := phonenumbers.DeletePhoneNumber(p.u.MetaContext(), keybase1.PhoneNumber("+"+p.phoneNumber))
	require.NoError(p.u.tc.T, err)
}

// ------------------

// Emails
type userSBSEmail struct {
	u *userPlusDevice
}

func (p *userSBSEmail) SetUser(user *userPlusDevice) {
	p.u = user
}

func (p *userSBSEmail) GetAssertionKV() (key string, value string) {
	return "email", p.u.userInfo.email
}

func (p *userSBSEmail) Verify() {
	emailAddress := keybase1.EmailAddress(p.u.userInfo.email)
	err := emails.SetVisibilityEmail(p.u.MetaContext(), emailAddress, keybase1.IdentityVisibility_PUBLIC)
	require.NoError(p.u.tc.T, err)
	err = kbtest.VerifyEmailAuto(p.u.MetaContext(), emailAddress)
	require.NoError(p.u.tc.T, err)
}

func (p *userSBSEmail) Revoke() {
	err := emails.DeleteEmail(p.u.MetaContext(), keybase1.EmailAddress(p.u.userInfo.email))
	require.NoError(p.u.tc.T, err)
}

// ------------------

// Rooter
type userSBSRooter struct {
	u *userPlusDevice
}

func (p *userSBSRooter) SetUser(user *userPlusDevice) {
	p.u = user
}

func (p *userSBSRooter) GetAssertionKV() (key string, value string) {
	return "rooter", p.u.username
}

func (p *userSBSRooter) Verify() {
	p.u.proveRooter()
}

func (p *userSBSRooter) Revoke() {
	p.u.revokeServiceProof("rooter")
}

// ------------------

func testTeamInviteSBS(t *testing.T, sbs userSBSProvider) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	bob := tt.addUser("bob")
	sbs.SetUser(bob)

	// User 0 creates a team.
	teamID, teamName := ann.createTeam2()

	key, value := sbs.GetAssertionKV()
	assertionURL := assertionFromKV(t, key, value)
	assertion := assertionURL.String()

	ann.addTeamMember(teamName.String(), assertion, keybase1.TeamRole_WRITER)

	ann.kickTeamRekeyd()
	sbs.Verify()

	ann.waitForTeamChangedGregor(teamID, keybase1.Seqno(3))
	bob.waitForTeamChangedGregor(teamID, keybase1.Seqno(3))

	// The team should have user 1 in it now as a writer.
	t0 := ann.loadTeam(teamName.String(), true /* admin */)
	writers, err := t0.UsersWithRole(keybase1.TeamRole_WRITER)
	require.NoError(t, err)
	require.Len(t, writers, 1)
	require.Equal(t, bob.uid, writers[0].Uid)

	// The invite should not be in the active invite map.
	require.Equal(t, 0, t0.NumActiveInvites())
	exists, err := t0.HasActiveInvite(tt.users[0].tc.MetaContext(), keybase1.TeamInviteName(value), key)
	require.NoError(t, err)
	require.False(t, exists, "after accepting invite, active invite shouldn't exist")
}

func TestTeamInviteSBSPhone(t *testing.T) {
	testTeamInviteSBS(t, &userSBSPhoneNumber{})
}

func TestTeamInviteSBSEmail(t *testing.T) {
	testTeamInviteSBS(t, &userSBSEmail{})
}

func TestTeamInviteSBSRooter(t *testing.T) {
	testTeamInviteSBS(t, &userSBSRooter{})
}

// ------------------

func testTeamInviteExistingUserSBS(t *testing.T, sbs userSBSProvider) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	bob := tt.addUser("bob")
	sbs.SetUser(bob)

	key, value := sbs.GetAssertionKV()
	assertionURL := assertionFromKV(t, key, value)
	assertion := assertionURL.String()

	sbs.Verify()

	// User 0 creates a team.
	_, teamName := ann.createTeam2()

	// Add bob by SBS assertion. Should just add bob and not an invite. Adding
	// resolvable SBS assertion via invite would also bounce off the server
	// with `TEAM_INVITE_USER_EXISTS` error.
	ann.addTeamMember(teamName.String(), assertion, keybase1.TeamRole_WRITER)

	// The team should have user 1 in it now as a writer.
	t0 := ann.loadTeam(teamName.String(), true /* admin */)
	writers, err := t0.UsersWithRole(keybase1.TeamRole_WRITER)
	require.NoError(t, err)
	require.Len(t, writers, 1)
	require.Equal(t, bob.uid, writers[0].Uid)

	// There should be no invite for the SBS.
	require.Equal(t, 0, t0.NumActiveInvites())
	exists, err := t0.HasActiveInvite(tt.users[0].tc.MetaContext(), keybase1.TeamInviteName(value), key)
	require.NoError(t, err)
	require.False(t, exists, "after adding resolvable assertion, no invite should have been created")
}

func TestTeamInviteExistingUserSBSPhone(t *testing.T) {
	testTeamInviteExistingUserSBS(t, &userSBSPhoneNumber{})
}

func TestTeamInviteExistingUserSBSEmail(t *testing.T) {
	testTeamInviteExistingUserSBS(t, &userSBSEmail{})
}

func TestTeamInviteExistingUserSBSRooter(t *testing.T) {
	testTeamInviteExistingUserSBS(t, &userSBSRooter{})
}

// ------------------

func TestTeamInviteSBSError(t *testing.T) {
	// Make sure we can't add invites for assertions if we can't attempt to
	// resolve them.

	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	bob := tt.addUser("bob")

	ann.disableTOFUSearch()

	teamID, teamName := ann.createTeam2()

	sbsProviders := []userSBSProvider{
		&userSBSEmail{},
		&userSBSPhoneNumber{},
	}

	for _, sbs := range sbsProviders {
		sbs.SetUser(bob)
		sbs.Verify()

		key, value := sbs.GetAssertionKV()
		assertionURL := assertionFromKV(t, key, value)
		assertion := assertionURL.String()

		_, err := teams.AddMemberByID(context.TODO(), ann.tc.G, teamID, assertion, keybase1.TeamRole_WRITER, nil, nil /* emailInviteMsg */)
		require.Error(t, err)
		require.Contains(t, err.Error(), "error 602") // user cannot search for assertions
	}

	t0 := ann.loadTeam(teamName.String(), true /* admin */)
	require.Equal(t, 0, t0.NumActiveInvites())
}
