package chat

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbhttp/manager"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/clockwork"

	"github.com/keybase/client/go/chat/unfurl"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type dummyHTTPSrv struct {
	sync.Mutex
	t       *testing.T
	srv     *http.Server
	succeed bool
}

func newDummyHTTPSrv(t *testing.T) *dummyHTTPSrv {
	return &dummyHTTPSrv{
		t: t,
	}
}

func (d *dummyHTTPSrv) Start() string {
	localhost := "127.0.0.1"
	listener, err := net.Listen("tcp", fmt.Sprintf("%s:0", localhost))
	require.NoError(d.t, err)
	port := listener.Addr().(*net.TCPAddr).Port
	mux := http.NewServeMux()
	mux.HandleFunc("/", d.handle)
	mux.HandleFunc("/favicon.ico", d.handleFavicon)
	mux.HandleFunc("/apple-touch-icon.png", d.handleApple)
	d.srv = &http.Server{
		Addr:    fmt.Sprintf("%s:%d", localhost, port),
		Handler: mux,
	}
	go d.srv.Serve(listener)
	return d.srv.Addr
}

func (d *dummyHTTPSrv) Stop() {
	require.NoError(d.t, d.srv.Close())
}

func (d *dummyHTTPSrv) handleApple(w http.ResponseWriter, r *http.Request) {
	d.Lock()
	defer d.Unlock()
	w.WriteHeader(404)
}

func (d *dummyHTTPSrv) handleFavicon(w http.ResponseWriter, r *http.Request) {
	d.Lock()
	defer d.Unlock()
	w.WriteHeader(200)
	f, err := os.Open(filepath.Join("unfurl", "testcases", "nytimes.ico"))
	require.NoError(d.t, err)
	_, err = io.Copy(w, f)
	require.NoError(d.t, err)
}

func (d *dummyHTTPSrv) handle(w http.ResponseWriter, r *http.Request) {
	d.Lock()
	defer d.Unlock()
	if d.succeed {
		html := "<html><head><title>MIKE</title></head></html>"
		w.WriteHeader(200)
		_, err := io.Copy(w, bytes.NewBuffer([]byte(html)))
		require.NoError(d.t, err)
		return
	}
	w.WriteHeader(500)
}

func (d *dummyHTTPSrv) setSucceed(succeed bool) {
	d.Lock()
	defer d.Unlock()
	d.succeed = succeed
}

type ptsigner struct{}

func (p *ptsigner) Sign(payload []byte) ([]byte, error) {
	s := sha256.Sum256(payload)
	return s[:], nil
}

func TestChatSrvUnfurl(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		switch mt {
		case chat1.ConversationMembersType_KBFS:
			return
		}

		etc := externalstest.SetupTest(t, "unfurl", 1)
		defer etc.Cleanup()

		ctc := makeChatTestContext(t, "TestChatSrvUnfurl", 1)
		defer ctc.cleanup()
		users := ctc.users()

		timeout := 20 * time.Second
		ctx := ctc.as(t, users[0]).startCtx
		tc := ctc.world.Tcs[users[0].Username]
		ri := ctc.as(t, users[0]).ri
		listener0 := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
		httpSrv := newDummyHTTPSrv(t)
		httpAddr := httpSrv.Start()
		defer httpSrv.Stop()
		storage := NewDevConversationBackedStorage(tc.Context(), func() chat1.RemoteInterface { return ri })
		sender := NewNonblockingSender(tc.Context(),
			NewBlockingSender(tc.Context(), NewBoxer(tc.Context()),
				func() chat1.RemoteInterface { return ri }))
		store := attachments.NewStoreTesting(tc.Context().GetLog(), nil, etc.G)
		s3signer := &ptsigner{}
		unfurler := unfurl.NewUnfurler(tc.Context(), store, s3signer, storage, sender,
			func() chat1.RemoteInterface { return ri })
		retryCh := make(chan struct{}, 5)
		unfurlCh := make(chan *chat1.Unfurl, 5)
		unfurler.SetTestingRetryCh(retryCh)
		unfurler.SetTestingUnfurlCh(unfurlCh)
		clock := clockwork.NewFakeClock()
		unfurler.SetClock(clock)
		tc.ChatG.Unfurler = unfurler
		fetcher := NewRemoteAttachmentFetcher(tc.Context(), store)
		tc.ChatG.AttachmentURLSrv = NewAttachmentHTTPSrv(tc.Context(),
			manager.NewSrv(tc.Context().ExternalG()),
			fetcher, func() chat1.RemoteInterface { return mockSigningRemote{} })

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt)
		recvSingleRetry := func() {
			select {
			case <-retryCh:
			case <-time.After(timeout):
				require.Fail(t, "no retry")
			}
			select {
			case <-retryCh:
				require.Fail(t, "unexpected retry")
			default:
			}
		}
		recvUnfurl := func() *chat1.Unfurl {
			select {
			case u := <-unfurlCh:
				return u
			case <-time.After(timeout):
				require.Fail(t, "no unfurl")
			}
			return nil
		}

		recvAndCheckUnfurlMsg := func(msgID chat1.MessageID) {
			var outboxID chat1.OutboxID
			select {
			case m := <-listener0.newMessageRemote:
				require.Equal(t, conv.Id, m.ConvID)
				require.True(t, m.Message.IsValid())
				require.Equal(t, chat1.MessageType_UNFURL, m.Message.GetMessageType())
				require.NotNil(t, m.Message.Valid().OutboxID)
				b, err := hex.DecodeString(*m.Message.Valid().OutboxID)
				require.NoError(t, err)
				outboxID = chat1.OutboxID(b)
			case <-time.After(timeout):
				require.Fail(t, "no message")
			}
			_, _, err := unfurler.Status(ctx, outboxID)
			require.Error(t, err)
			require.IsType(t, libkb.NotFoundError{}, err)
			select {
			case <-listener0.newMessageRemote:
				require.Fail(t, "no more messages")
			default:
			}
			// We get two of these, one for local and remote, but its hard to know where they
			// come from at the source, so just check twice.
			for i := 0; i < 2; i++ {
				select {
				case mu := <-listener0.messagesUpdated:
					require.Equal(t, 1, len(mu.Updates))
					require.Equal(t, conv.Id, mu.ConvID)
					require.Equal(t, msgID, mu.Updates[0].GetMessageID())
					require.True(t, mu.Updates[0].IsValid())
					require.Equal(t, 1, len(mu.Updates[0].Valid().Unfurls))
					typ, err := mu.Updates[0].Valid().Unfurls[0].Unfurl.UnfurlType()
					require.NoError(t, err)
					require.Equal(t, chat1.UnfurlType_GENERIC, typ)
					generic := mu.Updates[0].Valid().Unfurls[0].Unfurl.Generic()
					require.Nil(t, generic.Media)
					require.NotNil(t, generic.Favicon)
					require.NotZero(t, len(generic.Favicon.Url))
					resp, err := http.Get(generic.Favicon.Url)
					require.NoError(t, err)
					defer resp.Body.Close()
					var buf bytes.Buffer
					_, err = io.Copy(&buf, resp.Body)
					require.NoError(t, err)
					refBytes, err := ioutil.ReadFile(filepath.Join("unfurl", "testcases", "nytimes_sol.ico"))
					require.NoError(t, err)
					require.True(t, bytes.Equal(refBytes, buf.Bytes()))
					require.Equal(t, "MIKE", generic.Title)
				case <-time.After(timeout):
					require.Fail(t, "no message unfurl")
				}
			}
			select {
			case <-listener0.messagesUpdated:
				require.Fail(t, "no more updates")
			default:
			}
		}

		t.Logf("send for prompt")
		msg := chat1.NewMessageBodyWithText(chat1.MessageText{Body: fmt.Sprintf("http://%s", httpAddr)})
		origID := mustPostLocalForTest(t, ctc, users[0], conv, msg)
		t.Logf("origid: %v", origID)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)
		select {
		case notificationID := <-listener0.unfurlPrompt:
			require.Equal(t, origID, notificationID)
		case <-time.After(timeout):
			require.Fail(t, "no prompt")
		}
		t.Logf("whitelist and resolve")
		require.NoError(t, ctc.as(t, users[0]).chatLocalHandler().ResolveUnfurlPrompt(ctx,
			chat1.ResolveUnfurlPromptArg{
				ConvID:           conv.Id,
				MsgID:            origID,
				Result:           chat1.NewUnfurlPromptResultWithAccept("0.1"),
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_GUI,
			}))
		consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT) // from whitelist add
		select {
		case <-listener0.newMessageRemote:
			require.Fail(t, "no unfurl yet")
		default:
		}
		recvSingleRetry()
		require.Nil(t, recvUnfurl())

		t.Logf("try it again and fail")
		tc.Context().MessageDeliverer.ForceDeliverLoop(context.TODO())
		recvSingleRetry()
		require.Nil(t, recvUnfurl())

		t.Logf("now work")
		// now that we we can succeed
		httpSrv.setSucceed(true)

		var u *chat1.Unfurl
		for i := 0; i < 10; i++ {
			tc.Context().MessageDeliverer.ForceDeliverLoop(context.TODO())
			recvSingleRetry()
			u = recvUnfurl()
			if u != nil {
				break
			}
			t.Logf("retrying success unfurl, attempt: %d", i)
		}
		require.NotNil(t, u)
		typ, err := u.UnfurlType()
		require.NoError(t, err)
		require.Equal(t, chat1.UnfurlType_GENERIC, typ)
		require.Equal(t, "MIKE", u.Generic().Title)
		recvAndCheckUnfurlMsg(origID)

		t.Logf("make sure we don't unfurl twice")
		require.NoError(t, ctc.as(t, users[0]).chatLocalHandler().ResolveUnfurlPrompt(ctx,
			chat1.ResolveUnfurlPromptArg{
				ConvID:           conv.Id,
				MsgID:            origID,
				Result:           chat1.NewUnfurlPromptResultWithAccept("0.1"),
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_GUI,
			}))
		time.Sleep(200 * time.Millisecond)
		select {
		case <-listener0.newMessageRemote:
			require.Fail(t, "should not unfurl twice")
		default:
		}

		t.Logf("delete an unfurl")
		threadRes, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
			ConversationID: conv.Id,
			Query: &chat1.GetThreadQuery{
				MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
			},
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_GUI,
		})
		require.NoError(t, err)
		require.Equal(t, 1, len(threadRes.Thread.Messages))
		unfurlMsg := threadRes.Thread.Messages[0]
		require.True(t, unfurlMsg.IsValid())
		require.Equal(t, 1, len(unfurlMsg.Valid().Unfurls))
		unfurlMsgID := func() chat1.MessageID {
			for k := range unfurlMsg.Valid().Unfurls {
				return k
			}
			return chat1.MessageID(0)
		}()
		t.Logf("deleting msgid: %v", unfurlMsgID)
		_, err = ctc.as(t, users[0]).chatLocalHandler().PostDeleteNonblock(ctx, chat1.PostDeleteNonblockArg{
			ConversationID:   conv.Id,
			TlfName:          conv.TlfName,
			Supersedes:       unfurlMsgID,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_GUI,
		})
		require.NoError(t, err)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_DELETE)
		threadRes, err = ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
			ConversationID: conv.Id,
			Query: &chat1.GetThreadQuery{
				MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
			},
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_GUI,
		})
		require.NoError(t, err)
		thread := filterOutboxMessages(threadRes.Thread)
		require.Equal(t, 1, len(thread))
		unfurlMsg = thread[0]
		require.True(t, unfurlMsg.IsValid())
		require.Zero(t, len(unfurlMsg.Valid().Unfurls))
		select {
		case mu := <-listener0.messagesUpdated:
			require.Equal(t, 1, len(mu.Updates))
			require.True(t, mu.Updates[0].IsValid())
			require.Zero(t, len(mu.Updates[0].Valid().Unfurls))
		case <-time.After(timeout):
			require.Fail(t, "no update")
		}
		// only need one of these, since the second path through mergeMaybeNotify will have a deleted
		// unfurl in play
		select {
		case <-listener0.messagesUpdated:
			require.Fail(t, "no more updates")
		default:
		}

		t.Logf("exploding unfurl: %v", ctc.world.Fc.Now())
		dur := gregor1.ToDurationSec(120 * time.Minute)
		g := ctc.as(t, users[0]).h.G()
		g.GetEKLib().KeygenIfNeeded(g.MetaContext(context.Background()))
		origExplodeID := mustPostLocalEphemeralForTest(t, ctc, users[0], conv, msg, &dur)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)
		recvAndCheckUnfurlMsg(origExplodeID)

		t.Logf("try get/set settings")
		require.NoError(t, ctc.as(t, users[0]).chatLocalHandler().SaveUnfurlSettings(ctx,
			chat1.SaveUnfurlSettingsArg{
				Mode:      chat1.UnfurlMode_NEVER,
				Whitelist: []string{"nytimes.com", "cnn.com"},
			}))
		settings, err := ctc.as(t, users[0]).chatLocalHandler().GetUnfurlSettings(ctx)
		require.NoError(t, err)
		require.Equal(t, chat1.UnfurlMode_NEVER, settings.Mode)
		require.Equal(t, []string{"cnn.com", "nytimes.com"}, settings.Whitelist)

	})
}
