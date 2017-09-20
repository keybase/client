package systests

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"golang.org/x/net/context"

	client "github.com/keybase/client/go/client"
	libkb "github.com/keybase/client/go/libkb"
	chat1 "github.com/keybase/client/go/protocol/chat1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	teams "github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func sendChat(t smuTeam, u *smuUser, msg string) {
	tctx := u.primaryDevice().popClone()
	runner := client.NewCmdChatSendRunner(tctx.G)
	runner.SetTeamChatForTest(t.name)
	runner.SetMessage(msg)
	err := runner.Run()
	if err != nil {
		u.ctx.t.Fatal(err)
	}
}

func divDebug(ctx *smuContext, fmt string, arg ...interface{}) {
	div := "------------"
	ctx.log.Debug(div+" "+fmt+" "+div, arg...)
}

func readChatsWithError(team smuTeam, u *smuUser) (messages []chat1.MessageUnboxed, err error) {
	return readChatsWithErrorAndDevice(team, u, u.primaryDevice())
}

func readChatsWithErrorAndDevice(team smuTeam, u *smuUser, dev *smuDeviceWrapper) (messages []chat1.MessageUnboxed, err error) {
	tctx := dev.popClone()

	wait := 100 * time.Millisecond
	var totalWait time.Duration
	for i := 0; i < 10; i++ {
		runner := client.NewCmdChatReadRunner(tctx.G)
		runner.SetTeamChatForTest(team.name)
		_, messages, err = runner.Fetch()

		if err == nil {
			if i != 0 {
				u.ctx.t.Logf("readChatsWithError success after retrying %d times, polling for %s", i, totalWait)
			}
			return messages, nil
		}

		if !strings.Contains(err.Error(), "KBFS client not found") {
			// Only retry on KBFS errors
			return messages, err
		}

		time.Sleep(wait)
		totalWait += wait
	}

	u.ctx.t.Logf("Failed to readChatsWithError after polling for %s", totalWait)
	return messages, err
}

func readChats(team smuTeam, u *smuUser, nMessages int) {
	readChatsWithDevice(team, u, u.primaryDevice(), nMessages)
}

func readChatsWithDevice(team smuTeam, u *smuUser, dev *smuDeviceWrapper, nMessages int) {
	messages, err := readChatsWithErrorAndDevice(team, u, dev)
	t := u.ctx.t
	if err != nil {
		u.ctx.t.Fatal(err)
	}
	require.Equal(t, nMessages, len(messages))
	for i, msg := range messages {
		require.Equal(t, msg.Valid().MessageBody.Text().Body, fmt.Sprintf("%d", len(messages)-i-1))
	}
	divDebug(u.ctx, "readChat success for %s", u.username)
}

func pollForMembershipUpdate(team smuTeam, ann *smuUser, bob *smuUser, cam *smuUser) {

	details := ann.pollForMembershipUpdate(team, keybase1.PerTeamKeyGeneration(2))
	for _, member := range details.Members.Admins {
		switch member.Username {
		case ann.username:
			require.True(ann.ctx.t, member.Active)
		default:
			ann.ctx.t.Fatalf("unknown admin: %s", member.Username)
		}
	}
	for _, member := range details.Members.Writers {
		switch member.Username {
		case bob.username:
			require.False(ann.ctx.t, member.Active)
		case cam.username:
			require.True(ann.ctx.t, member.Active)
		default:
			ann.ctx.t.Fatalf("unknown writer: %s (%+v)", member.Username, details)
		}
	}
	ann.ctx.log.Debug("team details checked out: %+v", details)
}

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

	sendChat(team, ann, "0")
	divDebug(ctx, "Sent chat '0' (%s via %s)", team.name, ann.username)

	readChats(team, ann, 1)
	readChats(team, bob, 1)
	divDebug(ctx, "Ann and bob can read")

	ann.delete()
	divDebug(ctx, "Ann deleted her account")

	// It's important for cam to clear her cache right before the attempt to send,
	// since she might have received gregors that ann deleted her account,
	// and thefore might be trying to refresh and load the team.
	cam.primaryDevice().clearUPAKCache()
	sendChat(team, cam, "1")

	divDebug(ctx, "Cam sent a chat")
	readChats(team, bob, 2)
}

func TestTeamReset(t *testing.T) {
	t.Skip()
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

	sendChat(team, ann, "0")
	divDebug(ctx, "Sent chat '0' (%s via %s)", team.name, ann.username)

	readChats(team, ann, 1)
	readChats(team, bob, 1)

	kickTeamRekeyd(bob.getPrimaryGlobalContext(), t)
	bob.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)

	pollForMembershipUpdate(team, ann, bob, cam)
	divDebug(ctx, "Polled for rekey")

	bob.loginAfterReset(10)
	divDebug(ctx, "Bob logged in after reset")

	_, err := bob.teamGet(team)
	require.Error(t, err)
	ae, ok := err.(libkb.AppStatusError)
	require.True(t, ok)
	require.Equal(t, ae.Code, int(keybase1.StatusCode_SCTeamReadError))
	divDebug(ctx, "Bob failed to read the team")

	// Make sure that ann can still send even though bob is ousted
	sendChat(team, ann, "1")
	divDebug(ctx, "Sent chat '1' (%s via %s)", team.name, ann.username)
	readChats(team, ann, 2)
	// Same goes for cam --- note that she never read before, so nothing
	// is cached for her.
	readChats(team, cam, 2)

	_, err = readChatsWithError(team, bob)
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
	readChats(team, bob, 2)
	divDebug(ctx, "Bob reading chats after added back")
	sendChat(team, ann, "2")
	divDebug(ctx, "Ann sending chat '2'")
	readChats(team, bob, 3)
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

	sendChat(team, ann, "0")
	divDebug(ctx, "Sent chat '2' (%s via %s)", team.name, ann.username)

	readChats(team, ann, 1)

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
	readChats(team, bob, 1)
	divDebug(ctx, "Bob reading chats after added")
	sendChat(team, ann, "1")
	divDebug(ctx, "Ann sending chat '2'")
	readChats(team, bob, 2)
	divDebug(ctx, "Bob reading chat '2'")
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

	sendChat(team, ann, "0")
	divDebug(ctx, "Sent chat '2' (%s via %s)", team.name, ann.username)

	readChats(team, ann, 1)

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

	sendChat(team, ann, "0")
	divDebug(ctx, "Sent chat '2' (%s via %s)", team.name, ann.username)

	readChats(team, ann, 1)

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

	sendChat(team, ann, "0")
	divDebug(ctx, "Sent chat '2' (%s via %s)", team.name, ann.username)

	readChats(team, ann, 1)

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

	sendChat(team, ann, "0")
	divDebug(ctx, "Sent chat '2' (%s via %s)", team.name, ann.username)

	readChats(team, ann, 1)

	bob.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)

	ann.addAdmin(team, bob)
	divDebug(ctx, "Added bob as an admin")
}

// bob resets, implicit team lookup should still work for ann
func TestImplicitTeamReset(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	divDebug(ctx, "Signed up ann (%s)", ann.username)
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s)", bob.username)

	displayName := strings.Join([]string{ann.username, bob.username}, ",")
	iteam := ann.lookupImplicitTeam(true /*create*/, displayName, false /*isPublic*/)
	divDebug(ctx, "team created (%s)", iteam.ID)

	iteam2 := ann.lookupImplicitTeam(false /*create*/, displayName, false /*isPublic*/)
	require.Equal(t, iteam.ID, iteam2.ID, "second lookup should return same team")
	divDebug(ctx, "team looked up before reset")

	bob.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)

	iteam3 := ann.lookupImplicitTeam(false /*create*/, displayName, false /*isPublic*/)
	require.Equal(t, iteam.ID, iteam3.ID, "lookup after reset should return same team")
	divDebug(ctx, "team looked up before reset")
}

func TestImplicitTeamUserReset(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	// Sign up two users, bob and alice.
	alice := ctx.installKeybaseForUser("alice", 10)
	alice.signup()
	divDebug(ctx, "Signed up alice (%s)", alice.username)
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s)", bob.username)

	displayName := strings.Join([]string{alice.username, bob.username}, ",")
	team := alice.lookupImplicitTeam(true /*create*/, displayName, false /*isPublic*/)

	divDebug(ctx, "Created implicit team %s\n", team.ID)

	// Reset bob and reprovision.
	bob.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)

	bob.loginAfterReset(10)
	divDebug(ctx, "Bob logged in after reset")

	// Setup team loader on alice
	G := alice.getPrimaryGlobalContext()
	teams.NewTeamLoaderAndInstall(G)

	tryLoad := func(teamID keybase1.TeamID) (res *teams.Team) {
		res, err := teams.Load(context.TODO(), G, keybase1.LoadTeamArg{
			ID:          teamID,
			ForceRepoll: true,
		})
		require.NoError(t, err)
		return res
	}

	resTeam := tryLoad(team.ID)
	teamName := resTeam.Name().String()

	// Bob's role should be NONE since he's still reset.
	role, err := teams.MemberRole(context.TODO(), G, teamName, bob.username)
	require.NoError(t, err)
	require.Equal(t, role, keybase1.TeamRole_NONE)

	// Alice re-adds bob.
	alice.reAddUserAfterReset(team, bob)
	divDebug(ctx, "Re-Added bob as an owner")

	// Check if sigchain still plays back correctly
	tryLoad(team.ID)

	// Check if bob is back as OWNER.
	role, err = teams.MemberRole(context.TODO(), G, teamName, bob.username)
	require.NoError(t, err)
	require.Equal(t, role, keybase1.TeamRole_OWNER)

	// Reset and re-provision bob again.
	bob.reset()
	divDebug(ctx, "Reset bob again (%s) (poor bob)", bob.username)

	bob.loginAfterReset(10)
	divDebug(ctx, "Bob logged in after reset")

	// Check if sigchain plays correctly, check if role is NONE.
	tryLoad(team.ID)

	role, err = teams.MemberRole(context.TODO(), G, teamName, bob.username)
	require.NoError(t, err)
	require.Equal(t, role, keybase1.TeamRole_NONE)

	// Alice re-adds bob, again.
	alice.reAddUserAfterReset(team, bob)
	divDebug(ctx, "Re-Added bob as an owner again")

	// Check if sigchain plays correctly, at this point there are two
	// sigs similar to:
	//   "change_membership: { owner: ['xxxx%6'], none: ['xxxx%3'] }"
	// with uids and eldest from before and after reset.
	tryLoad(team.ID)

	role, err = teams.MemberRole(context.TODO(), G, teamName, bob.username)
	require.NoError(t, err)
	require.Equal(t, role, keybase1.TeamRole_OWNER)
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

	team := ann.createTeam([]*smuUser{bob})
	divDebug(ctx, "team created (%s)", team.name)

	bob.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)

	bob.loginAfterReset(10)
	divDebug(ctx, "Bob logged in after reset")

	ann.pollForMembershipUpdate(team, keybase1.PerTeamKeyGeneration(2))

	cli := ann.getTeamsClient()
	err := cli.TeamRemoveMember(context.TODO(), keybase1.TeamRemoveMemberArg{
		Name:     team.name,
		Username: bob.username,
	})
	require.NoError(t, err)

	G := ann.getPrimaryGlobalContext()
	teams.NewTeamLoaderAndInstall(G)
	role, err := teams.MemberRole(context.TODO(), G, team.name, bob.username)
	require.NoError(t, err)
	require.Equal(t, role, keybase1.TeamRole_NONE)
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

	sendChat(team, ann, "0")

	bob.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)

	bob.loginAfterReset(10)
	divDebug(ctx, "Bob logged in after reset")

	ann.pollForMembershipUpdate(team, keybase1.PerTeamKeyGeneration(2))

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

	readChats(team, bob, 1)
}
