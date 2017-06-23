package systests

import (
	"fmt"
	client "github.com/keybase/client/go/client"
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

func readChats(team smuTeam, u *smuUser, nMessages int) {
	tctx := u.primaryDevice().popClone()
	runner := client.NewCmdChatReadRunner(tctx.G)
	runner.SetTeamChatForTest(team.name)
	_, messages, err := runner.Fetch()
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

func pollForMembershipUpdate(team smuTeam, ann *smuUser, bob *smuUser) {

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
		default:
			ann.ctx.t.Fatalf("unknown writer: %s", member.Username)
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

	team := ann.createTeam([]*smuUser{bob})
	divDebug(ctx, "team created (%s)", team.name)

	sendChat(team, ann, "0")
	divDebug(ctx, "sent chat (%s via %s)", team.name, ann.username)

	readChats(team, ann, 1)
	readChats(team, bob, 1)

	kickTeamRekeyd(bob.getPrimaryGlobalContext(), t)
	bob.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)

	pollForMembershipUpdate(team, ann, bob)
	divDebug(ctx, "Polled for rekey")
}
