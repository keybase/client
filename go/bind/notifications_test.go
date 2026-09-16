package keybase

import (
	"context"
	"errors"
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type replyChatHelper struct {
	libkb.ChatHelper
	sendErr error
	sent    []string
}

func (h *replyChatHelper) SendTextByIDNonblock(_ context.Context, _ chat1.ConversationID, _ string, text string,
	_ *chat1.OutboxID, _ *chat1.MessageID,
) (chat1.OutboxID, error) {
	if h.sendErr != nil {
		return nil, h.sendErr
	}
	h.sent = append(h.sent, text)
	return nil, nil
}

type replyInboxSource struct {
	types.InboxSource
	markErr error
	marked  []chat1.MessageID
}

func (s *replyInboxSource) MarkAsRead(_ context.Context, _ chat1.ConversationID, _ gregor1.UID,
	msgID *chat1.MessageID, _ bool,
) error {
	s.marked = append(s.marked, *msgID)
	return s.markErr
}

func TestPostTextReply(t *testing.T) {
	const convID = "0000bbbbccccddddeeeeffff0000aaaabbbbccccddddeeeeffff0000aaaabbbb"
	setup := func(t *testing.T, loggedIn bool) (*globals.Context, *replyChatHelper, *replyInboxSource) {
		tc := libkb.SetupTest(t, "PostTextReply", 0)
		t.Cleanup(tc.Cleanup)
		helper := &replyChatHelper{}
		inbox := &replyInboxSource{}
		tc.G.ChatHelper = helper
		if loggedIn {
			uid := keybase1.MakeTestUID(1)
			deviceID := keybase1.DeviceID("00000000000000000000000000000018")
			sigKey, err := libkb.GenerateNaclSigningKeyPair()
			require.NoError(t, err)
			encKey, err := libkb.GenerateNaclDHKeyPair()
			require.NoError(t, err)
			require.NoError(t, tc.G.ActiveDevice.Set(libkb.NewMetaContextForTest(tc),
				keybase1.UserVersion{Uid: uid, EldestSeqno: 1}, deviceID,
				sigKey, encKey, "testuser-device", 0, libkb.KeychainModeNone))
			require.NoError(t, tc.G.Env.GetConfigWriter().SetUserConfig(
				libkb.NewUserConfig(uid, "testuser", nil, deviceID), true))
			require.NoError(t, tc.G.Env.GetConfigWriter().SwitchUser("testuser"))
		}
		return globals.NewContext(tc.G, &globals.ChatContext{InboxSource: inbox}), helper, inbox
	}
	ctx := context.Background()

	t.Run("sends and marks read", func(t *testing.T) {
		gc, helper, inbox := setup(t, true)
		require.NoError(t, postTextReply(ctx, gc, convID, "testuser", 5, "hi"))
		require.Equal(t, []string{"hi"}, helper.sent)
		require.Equal(t, []chat1.MessageID{5}, inbox.marked)
	})
	t.Run("send error is returned", func(t *testing.T) {
		gc, helper, inbox := setup(t, true)
		helper.sendErr = errors.New("outbox full")
		require.EqualError(t, postTextReply(ctx, gc, convID, "testuser", 5, "hi"), "outbox full")
		require.Empty(t, inbox.marked)
	})
	t.Run("mark read failure doesn't fail a sent reply", func(t *testing.T) {
		gc, helper, inbox := setup(t, true)
		inbox.markErr = errors.New("offline")
		require.NoError(t, postTextReply(ctx, gc, convID, "testuser", 5, "hi"))
		require.Equal(t, []string{"hi"}, helper.sent)
	})
	t.Run("logged out doesn't send", func(t *testing.T) {
		gc, helper, _ := setup(t, false)
		require.ErrorAs(t, postTextReply(ctx, gc, convID, "testuser", 5, "hi"), &libkb.LoginRequiredError{})
		require.Empty(t, helper.sent)
	})
	t.Run("invalid message ID doesn't send", func(t *testing.T) {
		gc, helper, _ := setup(t, true)
		require.Error(t, postTextReply(ctx, gc, convID, "testuser", -1, "hi"))
		require.Empty(t, helper.sent)
	})
}
