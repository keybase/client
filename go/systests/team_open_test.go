package systests

import (
	"strings"
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	//"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func TestTeamOpenAutoAddMember(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	own := tt.addUser("own")
	roo := tt.addUser("roo")

	nameStr, err := libkb.RandString("tt", 5)
	require.NoError(t, err)

	cli := own.teamsClient
	createRes, err := cli.TeamCreate(context.TODO(), keybase1.TeamCreateArg{
		Name:                 strings.ToLower(nameStr),
		SendChatNotification: false,
		Open:                 true,
	})

	_, _ = roo, createRes
	t.Logf("Open team name is %q", nameStr)
}
