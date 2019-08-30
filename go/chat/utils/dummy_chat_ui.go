package utils

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
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

func (r DummyChatUI) ChatThreadStatus(ctx context.Context, arg chat1.ChatThreadStatusArg) error {
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

func (r DummyChatUI) ChatSearchInboxStart(ctx context.Context, sessionID int) error {
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

func (r DummyChatUI) ChatSearchConvHits(ctx context.Context, arg chat1.ChatSearchConvHitsArg) error {
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

func (r DummyChatUI) ChatGiphySearchResults(ctx context.Context, arg chat1.ChatGiphySearchResultsArg) error {
	return nil
}

func (r DummyChatUI) ChatGiphyToggleResultWindow(ctx context.Context,
	arg chat1.ChatGiphyToggleResultWindowArg) error {
	return nil
}

func (r DummyChatUI) ChatShowManageChannels(ctx context.Context, arg chat1.ChatShowManageChannelsArg) error {
	return nil
}

func (r DummyChatUI) ChatCoinFlipStatus(ctx context.Context, arg chat1.ChatCoinFlipStatusArg) error {
	return nil
}

func (r DummyChatUI) ChatCommandMarkdown(ctx context.Context, arg chat1.ChatCommandMarkdownArg) error {
	return nil
}

func (r DummyChatUI) ChatMaybeMentionUpdate(ctx context.Context, arg chat1.ChatMaybeMentionUpdateArg) error {
	return nil
}

func (r DummyChatUI) ChatLoadGalleryHit(ctx context.Context, arg chat1.ChatLoadGalleryHitArg) error {
	return nil
}

func (r DummyChatUI) ChatWatchPosition(context.Context, chat1.ChatWatchPositionArg) (chat1.LocationWatchID, error) {
	return chat1.LocationWatchID(0), nil
}

func (r DummyChatUI) ChatClearWatch(context.Context, chat1.ChatClearWatchArg) error {
	return nil
}

func (r DummyChatUI) ChatCommandStatus(context.Context, chat1.ChatCommandStatusArg) error {
	return nil
}

func (r DummyChatUI) ChatBotCommandsUpdateStatus(context.Context, chat1.ChatBotCommandsUpdateStatusArg) error {
	return nil
}

type DummyChatNotifications struct{}

func (d DummyChatNotifications) NewChatActivity(ctx context.Context, arg chat1.NewChatActivityArg) error {
	return nil
}

func (d DummyChatNotifications) ChatIdentifyUpdate(context.Context, keybase1.CanonicalTLFNameAndIDWithBreaks) error {
	return nil
}
func (d DummyChatNotifications) ChatTLFFinalize(context.Context, chat1.ChatTLFFinalizeArg) error {
	return nil
}
func (d DummyChatNotifications) ChatTLFResolve(context.Context, chat1.ChatTLFResolveArg) error {
	return nil
}
func (d DummyChatNotifications) ChatInboxStale(context.Context, keybase1.UID) error { return nil }
func (d DummyChatNotifications) ChatThreadsStale(context.Context, chat1.ChatThreadsStaleArg) error {
	return nil
}
func (d DummyChatNotifications) ChatTypingUpdate(context.Context, []chat1.ConvTypingUpdate) error {
	return nil
}
func (d DummyChatNotifications) ChatJoinedConversation(context.Context, chat1.ChatJoinedConversationArg) error {
	return nil
}
func (d DummyChatNotifications) ChatLeftConversation(context.Context, chat1.ChatLeftConversationArg) error {
	return nil
}
func (d DummyChatNotifications) ChatResetConversation(context.Context, chat1.ChatResetConversationArg) error {
	return nil
}
func (d DummyChatNotifications) ChatInboxSyncStarted(context.Context, keybase1.UID) error {
	return nil
}
func (d DummyChatNotifications) ChatInboxSynced(context.Context, chat1.ChatInboxSyncedArg) error {
	return nil
}
func (d DummyChatNotifications) ChatSetConvRetention(context.Context, chat1.ChatSetConvRetentionArg) error {
	return nil
}
func (d DummyChatNotifications) ChatSetTeamRetention(context.Context, chat1.ChatSetTeamRetentionArg) error {
	return nil
}
func (d DummyChatNotifications) ChatSetConvSettings(context.Context, chat1.ChatSetConvSettingsArg) error {
	return nil
}
func (d DummyChatNotifications) ChatSubteamRename(context.Context, chat1.ChatSubteamRenameArg) error {
	return nil
}
func (d DummyChatNotifications) ChatKBFSToImpteamUpgrade(context.Context, chat1.ChatKBFSToImpteamUpgradeArg) error {
	return nil
}
func (d DummyChatNotifications) ChatAttachmentUploadStart(context.Context, chat1.ChatAttachmentUploadStartArg) error {
	return nil
}
func (d DummyChatNotifications) ChatAttachmentUploadProgress(context.Context, chat1.ChatAttachmentUploadProgressArg) error {
	return nil
}
func (d DummyChatNotifications) ChatPaymentInfo(context.Context, chat1.ChatPaymentInfoArg) error {
	return nil
}
func (d DummyChatNotifications) ChatRequestInfo(context.Context, chat1.ChatRequestInfoArg) error {
	return nil
}
func (d DummyChatNotifications) ChatPromptUnfurl(context.Context, chat1.ChatPromptUnfurlArg) error {
	return nil
}
