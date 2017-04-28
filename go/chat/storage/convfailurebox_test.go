package storage

import (
	"context"
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

func TestConvFailureBox(t *testing.T) {
	ltc := externals.SetupTest(t, "ConvFailureBox", 2)
	tc := kbtest.ChatTestContext{
		TestContext: ltc,
		ChatG:       &globals.ChatContext{},
	}
	u, err := kbtest.CreateAndSignupFakeUser("cf", ltc.G)
	require.NoError(t, err)
	uid := gregor1.UID(u.User.GetUID().ToBytes())
	cfb := NewConversationFailureBox(tc.Context(), uid, "mike")

	convID := randBytes(8)
	require.NoError(t, cfb.Failure(context.TODO(), convID))

	res, err := cfb.Read(context.TODO())
	require.NoError(t, err)
	require.Equal(t, 1, len(res))
	require.Equal(t, 1, res[0].Attempts)

	require.NoError(t, cfb.Failure(context.TODO(), convID))
	res, err = cfb.Read(context.TODO())
	require.NoError(t, err)
	require.Equal(t, 1, len(res))
	require.Equal(t, 2, res[0].Attempts)

	convID2 := randBytes(8)
	require.NoError(t, cfb.Failure(context.TODO(), convID2))
	res, err = cfb.Read(context.TODO())
	require.NoError(t, err)
	require.Equal(t, 2, len(res))

	require.NoError(t, cfb.Success(context.TODO(), convID2))
	res, err = cfb.Read(context.TODO())
	require.NoError(t, err)
	require.Equal(t, 1, len(res))
	require.Equal(t, 2, res[0].Attempts)
	require.Equal(t, chat1.ConversationID(convID), res[0].ConvID)

}
