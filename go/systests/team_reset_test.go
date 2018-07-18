package systests

import (
	"testing"

	"golang.org/x/net/context"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	teams "github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func divDebug(ctx *smuContext, fmt string, arg ...interface{}) {
	div := "------------"
	ctx.log.Debug(div+" "+fmt+" "+div, arg...)
}

func pollForMembershipUpdate(team smuTeam, ann *smuUser, bob *smuUser, cam *smuUser) {

	// Keep reloading this team until we get that Bob has been deactivated.
	// It might happen after the team is rotated, since a cache bust via gregor has
	// to happen
	poller := func(d keybase1.TeamDetails) bool {
		for _, member := range d.Members.Writers {
			switch member.Username {
			case bob.username:
				return member.Status.IsReset()
			}
		}
		return false
	}

	details := ann.pollForMembershipUpdate(team, keybase1.PerTeamKeyGeneration(2), poller)
	for _, member := range details.Members.Admins {
		switch member.Username {
		case ann.username:
			require.True(ann.ctx.t, member.Status.IsActive())
		default:
			ann.ctx.t.Fatalf("unknown admin: %s", member.Username)
		}
	}
	for _, member := range details.Members.Writers {
		switch member.Username {
		case bob.username:
			require.True(ann.ctx.t, member.Status.IsReset())
		case cam.username:
			require.True(ann.ctx.t, member.Status.IsActive())
		default:
			ann.ctx.t.Fatalf("unknown writer: %s (%+v)", member.Username, details)
		}
	}
	ann.ctx.log.Debug("team details checked out: %+v", details)
}

// tests a user deleting her account.
func TestTeamDelete(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	divDebug(ctx, "Signed up ann (%s)", ann.username)
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s)", bob.username)
	cam := ctx.installKeybaseForUser("cam", 10)
	cam.signup()
	divDebug(ctx, "Signed up cam (%s)", cam.username)

	team := ann.createTeam([]*smuUser{bob, cam})
	divDebug(ctx, "team created (%s)", team.name)

	ann.sendChat(team, "0")
	divDebug(ctx, "Sent chat '0' (%s via %s)", team.name, ann.username)

	ann.readChats(team, 1)
	bob.readChats(team, 1)
	divDebug(ctx, "Ann and bob can read")

	// just one person needs to do this before ann deletes, so her
	// deletion will immediately fall into accelerated rekeyd.
	kickTeamRekeyd(bob.getPrimaryGlobalContext(), t)

	ann.delete()
	divDebug(ctx, "Ann deleted her account")
	divDebug(ctx, "ann uid: %s", ann.uid())
	divDebug(ctx, "bob uid: %s", bob.uid())
	divDebug(ctx, "cam uid: %s", cam.uid())

	// bob and cam should see the key get rotated after ann deletes
	bob.pollForMembershipUpdate(team, keybase1.PerTeamKeyGeneration(2), nil)
	cam.pollForMembershipUpdate(team, keybase1.PerTeamKeyGeneration(2), nil)

	// It's important for cam to clear her cache right before the attempt to send,
	// since she might have received gregors that ann deleted her account,
	// and therefore might be trying to refresh and load the team.
	cam.primaryDevice().clearUPAKCache()
	cam.sendChat(team, "1")

	divDebug(ctx, "Cam sent a chat")
	bob.readChats(team, 2)

	// Disable UIDMapper cache to be able to see current state of
	// Active/Inactive for members.
	bob.setUIDMapperNoCachingMode(true)
	cam.setUIDMapperNoCachingMode(true)

	bob.assertMemberInactive(team, ann)
	bob.assertMemberActive(team, cam)

	cam.assertMemberInactive(team, ann)
	cam.assertMemberActive(team, bob)
}

func TestTeamReset(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	divDebug(ctx, "Signed up ann (%s, %s)", ann.username, ann.uid())
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s, %s)", bob.username, bob.uid())
	cam := ctx.installKeybaseForUser("cam", 10)
	cam.signup()
	divDebug(ctx, "Signed up cam (%s, %s)", cam.username, cam.uid())

	// Note that ann (the admin) has a UIDMapper that should get pubsub updates
	// since she is an admin for the team in question. cam won't get those
	// pubsub updates
	ann.setUIDMapperNoCachingMode(true)
	bob.setUIDMapperNoCachingMode(true)
	cam.setUIDMapperNoCachingMode(true)

	team := ann.createTeam([]*smuUser{bob, cam})
	divDebug(ctx, "team created (%s)", team.name)

	// ensure bob is active according to other users
	ann.assertMemberActive(team, bob)
	cam.assertMemberActive(team, bob)

	ann.sendChat(team, "0")
	divDebug(ctx, "Sent chat '0' (%s via %s)", team.name, ann.username)

	ann.readChats(team, 1)
	bob.readChats(team, 1)

	kickTeamRekeyd(bob.getPrimaryGlobalContext(), t)
	bob.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)

	pollForMembershipUpdate(team, ann, bob, cam)
	divDebug(ctx, "Polled for rekey")

	// bob should be inactive according to other users
	ann.assertMemberInactive(team, bob)
	cam.assertMemberInactive(team, bob)

	bob.loginAfterReset(10)
	divDebug(ctx, "Bob logged in after reset")

	// bob should be inactive according to other users
	ann.assertMemberInactive(team, bob)
	cam.assertMemberInactive(team, bob)

	_, err := bob.teamGet(team)
	require.Error(t, err)
	ae, ok := err.(libkb.AppStatusError)
	require.True(t, ok)
	require.Equal(t, ae.Code, int(keybase1.StatusCode_SCTeamReadError))
	divDebug(ctx, "Bob failed to read the team")

	// Make sure that ann can still send even though bob is ousted
	ann.sendChat(team, "1")
	divDebug(ctx, "Sent chat '1' (%s via %s)", team.name, ann.username)
	ann.readChats(team, 2)
	// Same goes for cam --- note that she never read before, so nothing
	// is cached for her.
	cam.readChats(team, 2)

	_, err = bob.readChatsWithError(team)
	require.Error(t, err)
	ae, ok = err.(libkb.AppStatusError)
	require.True(t, ok)
	require.Equal(t, ae.Code, int(keybase1.StatusCode_SCTeamReadError))
	divDebug(ctx, "Bob failed to read the chat")

	ann.addWriter(team, bob)
	divDebug(ctx, "Added bob back as a writer")
	_, err = bob.teamGet(team)
	require.NoError(t, err)
	divDebug(ctx, "Bob could read the team after added back")
	bob.readChats(team, 2)
	divDebug(ctx, "Bob reading chats after added back")
	ann.sendChat(team, "2")
	divDebug(ctx, "Ann sending chat '2'")
	bob.readChats(team, 3)
	divDebug(ctx, "Bob reading chat '2'")
}

// add bob (a user who has reset his account) to a team
// that he was never a member of
func TestTeamResetAdd(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	divDebug(ctx, "Signed up ann (%s)", ann.username)
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s)", bob.username)
	cam := ctx.installKeybaseForUser("cam", 10)
	cam.signup()
	divDebug(ctx, "Signed up cam (%s)", cam.username)

	team := ann.createTeam([]*smuUser{cam})
	divDebug(ctx, "team created (%s)", team.name)

	ann.sendChat(team, "0")
	divDebug(ctx, "Sent chat '2' (%s via %s)", team.name, ann.username)

	ann.readChats(team, 1)

	bob.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)

	bob.loginAfterReset(10)
	divDebug(ctx, "Bob logged in after reset")

	_, err := bob.teamGet(team)
	require.Error(t, err)
	divDebug(ctx, "Bob failed to read the team")

	ann.addWriter(team, bob)
	divDebug(ctx, "Added bob as a writer")
	_, err = bob.teamGet(team)
	require.NoError(t, err)
	divDebug(ctx, "Bob could read the team after added")
	bob.readChats(team, 1)
	divDebug(ctx, "Bob reading chats after added")
	ann.sendChat(team, "1")
	divDebug(ctx, "Ann sending chat '2'")
	bob.readChats(team, 2)
	divDebug(ctx, "Bob reading chat '2'")
}

// Ann creates a team, and adds Bob as an admin. Then Alice resets, and Bob readmits
// Ann as an admin (since he can't make her an owner). It should work.
func TestTeamOwnerResetAdminReadmit(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	divDebug(ctx, "Signed up ann (%s)", ann.username)
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s)", bob.username)

	team := ann.createTeam([]*smuUser{})
	divDebug(ctx, "team created (%s)", team.name)
	ann.addAdmin(team, bob)

	ann.reset()
	divDebug(ctx, "Reset ann (%s)", ann.username)

	ann.loginAfterReset(2)
	divDebug(ctx, "Ann logged in after reset")
	bob.addAdmin(team, ann)
	_, err := ann.teamGet(team)
	require.NoError(t, err)
	divDebug(ctx, "Ann read the team")
}

// add bob (a user who has reset his account and has no PUK) to a team
// that he was never a member of
func TestTeamResetAddNoPUK(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	divDebug(ctx, "Signed up ann (%s)", ann.username)
	bob := ctx.installKeybaseForUserNoPUK("bob", 10)
	bob.signupNoPUK()
	divDebug(ctx, "Signed up bob (%s)", bob.username)
	cam := ctx.installKeybaseForUser("cam", 10)
	cam.signup()
	divDebug(ctx, "Signed up cam (%s)", cam.username)

	team := ann.createTeam([]*smuUser{cam})
	divDebug(ctx, "team created (%s)", team.name)

	ann.sendChat(team, "0")
	divDebug(ctx, "Sent chat '2' (%s via %s)", team.name, ann.username)

	ann.readChats(team, 1)

	bob.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)

	bob.loginAfterResetNoPUK(1)
	divDebug(ctx, "Bob logged in after reset")

	_, err := bob.teamGet(team)
	require.Error(t, err)
	divDebug(ctx, "Bob failed to read the team")

	// this is the main point of the test, to get this to work
	// without an eldest seqno error.
	ann.addWriter(team, bob)
	divDebug(ctx, "Added bob as a writer")
}

// bob resets and added with no keys
func TestTeamResetNoKeys(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	divDebug(ctx, "Signed up ann (%s)", ann.username)
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s)", bob.username)
	cam := ctx.installKeybaseForUser("cam", 10)
	cam.signup()
	divDebug(ctx, "Signed up cam (%s)", cam.username)

	team := ann.createTeam([]*smuUser{cam})
	divDebug(ctx, "team created (%s)", team.name)

	ann.sendChat(team, "0")
	divDebug(ctx, "Sent chat '2' (%s via %s)", team.name, ann.username)

	ann.readChats(team, 1)

	bob.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)

	ann.addWriter(team, bob)
	divDebug(ctx, "Added bob as a writer")
}

// bob resets several times and added with no keys
func TestTeamResetManyNoKeys(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	divDebug(ctx, "Signed up ann (%s)", ann.username)
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s)", bob.username)
	cam := ctx.installKeybaseForUser("cam", 10)
	cam.signup()
	divDebug(ctx, "Signed up cam (%s)", cam.username)

	team := ann.createTeam([]*smuUser{cam})
	divDebug(ctx, "team created (%s)", team.name)

	ann.sendChat(team, "0")
	divDebug(ctx, "Sent chat '2' (%s via %s)", team.name, ann.username)

	ann.readChats(team, 1)

	for i := 0; i < 5; i++ {
		bob.reset()
		divDebug(ctx, "Reset bob (%s)", bob.username)

		bob.loginAfterReset(10)
		divDebug(ctx, "Bob logged in after reset")
	}

	ann.addWriter(team, bob)
	divDebug(ctx, "Added bob as a writer")
}

// bob resets and has no keys, added as an admin
func TestTeamResetNoKeysAdmin(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	divDebug(ctx, "Signed up ann (%s)", ann.username)
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s)", bob.username)
	cam := ctx.installKeybaseForUser("cam", 10)
	cam.signup()
	divDebug(ctx, "Signed up cam (%s)", cam.username)

	team := ann.createTeam([]*smuUser{cam})
	divDebug(ctx, "team created (%s)", team.name)

	ann.sendChat(team, "0")
	divDebug(ctx, "Sent chat '2' (%s via %s)", team.name, ann.username)

	ann.readChats(team, 1)

	bob.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)

	ann.addAdmin(team, bob)
	divDebug(ctx, "Added bob as an admin")
}

// Remove a member who was in a team and reset.
func TestTeamRemoveAfterReset(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	divDebug(ctx, "Signed up ann (%s)", ann.username)
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s)", bob.username)
	joe := ctx.installKeybaseForUser("joe", 10)
	joe.signup()
	divDebug(ctx, "Signed up joe (%s)", joe.username)

	team := ann.createTeam([]*smuUser{bob, joe})
	divDebug(ctx, "team created (%s)", team.name)

	kickTeamRekeyd(ann.getPrimaryGlobalContext(), t)
	bob.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)

	bob.loginAfterReset(10)
	divDebug(ctx, "Bob logged in after reset")
	ann.pollForMembershipUpdate(team, keybase1.PerTeamKeyGeneration(2), nil)

	joe.reset()
	divDebug(ctx, "Reset joe (%s), not re-provisioning though!", joe.username)

	ann.pollForMembershipUpdate(team, keybase1.PerTeamKeyGeneration(3), nil)

	cli := ann.getTeamsClient()
	err := cli.TeamRemoveMember(context.TODO(), keybase1.TeamRemoveMemberArg{
		Name:     team.name,
		Username: bob.username,
	})
	require.NoError(t, err)

	err = cli.TeamRemoveMember(context.TODO(), keybase1.TeamRemoveMemberArg{
		Name:     team.name,
		Username: joe.username,
	})
	require.NoError(t, err)

	G := ann.getPrimaryGlobalContext()
	teams.NewTeamLoaderAndInstall(G)
	role, err := teams.MemberRole(context.TODO(), G, team.name, bob.username)
	require.NoError(t, err)
	require.Equal(t, role, keybase1.TeamRole_NONE)
}

func TestTeamRemoveMemberAfterDelete(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	divDebug(ctx, "Signed up ann (%s)", ann.username)
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s)", bob.username)

	team := ann.createTeam([]*smuUser{bob})
	divDebug(ctx, "team created (%s)", team.name)

	bobUID := bob.uid()

	bob.delete()
	divDebug(ctx, "Bob deleted (%s)", bob.username)

	ann.pollForMembershipUpdate(team, keybase1.PerTeamKeyGeneration(2), nil)

	// Ensure ann sees bob as deleted, and not some cached remnant of
	// the past.
	ann.primaryDevice().clearUPAKCache()
	G := ann.getPrimaryGlobalContext()
	arg := libkb.NewLoadUserArg(G).WithNetContext(context.Background()).
		WithUID(bobUID).WithPublicKeyOptional()
	upak, _, err := G.GetUPAKLoader().LoadV2(arg)
	require.NoError(t, err)
	require.EqualValues(t, libkb.SCDeleted, upak.Current.Status)

	cli := ann.getTeamsClient()
	err = cli.TeamRemoveMember(context.Background(), keybase1.TeamRemoveMemberArg{
		Name:     team.name,
		Username: bob.username,
	})
	require.NoError(t, err)

	t.Logf("Calling TeamGet")

	details, err := cli.TeamGet(context.Background(), keybase1.TeamGetArg{
		Name: team.name,
	})
	require.NoError(t, err)

	require.Equal(t, 1, len(details.Members.Owners))
	require.Equal(t, ann.username, details.Members.Owners[0].Username)
	require.Equal(t, 0, len(details.Members.Admins))
	require.Equal(t, 0, len(details.Members.Writers))
	require.Equal(t, 0, len(details.Members.Readers))
}

func TestTeamTryAddDeletedUser(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	divDebug(ctx, "Signed up ann (%s)", ann.username)

	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s)", bob.username)
	bob.delete()
	divDebug(ctx, "Bob deleted (%s)", bob.username)

	cli := ann.getTeamsClient()
	team := ann.createTeam([]*smuUser{})
	divDebug(ctx, "team created (%s)", team.name)

	_, err := cli.TeamAddMember(context.Background(), keybase1.TeamAddMemberArg{
		Name:     team.name,
		Username: bob.username,
		Role:     keybase1.TeamRole_READER,
	})
	require.Error(t, err)
}

// Add a member after reset in a normal (non-implicit) team
func TestTeamReAddAfterReset(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	divDebug(ctx, "Signed up ann (%s)", ann.username)
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s)", bob.username)

	team := ann.createTeam([]*smuUser{bob})
	divDebug(ctx, "team created (%s)", team.name)

	ann.sendChat(team, "0")

	kickTeamRekeyd(ann.getPrimaryGlobalContext(), t)
	bob.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)

	bob.loginAfterReset(10)
	divDebug(ctx, "Bob logged in after reset")

	ann.pollForMembershipUpdate(team, keybase1.PerTeamKeyGeneration(2), nil)

	cli := ann.getTeamsClient()
	_, err := cli.TeamAddMember(context.TODO(), keybase1.TeamAddMemberArg{
		Name:     team.name,
		Username: bob.username,
		// Note: any role would do! Does not have to be the same as before
		// reset. This does not apply to imp-teams though, it requires the
		// same role there.
		Role: keybase1.TeamRole_READER,
	})
	require.NoError(t, err)

	G := ann.getPrimaryGlobalContext()
	teams.NewTeamLoaderAndInstall(G)
	role, err := teams.MemberRole(context.TODO(), G, team.name, bob.username)
	require.NoError(t, err)
	require.Equal(t, role, keybase1.TeamRole_READER)

	bob.readChats(team, 1)
}

func TestTeamResetOpen(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	divDebug(ctx, "Signed up ann (%s)", ann.username)
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s)", bob.username)

	team := ann.createTeam([]*smuUser{bob})
	divDebug(ctx, "team created (%s)", team.name)
	ann.openTeam(team, keybase1.TeamRole_WRITER)
	ann.assertMemberActive(team, bob)

	kickTeamRekeyd(ann.getPrimaryGlobalContext(), t)
	bob.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)

	// Expecting that CLKR handler will remove bob from the team.
	details := ann.pollForMembershipUpdate(team, keybase1.PerTeamKeyGeneration(2), nil)
	t.Logf("details from poll: %+v", details)
	teamObj := ann.loadTeam(team.name, false)
	_, err := teamObj.UserVersionByUID(context.Background(), bob.uid())
	require.Error(t, err, "expecting reset user to be removed from the team")
	require.Contains(t, err.Error(), "did not find user")

	bob.loginAfterReset(10)
	divDebug(ctx, "Bob logged in after reset")

	bob.requestAccess(team)
	divDebug(ctx, "Bob requested access to open team after reset")

	ann.pollForTeamSeqnoLink(team, teamObj.NextSeqno())
	ann.assertMemberActive(team, bob)

	// Generation should still be 2 - expecting just one rotate when
	// bob is kicked out, and after he requests access again, he is
	// just added in.
	teamObj = ann.loadTeam(team.name, false)
	require.Equal(t, keybase1.PerTeamKeyGeneration(2), teamObj.Generation())
}

func TestTeamListAfterReset(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	divDebug(ctx, "Signed up ann (%s, %s)", ann.username, ann.uid())
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s, %s)", bob.username, bob.uid())
	cam := ctx.installKeybaseForUser("cam", 10)
	cam.signup()
	divDebug(ctx, "Signed up cam (%s, %s)", cam.username, cam.uid())

	team := ann.createTeam([]*smuUser{bob, cam})
	divDebug(ctx, "team created (%s)", team.name)

	// ensure bob is active according to other users
	ann.assertMemberActive(team, bob)

	bob.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)

	bob.loginAfterReset(10)
	divDebug(ctx, "Bob logged in after reset")

	ann.addWriter(team, bob)
	divDebug(ctx, "Added bob back as a writer")

	list, err := cam.teamGet(team)
	require.NoError(t, err)
	found := false
	for _, w := range list.Members.Writers {
		if w.Username == bob.username {
			require.False(t, found, "wasn't found twice")
			require.True(t, w.Uv.EldestSeqno > 1, "reset eldest seqno")
			require.True(t, w.Status.IsActive(), "is active")
			found = true
		}
	}
	require.True(t, found, "we found bob (before he found us)")
}

func TestTeamAfterDeleteUser(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	divDebug(ctx, "Signed up ann (%s, %s)", ann.username, ann.uid())
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s, %s)", bob.username, bob.uid())

	team := ann.createTeam([]*smuUser{bob})
	divDebug(ctx, "team created (%s)", team.name)

	ann.sendChat(team, "0")
	divDebug(ctx, "Sent chat '0' (%s via %s)", team.name, ann.username)

	kickTeamRekeyd(ann.getPrimaryGlobalContext(), t)
	ann.delete()

	bob.pollForMembershipUpdate(team, keybase1.PerTeamKeyGeneration(2), nil)

	divDebug(ctx, "Deleted ann (%s)", ann.username)

	_, err := bob.teamGet(team)
	require.NoError(t, err)

	bob.dbNuke()

	_, err = bob.teamGet(team)
	require.NoError(t, err)

	bob.readChats(team, 1)
}

func testTeamResetBadgesAndDismiss(t *testing.T, readd bool) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUser("own")
	tt.addUser("roo")

	teamID, teamName := tt.users[0].createTeam2()
	tt.users[0].kickTeamRekeyd()
	tt.users[0].addTeamMember(teamName.String(), tt.users[1].username, keybase1.TeamRole_WRITER)
	tt.users[1].reset()
	tt.users[0].waitForTeamChangedGregor(teamID, keybase1.Seqno(2))
	// wait for badge state to have 1 team w/ reset member
	badgeState := tt.users[0].waitForBadgeStateWithReset(1)

	// users[0] should be badged since users[1] reset
	if len(badgeState.TeamsWithResetUsers) == 0 {
		t.Fatal("TeamsWithResetUsers is empty after reset")
	}
	out := badgeState.TeamsWithResetUsers[0]
	if out.Teamname != teamName.String() {
		t.Errorf("badged team name: %s, expected %s", out.Teamname, teamName)
	}
	if out.Username != tt.users[1].username {
		t.Errorf("badged user: %s, expected %s", out.Username, tt.users[1].username)
	}

	// users[1] logs in after reset
	tt.users[1].loginAfterReset()

	// Either re-adding or removing user from the team should clear
	// the reset badge.
	if readd {
		// users[0] adds users[1] back to the team
		tt.users[0].addTeamMember(teamName.String(), tt.users[1].username, keybase1.TeamRole_WRITER)
	} else {
		// users[0] removes users[1] from the team
		tt.users[0].removeTeamMember(teamName.String(), tt.users[1].username)
	}

	// wait for badge state to have no teams w/ reset member
	badgeState = tt.users[0].waitForBadgeStateWithReset(0)

	// badge state should be cleared
	if len(badgeState.TeamsWithResetUsers) != 0 {
		t.Errorf("badge state for TeamsWithResetUsers not empty: %d", len(badgeState.TeamsWithResetUsers))
	}
}

// TestTeamResetBadges checks that badges show up for admins
// when a member of the team resets, and that they are dismissed
// when the reset user is added.
func TestTeamResetBadgesOnAdd(t *testing.T) {
	testTeamResetBadgesAndDismiss(t, true)
}

// TestTeamResetBadgesOnRemove checks that badges show up for admins
// when a member of the team resets, and that they are dismissed
// when the reset user is removed.
func TestTeamResetBadgesOnRemove(t *testing.T) {
	testTeamResetBadgesAndDismiss(t, false)
}

// Test users leaving the team when their eldest seqno is not 1.
func TestTeamResetAfterReset(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	alice := tt.addUser("alice")
	bob := tt.addUser("bob")

	bob.reset()
	bob.loginAfterReset()
	_, teamName := alice.createTeam2()
	tn := teamName.String()
	alice.addTeamMember(tn, bob.username, keybase1.TeamRole_OWNER)
	bob.leave(tn)
	bob.reset()
	bob.loginAfterReset()
	alice.addTeamMember(tn, bob.username, keybase1.TeamRole_WRITER)
	bob.leave(tn)
	bob.reset()
	bob.loginAfterReset()
	alice.addTeamMember(tn, bob.username, keybase1.TeamRole_OWNER)
	bob.changeTeamMember(tn, alice.username, keybase1.TeamRole_READER)
	alice.loadTeam(tn, false)
	bob.leave(tn)
	alice.loadTeam(tn, false)
}
