// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
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
	}
	conn := NewSharedKeybaseConnection(kbCtx, config, c)
	c.client = chat1.LocalClient{Cli: conn.GetClient()}
	return c
}

// HandlerName implements the ConnectionHandler interface.
func (ChatRPC) HandlerName() string {
	return "Chat"
}

// OnConnect implements the ConnectionHandler interface.
func (c *ChatRPC) OnConnect(ctx context.Context, conn *rpc.Connection,
	_ rpc.GenericClient, server *rpc.Server) error {
	c.config.KBFSOps().PushConnectionStatusChange(KeybaseServiceName, nil)
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
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
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
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	}
	_, err := c.client.PostTextNonblock(ctx, arg)
	return err
}

// GetGroupedInbox implements the Chat interface.
func (c *ChatRPC) GetGroupedInbox(
	ctx context.Context, chatType chat1.TopicType, maxChats int) (
	results []tlf.CanonicalName, err error) {
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
	// service will support grouping these by TLF name and we won't
	// have to check for uniques.  For now, we might falsely return
	// fewer than `maxChats` TLFs.  TODO: make sure these are ordered
	// with the most recent one at index 0.
	seen := make(map[tlf.CanonicalName]bool)
	for i := 0; len(results) < maxChats && i < len(res.Conversations); i++ {
		name := tlf.CanonicalName(res.Conversations[i].Info.TlfName)
		if seen[name] {
			continue
		}
		seen[name] = true
		results = append(results, name)
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

	for _, conv := range res.Convs {
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
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
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
