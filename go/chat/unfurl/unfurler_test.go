package unfurl

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

type dummySender struct {
	ch chan chat1.MessagePlaintext
}

func makeDummySender() *dummySender {
	return &dummySender{
		ch: make(chan chat1.MessagePlaintext, 1),
	}
}

func (s *dummySender) SendUnfurlNonblock(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessagePlaintext, clientPrev chat1.MessageID, outboxID chat1.OutboxID) (chat1.OutboxID, error) {
	s.ch <- msg
	return outboxID, nil
}

type promptNotification struct {
	uid    gregor1.UID
	convID chat1.ConversationID
	msgID  chat1.MessageID
	domain string
}

type dummyActivityNotifier struct {
	types.ActivityNotifier
	ch chan promptNotification
}

func makeDummyActivityNotifier() *dummyActivityNotifier {
	return &dummyActivityNotifier{
		ch: make(chan promptNotification, 1),
	}
}

func (d *dummyActivityNotifier) PromptUnfurl(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msgID chat1.MessageID, domain string) {
	d.ch <- promptNotification{
		uid:    uid,
		convID: convID,
		msgID:  msgID,
		domain: domain,
	}
}

type dummyDeliverer struct {
	types.MessageDeliverer
}

func (d dummyDeliverer) ForceDeliverLoop(ctx context.Context) {}

func TestUnfurler(t *testing.T) {
	tc := externalstest.SetupTest(t, "unfurler", 0)
	defer tc.Cleanup()

	log := logger.NewTestLogger(t)
	store := attachments.NewStoreTesting(log, nil)
	s3signer := &ptsigner{}
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	notifier := makeDummyActivityNotifier()
	g.ChatContext.ActivityNotifier = notifier
	g.ChatContext.MessageDeliverer = dummyDeliverer{}
	sender := makeDummySender()
	ri := func() chat1.RemoteInterface { return paramsRemote{} }
	storage := newMemConversationBackedStorage()
	unfurler := NewUnfurler(g, store, s3signer, storage, sender, ri)
	settings := NewSettings(log, storage)
	srv := createTestCaseHTTPSrv(t)
	addr := srv.Start()
	defer srv.Stop()

	unfurler.unfurlCh = make(chan *chat1.Unfurl, 1)
	uid := gregor1.UID([]byte{0, 1})
	convID := chat1.ConversationID([]byte{0, 2})
	msgBody := fmt.Sprintf("check out this link! http://%s/?name=%s ", addr, "wsj0.html")
	fromMsg := chat1.NewMessageUnboxedWithValid(chat1.MessageUnboxedValid{
		ClientHeader: chat1.MessageClientHeaderVerified{
			TlfName:     "mike",
			MessageType: chat1.MessageType_TEXT,
		},
		ServerHeader: chat1.MessageServerHeader{
			MessageID: 4,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}),
	})

	// No prefetch unless we're in the whitelist
	numPrefetched := unfurler.Prefetch(context.TODO(), uid, convID, msgBody)
	require.Equal(t, 0, numPrefetched)

	unfurler.UnfurlAndSend(context.TODO(), uid, convID, fromMsg)
	select {
	case <-sender.ch:
		require.Fail(t, "no send here")
	case n := <-notifier.ch:
		require.Equal(t, uid, n.uid)
		require.Equal(t, convID, n.convID)
		require.Equal(t, fromMsg.GetMessageID(), n.msgID)
		require.Equal(t, "0.1", n.domain)
	case <-time.After(20 * time.Second):
		require.Fail(t, "no notifications")
	}
	require.NoError(t, settings.WhitelistAdd(context.TODO(), uid, "0.1"))

	// ensure we try to prefetch once per url in the msgText once we're whitelisted
	numPrefetched = unfurler.Prefetch(context.TODO(), uid, convID, strings.Repeat(msgBody, 5))
	require.Equal(t, 1, numPrefetched)

	for i := 0; i < 5; i++ {
		unfurler.UnfurlAndSend(context.TODO(), uid, convID, fromMsg)
	}
	var outboxID chat1.OutboxID
	select {
	case msg := <-sender.ch:
		require.Equal(t, chat1.MessageType_UNFURL, msg.ClientHeader.MessageType)
		require.Equal(t, fromMsg.Valid().ClientHeader.TlfName, msg.ClientHeader.TlfName)
		require.NotNil(t, msg.ClientHeader.OutboxID)
		outboxID = *msg.ClientHeader.OutboxID
		require.Equal(t, fromMsg.GetMessageID(), msg.ClientHeader.Supersedes)
	case <-notifier.ch:
		require.Fail(t, "no notification here")
	case <-time.After(20 * time.Second):
		require.Fail(t, "no notifications")
	}
	select {
	case <-sender.ch:
		require.Fail(t, "only one send should happen")
	default:
	}
	select {
	case unfurl := <-unfurler.unfurlCh:
		require.NotNil(t, unfurl)
		typ, err := unfurl.UnfurlType()
		require.NoError(t, err)
		require.Equal(t, chat1.UnfurlType_GENERIC, typ)
		require.NotNil(t, unfurl.Generic().Image)
		require.NotNil(t, unfurl.Generic().Favicon)
		require.NotNil(t, unfurl.Generic().Description)
		require.Equal(t, "U.S. Stocks Jump as Tough Month Sets to Wrap", unfurl.Generic().Title)
		require.Equal(t, "WSJ", unfurl.Generic().SiteName)
	case <-time.After(20 * time.Second):
		require.Fail(t, "no unfurl")
	}
	select {
	case <-unfurler.unfurlCh:
		require.Fail(t, "only one unfurl should happen")
	default:
	}
	status, _, err := unfurler.Status(context.TODO(), outboxID)
	require.NoError(t, err)
	require.Equal(t, types.UnfurlerTaskStatusSuccess, status)
	unfurler.Complete(context.TODO(), outboxID)
	status, _, err = unfurler.Status(context.TODO(), outboxID)
	require.Error(t, err)
	require.IsType(t, libkb.NotFoundError{}, err)
	require.Equal(t, types.UnfurlerTaskStatusFailed, status)
}
