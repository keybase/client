package systests

import (
	"fmt"
	client "github.com/keybase/client/go/client"
	libkb "github.com/keybase/client/go/libkb"
	chat1 "github.com/keybase/client/go/protocol/chat1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"testing"
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

func readChatsWithError(team smuTeam, u *smuUser) ([]chat1.MessageUnboxed, error) {
	tctx := u.primaryDevice().popClone()
	runner := client.NewCmdChatReadRunner(tctx.G)
	runner.SetTeamChatForTest(team.name)
	_, messages, err := runner.Fetch()
	return messages, err
}

func readChats(team smuTeam, u *smuUser, nMessages int) {
	messages, err := readChatsWithError(team, u)
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

func TestTeamReset(t *testing.T) {
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
	divDebug(ctx, "Sent chat '2' (%s via %s)", team.name, ann.username)

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
