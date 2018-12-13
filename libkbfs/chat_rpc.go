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
	"github.com/keybase/kbfs/kbfsedits"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
)

const (
	// The name of the channel in the logged-in user's private
	// self-conversation (of type kbfs-edits) that stores a history of
	// which TLFs the user has written to.
	selfWriteChannel = "_self"

	// The topic type of the self-write channel.
	selfWriteType = chat1.TopicType_KBFSFILEEDIT

	// numSelfTlfs is the number of self-written TLFs to include in
	// the results of GetGroupedInbox.
	numSelfTlfs = 3
)

// ChatRPC is an RPC based implementation for chat.
type ChatRPC struct {
	config   Config
	log      logger.Logger
	deferLog logger.Logger
	client   chat1.LocalInterface

	convLock          sync.RWMutex
	convCBs           map[string][]ChatChannelNewMessageCB
	selfConvID        chat1.ConversationID
	lastWrittenConvID chat1.ConversationID
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
	if c.config.KBFSOps() != nil {
		c.config.KBFSOps().PushConnectionStatusChange(KeybaseServiceName, nil)
	}

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
	if c.config.KBFSOps() != nil {
		c.config.KBFSOps().PushConnectionStatusChange(KeybaseServiceName, err)
	}
}

// OnDoCommandError implements the ConnectionHandler interface.
func (c *ChatRPC) OnDoCommandError(err error, wait time.Duration) {
	c.log.Warning("Chat: docommand error: %q; retrying in %s",
		err, wait)
	if c.config.KBFSOps() != nil {
		c.config.KBFSOps().PushConnectionStatusChange(KeybaseServiceName, err)
	}
}

// OnDisconnected implements the ConnectionHandler interface.
func (c *ChatRPC) OnDisconnected(_ context.Context,
	status rpc.DisconnectStatus) {
	if status == rpc.StartingNonFirstConnection {
		c.log.Warning("Chat is disconnected")
		if c.config.KBFSOps() != nil {
			c.config.KBFSOps().PushConnectionStatusChange(
				KeybaseServiceName, errDisconnected{})
		}
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
//   * chat1.PostLocalNonblock
//     * ClientPrev can be 0.  Can outbox ID be nil? mikem: yes

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
		TopicName:        &channelName,
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

func (c *ChatRPC) getSelfConvInfoIfCached() (
	selfConvID, lastWrittenConvID chat1.ConversationID) {
	c.convLock.RLock()
	defer c.convLock.RUnlock()
	return c.selfConvID, c.lastWrittenConvID
}

func (c *ChatRPC) getSelfConvInfo(ctx context.Context) (
	selfConvID, lastWrittenConvID chat1.ConversationID, err error) {
	selfConvID, lastWrittenConvID = c.getSelfConvInfoIfCached()
	if selfConvID != nil {
		return selfConvID, lastWrittenConvID, err
	}

	// Otherwise we need to look it up.
	session, err := c.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return nil, nil, err
	}

	selfConvID, err = c.GetConversationID(
		ctx, tlf.CanonicalName(session.Name), tlf.Private, selfWriteChannel,
		selfWriteType)
	if err != nil {
		return nil, nil, err
	}

	messages, _, err := c.ReadChannel(ctx, selfConvID, nil)
	if err != nil {
		return nil, nil, err
	}

	if len(messages) > 0 {
		selfMessage, err := kbfsedits.ReadSelfWrite(messages[0])
		if err != nil {
			c.log.CDebugf(ctx, "Couldn't read the last self-write message: %+v")
		} else {
			lastWrittenConvID = selfMessage.ConvID
		}
	}

	c.convLock.Lock()
	defer c.convLock.Unlock()
	c.selfConvID = selfConvID
	c.lastWrittenConvID = lastWrittenConvID
	return selfConvID, lastWrittenConvID, nil
}

// SendTextMessage implements the Chat interface.
func (c *ChatRPC) SendTextMessage(
	ctx context.Context, tlfName tlf.CanonicalName, tlfType tlf.Type,
	convID chat1.ConversationID, body string) error {
	if len(body) == 0 {
		c.log.CDebugf(ctx, "Ignoring empty message")
		return nil
	}

	arg := chat1.PostLocalNonblockArg{
		ConversationID: convID,
		Msg: chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				TlfName:     string(tlfName),
				TlfPublic:   tlfType == tlf.Public,
				MessageType: chat1.MessageType_TEXT,
			},
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: body,
			}),
		},
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_KBFS_CHAT,
	}
	_, err := c.client.PostLocalNonblock(ctx, arg)
	if err != nil {
		return err
	}

	selfConvID, lastWrittenConvID, err := c.getSelfConvInfo(ctx)
	if err != nil {
		return err
	}
	if lastWrittenConvID.Eq(convID) {
		// Can skip writing this, since the latest one is the same
		// conversation.  Note that this is slightly racy since
		// another write can happen in the meantime, but this list
		// doesn't need to be exact, so best effort is ok.
		return nil
	}

	c.log.CDebugf(ctx, "Writing self-write message to %s", selfConvID)

	session, err := c.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return err
	}

	serverTime := c.config.Clock().Now()
	if offset, ok := c.config.MDServer().OffsetFromServerTime(); ok {
		serverTime = serverTime.Add(-offset)
	}

	selfWriteBody, err := kbfsedits.PrepareSelfWrite(kbfsedits.SelfWriteMessage{
		Version: kbfsedits.NotificationV2,
		Folder: keybase1.Folder{
			Name:       string(tlfName),
			FolderType: tlfType.FolderType(),
			Private:    tlfType != tlf.Public,
		},
		ConvID:     convID,
		ServerTime: serverTime,
	})
	if err != nil {
		return err
	}

	arg = chat1.PostLocalNonblockArg{
		ConversationID: selfConvID,
		Msg: chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				TlfName:     string(session.Name),
				TlfPublic:   false,
				MessageType: chat1.MessageType_TEXT,
			},
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: selfWriteBody,
			}),
		},
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_KBFS_CHAT,
	}
	_, err = c.client.PostLocalNonblock(ctx, arg)
	if err != nil {
		return err
	}

	c.convLock.Lock()
	defer c.convLock.Unlock()
	c.lastWrittenConvID = convID

	return err
}

func (c *ChatRPC) getLastSelfWrittenHandles(
	ctx context.Context, chatType chat1.TopicType, seen map[string]bool) (
	results []*TlfHandle, err error) {
	selfConvID, _, err := c.getSelfConvInfo(ctx)
	if err != nil {
		return nil, err
	}
	var startPage []byte
	// Search backward until we find numSelfTlfs unique handles.
	for len(results) < numSelfTlfs {
		messages, nextPage, err := c.ReadChannel(ctx, selfConvID, startPage)
		if err != nil {
			return nil, err
		}
		for i := 0; i < len(messages) && len(results) < numSelfTlfs; i++ {
			selfMessage, err := kbfsedits.ReadSelfWrite(messages[i])
			if err != nil {
				return nil, err
			}

			tlfName := selfMessage.Folder.Name
			tlfType := tlf.TypeFromFolderType(selfMessage.Folder.FolderType)
			h, err := GetHandleFromFolderNameAndType(
				ctx, c.config.KBPKI(), c.config.MDOps(), tlfName, tlfType)
			if err != nil {
				c.log.CDebugf(ctx,
					"Ignoring errors getting handle for %s/%s: %+v",
					tlfName, tlfType, err)
				continue
			}

			p := h.GetCanonicalPath()
			if seen[p] {
				continue
			}
			seen[p] = true
			results = append(results, h)
		}

		if nextPage == nil {
			break
		}
		startPage = nextPage
	}
	return results, nil
}

// GetGroupedInbox implements the Chat interface.
func (c *ChatRPC) GetGroupedInbox(
	ctx context.Context, chatType chat1.TopicType, maxChats int) (
	results []*TlfHandle, err error) {
	// First get the latest TLFs written by this user.
	seen := make(map[string]bool)
	results, err = c.getLastSelfWrittenHandles(ctx, chatType, seen)
	if err != nil {
		return nil, err
	}

	arg := chat1.GetInboxAndUnboxLocalArg{
		Query: &chat1.GetInboxLocalQuery{
			TopicType: &chatType,
		},
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_KBFS_CHAT,
	}
	res, err := c.client.GetInboxAndUnboxLocal(ctx, arg)
	if err != nil {
		return nil, err
	}

	favorites, err := c.config.KBFSOps().GetFavorites(ctx)
	if err != nil {
		c.log.CWarningf(ctx,
			"Unable to fetch favorites while making GroupedInbox: %v",
			err)
	}
	favMap := make(map[Favorite]bool)
	for _, fav := range favorites {
		favMap[fav] = true
	}

	// Return the first unique `maxChats` chats.  Eventually the
	// service will support grouping these by TLF ID and we won't
	// have to check for uniques.  For now, we might falsely return
	// fewer than `maxChats` TLFs.  TODO: make sure these are ordered
	// with the most recent one at index 0.
	for i := 0; i < len(res.Conversations) && len(results) < maxChats; i++ {
		info := res.Conversations[i].Info
		if info.TopicName == selfWriteChannel {
			continue
		}

		tlfType := tlf.Private
		if info.Visibility == keybase1.TLFVisibility_PUBLIC {
			tlfType = tlf.Public
		} else if info.MembersType == chat1.ConversationMembersType_TEAM {
			tlfType = tlf.SingleTeam
		}

		tlfIsFavorite := favMap[Favorite{Name: info.TlfName, Type: tlfType}]
		if !tlfIsFavorite {
			continue
		}

		h, err := GetHandleFromFolderNameAndType(
			ctx, c.config.KBPKI(), c.config.MDOps(), info.TlfName, tlfType)
		if err != nil {
			c.log.CDebugf(ctx, "Ignoring errors getting handle for %s/%s: %+v",
				info.TlfName, tlfType, err)
			continue
		}

		p := h.GetCanonicalPath()
		if seen[p] {
			continue
		}
		seen[p] = true
		results = append(results, h)
	}

	return results, nil
}

// GetChannels implements the Chat interface.
func (c *ChatRPC) GetChannels(
	ctx context.Context, tlfName tlf.CanonicalName, tlfType tlf.Type,
	chatType chat1.TopicType) (
	convIDs []chat1.ConversationID, channelNames []string, err error) {
	expectedVisibility := keybase1.TLFVisibility_PRIVATE
	if tlfType == tlf.Public {
		expectedVisibility = keybase1.TLFVisibility_PUBLIC
	}

	arg := chat1.GetInboxAndUnboxLocalArg{
		Query: &chat1.GetInboxLocalQuery{
			Name: &chat1.NameQuery{
				Name:        string(tlfName),
				MembersType: membersTypeFromTlfType(tlfType),
			},
			TopicType:     &chatType,
			TlfVisibility: &expectedVisibility,
		},
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_KBFS_CHAT,
	}
	res, err := c.client.GetInboxAndUnboxLocal(ctx, arg)
	if err != nil {
		return nil, nil, err
	}

	for _, conv := range res.Conversations {
		if conv.Info.Visibility != expectedVisibility {
			// Skip any conversation that doesn't match our visibility.
			continue
		}

		if conv.Info.TopicName == selfWriteChannel {
			continue
		}

		convIDs = append(convIDs, conv.Info.Id)
		channelNames = append(channelNames, conv.Info.TopicName)
	}

	return convIDs, channelNames, nil
}

const readChannelPageSize = 100

// ReadChannel implements the Chat interface.
func (c *ChatRPC) ReadChannel(
	ctx context.Context, convID chat1.ConversationID, startPage []byte) (
	messages []string, nextPage []byte, err error) {
	pagination := &chat1.Pagination{Num: readChannelPageSize}
	if startPage != nil {
		pagination.Next = startPage
	}
	arg := chat1.GetThreadLocalArg{
		ConversationID:   convID,
		Pagination:       pagination,
		Reason:           chat1.GetThreadReason_KBFSFILEACTIVITY,
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
				c.log.CDebugf(ctx, "Ignoring unexpected msg type: %d", msgType)
				continue
			}
			messages = append(messages, msgBody.Text().Body)
		case chat1.MessageUnboxedState_ERROR:
			// TODO: Are there any errors we need to tolerate?
			return nil, nil, errors.New(msg.Error().ErrMsg)
		default:
			c.log.CDebugf(ctx, "Ignoring unexpected msg state: %d", state)
			continue
		}

	}
	if res.Thread.Pagination != nil && !res.Thread.Pagination.Last {
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

// ClearCache implements the Chat interface.
func (c *ChatRPC) ClearCache() {
	c.convLock.Lock()
	defer c.convLock.Unlock()
	c.selfConvID = nil
	c.lastWrittenConvID = nil
}

// We only register for the kbfs-edits type of notification in
// keybase_daemon_rpc, so all the other methods below besides
// `NewChatActivity` should never be called.
var _ chat1.NotifyChatInterface = (*ChatRPC)(nil)

func (c *ChatRPC) newNotificationChannel(
	ctx context.Context, convID chat1.ConversationID,
	conv *chat1.InboxUIItem) error {
	if conv == nil {
		c.log.CDebugf(ctx,
			"No conv for new notification channel %s; ignoring", convID)
		return nil
	}
	tlfType := tlf.Private
	if conv.Visibility == keybase1.TLFVisibility_PUBLIC {
		tlfType = tlf.Public
	} else if conv.MembersType == chat1.ConversationMembersType_TEAM {
		tlfType = tlf.SingleTeam
	}

	favorites, err := c.config.KBFSOps().GetFavorites(ctx)
	if err != nil {
		c.log.CWarningf(ctx,
			"Unable to fetch favorites while making edit notifications: %v",
			err)
	}
	tlfIsFavorite := false
	for _, fav := range favorites {
		if fav.Name == conv.Name && fav.Type == tlfType {
			tlfIsFavorite = true
			break
		}
	}
	if !tlfIsFavorite {
		return nil
	}

	tlfHandle, err := GetHandleFromFolderNameAndType(
		ctx, c.config.KBPKI(), c.config.MDOps(), conv.Name, tlfType)
	if err != nil {
		return err
	}
	if c.config.KBFSOps() != nil {
		c.config.KBFSOps().NewNotificationChannel(
			ctx, tlfHandle, convID, conv.Channel)
	}
	return nil
}

func (c *ChatRPC) setLastWrittenConvID(ctx context.Context, body string) error {
	c.convLock.Lock()
	defer c.convLock.Unlock()

	msg, err := kbfsedits.ReadSelfWrite(body)
	if err != nil {
		return err
	}
	c.log.CDebugf(ctx, "Last self-written conversation is %s", msg.ConvID)
	c.lastWrittenConvID = msg.ConvID
	return nil
}

// NewChatActivity implements the chat1.NotifyChatInterface for
// ChatRPC.
func (c *ChatRPC) NewChatActivity(
	ctx context.Context, arg chat1.NewChatActivityArg) error {
	activityType, err := arg.Activity.ActivityType()
	if err != nil {
		return err
	}
	switch activityType {
	case chat1.ChatActivityType_NEW_CONVERSATION:
		// If we learn about a new conversation for a given TLF,
		// attempt to route it to the TLF.
		info := arg.Activity.NewConversation()
		err := c.newNotificationChannel(ctx, info.ConvID, info.Conv)
		if err != nil {
			return err
		}
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

		// If this is on the self-write channel, cache it and we're
		// done.
		selfConvID, _ := c.getSelfConvInfoIfCached()
		if selfConvID.Eq(msg.ConvID) {
			return c.setLastWrittenConvID(ctx, body)
		}

		if len(cbs) == 0 {
			// No one is listening for this channel yet, so consider
			// it a new channel.
			err := c.newNotificationChannel(ctx, msg.ConvID, msg.Conv)
			if err != nil {
				return err
			}
		} else {
			for _, cb := range cbs {
				cb(msg.ConvID, body)
			}
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

// ChatSetConvSettings implements the chat1.NotifyChatInterface for
// ChatRPC.
func (c *ChatRPC) ChatSetConvSettings(
	_ context.Context, _ chat1.ChatSetConvSettingsArg) error {
	return nil
}

// ChatSubteamRename implements the chat1.NotifyChatInterface for
// ChatRPC.
func (c *ChatRPC) ChatSubteamRename(
	_ context.Context, _ chat1.ChatSubteamRenameArg) error {
	return nil
}

// ChatKBFSToImpteamUpgrade implements the chat1.NotifyChatInterface
// for ChatRPC.
func (c *ChatRPC) ChatKBFSToImpteamUpgrade(
	_ context.Context, _ chat1.ChatKBFSToImpteamUpgradeArg) error {
	return nil
}

// ChatAttachmentUploadStart implements the chat1.NotifyChatInterface
// for ChatRPC.
func (c *ChatRPC) ChatAttachmentUploadStart(
	_ context.Context, _ chat1.ChatAttachmentUploadStartArg) error {
	return nil
}

// ChatAttachmentUploadProgress implements the chat1.NotifyChatInterface
// for ChatRPC.
func (c *ChatRPC) ChatAttachmentUploadProgress(
	_ context.Context, _ chat1.ChatAttachmentUploadProgressArg) error {
	return nil
}

// ChatPaymentInfo implements the chat1.NotifyChatInterface
// for ChatRPC.
func (c *ChatRPC) ChatPaymentInfo(
	_ context.Context, _ chat1.ChatPaymentInfoArg) error {
	return nil
}

// ChatRequestInfo implements the chat1.NotifyChatInterface
// for ChatRPC.
func (c *ChatRPC) ChatRequestInfo(
	_ context.Context, _ chat1.ChatRequestInfoArg) error {
	return nil
}

// ChatPromptUnfurl implements the chat1.NotifyChatInterface
// for ChatRPC.
func (c *ChatRPC) ChatPromptUnfurl(_ context.Context, _ chat1.ChatPromptUnfurlArg) error {
	return nil
}
