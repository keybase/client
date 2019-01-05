package utils

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/protocol/chat1"
)

type DummyChatUI struct{}

func (r DummyChatUI) ChatAttachmentDownloadStart(ctx context.Context, sessionID int) error {
	return nil
}

func (r DummyChatUI) ChatAttachmentDownloadProgress(ctx context.Context,
	arg chat1.ChatAttachmentDownloadProgressArg) error {
	return nil
}

func (r DummyChatUI) ChatAttachmentDownloadDone(ctx context.Context, sessionID int) error {
	return nil
}

func (r DummyChatUI) ChatInboxConversation(ctx context.Context, arg chat1.ChatInboxConversationArg) error {
	return nil
}

func (r DummyChatUI) ChatInboxFailed(ctx context.Context, arg chat1.ChatInboxFailedArg) error {
	return nil
}

func (r DummyChatUI) ChatInboxUnverified(ctx context.Context, arg chat1.ChatInboxUnverifiedArg) error {
	return nil
}

func (r DummyChatUI) ChatThreadCached(ctx context.Context, arg chat1.ChatThreadCachedArg) error {
	return nil
}

func (r DummyChatUI) ChatThreadFull(ctx context.Context, arg chat1.ChatThreadFullArg) error {
	return nil
}

func (r DummyChatUI) ChatConfirmChannelDelete(ctx context.Context, arg chat1.ChatConfirmChannelDeleteArg) (bool, error) {
	return true, nil
}

func (r DummyChatUI) ChatSearchHit(ctx context.Context, arg chat1.ChatSearchHitArg) error {
	return nil
}

func (r DummyChatUI) ChatSearchDone(ctx context.Context, arg chat1.ChatSearchDoneArg) error {
	return nil
}

func (r DummyChatUI) ChatSearchInboxHit(ctx context.Context, arg chat1.ChatSearchInboxHitArg) error {
	return nil
}

func (r DummyChatUI) ChatSearchInboxDone(ctx context.Context, arg chat1.ChatSearchInboxDoneArg) error {
	return nil
}

func (r DummyChatUI) ChatSearchIndexStatus(ctx context.Context, arg chat1.ChatSearchIndexStatusArg) error {
	return nil
}

func (r DummyChatUI) ChatStellarDataConfirm(ctx context.Context, arg chat1.ChatStellarDataConfirmArg) (bool, error) {
	return true, nil
}

func (r DummyChatUI) ChatStellarShowConfirm(ctx context.Context, sessionID int) error {
	return nil
}

func (r DummyChatUI) ChatStellarDataError(ctx context.Context, arg chat1.ChatStellarDataErrorArg) (bool, error) {
	return true, nil
}

func (r DummyChatUI) ChatStellarDone(ctx context.Context, arg chat1.ChatStellarDoneArg) error {
	return nil
}
