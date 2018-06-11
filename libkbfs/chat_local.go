// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/kbfs/tlf"
)

// ChatLocal is a local implementation for chat.  TODO: fill in the
// logic to allow for testing.
type ChatLocal struct {
	config   Config
	log      logger.Logger
	deferLog logger.Logger
}

// NewChatLocal constructs a new local chat implementation.
func NewChatLocal(config Config) *ChatLocal {
	log := config.MakeLogger("")
	deferLog := log.CloneWithAddedDepth(1)
	return &ChatLocal{
		log:      log,
		deferLog: deferLog,
		config:   config,
	}
}

var _ Chat = (*ChatLocal)(nil)

// GetConversationID implements the Chat interface.
func (c *ChatLocal) GetConversationID(
	ctx context.Context, tlfName tlf.CanonicalName, tlfType tlf.Type,
	channelName string, chatType chat1.TopicType) (
	chat1.ConversationID, error) {
	return chat1.ConversationID("TODO"), nil
}

// SendTextMessage implements the Chat interface.
func (c *ChatLocal) SendTextMessage(
	ctx context.Context, tlfName tlf.CanonicalName, tlfType tlf.Type,
	convID chat1.ConversationID, body string) error {
	c.log.CDebugf(ctx, "Asked to send text message for %s, %s, "+
		"but ignoring: %s", tlfName, tlfType, body)
	return nil
}

// GetGroupedInbox implements the Chat interface.
func (c *ChatLocal) GetGroupedInbox(
	ctx context.Context, chatType chat1.TopicType, maxChats int) (
	results []tlf.CanonicalName, err error) {
	return nil, nil
}

// GetChannels implements the Chat interface.
func (c *ChatLocal) GetChannels(
	ctx context.Context, tlfName tlf.CanonicalName, tlfType tlf.Type,
	chatType chat1.TopicType) (
	convIDs []chat1.ConversationID, channelNames []string, err error) {
	return nil, nil, nil
}

// ReadChannel implements the Chat interface.
func (c *ChatLocal) ReadChannel(
	ctx context.Context, convID chat1.ConversationID, startPage []byte) (
	messages []string, nextPage []byte, err error) {
	return nil, nil, nil
}
