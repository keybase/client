package chat

import (
	"context"
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

// Attachment and emoji URLs are cached by callers, so they must keep
// resolving to the same address across a background/foreground cycle rather
// than going blank while the underlying http server is stopped.
func TestAttachmentURLsSurviveBackground(t *testing.T) {
	tc := externalstest.SetupTest(t, "attachment-url-bg", 0)
	defer tc.Cleanup()
	tc.G.ConnectionManager = libkb.NewConnectionManager()
	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	httpSrv := manager.NewSrv(tc.G)
	srv := NewAttachmentHTTPSrv(g, httpSrv, types.DummyAttachmentFetcher{}, nil)
	g.AttachmentURLSrv = srv
	emoji := NewDevConvEmojiSource(g, nil)
	ctx := context.TODO()
	convID := chat1.ConversationID([]byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16})
	msg := chat1.EmojiMessage{ConvID: convID, MsgID: 3}

	require.True(t, httpSrv.Active())
	beforeURL := srv.GetURL(ctx, msg.ConvID, msg.MsgID, false, false, false)
	require.NotEmpty(t, beforeURL)
	source, _, err := emoji.RemoteToLocalSource(ctx, chat1.NewEmojiRemoteSourceWithMessage(msg), false)
	require.NoError(t, err)
	beforeEmoji := source.Httpsrv()
	require.NotEmpty(t, beforeEmoji)

	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	require.Eventually(t, func() bool { return !httpSrv.Active() }, 10*time.Second, time.Millisecond,
		"BACKGROUND did not stop the server")

	afterURL := srv.GetURL(ctx, msg.ConvID, msg.MsgID, false, false, false)
	require.NotEmpty(t, afterURL, "GetURL went blank once backgrounded")
	require.Equal(t, beforeURL, afterURL)

	source, _, err = emoji.RemoteToLocalSource(ctx, chat1.NewEmojiRemoteSourceWithMessage(msg), false)
	require.NoError(t, err)
	afterEmoji := source.Httpsrv()
	require.NotEmpty(t, afterEmoji, "emoji URL went blank once backgrounded")
	require.Equal(t, beforeEmoji, afterEmoji)
}
