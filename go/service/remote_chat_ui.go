package service

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/protocol/chat1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type RemoteChatUI struct {
	sessionID int
	cli       chat1.ChatUiClient
}

func NewRemoteChatUI(sessionID int, c *rpc.Client) *RemoteChatUI {
	return &RemoteChatUI{
		sessionID: sessionID,
		cli:       chat1.ChatUiClient{Cli: c},
	}
}

func (r *RemoteChatUI) ChatAttachmentDownloadStart(ctx context.Context) error {
	return r.cli.ChatAttachmentDownloadStart(ctx, r.sessionID)
}

func (r *RemoteChatUI) ChatAttachmentDownloadProgress(ctx context.Context, arg chat1.ChatAttachmentDownloadProgressArg) error {
	arg.SessionID = r.sessionID
	return r.cli.ChatAttachmentDownloadProgress(ctx, arg)
}

func (r *RemoteChatUI) ChatAttachmentDownloadDone(ctx context.Context) error {
	return r.cli.ChatAttachmentDownloadDone(ctx, r.sessionID)
}

func (r *RemoteChatUI) ChatInboxConversation(ctx context.Context, arg chat1.ChatInboxConversationArg) error {
	return r.cli.ChatInboxConversation(ctx, arg)
}

func (r *RemoteChatUI) ChatInboxFailed(ctx context.Context, arg chat1.ChatInboxFailedArg) error {
	return r.cli.ChatInboxFailed(ctx, arg)
}

func (r *RemoteChatUI) ChatInboxUnverified(ctx context.Context, arg chat1.ChatInboxUnverifiedArg) error {
	return r.cli.ChatInboxUnverified(ctx, arg)
}

func (r *RemoteChatUI) ChatThreadCached(ctx context.Context, arg chat1.ChatThreadCachedArg) error {
	return r.cli.ChatThreadCached(ctx, arg)
}

func (r *RemoteChatUI) ChatThreadFull(ctx context.Context, arg chat1.ChatThreadFullArg) error {
	return r.cli.ChatThreadFull(ctx, arg)
}

func (r *RemoteChatUI) ChatConfirmChannelDelete(ctx context.Context, arg chat1.ChatConfirmChannelDeleteArg) (bool, error) {
	return r.cli.ChatConfirmChannelDelete(ctx, arg)
}

func (r *RemoteChatUI) ChatSearchHit(ctx context.Context, arg chat1.ChatSearchHitArg) error {
	return r.cli.ChatSearchHit(ctx, arg)
}

func (r *RemoteChatUI) ChatSearchDone(ctx context.Context, arg chat1.ChatSearchDoneArg) error {
	return r.cli.ChatSearchDone(ctx, arg)
}

func (r *RemoteChatUI) ChatSearchInboxHit(ctx context.Context, arg chat1.ChatSearchInboxHitArg) error {
	return r.cli.ChatSearchInboxHit(ctx, arg)
}

func (r *RemoteChatUI) ChatSearchInboxDone(ctx context.Context, arg chat1.ChatSearchInboxDoneArg) error {
	return r.cli.ChatSearchInboxDone(ctx, arg)
}

func (r *RemoteChatUI) ChatSearchIndexStatus(ctx context.Context, arg chat1.ChatSearchIndexStatusArg) error {
	return r.cli.ChatSearchIndexStatus(ctx, arg)
}

func (r *RemoteChatUI) ChatStellarDataConfirm(ctx context.Context, summary chat1.UIChatPaymentSummary) (bool, error) {
	return r.cli.ChatStellarDataConfirm(ctx, chat1.ChatStellarDataConfirmArg{
		SessionID: r.sessionID,
		Summary:   summary,
	})
}

func (r *RemoteChatUI) ChatStellarShowConfirm(ctx context.Context) error {
	return r.cli.ChatStellarShowConfirm(ctx, r.sessionID)
}

func (r *RemoteChatUI) ChatStellarDataError(ctx context.Context, err keybase1.Status) (bool, error) {
	return r.cli.ChatStellarDataError(ctx, chat1.ChatStellarDataErrorArg{
		SessionID: r.sessionID,
		Error:     err,
	})
}

func (r *RemoteChatUI) ChatStellarDone(ctx context.Context, canceled bool) error {
	return r.cli.ChatStellarDone(ctx, chat1.ChatStellarDoneArg{
		SessionID: r.sessionID,
		Canceled:  canceled,
	})
}

func (r *RemoteChatUI) ChatGiphySearchResults(ctx context.Context, convID chat1.ConversationID,
	results []chat1.GiphySearchResult) error {
	return r.cli.ChatGiphySearchResults(ctx, chat1.ChatGiphySearchResultsArg{
		SessionID: r.sessionID,
		ConvID:    convID.String(),
		Results:   results,
	})
}

func (r *RemoteChatUI) ChatGiphyToggleResultWindow(ctx context.Context, convID chat1.ConversationID,
	show bool) error {
	return r.cli.ChatGiphyToggleResultWindow(ctx, chat1.ChatGiphyToggleResultWindowArg{
		SessionID: r.sessionID,
		ConvID:    convID.String(),
		Show:      show,
	})
}

func (r *RemoteChatUI) ChatShowManageChannels(ctx context.Context, teamname string) error {
	return r.cli.ChatShowManageChannels(ctx, chat1.ChatShowManageChannelsArg{
		SessionID: r.sessionID,
		Teamname:  teamname,
	})
}

func (r *RemoteChatUI) ChatCoinFlipStatus(ctx context.Context, statuses []chat1.UICoinFlipStatus) error {
	return r.cli.ChatCoinFlipStatus(ctx, chat1.ChatCoinFlipStatusArg{
		SessionID: r.sessionID,
		Statuses:  statuses,
	})
}

func (r *RemoteChatUI) ChatCommandMarkdown(ctx context.Context, convID chat1.ConversationID,
	md *chat1.UICommandMarkdown) error {
	return r.cli.ChatCommandMarkdown(ctx, chat1.ChatCommandMarkdownArg{
		SessionID: r.sessionID,
		ConvID:    convID.String(),
		Md:        md,
	})
}
