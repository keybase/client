package chat

import (
	"bytes"
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/attachments"

	"github.com/keybase/client/go/chat/unfurl"
	"github.com/keybase/client/go/protocol/chat1"
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
		uid := users[0].User.GetUID().ToBytes()
		listener0 := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.SetListener(listener0)
		httpSrv := newDummyHTTPSrv(t)
		httpAddr := httpSrv.Start()
		defer httpSrv.Stop()
		storage := NewDevConversationBackedStorage(tc.Context(), func() chat1.RemoteInterface { return ri })
		settings := unfurl.NewSettings(tc.Context().GetLog(), storage)
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
		msgID := mustPostLocalForTest(t, ctc, users[0], conv, msg)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)
		select {
		case notificationID := <-listener0.unfurlPrompt:
			require.Equal(t, msgID, notificationID)
		case <-time.After(timeout):
			require.Fail(t, "no prompt")
		}

		t.Logf("whitelist and send again")
		require.NoError(t, settings.WhitelistAdd(ctx, uid, "0.1"))
		consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)
		mustPostLocalForTest(t, ctc, users[0], conv, msg)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)
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
		httpSrv.succeed = true
		tc.Context().MessageDeliverer.ForceDeliverLoop(context.TODO())
		recvSingleRetry()
		u := recvUnfurl()
		require.NotNil(t, u)
		typ, err := u.UnfurlType()
		require.NoError(t, err)
		require.Equal(t, chat1.UnfurlType_GENERIC, typ)
		require.Equal(t, "MIKE", u.Generic().Title)
		select {
		case m := <-listener0.newMessageRemote:
			require.Equal(t, conv.Id, m.ConvID)
			require.True(t, m.Message.IsValid())
			require.Equal(t, chat1.MessageType_UNFURL, m.Message.GetMessageType())
		case <-time.After(timeout):
			require.Fail(t, "no message")
		}
	})
}
