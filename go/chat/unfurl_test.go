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
	"testing"
	"time"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/libkb"

	"github.com/keybase/client/go/chat/unfurl"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type dummyHTTPSrv struct {
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

func (d *dummyHTTPSrv) handleFavicon(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(200)
	f, err := os.Open(filepath.Join("unfurl", "testcases", "nytimes.ico"))
	require.NoError(d.t, err)
	_, err = io.Copy(w, f)
	require.NoError(d.t, err)
}

func (d *dummyHTTPSrv) handle(w http.ResponseWriter, r *http.Request) {
	if d.succeed {
		html := "<html><head><title>MIKE</title></head></html>"
		w.WriteHeader(200)
		_, err := io.Copy(w, bytes.NewBuffer([]byte(html)))
		require.NoError(d.t, err)
		return
	}
	w.WriteHeader(500)
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

		ctc := makeChatTestContext(t, "TestChatSrvUnfurl", 1)
		defer ctc.cleanup()
		users := ctc.users()

		timeout := 20 * time.Second
		ctx := ctc.as(t, users[0]).startCtx
		tc := ctc.world.Tcs[users[0].Username]
		ri := ctc.as(t, users[0]).ri
		listener0 := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.SetListener(listener0)
		httpSrv := newDummyHTTPSrv(t)
		httpAddr := httpSrv.Start()
		defer httpSrv.Stop()
		storage := NewDevConversationBackedStorage(tc.Context(), func() chat1.RemoteInterface { return ri })
		sender := NewNonblockingSender(tc.Context(),
			NewBlockingSender(tc.Context(), NewBoxer(tc.Context()),
				func() chat1.RemoteInterface { return ri }))
		store := attachments.NewStoreTesting(tc.Context().GetLog(), nil)
		s3signer := &ptsigner{}
		unfurler := unfurl.NewUnfurler(tc.Context(), store, s3signer, storage, sender,
			func() chat1.RemoteInterface { return ri })
		retryCh := make(chan struct{}, 5)
		unfurlCh := make(chan *chat1.Unfurl, 5)
		unfurler.SetTestingRetryCh(retryCh)
		unfurler.SetTestingUnfurlCh(unfurlCh)
		tc.ChatG.Unfurler = unfurler
		fetcher := NewRemoteAttachmentFetcher(tc.Context(), store)
		tc.ChatG.AttachmentURLSrv = NewAttachmentHTTPSrv(tc.Context(), fetcher,
			func() chat1.RemoteInterface { return mockSigningRemote{} })

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
				require.Fail(t, "no retry")
			}
			return nil
		}

		t.Logf("send for prompt")
		msg := chat1.NewMessageBodyWithText(chat1.MessageText{Body: fmt.Sprintf("http://%s", httpAddr)})
		origID := mustPostLocalForTest(t, ctc, users[0], conv, msg)
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
		recvAndCheckUnfurlMsg := func() {
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
			case mu := <-listener0.messagesUnfurled:
				require.Equal(t, 1, len(mu.Updates))
				require.Equal(t, conv.Id, mu.Updates[0].ConvID)
				require.Equal(t, origID, mu.Updates[0].Msg.GetMessageID())
				require.True(t, mu.Updates[0].Msg.IsValid())
				require.Equal(t, 1, len(mu.Updates[0].Msg.Valid().Unfurls))
				typ, err := mu.Updates[0].Msg.Valid().Unfurls[0].Unfurl.UnfurlType()
				require.NoError(t, err)
				require.Equal(t, chat1.UnfurlType_GENERIC, typ)
				generic := mu.Updates[0].Msg.Valid().Unfurls[0].Unfurl.Generic()
				require.Nil(t, generic.Image)
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
		httpSrv.succeed = true
		tc.Context().MessageDeliverer.ForceDeliverLoop(context.TODO())
		recvSingleRetry()
		u := recvUnfurl()
		require.NotNil(t, u)
		typ, err := u.UnfurlType()
		require.NoError(t, err)
		require.Equal(t, chat1.UnfurlType_GENERIC, typ)
		require.Equal(t, "MIKE", u.Generic().Title)
		recvAndCheckUnfurlMsg()

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

		t.Logf("exploding unfurl")
		dur := gregor1.ToDurationSec(60 * time.Second)
		mustPostLocalEphemeralForTest(t, ctc, users[0], conv, msg, &dur)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)
		recvAndCheckUnfurlMsg()
	})
}
