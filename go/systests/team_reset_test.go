package systests

import (
	"fmt"
	client "github.com/keybase/client/go/client"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
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
	tctx.G.Log.Debugf("--------- readChat success for %s ------------", u.username)
}

func TestTeamReset(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	ctx.log.Debugf("-------- Signed up ann (%s) ------------", ann.username)
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	ctx.log.Debugf("-------- Signed up bob (%s) ------------", bob.username)

	team := ann.createTeam([]*smuUser{bob})
	ctx.log.Debugf("-------- team created (%s) ------------", team.name)

	sendChat(team, ann, "0")
	ctx.log.Debugf("-------- sent chat (%s via %s) ------------", team.name, ann.username)

	readChats(team, ann, 1)
	readChats(team, bob, 1)

	bob.reset()
	time.Sleep(10 * time.Second)
}
