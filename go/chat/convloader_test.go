package chat

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

func setupLoaderTest(t *testing.T) (*kbtest.ChatTestContext, *kbtest.ChatMockWorld, *chatListener, chat1.NewConversationRemoteRes) {
	world, ri, _, baseSender, listener, tlf := setupTest(t, 1)

	u := world.GetUsers()[0]
	trip := newConvTriple(t, tlf, u.Username)
	firstMessagePlaintext := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			TlfName:     u.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_TLFNAME,
		},
		MessageBody: chat1.MessageBody{},
	}
	firstMessageBoxed, _, err := baseSender.Prepare(context.TODO(), firstMessagePlaintext, nil)
	require.NoError(t, err)
	res, err := ri.NewConversationRemote2(context.TODO(), chat1.NewConversationRemote2Arg{
		IdTriple:   trip,
		TLFMessage: *firstMessageBoxed,
	})
	require.NoError(t, err)

	tc := userTc(t, world, u)

	return tc, world, listener, res
}

func TestConvLoader(t *testing.T) {
	tc, world, listener, res := setupLoaderTest(t)
	defer world.Cleanup()

	if err := tc.Context().ConvLoader.Queue(context.TODO(), res.ConvID); err != nil {
		t.Fatal(err)
	}

	select {
	case convID := <-listener.bgConvLoads:
		if !convID.Eq(res.ConvID) {
			t.Errorf("loaded conv id: %s, expected %s", convID, res.ConvID)
		}
	case <-time.After(20 * time.Second):
		t.Fatal("timeout waiting for conversation load")
	}
}
