package chat

import (
	"context"
	"net"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbhttp/manager"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type startOnlyAttachmentFetcher struct {
	types.AttachmentFetcher
}

func (startOnlyAttachmentFetcher) OnStart(libkb.MetaContext) {}

// requireSrvServing waits until the server does or does not accept connections
// at the address it hands out.
func requireSrvServing(t *testing.T, srv *manager.Srv, serving bool) {
	t.Helper()
	require.Eventually(t, func() bool {
		addr, err := srv.Addr()
		if err != nil {
			return false
		}
		conn, err := net.DialTimeout("tcp", addr, time.Second)
		if err == nil {
			conn.Close()
		}
		return (err == nil) == serving
	}, 10*time.Second, time.Millisecond, "server serving != %v", serving)
}

func TestGetURLWhileStoppedUsesLastAddress(t *testing.T) {
	tc := externalstest.SetupTest(t, "attachment-url-stopped", 0)
	defer tc.Cleanup()
	tc.G.ConnectionManager = libkb.NewConnectionManager()
	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	httpSrv := manager.NewSrv(tc.G)
	srv := NewAttachmentHTTPSrv(g, httpSrv, startOnlyAttachmentFetcher{}, nil)
	g.AttachmentURLSrv = srv
	emoji := NewDevConvEmojiSource(g, nil)
	ctx := context.TODO()
	msg := chat1.EmojiMessage{ConvID: convLoaderTestConvID, MsgID: 3}

	type urls struct {
		full, preview, emoji, emojiNoAnim, emojiNoAnimOnly string
	}
	get := func() urls {
		var res urls
		res.full = srv.GetURL(ctx, msg.ConvID, msg.MsgID, false, false, false)
		res.preview = srv.GetURL(ctx, msg.ConvID, msg.MsgID, true, false, false)
		source, noAnimSource, err := emoji.RemoteToLocalSource(ctx, chat1.NewEmojiRemoteSourceWithMessage(msg), false)
		require.NoError(t, err)
		res.emoji, res.emojiNoAnim = source.Httpsrv(), noAnimSource.Httpsrv()
		source, _, err = emoji.RemoteToLocalSource(ctx, chat1.NewEmojiRemoteSourceWithMessage(msg), true)
		require.NoError(t, err)
		res.emojiNoAnimOnly = source.Httpsrv()
		return res
	}

	requireSrvServing(t, httpSrv, true)
	addr, err := httpSrv.Addr()
	require.NoError(t, err)
	prefix := "http://" + addr + "/"
	up := get()
	for _, url := range []string{up.full, up.preview, up.emoji, up.emojiNoAnim, up.emojiNoAnimOnly} {
		require.True(t, strings.HasPrefix(url, prefix), "url %q while serving", url)
	}
	require.Contains(t, up.preview, "&prev=true")

	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	requireSrvServing(t, httpSrv, false)
	require.Equal(t, up, get())

	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	requireSrvServing(t, httpSrv, true)
	require.Equal(t, up, get())
}
