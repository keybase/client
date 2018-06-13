// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
)

// ChatRPC is an RPC based implementation for chat.
type ChatRPC struct {
	config   Config
	log      logger.Logger
	deferLog logger.Logger
	client   chat1.LocalInterface

	convLock sync.RWMutex
	convCBs  map[string][]ChatChannelNewMessageCB
}

var _ rpc.ConnectionHandler = (*ChatRPC)(nil)

// NewChatRPC constructs a new RPC based chat implementation.
func NewChatRPC(config Config, kbCtx Context) *ChatRPC {
	log := config.MakeLogger("")
	deferLog := log.CloneWithAddedDepth(1)
	c := &ChatRPC{
		log:      log,
		deferLog: deferLog,
		config:   config,
		convCBs:  make(map[string][]ChatChannelNewMessageCB),
	}
	conn := NewSharedKeybaseConnection(kbCtx, config, c)
	c.client = chat1.LocalClient{Cli: conn.GetClient()}
	return c
}

// HandlerName implements the ConnectionHandler interface.
func (c *ChatRPC) HandlerName() string {
	return "Chat"
}

// OnConnect implements the ConnectionHandler interface.
func (c *ChatRPC) OnConnect(ctx context.Context, conn *rpc.Connection,
	_ rpc.GenericClient, server *rpc.Server) error {
	c.config.KBFSOps().PushConnectionStatusChange(KeybaseServiceName, nil)

	err := server.Register(chat1.NotifyChatProtocol(c))
	switch err.(type) {
	case nil, rpc.AlreadyRegisteredError:
	default:
		return err
	}

	return nil
}

// OnConnectError implements the ConnectionHandler interface.
func (c *ChatRPC) OnConnectError(err error, wait time.Duration) {
	c.log.Warning("Chat: connection error: %q; retrying in %s",
		err, wait)
	c.config.KBFSOps().PushConnectionStatusChange(KeybaseServiceName, err)
}

// OnDoCommandError implements the ConnectionHandler interface.
func (c *ChatRPC) OnDoCommandError(err error, wait time.Duration) {
	c.log.Warning("Chat: docommand error: %q; retrying in %s",
		err, wait)
	c.config.KBFSOps().PushConnectionStatusChange(KeybaseServiceName, err)
}

// OnDisconnected implements the ConnectionHandler interface.
func (c *ChatRPC) OnDisconnected(_ context.Context,
	status rpc.DisconnectStatus) {
	if status == rpc.StartingNonFirstConnection {
		c.log.Warning("Chat is disconnected")
		c.config.KBFSOps().PushConnectionStatusChange(
			KeybaseServiceName, errDisconnected{})
	}
}

// ShouldRetry implements the ConnectionHandler interface.
func (c *ChatRPC) ShouldRetry(_ string, _ error) bool {
	return false
}

// ShouldRetryOnConnect implements the ConnectionHandler interface.
func (c *ChatRPC) ShouldRetryOnConnect(err error) bool {
	_, inputCanceled := err.(libkb.InputCanceledError)
	return !inputCanceled
}

var _ Chat = (*ChatRPC)(nil)

// Chat notes (will remove/rework these once the implementation is complete):
//
// When sending:
//   * chat1.NewConversationLocal
//   * chat1.PostTestNonblock
//     * ClientPrev can be 0.  Can outbox ID be nil?

// Gathering recent notifications:
//   * chat1.GetInboxAndUnboxLocal (pagination not needed)
//     * But we'd need inbox grouping to get this exactly right.

// Reading each conversation:
//   * Get list of all channels/writers in the conversation
//     * chat1.GetTLFConversationsLocal can give us the list of channels,
//       which corresponds to the set of users who have actually written.
//       (There might be a lot of team members who haven't written, so
//       probably best to avoid iterating through everyone.).
//     * Always look up your own channel though, so the GUI can show your
//       own last edits if desired.
//   * Read each channel until getting N updates for each writer
//     * chat1.GetThreadLocal with pagination
//     * No prev filled in on next pagination to go backward
//   * How to reconcile renames, etc across channels?
//     * It's hard to know if a long-ago writer updated a file, and
//       later it was renamed by a prolific writer who made N more updates
//       afterward.
//     * For performance reasons, we probably just need to show the old
//       update under the old file name.  Should be rare enough that
//       it doesn't matter.

// Getting real-time updates:
//   * New kbfs-edits activity push notifications on notify-router
//   * Mike will make ticket to auto-join non-chat channels,
//     so they show up in `GetInboxAndUnboxLocal`.
//   * Spot-edit the local edit history on each new push notification.

// One layer over the service RPC connection that takes all needed
// arguments (including topic type, etc), and passes it pretty
// directly to the RPC.

// Another, per-TLF layer to remember the resolved conversation ID and
// send/read kbfs-edits messages.  It should also interface with the
// local journal to show the unflushed journal data as part of the
// updates.

// Finally an inbox layer that can read the server inbox, and also
// checks the journal status, to return the top set of conversations
// at any given time.  Maybe it also subscribes to inbox notifications
// of some kind.

func membersTypeFromTlfType(tlfType tlf.Type) chat1.ConversationMembersType {
	if tlfType == tlf.SingleTeam {
		return chat1.ConversationMembersType_TEAM
	}
	return chat1.ConversationMembersType_IMPTEAMNATIVE
}

// GetConversationID implements the Chat interface.
func (c *ChatRPC) GetConversationID(
	ctx context.Context, tlfName tlf.CanonicalName, tlfType tlf.Type,
	channelName string, chatType chat1.TopicType) (
	chat1.ConversationID, error) {
	vis := keybase1.TLFVisibility_PRIVATE
	if tlfType == tlf.Public {
		vis = keybase1.TLFVisibility_PUBLIC
	}

	arg := chat1.NewConversationLocalArg{
		TlfName:          string(tlfName),
		TopicType:        chatType,
		TlfVisibility:    vis,
		MembersType:      membersTypeFromTlfType(tlfType),
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_KBFS_CHAT,
	}

	// Try creating the conversation to get back the ID -- if the
	// conversation already exists, this just returns the existing
	// conversation.
	res, err := c.client.NewConversationLocal(ctx, arg)
	if err != nil {
		return nil, err
	}

	return res.Conv.Info.Id, nil
}

// SendTextMessage implements the Chat interface.
func (c *ChatRPC) SendTextMessage(
	ctx context.Context, tlfName tlf.CanonicalName, tlfType tlf.Type,
	convID chat1.ConversationID, body string) error {
	arg := chat1.PostTextNonblockArg{
		ConversationID:   convID,
		TlfName:          string(tlfName),
		TlfPublic:        tlfType == tlf.Public,
		Body:             body,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_KBFS_CHAT,
	}
	_, err := c.client.PostTextNonblock(ctx, arg)
	return err
}

// GetGroupedInbox implements the Chat interface.
func (c *ChatRPC) GetGroupedInbox(
	ctx context.Context, chatType chat1.TopicType, maxChats int) (
	results []*TlfHandle, err error) {
	arg := chat1.GetInboxAndUnboxLocalArg{
		Query: &chat1.GetInboxLocalQuery{
			TopicType: &chatType,
		},
	}
	res, err := c.client.GetInboxAndUnboxLocal(ctx, arg)
	if err != nil {
		return nil, err
	}

	// Return the first unique `maxChats` chats.  Eventually the
	// service will support grouping these by TLF ID and we won't
	// have to check for uniques.  For now, we might falsely return
	// fewer than `maxChats` TLFs.  TODO: make sure these are ordered
	// with the most recent one at index 0.
	seen := make(map[string]bool)
	for i := 0; len(results) < maxChats && i < len(res.Conversations); i++ {
		info := res.Conversations[i].Info
		tlfID := info.Triple.Tlfid.String()
		if seen[tlfID] {
			continue
		}
		seen[tlfID] = true
		tlfType := tlf.Private
		if info.Visibility == keybase1.TLFVisibility_PUBLIC {
			tlfType = tlf.Public
		} else if info.MembersType == chat1.ConversationMembersType_TEAM {
			tlfType = tlf.SingleTeam
		}

		h, err := GetHandleFromFolderNameAndType(
			ctx, c.config.KBPKI(), c.config.MDOps(), info.TlfName, tlfType)
		if err != nil {
			return nil, err
		}
		results = append(results, h)
	}
	return results, nil
}

// GetChannels implements the Chat interface.
func (c *ChatRPC) GetChannels(
	ctx context.Context, tlfName tlf.CanonicalName, tlfType tlf.Type,
	chatType chat1.TopicType) (
	convIDs []chat1.ConversationID, channelNames []string, err error) {
	arg := chat1.GetTLFConversationsLocalArg{
		TlfName:     string(tlfName),
		TopicType:   chatType,
		MembersType: membersTypeFromTlfType(tlfType),
	}
	res, err := c.client.GetTLFConversationsLocal(ctx, arg)
	if err != nil {
		return nil, nil, err
	}

	expectedVisibility := keybase1.TLFVisibility_PRIVATE
	if tlfType == tlf.Public {
		expectedVisibility = keybase1.TLFVisibility_PUBLIC
	}
	for _, conv := range res.Convs {
		if conv.Visibility != expectedVisibility {
			// Skip any conversation that doesn't match our visibility.
			continue
		}

		id, err := chat1.MakeConvID(conv.ConvID)
		if err != nil {
			return nil, nil, err
		}
		convIDs = append(convIDs, id)
		channelNames = append(channelNames, conv.Name)
	}

	return convIDs, channelNames, nil
}

// ReadChannel implements the Chat interface.
func (c *ChatRPC) ReadChannel(
	ctx context.Context, convID chat1.ConversationID, startPage []byte) (
	messages []string, nextPage []byte, err error) {
	var pagination *chat1.Pagination
	if startPage != nil {
		pagination = &chat1.Pagination{Next: startPage}
	}
	arg := chat1.GetThreadLocalArg{
		ConversationID:   convID,
		Pagination:       pagination,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_KBFS_CHAT,
	}
	res, err := c.client.GetThreadLocal(ctx, arg)
	if err != nil {
		return nil, nil, err
	}
	for _, msg := range res.Thread.Messages {
		state, err := msg.State()
		if err != nil {
			return nil, nil, err
		}
		switch state {
		case chat1.MessageUnboxedState_VALID:
			msgBody := msg.Valid().MessageBody
			msgType, err := msgBody.MessageType()
			if err != nil {
				return nil, nil, err
			}
			if msgType != chat1.MessageType_TEXT {
				return nil, nil, errors.Errorf(
					"Unexpected msg type: %d", msgType)
			}
			messages = append(messages, msgBody.Text().Body)
		case chat1.MessageUnboxedState_ERROR:
			// TODO: Are there any errors we need to tolerate?
			return nil, nil, errors.New(msg.Error().ErrMsg)
		default:
			return nil, nil, errors.Errorf("Unexpected msg state: %d", state)
		}

	}
	if res.Thread.Pagination != nil {
		nextPage = res.Thread.Pagination.Next
	}
	return messages, nextPage, nil
}

// RegisterForMessages implements the Chat interface.
func (c *ChatRPC) RegisterForMessages(
	convID chat1.ConversationID, cb ChatChannelNewMessageCB) {
	str := convID.String()
	c.convLock.Lock()
	defer c.convLock.Unlock()
	c.convCBs[str] = append(c.convCBs[str], cb)
}

// We only register for the kbfs-edits type of notification in
// keybase_daemon_rpc, so all the other methods below besides
// `NewChatKBFSFileEditActivity` should never be called.
var _ chat1.NotifyChatInterface = (*ChatRPC)(nil)

// NewChatActivity implements the chat1.NotifyChatInterface for
// ChatRPC.
func (c *ChatRPC) NewChatActivity(
	_ context.Context, _ chat1.NewChatActivityArg) error {
	return nil
}

// NewChatKBFSFileEditActivity implements the
// chat1.NotifyChatInterface for ChatRPC.
func (c *ChatRPC) NewChatKBFSFileEditActivity(
	ctx context.Context, arg chat1.NewChatKBFSFileEditActivityArg) error {
	activityType, err := arg.Activity.ActivityType()
	if err != nil {
		return err
	}
	switch activityType {
	case chat1.ChatActivityType_NEW_CONVERSATION:
		// If we learn about a new conversation for a given TLF,
		// attempt to route it to the TLF.
		info := arg.Activity.NewConversation()
		tlfType := tlf.Private
		if info.Conv.Visibility == keybase1.TLFVisibility_PUBLIC {
			tlfType = tlf.Public
		} else if info.Conv.MembersType == chat1.ConversationMembersType_TEAM {
			tlfType = tlf.SingleTeam
		}
		tlfHandle, err := GetHandleFromFolderNameAndType(
			ctx, c.config.KBPKI(), c.config.MDOps(), info.Conv.Name, tlfType)
		if err != nil {
			return err
		}
		c.config.KBFSOps().NewNotificationChannel(
			ctx, tlfHandle, info.ConvID, info.Conv.Channel)
	case chat1.ChatActivityType_INCOMING_MESSAGE:
		// If we learn about a new message for a given conversation ID,
		// let any registered callbacks for that conversation ID know.
		msg := arg.Activity.IncomingMessage()
		state, err := msg.Message.State()
		if err != nil {
			return err
		}
		if state != chat1.MessageUnboxedState_VALID {
			return nil
		}

		validMsg := msg.Message.Valid()
		msgType, err := validMsg.MessageBody.MessageType()
		if err != nil {
			return err
		}
		if msgType != chat1.MessageType_TEXT {
			return nil
		}
		body := validMsg.MessageBody.Text().Body

		c.convLock.RLock()
		cbs := c.convCBs[msg.ConvID.String()]
		c.convLock.RUnlock()

		for _, cb := range cbs {
			cb(msg.ConvID, body)
		}
	}
	return nil
}

// ChatIdentifyUpdate implements the chat1.NotifyChatInterface for
// ChatRPC.
func (c *ChatRPC) ChatIdentifyUpdate(
	_ context.Context, _ keybase1.CanonicalTLFNameAndIDWithBreaks) error {
	return nil
}

// ChatTLFFinalize implements the chat1.NotifyChatInterface for
// ChatRPC.
func (c *ChatRPC) ChatTLFFinalize(
	_ context.Context, _ chat1.ChatTLFFinalizeArg) error {
	return nil
}

// ChatTLFResolve implements the chat1.NotifyChatInterface for
// ChatRPC.
func (c *ChatRPC) ChatTLFResolve(
	_ context.Context, _ chat1.ChatTLFResolveArg) error {
	return nil
}

// ChatInboxStale implements the chat1.NotifyChatInterface for
// ChatRPC.
func (c *ChatRPC) ChatInboxStale(_ context.Context, _ keybase1.UID) error {
	return nil
}

// ChatThreadsStale implements the chat1.NotifyChatInterface for
// ChatRPC.
func (c *ChatRPC) ChatThreadsStale(
	_ context.Context, _ chat1.ChatThreadsStaleArg) error {
	return nil
}

// ChatTypingUpdate implements the chat1.NotifyChatInterface for
// ChatRPC.
func (c *ChatRPC) ChatTypingUpdate(
	_ context.Context, _ []chat1.ConvTypingUpdate) error {
	return nil
}

// ChatJoinedConversation implements the chat1.NotifyChatInterface for
// ChatRPC.
func (c *ChatRPC) ChatJoinedConversation(
	_ context.Context, _ chat1.ChatJoinedConversationArg) error {
	return nil
}

// ChatLeftConversation implements the chat1.NotifyChatInterface for
// ChatRPC.
func (c *ChatRPC) ChatLeftConversation(
	_ context.Context, _ chat1.ChatLeftConversationArg) error {
	return nil
}

// ChatResetConversation implements the chat1.NotifyChatInterface for
// ChatRPC.
func (c *ChatRPC) ChatResetConversation(
	_ context.Context, _ chat1.ChatResetConversationArg) error {
	return nil
}

// ChatInboxSyncStarted implements the chat1.NotifyChatInterface for
// ChatRPC.
func (c *ChatRPC) ChatInboxSyncStarted(
	_ context.Context, _ keybase1.UID) error {
	return nil
}

// ChatInboxSynced implements the chat1.NotifyChatInterface for
// ChatRPC.
func (c *ChatRPC) ChatInboxSynced(
	_ context.Context, _ chat1.ChatInboxSyncedArg) error {
	return nil
}

// ChatSetConvRetention implements the chat1.NotifyChatInterface for
// ChatRPC.
func (c *ChatRPC) ChatSetConvRetention(
	_ context.Context, _ chat1.ChatSetConvRetentionArg) error {
	return nil
}

// ChatSetTeamRetention implements the chat1.NotifyChatInterface for
// ChatRPC.
func (c *ChatRPC) ChatSetTeamRetention(
	_ context.Context, _ chat1.ChatSetTeamRetentionArg) error {
	return nil
}

// ChatKBFSToImpteamUpgrade implements the chat1.NotifyChatInterface
// for ChatRPC.
func (c *ChatRPC) ChatKBFSToImpteamUpgrade(
	_ context.Context, _ chat1.ChatKBFSToImpteamUpgradeArg) error {
	return nil
}
