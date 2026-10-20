package unfurl

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
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
	"github.com/stretchr/testify/assert"
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
		ch: make(chan promptNotification, 8),
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
	require.NotNil(t, res[0].Unfurl)
	typ, err := res[0].Unfurl.UnfurlType()
	require.NoError(t, err)
	require.Equal(t, chat1.UnfurlType_GENERIC, typ)
	require.NotEmpty(t, res[0].Unfurl.Generic().Title)

	// duplicate URLs collapse to one entry
	res = unfurler.PreviewURLs(context.TODO(), uid, convID, url+" and again "+url)
	require.Len(t, res, 1)

	// text with no links does no work
	require.Empty(t, unfurler.PreviewURLs(context.TODO(), uid, convID, "no links here"))
}

// a url the scraper cannot fetch still comes back, with no unfurl on it: the send path
// would queue an unfurl for it anyway, so the client needs to know to suppress it
func TestUnfurlerPreviewURLsScrapeFailure(t *testing.T) {
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
	srv := newDummyHTTPSrv(t, func(w http.ResponseWriter, r *http.Request) {
		// what wsj.com does to the scraper
		w.WriteHeader(http.StatusUnauthorized)
	})
	addr := srv.Start()
	defer srv.Stop()

	url := fmt.Sprintf("http://%s/?name=%s", addr, "wsj0.html")
	require.NoError(t, unfurler.WhitelistAdd(context.TODO(), uid, "127.0.0.1"))

	res := unfurler.PreviewURLs(context.TODO(), uid, convID, "check this out "+url)
	require.Len(t, res, 1)
	require.Equal(t, url, res[0].Url)
	require.Nil(t, res[0].Unfurl)
}

// the composer previews on every debounced edit, so a url that cannot be scraped would be
// re-fetched for as long as it sits in the text. the failure is remembered briefly instead
func TestUnfurlerPreviewURLsFailureNotRescraped(t *testing.T) {
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
	var hits int32
	srv := newDummyHTTPSrv(t, func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&hits, 1)
		w.WriteHeader(http.StatusUnauthorized)
	})
	addr := srv.Start()
	defer srv.Stop()

	url := fmt.Sprintf("http://%s/?name=%s", addr, "wsj0.html")
	require.NoError(t, unfurler.WhitelistAdd(context.TODO(), uid, "127.0.0.1"))

	for i := 0; i < 3; i++ {
		res := unfurler.PreviewURLs(context.TODO(), uid, convID, "check this out "+url)
		require.Len(t, res, 1)
		require.Nil(t, res[0].Unfurl, "a cached failure still reports the url for suppression")
	}
	require.Equal(t, int32(1), atomic.LoadInt32(&hits))
}

func makeTextMsgWithMsgID(msgBody string, outboxID chat1.OutboxID, msgID chat1.MessageID) chat1.MessageUnboxed {
	return chat1.NewMessageUnboxedWithValid(chat1.MessageUnboxedValid{
		ClientHeader: chat1.MessageClientHeaderVerified{
			TlfName:     "mike",
			MessageType: chat1.MessageType_TEXT,
			OutboxID:    &outboxID,
		},
		ServerHeader: chat1.MessageServerHeader{
			// the suppression key derives from this, not from the outbox id, so tests that
			// mean "a different message" have to vary it
			MessageID: msgID,
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

	url := fmt.Sprintf("http://%s/?name=%s", addr, "wsj0.html")
	require.NoError(t, unfurler.WhitelistAdd(context.TODO(), uid, "127.0.0.1"))

	outboxID, err := storage.NewOutboxID()
	require.NoError(t, err)
	// a second url that is not whitelisted makes this the prompt-resolution case: the
	// first pass must persist the dismissal so a later UnfurlAndSend with no suppress list
	// still skips it. a pass that issues no prompt deletes those markers, because nothing
	// will run UnfurlAndSend on that message again.
	promptURL := "http://example.com/other"
	msg := makeTextMsgWithMsgID("check out this link! "+url+" and "+promptURL, outboxID, 4)

	unfurler.UnfurlAndSend(context.TODO(), uid, convID, msg, []string{url})
	select {
	case n := <-notifier.ch:
		require.Equal(t, "example.com", n.domain)
	case <-time.After(2 * time.Second):
		require.Fail(t, "expected a prompt for the un-dismissed url")
	}
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
	case n := <-notifier.ch:
		require.Equal(t, "example.com", n.domain)
	case <-time.After(2 * time.Second):
		require.Fail(t, "expected a prompt on the second pass")
	}
	select {
	case <-sender.ch:
		require.Fail(t, "should not have sent a suppressed unfurl on the second pass")
	case <-time.After(2 * time.Second):
	}

	// the dismissal is scoped to that message: the same url sent again, undismissed, must
	// still unfurl. the suppression key derives from the message id, so this needs a
	// genuinely different message rather than just a different outbox id
	laterMsg := makeTextMsgWithMsgID("sending it again "+url, outboxID, 5)
	unfurler.UnfurlAndSend(context.TODO(), uid, convID, laterMsg, nil)
	select {
	case <-sender.ch:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no unfurl message sent for the same url in a later message")
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
	msg := makeTextMsgWithMsgID("check out this link! "+url, outboxID, 4)

	unfurler.UnfurlAndSend(context.TODO(), uid, convID, msg, []string{url})
	select {
	case n := <-notifier.ch:
		require.Failf(t, "prompted for a suppressed URL", "domain: %s", n.domain)
	case <-time.After(2 * time.Second):
	}

	// the same url in a later message still prompts, so the check above is not passing
	// because prompting is broken
	unfurler.UnfurlAndSend(context.TODO(), uid, convID,
		makeTextMsgWithMsgID("sending it again "+url, outboxID, 5), nil)
	select {
	case <-notifier.ch:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no prompt for the unsuppressed URL")
	}
}

// an abandoned preview caller must not take the scrape down with it: the composer calls
// PreviewURLs again on every edit, so the caller that wins the singleflight is often the
// one that goes away first
func TestUnfurlerPreviewURLsCallerCancel(t *testing.T) {
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

	var scrapes int64
	started := make(chan struct{}, 1)
	release := make(chan struct{})
	srv := newDummyHTTPSrv(t, func(w http.ResponseWriter, r *http.Request) {
		name := r.URL.Query().Get("name")
		if name == "wsj0.html" && atomic.AddInt64(&scrapes, 1) == 1 {
			started <- struct{}{}
			<-release
		}
		w.WriteHeader(200)
		dat, err := os.ReadFile(filepath.Join("testcases", name))
		assert.NoError(t, err)
		_, err = io.Copy(w, bytes.NewBuffer(dat))
		assert.NoError(t, err)
	})
	addr := srv.Start()
	defer srv.Stop()

	url := fmt.Sprintf("http://%s/?name=%s", addr, "wsj0.html")
	require.NoError(t, unfurler.WhitelistAdd(context.TODO(), uid, "127.0.0.1"))

	// the first caller wins the singleflight and is then abandoned mid-scrape
	firstCtx, cancelFirst := context.WithCancel(context.TODO())
	firstCh := make(chan []chat1.UnfurlPreviewInfo, 1)
	go func() { firstCh <- unfurler.PreviewURLs(firstCtx, uid, convID, "check this out "+url) }()
	select {
	case <-started:
	case <-time.After(20 * time.Second):
		require.Fail(t, "scrape never started")
	}

	// the second caller joins the same scrape, then the first one goes away
	secondCh := make(chan []chat1.UnfurlPreviewInfo, 1)
	go func() { secondCh <- unfurler.PreviewURLs(context.TODO(), uid, convID, "check this out "+url) }()
	cancelFirst()
	select {
	case res := <-firstCh:
		require.Empty(t, res, "a cancelled caller should not return a preview")
	case <-time.After(20 * time.Second):
		require.Fail(t, "cancelled caller never returned")
	}

	close(release)
	select {
	case res := <-secondCh:
		require.Len(t, res, 1, "the surviving caller lost its preview to the cancelled one")
		require.Equal(t, url, res[0].Url)
		require.NotNil(t, res[0].Unfurl)
		require.NotEmpty(t, res[0].Unfurl.Generic().Title)
	case <-time.After(20 * time.Second):
		require.Fail(t, "surviving caller never returned")
	}
	require.Equal(t, int64(1), atomic.LoadInt64(&scrapes), "the two callers did not share one scrape")
}

// only generic unfurls get a card, and a map is a generic unfurl the message view itself
// refuses to render. the frontend filters on the same rule
func TestUnfurlerPreviewable(t *testing.T) {
	generic := chat1.UnfurlGeneric{Title: "t", Url: "u", SiteName: "s"}
	require.True(t, previewable(chat1.NewUnfurlWithGeneric(generic)))

	withMap := generic
	withMap.MapInfo = &chat1.UnfurlGenericMapInfo{}
	require.False(t, previewable(chat1.NewUnfurlWithGeneric(withMap)))

	require.False(t, previewable(chat1.NewUnfurlWithGiphy(chat1.UnfurlGiphy{})))
	require.False(t, previewable(chat1.NewUnfurlWithYoutube(chat1.UnfurlYoutube{})))
}

// the rule for what gets no card is the one previewable uses on a scraped unfurl, read
// from the domain: a giphy short link classifies as giphy without being on the
// auto-whitelist, and suppressing it would lose an unfurl the send would have landed
func TestUnfurlerCarded(t *testing.T) {
	require.True(t, carded("https://example.com/a"))
	require.True(t, carded("https://youtube.com/watch?v=mmJ_LT8bUj0"))
	require.True(t, carded("not a url at all"))
	require.False(t, carded("https://giphy.com/gifs/abc"))
	require.False(t, carded("https://gph.is/2X9abc"))
	require.False(t, carded(fmt.Sprintf("https://%s/?lat=1&lon=2&acc=3&done=true", types.MapsDomain)))
}

// a giphy or a maps url gets no card either way, so a scrape failure on one must not be
// reported: suppressing it would lose an unfurl the send's own retries would have landed
func TestUnfurlerPreviewURLsAutoWhitelistFailureNotSuppressed(t *testing.T) {
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
	// the maps domain is auto-whitelisted and scraped locally, so an unparseable coord
	// fails the scrape without touching the network
	url := fmt.Sprintf("https://%s/?lat=nope&lon=1&acc=1&done=true", types.MapsDomain)

	require.Empty(t, unfurler.PreviewURLs(context.TODO(), uid, convID, "check this out "+url))
}

func TestUnfurlerPreviewURLsCancelKeepsPrior(t *testing.T) {
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
	memStorage := newMemConversationBackedStorage()
	unfurler := NewUnfurler(g, store, s3signer, memStorage, sender, ri)

	uid := gregor1.UID([]byte{0, 1})
	convID := chat1.ConversationID([]byte{0, 1, 2})
	secondStarted := make(chan struct{}, 1)
	release := make(chan struct{})
	srv := newDummyHTTPSrv(t, func(w http.ResponseWriter, r *http.Request) {
		name := r.URL.Query().Get("name")
		if name == "second.html" {
			select {
			case secondStarted <- struct{}{}:
			default:
			}
			<-release
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.WriteHeader(200)
		dat, err := os.ReadFile(filepath.Join("testcases", "wsj0.html"))
		assert.NoError(t, err)
		_, err = io.Copy(w, bytes.NewBuffer(dat))
		assert.NoError(t, err)
	})
	addr := srv.Start()
	defer srv.Stop()

	url1 := fmt.Sprintf("http://%s/?name=wsj0.html", addr)
	url2 := fmt.Sprintf("http://%s/?name=second.html", addr)
	require.NoError(t, unfurler.WhitelistAdd(context.TODO(), uid, "127.0.0.1"))

	ctx, cancel := context.WithCancel(context.TODO())
	ch := make(chan []chat1.UnfurlPreviewInfo, 1)
	go func() { ch <- unfurler.PreviewURLs(ctx, uid, convID, url1+" "+url2) }()
	select {
	case <-secondStarted:
	case <-time.After(20 * time.Second):
		require.Fail(t, "second scrape never started")
	}
	cancel()
	select {
	case res := <-ch:
		require.Len(t, res, 1, "a cancel must keep urls already scraped in this request")
		require.Equal(t, url1, res[0].Url)
		require.NotNil(t, res[0].Unfurl)
	case <-time.After(20 * time.Second):
		require.Fail(t, "cancelled preview never returned")
	}
	close(release)
}

func TestUnfurlerSuppressClearedWhenNoPrompt(t *testing.T) {
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
	msg := makeTextMsgWithMsgID("check out this link! "+url, outboxID, 4)

	unfurler.UnfurlAndSend(context.TODO(), uid, convID, msg, []string{url})
	select {
	case <-sender.ch:
		require.Fail(t, "should not have sent a suppressed unfurl")
	case <-time.After(2 * time.Second):
	}

	// no prompt on that pass, so nothing will UnfurlAndSend this message again. drop the
	// marker rather than leave it in the kv store for the life of the device
	unfurler.UnfurlAndSend(context.TODO(), uid, convID, msg, nil)
	select {
	case <-sender.ch:
	case <-time.After(20 * time.Second):
		require.Fail(t, "marker from a no-prompt pass must not outlive that pass")
	}
}

type fakeUnfurlOutbox struct {
	records map[string]chat1.OutboxRecord
	removed []chat1.OutboxID
	// the real outbox completes a removed record's unfurl task
	complete func(context.Context, chat1.OutboxID)
}

func (f *fakeUnfurlOutbox) GetRecord(ctx context.Context, outboxID chat1.OutboxID) (chat1.OutboxRecord, error) {
	obr, ok := f.records[outboxID.String()]
	if !ok {
		return obr, storage.MissError{}
	}
	return obr, nil
}

func (f *fakeUnfurlOutbox) RemoveMessage(ctx context.Context, outboxID chat1.OutboxID) (chat1.OutboxRecord, error) {
	obr := f.records[outboxID.String()]
	delete(f.records, outboxID.String())
	f.removed = append(f.removed, outboxID)
	f.complete(ctx, outboxID)
	return obr, nil
}

type unfurlMessageTest struct {
	unfurler *Unfurler
	notifier *dummyActivityNotifier
	sender   *dummySender
	outbox   *fakeUnfurlOutbox
	uid      gregor1.UID
	convID   chat1.ConversationID
	url      string
	msg      chat1.MessageUnboxed
}

func setupUnfurlMessageTest(t *testing.T) (*unfurlMessageTest, func()) {
	tc := externalstest.SetupTest(t, "unfurler", 0)
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	notifier := makeDummyActivityNotifier()
	g.ActivityNotifier = notifier
	g.MessageDeliverer = dummyDeliverer{}
	sender := makeDummySender()
	ri := func() chat1.RemoteInterface { return paramsRemote{} }
	unfurler := NewUnfurler(g, attachments.NewStoreTesting(g, nil), &ptsigner{},
		newMemConversationBackedStorage(), sender, ri)
	outbox := &fakeUnfurlOutbox{records: make(map[string]chat1.OutboxRecord), complete: unfurler.Complete}
	unfurler.outbox = func(gregor1.UID) unfurlOutbox { return outbox }
	srv := createTestCaseHTTPSrv(t)
	addr := srv.Start()
	outboxID, err := storage.NewOutboxID()
	require.NoError(t, err)
	url := fmt.Sprintf("http://%s/?name=%s", addr, "wsj0.html")
	m := &unfurlMessageTest{
		unfurler: unfurler,
		notifier: notifier,
		sender:   sender,
		outbox:   outbox,
		uid:      gregor1.UID([]byte{0, 1}),
		convID:   chat1.ConversationID([]byte{0, 1, 2}),
		url:      url,
		msg:      makeTextMsgWithMsgID("check out this link! "+url, outboxID, 4),
	}
	return m, func() {
		srv.Stop()
		tc.Cleanup()
	}
}

func (m *unfurlMessageTest) requireSent(t *testing.T) {
	select {
	case msg := <-m.sender.ch:
		require.Equal(t, chat1.MessageType_UNFURL, msg.ClientHeader.MessageType)
		require.Equal(t, m.msg.GetMessageID(), msg.ClientHeader.Supersedes)
	case n := <-m.notifier.ch:
		require.Failf(t, "prompted instead of unfurling", "domain: %s", n.domain)
	case <-time.After(20 * time.Second):
		require.Fail(t, "no unfurl sent")
	}
}

func (m *unfurlMessageTest) requireNotSent(t *testing.T) {
	select {
	case <-m.sender.ch:
		require.Fail(t, "should not have sent an unfurl")
	case n := <-m.notifier.ch:
		require.Failf(t, "should not have prompted", "domain: %s", n.domain)
	case <-time.After(2 * time.Second):
	}
}

// an explicit request to unfurl one message overrides whatever the settings say, and leaves
// them as they were
func TestUnfurlMessageOverridesSettings(t *testing.T) {
	cases := []struct {
		name  string
		setup func(t *testing.T, m *unfurlMessageTest)
	}{
		{
			name: "mode never",
			setup: func(t *testing.T, m *unfurlMessageTest) {
				require.NoError(t, m.unfurler.SetMode(context.TODO(), m.uid, chat1.UnfurlMode_NEVER))
			},
		},
		{
			name: "blocked domain",
			setup: func(t *testing.T, m *unfurlMessageTest) {
				require.NoError(t, m.unfurler.BlocklistAdd(context.TODO(), m.uid, "127.0.0.1"))
			},
		},
		{
			name:  "domain on neither list",
			setup: func(t *testing.T, m *unfurlMessageTest) {},
		},
	}
	for _, tcase := range cases {
		t.Run(tcase.name, func(t *testing.T) {
			m, cleanup := setupUnfurlMessageTest(t)
			defer cleanup()
			tcase.setup(t, m)
			before, err := m.unfurler.GetSettings(context.TODO(), m.uid)
			require.NoError(t, err)

			// the ordinary pass holds back, so the forced one below is what unfurls
			m.unfurler.UnfurlAndSend(context.TODO(), m.uid, m.convID, m.msg, nil)
			select {
			case <-m.sender.ch:
				require.Fail(t, "the ordinary pass should not unfurl here")
			case <-m.notifier.ch:
			case <-time.After(2 * time.Second):
			}

			m.unfurler.UnfurlMessage(context.TODO(), m.uid, m.convID, m.msg)
			m.requireSent(t)

			after, err := m.unfurler.GetSettings(context.TODO(), m.uid)
			require.NoError(t, err)
			require.Equal(t, before, after)
		})
	}
}

func TestUnfurlMessageOverridesDismissal(t *testing.T) {
	m, cleanup := setupUnfurlMessageTest(t)
	defer cleanup()
	require.NoError(t, m.unfurler.WhitelistAdd(context.TODO(), m.uid, "127.0.0.1"))
	// a second url that prompts keeps the dismissal marker for the first one alive
	m.msg = makeTextMsgWithMsgID("check out this link! "+m.url+" and http://example.com/other",
		*m.msg.Valid().ClientHeader.OutboxID, 4)

	m.unfurler.UnfurlAndSend(context.TODO(), m.uid, m.convID, m.msg, []string{m.url})
	select {
	case n := <-m.notifier.ch:
		require.Equal(t, "example.com", n.domain)
	case <-time.After(2 * time.Second):
		require.Fail(t, "expected a prompt for the un-dismissed url")
	}
	m.unfurler.UnfurlAndSend(context.TODO(), m.uid, m.convID, m.msg, nil)
	select {
	case <-m.sender.ch:
		require.Fail(t, "the dismissal should hold on an ordinary pass")
	case <-m.notifier.ch:
	case <-time.After(2 * time.Second):
	}

	// two sends, and the dummy sender buffers one
	go m.unfurler.UnfurlMessage(context.TODO(), m.uid, m.convID, m.msg)
	unfurled := make(map[chat1.MessageID]int)
	for range 2 {
		select {
		case msg := <-m.sender.ch:
			unfurled[msg.ClientHeader.Supersedes]++
		case n := <-m.notifier.ch:
			require.Failf(t, "prompted instead of unfurling", "domain: %s", n.domain)
		case <-time.After(20 * time.Second):
			require.Fail(t, "expected both urls to unfurl")
		}
	}
	require.Equal(t, 2, unfurled[m.msg.GetMessageID()])
}

func TestUnfurlMessageSkipsAlreadyUnfurled(t *testing.T) {
	m, cleanup := setupUnfurlMessageTest(t)
	defer cleanup()
	valid := m.msg.Valid()
	valid.Unfurls = map[chat1.MessageID]chat1.UnfurlResult{5: {Url: m.url}}
	m.msg = chat1.NewMessageUnboxedWithValid(valid)

	m.unfurler.UnfurlMessage(context.TODO(), m.uid, m.convID, m.msg)
	m.requireNotSent(t)
}

// an earlier attempt that will never deliver is replaced, and one still in flight is left to
// finish, so the url never unfurls twice
func TestUnfurlMessageEarlierAttempt(t *testing.T) {
	permFailed := types.UnfurlerTaskStatusPermFailed
	cases := []struct {
		name        string
		status      *types.UnfurlerTaskStatus
		record      *chat1.OutboxState
		wantSent    bool
		wantRemoved bool
	}{
		{name: "failed, record gone", status: &permFailed, wantSent: true},
		// a task is saved before its outbox record is written, so a task with no status and
		// no record yet is in flight
		{name: "just saved, no record yet"},
		{
			name:   "failed, record errored",
			status: &permFailed,
			record: func() *chat1.OutboxState {
				s := chat1.NewOutboxStateWithError(chat1.OutboxStateError{Typ: chat1.OutboxErrorType_MISC})
				return &s
			}(),
			wantSent:    true,
			wantRemoved: true,
		},
		{
			name:   "failed, record still sending",
			status: &permFailed,
			record: func() *chat1.OutboxState {
				s := chat1.NewOutboxStateWithSending(0)
				return &s
			}(),
		},
	}
	for _, tcase := range cases {
		t.Run(tcase.name, func(t *testing.T) {
			m, cleanup := setupUnfurlMessageTest(t)
			defer cleanup()
			outboxID := storage.GetOutboxIDFromURL(m.url, m.convID, m.msg)
			require.NoError(t, m.unfurler.saveTask(context.TODO(), outboxID, m.uid, m.convID, m.url))
			if tcase.status != nil {
				require.NoError(t, m.unfurler.setStatus(context.TODO(), outboxID, *tcase.status))
			}
			if tcase.record != nil {
				m.outbox.records[outboxID.String()] = chat1.OutboxRecord{OutboxID: outboxID, State: *tcase.record}
			}

			m.unfurler.UnfurlMessage(context.TODO(), m.uid, m.convID, m.msg)
			if tcase.wantSent {
				m.requireSent(t)
			} else {
				m.requireNotSent(t)
			}
			if tcase.wantRemoved {
				require.Equal(t, []chat1.OutboxID{outboxID}, m.outbox.removed)
			} else {
				require.Empty(t, m.outbox.removed)
			}
		})
	}
}
