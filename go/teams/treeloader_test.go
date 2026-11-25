package teams

import (
	"errors"
	"sync"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// The tree walk and result assembly, with team loads from fixed sigchain states: the real loads
// need the API server.
func TestTreeloaderKeepsGoingPastAFailedSubteam(t *testing.T) {
	tc := SetupTest(t, "treeloader", 1)
	defer tc.Cleanup()
	mctx := libkb.NewMetaContextForTest(tc)

	mustName := func(s string) keybase1.TeamName {
		name, err := keybase1.TeamNameFromString(s)
		require.NoError(t, err)
		return name
	}
	uv := func(uid string) keybase1.UserVersion {
		return keybase1.UserVersion{Uid: keybase1.UID(uid), EldestSeqno: 1}
	}
	target := uv("11111111111111111111111111111119")
	other := uv("22222222222222222222222222222219")
	bot := uv("33333333333333333333333333333319")
	joined := func(role keybase1.TeamRole, at keybase1.Time) []keybase1.UserLogPoint {
		return []keybase1.UserLogPoint{{Role: role, SigMeta: keybase1.SignatureMetadata{Time: at}}}
	}
	subteams := func(names map[keybase1.TeamID]string) map[keybase1.TeamID][]keybase1.SubteamLogPoint {
		res := make(map[keybase1.TeamID][]keybase1.SubteamLogPoint)
		for id, name := range names {
			res[id] = []keybase1.SubteamLogPoint{{Name: mustName(name), Seqno: 1}}
		}
		return res
	}

	const rootID, aID, bID, xID = keybase1.TeamID("root"), keybase1.TeamID("a"),
		keybase1.TeamID("b"), keybase1.TeamID("x")
	root := &TeamSigChainState{inner: keybase1.TeamSigChainState{
		Id: rootID,
		UserLog: map[keybase1.UserVersion][]keybase1.UserLogPoint{
			target: joined(keybase1.TeamRole_ADMIN, 50),
			other:  joined(keybase1.TeamRole_WRITER, 60),
			bot:    joined(keybase1.TeamRole_BOT, 70),
		},
		SubteamLog: subteams(map[keybase1.TeamID]string{aID: "acme.aa", bID: "acme.bb"}),
	}}
	chains := map[keybase1.TeamID]*TeamSigChainState{
		aID: {inner: keybase1.TeamSigChainState{
			Id:         aID,
			UserLog:    map[keybase1.UserVersion][]keybase1.UserLogPoint{target: joined(keybase1.TeamRole_WRITER, 100)},
			SubteamLog: subteams(map[keybase1.TeamID]string{xID: "acme.aa.xx"}),
		}},
		xID: {inner: keybase1.TeamSigChainState{
			Id:      xID,
			UserLog: map[keybase1.UserVersion][]keybase1.UserLogPoint{other: joined(keybase1.TeamRole_READER, 120)},
		}},
	}

	var loadedMu sync.Mutex
	var loaded []keybase1.TeamID
	l := &Treeloader{
		targetUsername: "testuser",
		targetTeamID:   rootID,
		targetUV:       target,
		targetTeamName: mustName("acme"),
		loadSubteam: func(_ libkb.MetaContext, teamID keybase1.TeamID) (*TeamSigChainState, error) {
			loadedMu.Lock()
			loaded = append(loaded, teamID)
			loadedMu.Unlock()
			if teamID == bID {
				return nil, errors.New("team b failed to load")
			}
			return chains[teamID], nil
		},
	}
	l.Converter = l

	res := l.loadTree(mctx, root)

	var names []string
	for _, m := range res {
		names = append(names, m.TeamName)
	}
	require.Equal(t, []string{"acme", "acme.aa", "acme.aa.xx", "acme.bb"}, names)
	require.ElementsMatch(t, []keybase1.TeamID{aID, bID, xID}, loaded)

	ok := func(i int) keybase1.TeamTreeMembershipValue {
		s, err := res[i].Result.S()
		require.NoError(t, err)
		require.Equal(t, keybase1.TeamTreeMembershipStatus_OK, s, res[i].TeamName)
		return res[i].Result.Ok()
	}
	rootVal := ok(0)
	require.Equal(t, keybase1.TeamRole_ADMIN, rootVal.Role)
	require.Equal(t, rootID, rootVal.TeamID)
	require.NotNil(t, rootVal.MemberCount)
	require.Equal(t, 2, *rootVal.MemberCount, "bots are not counted")

	aVal := ok(1)
	require.Equal(t, keybase1.TeamRole_WRITER, aVal.Role)
	require.NotNil(t, aVal.JoinTime)
	require.Equal(t, keybase1.Time(100), *aVal.JoinTime)
	require.NotNil(t, aVal.MemberCount)
	require.Equal(t, 1, *aVal.MemberCount)

	xVal := ok(2)
	require.Equal(t, keybase1.TeamRole_NONE, xVal.Role)
	require.Nil(t, xVal.JoinTime)
	require.Equal(t, xID, xVal.TeamID)

	s, err := res[3].Result.S()
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamTreeMembershipStatus_ERROR, s)
	require.Equal(t, keybase1.TeamTreeError{
		Message:           "team b failed to load",
		WillSkipSubtree:   true,
		WillSkipAncestors: false,
	}, res[3].Result.Error())
}
