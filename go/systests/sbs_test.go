package systests

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/phonenumbers"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
)

func TestTeamInvitePhoneNumber(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	bob := tt.addUser("bob")

	// user 0 creates a team
	teamID, teamName := ann.createTeam2()

	phone := kbtest.GenerateTestPhoneNumber()
	phoneNumber := keybase1.PhoneNumber("+" + phone)
	phoneAssertion := fmt.Sprintf("%s@phone", phone)

	ann.addTeamMember(teamName.String(), phoneAssertion, keybase1.TeamRole_WRITER)

	{
		mctx := bob.MetaContext()
		g := bob.tc.G
		require.NoError(t, phonenumbers.AddPhoneNumber(mctx, phoneNumber, keybase1.IdentityVisibility_PUBLIC))
		code, err := kbtest.GetPhoneVerificationCode(libkb.NewMetaContextTODO(g), phoneNumber)
		require.NoError(t, err)
		require.NoError(t, phonenumbers.VerifyPhoneNumber(mctx, phoneNumber, code))
	}

	ann.waitForTeamChangedGregor(teamID, keybase1.Seqno(3))
	bob.waitForTeamChangedGregor(teamID, keybase1.Seqno(3))

	// the team should have user 1 in it now as a writer
	t0, err := teams.GetTeamByNameForTest(context.TODO(), tt.users[0].tc.G, teamName.String(), false, true)
	require.NoError(t, err)
	writers, err := t0.UsersWithRole(keybase1.TeamRole_WRITER)
	require.NoError(t, err)
	require.Len(t, writers, 1)
	if len(writers) > 0 {
		require.Equal(t, bob.uid, writers[0].Uid)
	}

	// the invite should not be in the active invite map
	exists, err := t0.HasActiveInvite(tt.users[0].tc.MetaContext(), keybase1.TeamInviteName(phone), "phone")
	require.NoError(t, err)
	require.False(t, exists, "after accepting invite, active invite shouldn't exist")
}
