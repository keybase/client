// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"context"
	"errors"
	"io"
	"net"
	"sort"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/stretchr/testify/require"
)

// A chat notification can reach the GUI after the account it was generated
// for has signed out: login and logout are not serialized against chat
// notifications. The GUI can drop such a notification only if it says which
// account it is for, so every NotifyChat notification must carry, as `uid`,
// the account it was generated for.
//
// Entries whose send takes no uid today ignore theirs (`_`); the fix threads
// the account through those sends.
func TestChatNotificationsNameTheirAccount(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()

	rec := newChatUIDRecorder(g, keybase1.NotificationChannels{
		Chat:            true,
		Chatattachments: true,
		Chatarchive:     true,
	})
	defer rec.close()

	uid := keybase1.UID("295a7eea607af32040647123732bc819")
	convID := chat1.ConversationID("conv")
	activity := chat1.NewChatActivityWithReadMessage(chat1.ReadMessageInfo{ConvID: convID})

	type send func(ctx context.Context, r *NotifyRouter, uid keybase1.UID)
	sends := map[string]send{
		"NewChatActivity": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleNewChatActivity(ctx, uid, chat1.TopicType_CHAT, &activity, chat1.ChatActivitySource_LOCAL, false)
		},
		"ChatIdentifyUpdate": func(ctx context.Context, r *NotifyRouter, _ keybase1.UID) {
			r.HandleChatIdentifyUpdate(ctx, keybase1.CanonicalTLFNameAndIDWithBreaks{})
		},
		"ChatTLFFinalize": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatTLFFinalize(ctx, uid, convID, chat1.TopicType_CHAT, chat1.ConversationFinalizeInfo{}, nil)
		},
		"ChatTLFResolve": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatTLFResolve(ctx, uid, convID, chat1.TopicType_CHAT, chat1.ConversationResolveInfo{})
		},
		"ChatInboxStale": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatInboxStale(ctx, uid)
		},
		"ChatThreadsStale": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatThreadsStale(ctx, uid, nil)
		},
		"ChatTypingUpdate": func(ctx context.Context, r *NotifyRouter, _ keybase1.UID) {
			r.HandleChatTypingUpdate(ctx, nil)
		},
		"ChatJoinedConversation": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatJoinedConversation(ctx, uid, convID, chat1.TopicType_CHAT, nil)
		},
		"ChatLeftConversation": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatLeftConversation(ctx, uid, convID, chat1.TopicType_CHAT)
		},
		"ChatResetConversation": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatResetConversation(ctx, uid, convID, chat1.TopicType_CHAT)
		},
		"ChatInboxSyncStarted": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatInboxSyncStarted(ctx, uid)
		},
		"ChatInboxSynced": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatInboxSynced(ctx, uid, chat1.TopicType_CHAT, chat1.NewChatSyncResultWithClear())
		},
		"ChatSetConvRetention": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatSetConvRetention(ctx, uid, convID, chat1.TopicType_CHAT, nil)
		},
		"ChatSetTeamRetention": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatSetTeamRetention(ctx, uid, keybase1.TeamID(""), chat1.TopicType_CHAT, nil)
		},
		"ChatSetConvSettings": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatSetConvSettings(ctx, uid, convID, chat1.TopicType_CHAT, nil)
		},
		"ChatSubteamRename": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatSubteamRename(ctx, uid, nil, chat1.TopicType_CHAT, nil)
		},
		"ChatKBFSToImpteamUpgrade": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatKBFSToImpteamUpgrade(ctx, uid, convID, chat1.TopicType_CHAT)
		},
		"ChatAttachmentUploadStart": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatAttachmentUploadStart(ctx, uid, convID, nil)
		},
		"ChatAttachmentUploadProgress": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatAttachmentUploadProgress(ctx, uid, convID, nil, 1, 2)
		},
		"ChatAttachmentDownloadProgress": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatAttachmentDownloadProgress(ctx, uid, convID, 1, 1, 2)
		},
		"ChatAttachmentDownloadComplete": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatAttachmentDownloadComplete(ctx, uid, convID, 1)
		},
		"ChatArchiveProgress": func(ctx context.Context, r *NotifyRouter, _ keybase1.UID) {
			r.HandleChatArchiveProgress(ctx, chat1.ArchiveJobID("job"), 1, 2)
		},
		"ChatArchiveComplete": func(ctx context.Context, r *NotifyRouter, _ keybase1.UID) {
			r.HandleChatArchiveComplete(ctx, chat1.ArchiveJobID("job"))
		},
		"ChatPaymentInfo": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatPaymentInfo(ctx, uid, convID, 1, chat1.UIPaymentInfo{})
		},
		"ChatRequestInfo": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatRequestInfo(ctx, uid, convID, 1, chat1.UIRequestInfo{})
		},
		"ChatPromptUnfurl": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatPromptUnfurl(ctx, uid, convID, 1, "example.com")
		},
		"ChatConvUpdate": func(ctx context.Context, r *NotifyRouter, uid keybase1.UID) {
			r.HandleChatConvUpdate(ctx, uid, convID, chat1.TopicType_CHAT, nil)
		},
		"ChatWelcomeMessageLoaded": func(ctx context.Context, r *NotifyRouter, _ keybase1.UID) {
			r.HandleChatWelcomeMessageLoaded(ctx, keybase1.TeamID(""), chat1.WelcomeMessageDisplay{})
		},
		"ChatParticipantsInfo": func(ctx context.Context, r *NotifyRouter, _ keybase1.UID) {
			r.HandleChatParticipantsInfo(ctx, nil)
		},
	}

	// every notification in the protocol is covered, so one added later
	// without a uid fails here too
	var names []string
	for name := range chat1.NotifyChatProtocol(nil).Methods {
		require.Contains(t, sends, name, "NotifyChat.%s has no entry in this test", name)
		names = append(names, name)
	}
	sort.Strings(names)

	ctx := context.Background()
	for _, name := range names {
		t.Run(name, func(t *testing.T) {
			method := "chat.1.NotifyChat." + name
			sends[name](ctx, g.NotifyRouter, uid)
			var arg map[string]any
			require.Eventually(t, func() bool {
				found, ok := rec.last(method)
				if ok {
					arg = found
				}
				return ok
			}, 10*time.Second, 10*time.Millisecond, "%s was never sent", method)
			require.Contains(t, arg, "uid", "%s does not say which account it is for", method)
			require.Equal(t, uid.String(), arg["uid"], "%s names the wrong account", method)
		})
	}
}

// chatUIDRecorder is a GUI connection registered with a NotifyRouter. It
// decodes each notification written to it into its argument map.
type chatUIDRecorder struct {
	conn   *chatUIDConn
	closed chan error
}

func newChatUIDHandle() *codec.MsgpackHandle {
	return &codec.MsgpackHandle{WriteExt: true, RawToString: true}
}

func newChatUIDRecorder(g *GlobalContext, channels keybase1.NotificationChannels) *chatUIDRecorder {
	conn := &chatUIDConn{readDone: make(chan struct{}), args: make(map[string]map[string]any)}
	xp := rpc.NewTransport(conn, NewRPCLogFactory(g), g.LocalNetworkInstrumenterStorage,
		MakeWrapError(g), rpc.DefaultMaxFrameLength)
	closed := make(chan error, 1)
	rpc.NewServer(xp, MakeWrapError(g)).Run()
	id := g.NotifyRouter.AddConnection(xp, closed)
	g.NotifyRouter.SetChannels(id, channels)
	return &chatUIDRecorder{conn: conn, closed: closed}
}

// last returns the argument of the most recent notification sent as method.
func (r *chatUIDRecorder) last(method string) (map[string]any, bool) {
	r.conn.mu.Lock()
	defer r.conn.mu.Unlock()
	arg, ok := r.conn.args[method]
	return arg, ok
}

func (r *chatUIDRecorder) close() {
	_ = r.conn.Close()
	r.closed <- io.EOF
}

type chatUIDConn struct {
	mu        sync.Mutex
	args      map[string]map[string]any
	closeOnce sync.Once
	readDone  chan struct{}
}

var _ net.Conn = (*chatUIDConn)(nil)

// Write gets exactly one frame per call: the rpc encoder writes each frame,
// its length prefix included, in a single Write.
func (c *chatUIDConn) Write(b []byte) (int, error) {
	dec := codec.NewDecoderBytes(b, newChatUIDHandle())
	var length int
	var frame []any
	if err := dec.Decode(&length); err != nil {
		return 0, err
	}
	if err := dec.Decode(&frame); err != nil {
		return 0, err
	}
	// a notification is [2, method, args, tags?]
	if len(frame) < 3 {
		return 0, errors.New("chatUIDConn: not a notification")
	}
	method, _ := frame[1].(string)
	args, _ := frame[2].([]any)
	arg := map[string]any{}
	if len(args) > 0 {
		var raw []byte
		if err := codec.NewEncoderBytes(&raw, newChatUIDHandle()).Encode(args[0]); err != nil {
			return 0, err
		}
		if err := codec.NewDecoderBytes(raw, newChatUIDHandle()).Decode(&arg); err != nil {
			return 0, err
		}
	}
	c.mu.Lock()
	c.args[method] = arg
	c.mu.Unlock()
	return len(b), nil
}

func (c *chatUIDConn) Read([]byte) (int, error) {
	<-c.readDone
	return 0, io.EOF
}

func (c *chatUIDConn) Close() error {
	c.closeOnce.Do(func() { close(c.readDone) })
	return nil
}

func (c *chatUIDConn) LocalAddr() net.Addr              { return nil }
func (c *chatUIDConn) RemoteAddr() net.Addr             { return nil }
func (c *chatUIDConn) SetDeadline(time.Time) error      { return nil }
func (c *chatUIDConn) SetReadDeadline(time.Time) error  { return nil }
func (c *chatUIDConn) SetWriteDeadline(time.Time) error { return nil }
