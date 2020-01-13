package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"

	"github.com/stretchr/testify/require"
)

func TestUserBlocking(t *testing.T) {
	tc1 := SetupEngineTest(t, "blocking")
	defer tc1.Cleanup()
	u1 := CreateAndSignupFakeUser(tc1, "ublk")
	m1 := NewMetaContextForTest(tc1).WithUIs(libkb.UIs{
		LogUI: tc1.G.UI.GetLogUI(),
	})

	tc2 := SetupEngineTest(t, "blocking")
	defer tc2.Cleanup()
	u2 := CreateAndSignupFakeUser(tc2, "ublk")
	m2 := NewMetaContextForTest(tc2).WithUIs(libkb.UIs{
		LogUI: tc2.G.UI.GetLogUI(),
	})

	// Both users should have 0 blocks
	e1 := NewUserBlocksGet(tc1.G, keybase1.GetUserBlocksArg{})
	require.NoError(t, RunEngine2(m1, e1))
	require.Len(t, e1.Blocks(), 0)

	e1 = NewUserBlocksGet(tc2.G, keybase1.GetUserBlocksArg{})
	require.NoError(t, RunEngine2(m2, e1))
	require.Len(t, e1.Blocks(), 0)

	// Chat block
	yes := true
	e2 := NewUserBlocksSet(tc1.G, keybase1.SetUserBlocksArg{
		Blocks: []keybase1.UserBlockArg{{
			Username:     u2.Username,
			SetChatBlock: &yes,
		}},
	})
	require.NoError(t, RunEngine2(m1, e2))

	e1 = NewUserBlocksGet(tc1.G, keybase1.GetUserBlocksArg{})
	require.NoError(t, RunEngine2(m1, e1))
	blocks := e1.Blocks()
	require.Len(t, blocks, 1)
	require.Equal(t, u2.Username, blocks[0].Username)
	require.Equal(t, true, blocks[0].ChatBlocked)
	require.Equal(t, false, blocks[0].FollowBlocked)
	require.NotNil(t, blocks[0].CreateTime)
	require.Nil(t, blocks[0].ModifyTime)

	// Follow block
	e2 = NewUserBlocksSet(tc1.G, keybase1.SetUserBlocksArg{
		Blocks: []keybase1.UserBlockArg{{
			Username:       u2.Username,
			SetFollowBlock: &yes,
		}},
	})
	require.NoError(t, RunEngine2(m1, e2))

	e1 = NewUserBlocksGet(tc1.G, keybase1.GetUserBlocksArg{})
	require.NoError(t, RunEngine2(m1, e1))
	blocks = e1.Blocks()
	require.Len(t, blocks, 1)
	require.Equal(t, u2.Username, blocks[0].Username)
	require.Equal(t, true, blocks[0].ChatBlocked)
	require.Equal(t, true, blocks[0].FollowBlocked)
	require.NotNil(t, blocks[0].CreateTime)
	require.NotNil(t, blocks[0].ModifyTime)

	// Unblocking
	no := false
	e2 = NewUserBlocksSet(tc1.G, keybase1.SetUserBlocksArg{
		Blocks: []keybase1.UserBlockArg{{
			Username:     u2.Username,
			SetChatBlock: &no,
		}, {
			Username:       u2.Username,
			SetFollowBlock: &no,
		}},
	})
	require.NoError(t, RunEngine2(m1, e2))

	e1 = NewUserBlocksGet(tc1.G, keybase1.GetUserBlocksArg{})
	require.NoError(t, RunEngine2(m1, e1))
	blocks = e1.Blocks()
	require.Len(t, blocks, 1)
	require.Equal(t, u2.Username, blocks[0].Username)
	require.Equal(t, false, blocks[0].ChatBlocked)
	require.Equal(t, false, blocks[0].FollowBlocked)
	require.NotNil(t, blocks[0].CreateTime)
	require.NotNil(t, blocks[0].ModifyTime)

	// Try to get blocks with username filter.
	e1 = NewUserBlocksGet(tc1.G, keybase1.GetUserBlocksArg{
		Usernames: []string{u2.Username},
	})
	require.NoError(t, RunEngine2(m1, e1))
	blocks2 := e1.Blocks()

	// Expect to see same things as in unfiltered call.
	require.Equal(t, blocks, blocks2)

	// Try to get blocks with username filter for different username than tc2.
	e1 = NewUserBlocksGet(tc1.G, keybase1.GetUserBlocksArg{
		Usernames: []string{u1.Username},
	})
	require.NoError(t, RunEngine2(m1, e1))
	blocks2 = e1.Blocks()
	require.Len(t, blocks2, 0)
}
