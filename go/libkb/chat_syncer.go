package libkb

import (
	types "github.com/keybase/client/go/chat/types"
	chat1 "github.com/keybase/client/go/protocol/chat1"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	context "golang.org/x/net/context"
)

type NullChatSyncer struct {
}

func (s NullChatSyncer) IsConnected(ctx context.Context) bool {
	return true
}

func (s NullChatSyncer) Connected(ctx context.Context, cli chat1.RemoteInterface, uid gregor1.UID,
	syncRes *chat1.SyncChatRes) error {
	return nil
}

func (s NullChatSyncer) Disconnected(ctx context.Context) {

}

func (s NullChatSyncer) Sync(ctx context.Context, cli chat1.RemoteInterface, uid gregor1.UID,
	syncRes *chat1.SyncChatRes) error {
	return nil
}

func (s NullChatSyncer) RegisterOfflinable(offlinable types.Offlinable) {

}

func (s NullChatSyncer) SendChatStaleNotifications(ctx context.Context, uid gregor1.UID, convIDs []chat1.ConversationID, immediate bool) {

}

func (s NullChatSyncer) Shutdown() {

}

var _ types.Syncer = NullChatSyncer{}
