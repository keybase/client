package unfurl

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/libkb"
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
	msg chat1.MessagePlaintext, clientPrev chat1.MessageID, outboxID chat1.OutboxID,
) (chat1.OutboxID, error) {
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
	convID chat1.ConversationID, msgID chat1.MessageID, domain string,
) {
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
	g := globals.NewContext(tc.G, &globals.ChatContext{})

	store := attachments.NewStoreTesting(g, nil)
	s3signer := &ptsigner{}
	notifier := makeDummyActivityNotifier()
	g.ActivityNotifier = notifier
	g.MessageDeliverer = dummyDeliverer{}
	sender := makeDummySender()
	ri := func() chat1.RemoteInterface { return paramsRemote{} }
	storage := newMemConversationBackedStorage()
	unfurler := NewUnfurler(g, store, s3signer, storage, sender, ri)
	settings := NewSettings(g, storage)
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

	unfurler.UnfurlAndSend(context.TODO(), uid, convID, fromMsg, nil)
	select {
	case <-sender.ch:
		require.Fail(t, "no send here")
	case n := <-notifier.ch:
		require.Equal(t, uid, n.uid)
		require.Equal(t, convID, n.convID)
		require.Equal(t, fromMsg.GetMessageID(), n.msgID)
		require.Equal(t, "127.0.0.1", n.domain)
	case <-time.After(20 * time.Second):
		require.Fail(t, "no notifications")
	}
	require.NoError(t, settings.WhitelistAdd(context.TODO(), uid, "127.0.0.1"))

	// ensure we try to prefetch once per url in the msgText once we're whitelisted
	numPrefetched = unfurler.Prefetch(context.TODO(), uid, convID, strings.Repeat(msgBody, 5))
	require.Equal(t, 1, numPrefetched)

	for range 5 {
		unfurler.UnfurlAndSend(context.TODO(), uid, convID, fromMsg, nil)
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
	require.ErrorAs(t, err, new(libkb.NotFoundError))
	require.Equal(t, types.UnfurlerTaskStatusFailed, status)
}

func TestUnfurlerPreviewURLs(t *testing.T) {
	tc := externalstest.SetupTest(t, "unfurler", 0)
	defer tc.Cleanup()
	g := globals.NewContext(tc.G, &globals.ChatContext{})

	store := attachments.NewStoreTesting(g, nil)
	s3signer := &ptsigner{}
	g.ActivityNotifier = makeDummyActivityNotifier()
	g.MessageDeliverer = dummyDeliverer{}
	g.AttachmentURLSrv = types.DummyAttachmentHTTPSrv{}
	sender := makeDummySender()
	ri := func() chat1.RemoteInterface { return paramsRemote{} }
	storage := newMemConversationBackedStorage()
	unfurler := NewUnfurler(g, store, s3signer, storage, sender, ri)

	uid := gregor1.UID([]byte{0, 1})
	convID := chat1.ConversationID([]byte{0, 1, 2})
	srv := createTestCaseHTTPSrv(t)
	addr := srv.Start()
	defer srv.Stop()

	url := fmt.Sprintf("http://%s/?name=%s", addr, "wsj0.html")
	require.NoError(t, unfurler.WhitelistAdd(context.TODO(), uid, "127.0.0.1"))

	res := unfurler.PreviewURLs(context.TODO(), uid, convID, "check this out "+url)
	require.Len(t, res, 1)
	require.Equal(t, url, res[0].Url)
	typ, err := res[0].Unfurl.UnfurlType()
	require.NoError(t, err)
	require.Equal(t, chat1.UnfurlType_GENERIC, typ)
	require.NotZero(t, res[0].Unfurl.Generic().Title)

	// duplicate URLs collapse to one entry
	res = unfurler.PreviewURLs(context.TODO(), uid, convID, url+" and again "+url)
	require.Len(t, res, 1)

	// text with no links does no work
	require.Empty(t, unfurler.PreviewURLs(context.TODO(), uid, convID, "no links here"))
}

func makeTextMsgWithOutboxID(msgBody string, outboxID chat1.OutboxID) chat1.MessageUnboxed {
	return chat1.NewMessageUnboxedWithValid(chat1.MessageUnboxedValid{
		ClientHeader: chat1.MessageClientHeaderVerified{
			TlfName:     "mike",
			MessageType: chat1.MessageType_TEXT,
			OutboxID:    &outboxID,
		},
		ServerHeader: chat1.MessageServerHeader{
			MessageID: 4,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: msgBody,
		}),
	})
}

func TestUnfurlerSuppress(t *testing.T) {
	tc := externalstest.SetupTest(t, "unfurler", 0)
	defer tc.Cleanup()
	g := globals.NewContext(tc.G, &globals.ChatContext{})

	store := attachments.NewStoreTesting(g, nil)
	s3signer := &ptsigner{}
	g.ActivityNotifier = makeDummyActivityNotifier()
	g.MessageDeliverer = dummyDeliverer{}
	sender := makeDummySender()
	ri := func() chat1.RemoteInterface { return paramsRemote{} }
	memStorage := newMemConversationBackedStorage()
	unfurler := NewUnfurler(g, store, s3signer, memStorage, sender, ri)

	uid := gregor1.UID([]byte{0, 1})
	convID := chat1.ConversationID([]byte{0, 1, 2})
	srv := createTestCaseHTTPSrv(t)
	addr := srv.Start()
	defer srv.Stop()

	url := fmt.Sprintf("http://%s/?name=%s", addr, "wsj0.html")
	require.NoError(t, unfurler.WhitelistAdd(context.TODO(), uid, "127.0.0.1"))

	outboxID, err := storage.NewOutboxID()
	require.NoError(t, err)
	msg := makeTextMsgWithOutboxID("check out this link! "+url, outboxID)

	unfurler.UnfurlAndSend(context.TODO(), uid, convID, msg, []string{url})
	select {
	case <-sender.ch:
		require.Fail(t, "should not have sent a suppressed unfurl")
	case <-time.After(2 * time.Second):
	}

	// resolving an unfurl prompt for another URL re-runs UnfurlAndSend on the same message
	// with no suppress list of its own. the marker left by the first pass is what keeps the
	// dismissal honoured, and it is not on a clock: however long the message waited to
	// send, this pass must still skip the URL
	unfurler.UnfurlAndSend(context.TODO(), uid, convID, msg, nil)
	select {
	case <-sender.ch:
		require.Fail(t, "should not have sent a suppressed unfurl on the second pass")
	case <-time.After(2 * time.Second):
	}

	// an unsuppressed URL in the same conversation still unfurls, so the checks above are
	// not passing because the pipeline is dead
	otherURL := fmt.Sprintf("http://%s/?name=%s", addr, "nytimes0.html")
	otherOutboxID, err := storage.NewOutboxID()
	require.NoError(t, err)
	otherMsg := makeTextMsgWithOutboxID("and this one "+otherURL, otherOutboxID)
	unfurler.UnfurlAndSend(context.TODO(), uid, convID, otherMsg, nil)
	select {
	case <-sender.ch:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no unfurl message sent for the unsuppressed URL")
	}
}

func TestPreviewable(t *testing.T) {
	generic := chat1.NewUnfurlWithGeneric(chat1.UnfurlGeneric{Title: "t"})
	require.True(t, previewable(generic))

	// a map is a generic unfurl carrying MapInfo; the message view will not render one,
	// so the preview must not either
	mapped := chat1.NewUnfurlWithGeneric(chat1.UnfurlGeneric{
		Title:   "here",
		MapInfo: &chat1.UnfurlGenericMapInfo{IsLiveLocationDone: true},
	})
	require.False(t, previewable(mapped))

	require.False(t, previewable(chat1.NewUnfurlWithYoutube(chat1.UnfurlYoutube{})))
	require.False(t, previewable(chat1.NewUnfurlWithGiphy(chat1.UnfurlGiphy{})))
}

func TestUnfurlerSuppressPrompt(t *testing.T) {
	tc := externalstest.SetupTest(t, "unfurler", 0)
	defer tc.Cleanup()
	g := globals.NewContext(tc.G, &globals.ChatContext{})

	store := attachments.NewStoreTesting(g, nil)
	s3signer := &ptsigner{}
	notifier := makeDummyActivityNotifier()
	g.ActivityNotifier = notifier
	g.MessageDeliverer = dummyDeliverer{}
	sender := makeDummySender()
	ri := func() chat1.RemoteInterface { return paramsRemote{} }
	memStorage := newMemConversationBackedStorage()
	unfurler := NewUnfurler(g, store, s3signer, memStorage, sender, ri)

	uid := gregor1.UID([]byte{0, 1})
	convID := chat1.ConversationID([]byte{0, 1, 2})
	srv := createTestCaseHTTPSrv(t)
	addr := srv.Start()
	defer srv.Stop()

	// no WhitelistAdd here, so this url classifies as a prompt hit rather than an unfurl
	// one. a queued message is classified at send time, so a url the sender dismissed while
	// the domain was whitelisted can arrive here as a prompt: prompting for a link they
	// declined breaks the same promise as unfurling it
	url := fmt.Sprintf("http://%s/?name=%s", addr, "wsj0.html")
	outboxID, err := storage.NewOutboxID()
	require.NoError(t, err)
	msg := makeTextMsgWithOutboxID("check out this link! "+url, outboxID)

	unfurler.UnfurlAndSend(context.TODO(), uid, convID, msg, []string{url})
	select {
	case n := <-notifier.ch:
		require.Failf(t, "prompted for a suppressed URL", "domain: %s", n.domain)
	case <-time.After(2 * time.Second):
	}

	// and an unsuppressed one still prompts, so the check above is not passing because
	// prompting is broken. it has to be a different url: the marker is keyed by url, so
	// re-sending the same one would be skipped by the marker the first pass just wrote
	otherURL := fmt.Sprintf("http://%s/?name=%s", addr, "nytimes0.html")
	otherOutboxID, err := storage.NewOutboxID()
	require.NoError(t, err)
	unfurler.UnfurlAndSend(context.TODO(), uid, convID,
		makeTextMsgWithOutboxID("and this one "+otherURL, otherOutboxID), nil)
	select {
	case <-notifier.ch:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no prompt for the unsuppressed URL")
	}
}
