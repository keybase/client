// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/pkg/errors"
)

type convLocal struct {
	convID   chat1.ConversationID
	chanName string
	messages []string
	cbs      []ChatChannelNewMessageCB
	mtime    time.Time
}

type convLocalByIDMap map[string]*convLocal

type convLocalByNameMap map[tlf.CanonicalName]convLocalByIDMap

type convLocalByTypeMap map[tlf.Type]convLocalByNameMap

type newConvCB func(
	context.Context, *tlfhandle.Handle, chat1.ConversationID, string)

type chatLocalSharedData struct {
	lock          sync.RWMutex
	newChannelCBs map[Config]newConvCB
	convs         convLocalByTypeMap
	convsByID     convLocalByIDMap
}

type selfConvInfo struct {
	convID  chat1.ConversationID
	tlfName tlf.CanonicalName
	tlfType tlf.Type
}

// chatLocal is a local implementation for chat.
type chatLocal struct {
	config   Config
	log      logger.Logger
	deferLog logger.Logger
	data     *chatLocalSharedData

	lock          sync.Mutex
	selfConvInfos []selfConvInfo
}

func newChatLocalWithData(config Config, data *chatLocalSharedData) *chatLocal {
	log := config.MakeLogger("")
	deferLog := log.CloneWithAddedDepth(1)
	return &chatLocal{
		log:      log,
		deferLog: deferLog,
		config:   config,
		data:     data,
	}
}

// newChatLocal constructs a new local chat implementation.
func newChatLocal(config Config) *chatLocal {
	return newChatLocalWithData(config, &chatLocalSharedData{
		convs:     make(convLocalByTypeMap),
		convsByID: make(convLocalByIDMap),
		newChannelCBs: map[Config]newConvCB{
			config: nil,
		},
	})
}

var _ Chat = (*chatLocal)(nil)

// GetConversationID implements the Chat interface.
func (c *chatLocal) GetConversationID(
	ctx context.Context, tlfName tlf.CanonicalName, tlfType tlf.Type,
	channelName string, chatType chat1.TopicType) (
	chat1.ConversationID, error) {
	if chatType != chat1.TopicType_KBFSFILEEDIT {
		panic(fmt.Sprintf("Bad topic type: %d", chatType))
	}

	c.data.lock.Lock()
	defer c.data.lock.Unlock()
	byID, ok := c.data.convs[tlfType][tlfName]
	if !ok {
		if _, ok := c.data.convs[tlfType]; !ok {
			c.data.convs[tlfType] = make(convLocalByNameMap)
		}
		if _, ok := c.data.convs[tlfType][tlfName]; !ok {
			byID = make(convLocalByIDMap)
			c.data.convs[tlfType][tlfName] = byID
		}
	}
	for _, conv := range byID {
		if conv.chanName == channelName {
			return conv.convID, nil
		}
	}

	// Make a new conversation.
	var idBytes [8]byte
	err := kbfscrypto.RandRead(idBytes[:])
	if err != nil {
		return nil, err
	}
	id := chat1.ConversationID(idBytes[:])
	c.log.CDebugf(ctx, "Making new conversation for %s, %s: %s",
		tlfName, channelName, id)
	conv := &convLocal{
		convID:   id,
		chanName: channelName,
	}
	c.data.convs[tlfType][tlfName][id.String()] = conv
	c.data.convsByID[id.String()] = conv

	h, err := GetHandleFromFolderNameAndType(
		ctx, c.config.KBPKI(), c.config.MDOps(), c.config,
		string(tlfName), tlfType)
	if err != nil {
		return nil, err
	}
	for config, cb := range c.data.newChannelCBs {
		// Only send notifications to those that can read the TLF.
		session, err := config.KBPKI().GetCurrentSession(ctx)
		if err != nil {
			return nil, err
		}
		isReader, err := isReaderFromHandle(
			ctx, h, config.KBPKI(), config, session.UID)
		if err != nil {
			return nil, err
		}
		if !isReader {
			continue
		}

		if cb == nil && config.KBFSOps() != nil {
			cb = config.KBFSOps().NewNotificationChannel
		}

		cb(ctx, h, id, channelName)
	}

	return id, nil
}

// SendTextMessage implements the Chat interface.
func (c *chatLocal) SendTextMessage(
	ctx context.Context, tlfName tlf.CanonicalName, tlfType tlf.Type,
	convID chat1.ConversationID, body string) error {
	c.data.lock.Lock()
	defer c.data.lock.Unlock()
	conv, ok := c.data.convs[tlfType][tlfName][convID.String()]
	if !ok {
		return errors.Errorf("Conversation %s doesn't exist", convID.String())
	}
	conv.messages = append(conv.messages, body)
	conv.mtime = c.config.Clock().Now()

	c.lock.Lock()
	// For testing purposes just keep a running tab of all
	// self-written conversations.  Reconsider if we run into memory
	// or performance issues.  TODO: if we ever run an edit history
	// test with multiple devices from the same user, we'll need to
	// save this data in the shared info.
	c.selfConvInfos = append(
		c.selfConvInfos, selfConvInfo{convID, tlfName, tlfType})
	c.lock.Unlock()

	// TODO: if there are some users who can read this folder but who
	// haven't yet subscribed to the conversation, we should send them
	// a new channel notification.
	for _, cb := range conv.cbs {
		cb(convID, body)
	}

	return nil
}

type chatHandleAndTime struct {
	h     *tlfhandle.Handle
	mtime time.Time
}

type chatHandleAndTimeByMtime []chatHandleAndTime

func (chatbm chatHandleAndTimeByMtime) Len() int {
	return len(chatbm)
}

func (chatbm chatHandleAndTimeByMtime) Less(i, j int) bool {
	// Reverse sort so newest conversation is at index 0.
	return chatbm[i].mtime.After(chatbm[j].mtime)
}

func (chatbm chatHandleAndTimeByMtime) Swap(i, j int) {
	chatbm[i], chatbm[j] = chatbm[j], chatbm[i]
}

// GetGroupedInbox implements the Chat interface.
func (c *chatLocal) GetGroupedInbox(
	ctx context.Context, chatType chat1.TopicType, maxChats int) (
	results []*tlfhandle.Handle, err error) {
	if chatType != chat1.TopicType_KBFSFILEEDIT {
		panic(fmt.Sprintf("Bad topic type: %d", chatType))
	}

	session, err := c.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return nil, err
	}

	var handlesAndTimes chatHandleAndTimeByMtime

	seen := make(map[string]bool)
	c.data.lock.Lock()
	defer c.data.lock.Unlock()
	for t, byName := range c.data.convs {
		for name, byID := range byName {
			if t == tlf.Public && string(name) != string(session.Name) {
				// Skip public TLFs that aren't our own.
				continue
			}

			h, err := GetHandleFromFolderNameAndType(
				ctx, c.config.KBPKI(), c.config.MDOps(), c.config,
				string(name), t)
			if err != nil {
				return nil, err
			}

			// Only include if the current user can read the folder.
			isReader, err := isReaderFromHandle(
				ctx, h, c.config.KBPKI(), c.config, session.UID)
			if err != nil {
				return nil, err
			}
			if !isReader {
				continue
			}

			hAndT := chatHandleAndTime{h: h}
			for _, conv := range byID {
				if conv.mtime.After(hAndT.mtime) {
					hAndT.mtime = conv.mtime
				}
			}
			handlesAndTimes = append(handlesAndTimes, hAndT)
			seen[h.GetCanonicalPath()] = true
		}
	}

	sort.Sort(handlesAndTimes)
	for i := 0; i < len(handlesAndTimes) && i < maxChats; i++ {
		results = append(results, handlesAndTimes[i].h)
	}

	c.lock.Lock()
	defer c.lock.Unlock()
	var selfHandles []*tlfhandle.Handle
	max := numSelfTlfs
	for i := len(c.selfConvInfos) - 1; i >= 0 && len(selfHandles) < max; i-- {
		info := c.selfConvInfos[i]
		h, err := GetHandleFromFolderNameAndType(
			ctx, c.config.KBPKI(), c.config.MDOps(), c.config,
			string(info.tlfName), info.tlfType)
		if err != nil {
			return nil, err
		}

		p := h.GetCanonicalPath()
		if seen[p] {
			continue
		}
		seen[p] = true
		selfHandles = append(selfHandles, h)
	}

	numOver := len(results) + len(selfHandles) - maxChats
	if numOver < 0 {
		numOver = 0
	}
	results = append(results[:len(results)-numOver], selfHandles...)
	return results, nil
}

// GetChannels implements the Chat interface.
func (c *chatLocal) GetChannels(
	ctx context.Context, tlfName tlf.CanonicalName, tlfType tlf.Type,
	chatType chat1.TopicType) (
	convIDs []chat1.ConversationID, channelNames []string, err error) {
	if chatType != chat1.TopicType_KBFSFILEEDIT {
		panic(fmt.Sprintf("Bad topic type: %d", chatType))
	}

	c.data.lock.RLock()
	defer c.data.lock.RUnlock()
	byID := c.data.convs[tlfType][tlfName]
	for _, conv := range byID {
		convIDs = append(convIDs, conv.convID)
		channelNames = append(channelNames, conv.chanName)
	}
	return convIDs, channelNames, nil
}

// ReadChannel implements the Chat interface.
func (c *chatLocal) ReadChannel(
	ctx context.Context, convID chat1.ConversationID, startPage []byte) (
	messages []string, nextPage []byte, err error) {
	c.data.lock.RLock()
	defer c.data.lock.RUnlock()
	conv, ok := c.data.convsByID[convID.String()]
	if !ok {
		return nil, nil, errors.Errorf(
			"Conversation %s doesn't exist", convID.String())
	}
	// For now, no paging, just return the complete list.
	return conv.messages, nil, nil
}

// RegisterForMessages implements the Chat interface.
func (c *chatLocal) RegisterForMessages(
	convID chat1.ConversationID, cb ChatChannelNewMessageCB) {
	c.data.lock.Lock()
	defer c.data.lock.Unlock()
	conv, ok := c.data.convsByID[convID.String()]
	if !ok {
		panic(fmt.Sprintf("Conversation %s doesn't exist", convID.String()))
	}
	conv.cbs = append(conv.cbs, cb)
}

func (c *chatLocal) copy(config Config) *chatLocal {
	copy := newChatLocalWithData(config, c.data)
	c.data.lock.Lock()
	defer c.data.lock.Unlock()
	c.data.newChannelCBs[config] = config.KBFSOps().NewNotificationChannel
	return copy
}

// ClearCache implements the Chat interface.
func (c *chatLocal) ClearCache() {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.selfConvInfos = nil
}
