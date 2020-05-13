package utils

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type NullChatUI struct{}

var _ libkb.ChatUI = (*NullChatUI)(nil)

func (u NullChatUI) ChatInboxUnverified(context.Context, chat1.ChatInboxUnverifiedArg) error {
	return nil
}
func (u NullChatUI) ChatInboxConversation(context.Context, chat1.ChatInboxConversationArg) error {
	return nil
}
func (u NullChatUI) ChatInboxFailed(context.Context, chat1.ChatInboxFailedArg) error  { return nil }
func (u NullChatUI) ChatInboxLayout(context.Context, string) error                    { return nil }
func (u NullChatUI) ChatThreadCached(context.Context, *string) error                  { return nil }
func (u NullChatUI) ChatThreadFull(context.Context, string) error                     { return nil }
func (u NullChatUI) ChatThreadStatus(context.Context, chat1.UIChatThreadStatus) error { return nil }
func (u NullChatUI) ChatConfirmChannelDelete(context.Context, chat1.ChatConfirmChannelDeleteArg) (bool, error) {
	return false, nil
}
func (u NullChatUI) ChatSearchHit(context.Context, chat1.ChatSearchHitArg) error           { return nil }
func (u NullChatUI) ChatSearchDone(context.Context, chat1.ChatSearchDoneArg) error         { return nil }
func (u NullChatUI) ChatSearchInboxHit(context.Context, chat1.ChatSearchInboxHitArg) error { return nil }
func (u NullChatUI) ChatSearchInboxStart(context.Context) error                            { return nil }
func (u NullChatUI) ChatSearchInboxDone(context.Context, chat1.ChatSearchInboxDoneArg) error {
	return nil
}
func (u NullChatUI) ChatSearchIndexStatus(context.Context, chat1.ChatSearchIndexStatusArg) error {
	return nil
}
func (u NullChatUI) ChatSearchConvHits(context.Context, chat1.UIChatSearchConvHits) error { return nil }
func (u NullChatUI) ChatSearchTeamHits(context.Context, chat1.UIChatSearchTeamHits) error { return nil }
func (u NullChatUI) ChatSearchBotHits(context.Context, chat1.UIChatSearchBotHits) error   { return nil }
func (u NullChatUI) ChatStellarShowConfirm(context.Context) error                         { return nil }
func (u NullChatUI) ChatStellarDataConfirm(context.Context, chat1.UIChatPaymentSummary) (bool, error) {
	return false, nil
}
func (u NullChatUI) ChatStellarDataError(context.Context, keybase1.Status) (bool, error) {
	return false, nil
}
func (u NullChatUI) ChatStellarDone(context.Context, bool) error { return nil }
func (u NullChatUI) ChatGiphySearchResults(ctx context.Context, convID chat1.ConversationID,
	results chat1.GiphySearchResults) error {
	return nil
}
func (u NullChatUI) ChatGiphyToggleResultWindow(ctx context.Context, convID chat1.ConversationID, show, clearInput bool) error {
	return nil
}
func (u NullChatUI) ChatShowManageChannels(context.Context, string) error               { return nil }
func (u NullChatUI) ChatCoinFlipStatus(context.Context, []chat1.UICoinFlipStatus) error { return nil }
func (u NullChatUI) ChatCommandMarkdown(context.Context, chat1.ConversationID, *chat1.UICommandMarkdown) error {
	return nil
}
func (u NullChatUI) ChatMaybeMentionUpdate(context.Context, string, string, chat1.UIMaybeMentionInfo) error {
	return nil
}
func (u NullChatUI) ChatLoadGalleryHit(context.Context, chat1.UIMessage) error { return nil }
func (u NullChatUI) ChatWatchPosition(context.Context, chat1.ConversationID, chat1.UIWatchPositionPerm) (chat1.LocationWatchID, error) {
	return 0, nil
}
func (u NullChatUI) ChatClearWatch(context.Context, chat1.LocationWatchID) error { return nil }
func (u NullChatUI) ChatCommandStatus(context.Context, chat1.ConversationID, string, chat1.UICommandStatusDisplayTyp,
	[]chat1.UICommandStatusActionTyp) error {
	return nil
}
func (u NullChatUI) ChatBotCommandsUpdateStatus(context.Context, chat1.ConversationID, chat1.UIBotCommandsUpdateStatus) error {
	return nil
}
func (u NullChatUI) TriggerContactSync(context.Context) error { return nil }
