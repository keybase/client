package client

import (
	"context"
	"crypto/rand"
	"math/big"
	"sync"

	"github.com/keybase/client/go/protocol/chat1"
)

type DelegateChatUI struct {
	sync.Mutex
	// sessionID -> chatUI
	chatUIs map[int]chat1.ChatUiInterface
}

var _ chat1.ChatUiInterface = (*DelegateChatUI)(nil)

func newDelegateChatUI() *DelegateChatUI {
	return &DelegateChatUI{
		chatUIs: make(map[int]chat1.ChatUiInterface),
	}
}

func getSessionID(chatUI chat1.ChatUiInterface) int {
	switch ui := chatUI.(type) {
	case *ChatAPIUI:
		return ui.sessionID
	case *ChatCLIUI:
		return ui.sessionID
	default:
		return 0
	}
}

func randSessionID() int {
	sessionID, err := rand.Int(rand.Reader, big.NewInt(int64(1<<32)))
	if err != nil {
		return 0
	}
	return int(sessionID.Int64())
}

func (c *DelegateChatUI) RegisterChatUI(chatUI chat1.ChatUiInterface) {
	c.Lock()
	defer c.Unlock()
	sessionID := getSessionID(chatUI)
	c.chatUIs[sessionID] = chatUI
}

func (c *DelegateChatUI) DeregisterChatUI(chatUI chat1.ChatUiInterface) {
	c.Lock()
	defer c.Unlock()
	sessionID := getSessionID(chatUI)
	delete(c.chatUIs, sessionID)
}

func (c *DelegateChatUI) getChatUI(sessionID int) *chat1.ChatUiInterface {
	c.Lock()
	defer c.Unlock()
	if chatUI, ok := c.chatUIs[sessionID]; ok {
		return &chatUI
	}
	return nil
}

func (c *DelegateChatUI) ChatInboxConversation(ctx context.Context, arg chat1.ChatInboxConversationArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatInboxConversation(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatInboxLayout(ctx context.Context, arg chat1.ChatInboxLayoutArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatInboxLayout(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatInboxFailed(ctx context.Context, arg chat1.ChatInboxFailedArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatInboxFailed(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatInboxUnverified(ctx context.Context, arg chat1.ChatInboxUnverifiedArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatInboxUnverified(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatThreadCached(ctx context.Context, arg chat1.ChatThreadCachedArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatThreadCached(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatThreadFull(ctx context.Context, arg chat1.ChatThreadFullArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatThreadFull(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatThreadStatus(ctx context.Context, arg chat1.ChatThreadStatusArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatThreadStatus(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatConfirmChannelDelete(ctx context.Context, arg chat1.ChatConfirmChannelDeleteArg) (bool, error) {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatConfirmChannelDelete(ctx, arg)
	}
	return true, nil
}

func (c *DelegateChatUI) ChatSearchHit(ctx context.Context, arg chat1.ChatSearchHitArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatSearchHit(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatSearchDone(ctx context.Context, arg chat1.ChatSearchDoneArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatSearchDone(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatSearchInboxStart(ctx context.Context, sessionID int) error {
	if chatUI := c.getChatUI(sessionID); chatUI != nil {
		return (*chatUI).ChatSearchInboxStart(ctx, sessionID)
	}
	return nil
}

func (c *DelegateChatUI) ChatSearchInboxHit(ctx context.Context, arg chat1.ChatSearchInboxHitArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatSearchInboxHit(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatSearchInboxDone(ctx context.Context, arg chat1.ChatSearchInboxDoneArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatSearchInboxDone(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatSearchIndexStatus(ctx context.Context, arg chat1.ChatSearchIndexStatusArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatSearchIndexStatus(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatSearchConvHits(ctx context.Context, arg chat1.ChatSearchConvHitsArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatSearchConvHits(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatSearchTeamHits(ctx context.Context, arg chat1.ChatSearchTeamHitsArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatSearchTeamHits(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatSearchBotHits(ctx context.Context, arg chat1.ChatSearchBotHitsArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatSearchBotHits(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatStellarDataConfirm(ctx context.Context, arg chat1.ChatStellarDataConfirmArg) (bool, error) {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatStellarDataConfirm(ctx, arg)
	}
	return true, nil
}

func (c *DelegateChatUI) ChatStellarShowConfirm(ctx context.Context, sessionID int) error {
	if chatUI := c.getChatUI(sessionID); chatUI != nil {
		return (*chatUI).ChatStellarShowConfirm(ctx, sessionID)
	}
	return nil
}

func (c *DelegateChatUI) ChatStellarDataError(ctx context.Context, arg chat1.ChatStellarDataErrorArg) (bool, error) {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatStellarDataError(ctx, arg)
	}
	return false, nil
}

func (c *DelegateChatUI) ChatStellarDone(ctx context.Context, arg chat1.ChatStellarDoneArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatStellarDone(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatGiphySearchResults(ctx context.Context, arg chat1.ChatGiphySearchResultsArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatGiphySearchResults(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatGiphyToggleResultWindow(ctx context.Context,
	arg chat1.ChatGiphyToggleResultWindowArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatGiphyToggleResultWindow(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatShowManageChannels(ctx context.Context, arg chat1.ChatShowManageChannelsArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatShowManageChannels(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatCoinFlipStatus(ctx context.Context, arg chat1.ChatCoinFlipStatusArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatCoinFlipStatus(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatCommandMarkdown(ctx context.Context, arg chat1.ChatCommandMarkdownArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatCommandMarkdown(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatMaybeMentionUpdate(ctx context.Context, arg chat1.ChatMaybeMentionUpdateArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatMaybeMentionUpdate(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatLoadGalleryHit(ctx context.Context, arg chat1.ChatLoadGalleryHitArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatLoadGalleryHit(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatWatchPosition(ctx context.Context, arg chat1.ChatWatchPositionArg) (chat1.LocationWatchID, error) {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatWatchPosition(ctx, arg)
	}
	return chat1.LocationWatchID(0), nil
}

func (c *DelegateChatUI) ChatClearWatch(ctx context.Context, arg chat1.ChatClearWatchArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatClearWatch(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatCommandStatus(ctx context.Context, arg chat1.ChatCommandStatusArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatCommandStatus(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) ChatBotCommandsUpdateStatus(ctx context.Context, arg chat1.ChatBotCommandsUpdateStatusArg) error {
	if chatUI := c.getChatUI(arg.SessionID); chatUI != nil {
		return (*chatUI).ChatBotCommandsUpdateStatus(ctx, arg)
	}
	return nil
}

func (c *DelegateChatUI) TriggerContactSync(ctx context.Context, sessionID int) error {
	if chatUI := c.getChatUI(sessionID); chatUI != nil {
		return (*chatUI).TriggerContactSync(ctx, sessionID)
	}
	return nil
}
