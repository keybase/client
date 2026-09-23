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

// TestPostTextReply drives HandlePostTextReply, the Android quick-reply
// entry point, through the package-level kbCtx/kbChatCtx globals it reads
// directly (there is no context parameter to inject fakes through).
func TestPostTextReply(t *testing.T) {
	const convID = "0000bbbbccccddddeeeeffff0000aaaabbbbccccddddeeeeffff0000aaaabbbb"

	setup := func(t *testing.T, loggedIn bool) (*replyChatHelper, *replyInboxSource) {
		tc := libkb.SetupTest(t, "PostTextReply", 0)
		t.Cleanup(tc.Cleanup)
		helper := &replyChatHelper{}
		inbox := &replyInboxSource{}
		tc.G.ChatHelper = helper

		prevCtx, prevChatCtx := kbCtx, kbChatCtx
		kbCtx = tc.G
		kbChatCtx = &globals.ChatContext{InboxSource: inbox}
		t.Cleanup(func() {
			kbCtx = prevCtx
			kbChatCtx = prevChatCtx
		})

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
		return helper, inbox
	}

	// Guards: the intended happy paths must keep working.
	t.Run("sends and marks read", func(t *testing.T) {
		helper, inbox := setup(t, true)
		require.NoError(t, HandlePostTextReply(convID, "testuser", 5, "hi"))
		require.Equal(t, []string{"hi"}, helper.sent)
		require.Equal(t, []chat1.MessageID{5}, inbox.marked)
	})
	t.Run("mark read failure doesn't fail a sent reply", func(t *testing.T) {
		helper, inbox := setup(t, true)
		inbox.markErr = errors.New("offline")
		require.NoError(t, HandlePostTextReply(convID, "testuser", 5, "hi"))
		require.Equal(t, []string{"hi"}, helper.sent)
	})

	// Bugs: HandlePostTextReply calls SendTextByIDNonblock unconditionally,
	// before checking login state or the message ID, and never checks the
	// send's returned error.
	t.Run("send error is returned", func(t *testing.T) {
		helper, inbox := setup(t, true)
		helper.sendErr = errors.New("outbox full")
		require.Error(t, HandlePostTextReply(convID, "testuser", 5, "hi"))
		require.Empty(t, inbox.marked)
	})
	t.Run("logged out doesn't send", func(t *testing.T) {
		helper, _ := setup(t, false)
		require.Error(t, HandlePostTextReply(convID, "testuser", 5, "hi"))
		require.Empty(t, helper.sent)
	})
	t.Run("invalid message ID doesn't send", func(t *testing.T) {
		helper, _ := setup(t, true)
		require.Error(t, HandlePostTextReply(convID, "testuser", -1, "hi"))
		require.Empty(t, helper.sent)
	})
}
