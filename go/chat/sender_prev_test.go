package chat

import (
	"context"
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// prevInboxSource answers inbox reads for one conversation. The local cache can be
// made to miss, the way it does before the first inbox sync or after the cache is
// cleared, while the server still knows the conversation.
type prevInboxSource struct {
	types.InboxSource
	conv       types.RemoteConversation
	localCache bool
}

func (s *prevInboxSource) ReadUnverified(ctx context.Context, uid gregor1.UID,
	dataSource types.InboxSourceDataSourceTyp, query *chat1.GetInboxQuery,
) (types.Inbox, error) {
	if dataSource == types.InboxSourceDataSourceLocalOnly && !s.localCache {
		return types.Inbox{}, nil
	}
	return types.Inbox{ConvsUnverified: []types.RemoteConversation{s.conv}}, nil
}

type prevCapturingDeliverer struct {
	types.MessageDeliverer
	queued []chat1.MessagePlaintext
}

func (d *prevCapturingDeliverer) Queue(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessagePlaintext, outboxID *chat1.OutboxID, sendOpts *chat1.SenderSendOptions,
	prepareOpts *chat1.SenderPrepareOptions, identifyBehavior keybase1.TLFIdentifyBehavior,
) (chat1.OutboxRecord, error) {
	d.queued = append(d.queued, msg)
	return chat1.OutboxRecord{ConvID: convID, Msg: msg}, nil
}

func setupPrevTestUser(t *testing.T, tc libkb.TestContext) {
	uid := keybase1.MakeTestUID(1)
	deviceID, err := libkb.NewDeviceID()
	require.NoError(t, err)
	require.NoError(t, tc.G.Env.GetConfigWriter().SetUserConfig(
		libkb.NewUserConfig(uid, "testuser", nil, deviceID), false))
	sigKey, err := libkb.GenerateNaclSigningKeyPair()
	require.NoError(t, err)
	encKey, err := libkb.GenerateNaclDHKeyPair()
	require.NoError(t, err)
	require.NoError(t, tc.G.ActiveDevice.Set(libkb.NewMetaContextForTest(tc),
		keybase1.NewUserVersion(uid, 1), deviceID, sigKey, encKey, "testuser-mac",
		keybase1.ToTime(tc.G.Clock().Now()), libkb.KeychainModeNone))
}

// The GUI passes the newest message ID it has on screen as clientPrev with every
// nonblocking post, and the service uses it (or its own local inbox, whichever is
// larger) as OutboxInfo.Prev. That value places the pending message in the thread:
// its frontend ordinal is Prev plus a sub-position. A post with clientPrev 0 has to
// land at the same place as one with the correct clientPrev, so the GUI can stop
// tracking it.
func TestNonblockingSenderPrevWithoutClientPrev(t *testing.T) {
	const maxMsgID = chat1.MessageID(10)
	convID := chat1.ConversationID([]byte{1, 2, 3, 4})
	conv := types.RemoteConversation{
		Conv: chat1.Conversation{
			Metadata: chat1.ConversationMetadata{ConversationID: convID},
			MaxMsgSummaries: []chat1.MessageSummary{
				{MsgID: maxMsgID, MessageType: chat1.MessageType_TEXT},
			},
		},
		ConvIDStr: convID.ConvIDStr(),
	}

	cases := []struct {
		name       string
		localCache bool
		clientPrev chat1.MessageID
	}{
		{name: "local inbox cached, no clientPrev", localCache: true, clientPrev: 0},
		{name: "local inbox cached, clientPrev from GUI", localCache: true, clientPrev: maxMsgID},
		{name: "local inbox not cached, clientPrev from GUI", localCache: false, clientPrev: maxMsgID},
		{name: "local inbox not cached, no clientPrev", localCache: false, clientPrev: 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			tc := externalstest.SetupTest(t, "NonblockingSenderPrev", 0)
			defer tc.Cleanup()
			setupPrevTestUser(t, tc)
			deliverer := &prevCapturingDeliverer{}
			g := globals.NewContext(tc.G, &globals.ChatContext{
				InboxSource:      &prevInboxSource{conv: conv, localCache: c.localCache},
				MessageDeliverer: deliverer,
			})
			_, err := utils.AssertLoggedInUID(context.TODO(), g)
			require.NoError(t, err)

			msg := chat1.MessagePlaintext{
				ClientHeader: chat1.MessageClientHeader{MessageType: chat1.MessageType_TEXT},
				MessageBody:  chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hi"}),
			}
			_, _, err = NewNonblockingSender(g, nil).Send(context.TODO(), convID, msg, c.clientPrev,
				nil, nil, nil)
			require.NoError(t, err)
			require.Len(t, deliverer.queued, 1)
			outboxInfo := deliverer.queued[0].ClientHeader.OutboxInfo
			require.NotNil(t, outboxInfo)
			require.Equal(t, maxMsgID, outboxInfo.Prev,
				"pending message must be placed after the newest message in the conversation")
		})
	}
}
