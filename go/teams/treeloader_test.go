package teams

import (
	"errors"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func mustTreeTeamName(t *testing.T, s string) keybase1.TeamName {
	name, err := keybase1.TeamNameFromString(s)
	require.NoError(t, err)
	return name
}

func TestTreeNode(t *testing.T) {
	tc := SetupTest(t, "treeloader", 1)
	defer tc.Cleanup()
	mctx := libkb.NewMetaContextForTest(tc)

	uv := func(uid string) keybase1.UserVersion {
		return keybase1.UserVersion{Uid: keybase1.UID(uid), EldestSeqno: 1}
	}
	target := uv("11111111111111111111111111111119")
	other := uv("22222222222222222222222222222219")
	bot := uv("33333333333333333333333333333319")
	joined := func(role keybase1.TeamRole, at keybase1.Time) []keybase1.UserLogPoint {
		return []keybase1.UserLogPoint{{Role: role, SigMeta: keybase1.SignatureMetadata{Time: at}}}
	}
	subteamLog := func(names map[keybase1.TeamID]string) map[keybase1.TeamID][]keybase1.SubteamLogPoint {
		res := make(map[keybase1.TeamID][]keybase1.SubteamLogPoint)
		for id, name := range names {
			res[id] = []keybase1.SubteamLogPoint{{Name: mustTreeTeamName(t, name), Seqno: 1}}
		}
		return res
	}

	l := &Treeloader{
		targetUsername: "testuser",
		targetTeamID:   "root",
		targetUV:       target,
		targetTeamName: mustTreeTeamName(t, "acme"),
	}
	l.Converter = l

	t.Run("a loaded team is a row, with its subteams to load next", func(t *testing.T) {
		root := &TeamSigChainState{inner: keybase1.TeamSigChainState{
			Id: "root",
			UserLog: map[keybase1.UserVersion][]keybase1.UserLogPoint{
				target: joined(keybase1.TeamRole_ADMIN, 50),
				other:  joined(keybase1.TeamRole_WRITER, 60),
				bot:    joined(keybase1.TeamRole_BOT, 70),
			},
			SubteamLog: subteamLog(map[keybase1.TeamID]string{"a": "acme.aa", "b": "acme.bb"}),
		}}
		row, subteams := l.treeNode(mctx, mustTreeTeamName(t, "acme"), root, nil)

		require.Equal(t, "acme", row.TeamName)
		s, err := row.Result.S()
		require.NoError(t, err)
		require.Equal(t, keybase1.TeamTreeMembershipStatus_OK, s)
		val := row.Result.Ok()
		require.Equal(t, keybase1.TeamRole_ADMIN, val.Role)
		require.Equal(t, keybase1.TeamID("root"), val.TeamID)
		require.NotNil(t, val.JoinTime)
		require.Equal(t, keybase1.Time(50), *val.JoinTime)
		require.NotNil(t, val.MemberCount)
		require.Equal(t, 2, *val.MemberCount, "bots are not counted")
		require.ElementsMatch(t, []keybase1.TeamID{"a", "b"},
			[]keybase1.TeamID{subteams[0].Id, subteams[1].Id})
	})

	t.Run("a team the user is not in is a row without a join time", func(t *testing.T) {
		chain := &TeamSigChainState{inner: keybase1.TeamSigChainState{
			Id:      "x",
			UserLog: map[keybase1.UserVersion][]keybase1.UserLogPoint{other: joined(keybase1.TeamRole_READER, 120)},
		}}
		row, subteams := l.treeNode(mctx, mustTreeTeamName(t, "acme.aa.xx"), chain, nil)
		val := row.Result.Ok()
		require.Equal(t, keybase1.TeamRole_NONE, val.Role)
		require.Nil(t, val.JoinTime)
		require.Equal(t, 1, *val.MemberCount)
		require.Empty(t, subteams)
	})

	t.Run("a subteam that failed to load is an error row and its subtree is skipped", func(t *testing.T) {
		row, subteams := l.treeNode(mctx, mustTreeTeamName(t, "acme.bb"), nil, errors.New("team bb failed to load"))
		require.Equal(t, "acme.bb", row.TeamName)
		s, err := row.Result.S()
		require.NoError(t, err)
		require.Equal(t, keybase1.TeamTreeMembershipStatus_ERROR, s)
		require.Equal(t, keybase1.TeamTreeError{
			Message:           "team bb failed to load",
			WillSkipSubtree:   true,
			WillSkipAncestors: false,
		}, row.Result.Error())
		require.Empty(t, subteams)
	})
}

func TestSortTeamTreeMemberships(t *testing.T) {
	row := func(name string) keybase1.TeamTreeMembership {
		return keybase1.TeamTreeMembership{TeamName: name}
	}
	res := []keybase1.TeamTreeMembership{
		row("acme.bb"), row("acme.aa_z"), row("acme.aa.xx"), row("acme"), row("acme.aa"), row("acme.aa.xx.yy"),
	}
	sortTeamTreeMemberships(res)
	var names []string
	for _, r := range res {
		names = append(names, r.TeamName)
	}
	require.Equal(t, []string{"acme", "acme.aa", "acme.aa.xx", "acme.aa.xx.yy", "acme.aa_z", "acme.bb"}, names)
}
