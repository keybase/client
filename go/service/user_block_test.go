package service

import (
	"context"
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

type userBlockingTest struct {
	userHandler *UserHandler
	tc          libkb.TestContext
	user        *kbtest.FakeUser
}

func setupUserBlockingTest(t *testing.T) *userBlockingTest {
	ret := &userBlockingTest{}
	ret.tc = libkb.SetupTest(t, "blocking", 0)
	ret.userHandler = NewUserHandler(nil, ret.tc.G, nil, nil)

	user, err := kbtest.CreateAndSignupFakeUser("ublk", ret.tc.G)
	require.NoError(t, err)
	ret.user = user
	return ret
}

func TestUserBlocking(t *testing.T) {
	tc1 := setupUserBlockingTest(t)
	defer tc1.tc.Cleanup()
	tc2 := setupUserBlockingTest(t)
	defer tc2.tc.Cleanup()

	for _, tc := range []*userBlockingTest{tc1, tc2} {
		blocks, err := tc.userHandler.GetUserBlocks(context.Background(), keybase1.GetUserBlocksArg{})
		require.NoError(t, err)
		require.Len(t, blocks, 0)
	}

	yes := true
	err := tc1.userHandler.SetUserBlocks(context.Background(), keybase1.SetUserBlocksArg{
		Blocks: []keybase1.UserBlockArg{{
			Username:     tc2.user.Username,
			SetChatBlock: &yes,
		}},
	})
	require.NoError(t, err)

	blocks, err := tc1.userHandler.GetUserBlocks(context.Background(), keybase1.GetUserBlocksArg{})
	require.NoError(t, err)
	require.Len(t, blocks, 1)
	require.Equal(t, tc2.user.Username, blocks[0].Username)
	require.Equal(t, true, blocks[0].ChatBlocked)
	require.Equal(t, false, blocks[0].FollowBlocked)
	require.NotNil(t, blocks[0].CreateTime)
	require.Nil(t, blocks[0].ModifyTime)

	err = tc1.userHandler.SetUserBlocks(context.Background(), keybase1.SetUserBlocksArg{
		Blocks: []keybase1.UserBlockArg{{
			Username:       tc2.user.Username,
			SetFollowBlock: &yes,
		}},
	})
	require.NoError(t, err)

	blocks, err = tc1.userHandler.GetUserBlocks(context.Background(), keybase1.GetUserBlocksArg{})
	require.NoError(t, err)
	require.Len(t, blocks, 1)
	require.Equal(t, tc2.user.Username, blocks[0].Username)
	require.Equal(t, true, blocks[0].ChatBlocked)
	require.Equal(t, true, blocks[0].FollowBlocked)
	require.NotNil(t, blocks[0].CreateTime)
	require.NotNil(t, blocks[0].ModifyTime)

	no := false
	err = tc1.userHandler.SetUserBlocks(context.Background(), keybase1.SetUserBlocksArg{
		// Two block operations for same username is legal, but wasteful.
		Blocks: []keybase1.UserBlockArg{{
			Username:     tc2.user.Username,
			SetChatBlock: &no,
		}, {
			Username:       tc2.user.Username,
			SetFollowBlock: &no,
		}},
	})
	require.NoError(t, err)

	blocks, err = tc1.userHandler.GetUserBlocks(context.Background(), keybase1.GetUserBlocksArg{})
	require.NoError(t, err)
	require.Len(t, blocks, 1)
	require.Equal(t, tc2.user.Username, blocks[0].Username)
	require.Equal(t, false, blocks[0].ChatBlocked)
	require.Equal(t, false, blocks[0].FollowBlocked)
	require.NotNil(t, blocks[0].CreateTime)
	require.NotNil(t, blocks[0].ModifyTime)
}
