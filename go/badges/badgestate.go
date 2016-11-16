// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package badges

import (
	"sync"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

// BadgeState represents the number of badges on the app. It's threadsafe.
// Useable from both the client service and gregor server.
// See service:Badger for the service part that owns this.
type BadgeState struct {
	libkb.Contextified
	sync.Mutex

	state keybase1.BadgeState

	inboxVers chat1.InboxVers
	// Map from ConversationID.String to BadgeConversationInfo.
	chatUnreadMap map[string]keybase1.BadgeConversationInfo
}

// NewBadgeState creates a new empty BadgeState.
func NewBadgeState(g *libkb.GlobalContext) *BadgeState {
	return &BadgeState{
		Contextified:  libkb.NewContextified(g),
		inboxVers:     chat1.InboxVers(0),
		chatUnreadMap: make(map[string]keybase1.BadgeConversationInfo),
	}
}

// Exports the state summary
func (b *BadgeState) Export() (keybase1.BadgeState, error) {
	b.Lock()
	defer b.Unlock()

	b.state.Conversations = []keybase1.BadgeConversationInfo{}
	for _, info := range b.chatUnreadMap {
		b.state.Conversations = append(b.state.Conversations, info)
	}

	return b.state, nil
}

// UpdateWithGregor updates the badge state from a gregor state.
func (b *BadgeState) UpdateWithGregor(gstate gregor.State) error {
	b.Lock()
	defer b.Unlock()

	b.state.NewTlfs = 0
	b.state.NewFollowers = 0
	b.state.RekeysNeeded = 0

	items, err := gstate.Items()
	if err != nil {
		return err
	}
	for _, item := range items {
		categoryObj := item.Category()
		if categoryObj == nil {
			continue
		}
		category := categoryObj.String()
		switch category {
		case "tlf":
			b.state.NewTlfs++
		case "kbfs_tlf_rekey_needed", "kbfs_tlf_sbs_rekey_needed":
			b.state.RekeysNeeded++
		case "follow":
			b.state.NewFollowers++
		}
	}

	b.updateCounts()

	return nil
}

func (b *BadgeState) UpdateWithChat(update chat1.UnreadUpdate, inboxVers chat1.InboxVers) {
	b.Lock()
	defer b.Unlock()

	// Skip stale updates
	if inboxVers < b.inboxVers {
		return
	}

	b.updateWithChat(update)
	b.updateCounts()
}

func (b *BadgeState) UpdateWithChatFull(update chat1.UnreadUpdateFull) {
	b.Lock()
	defer b.Unlock()

	if update.Ignore {
		return
	}

	// Skip stale updates
	if update.InboxVers < b.inboxVers {
		return
	}

	b.chatUnreadMap = make(map[string]keybase1.BadgeConversationInfo)

	for _, upd := range update.Updates {
		b.updateWithChat(upd)
	}

	b.inboxVers = update.InboxVers
	b.updateCounts()
}

func (b *BadgeState) Clear() {
	b.state = keybase1.BadgeState{}
	b.inboxVers = chat1.InboxVers(0)
	b.chatUnreadMap = make(map[string]keybase1.BadgeConversationInfo)
}

func (b *BadgeState) updateWithChat(update chat1.UnreadUpdate) {
	b.chatUnreadMap[update.ConvID.String()] = keybase1.BadgeConversationInfo{
		ConvID:         keybase1.ChatConversationID(update.ConvID),
		UnreadMessages: update.UnreadMessages,
	}
}

func (b *BadgeState) updateCounts() {
	// Compute chat counts
	b.state.UnreadChatMessages = 0
	b.state.UnreadChatConversations = 0
	for _, info := range b.chatUnreadMap {
		if info.UnreadMessages > 0 {
			b.state.UnreadChatConversations++
		}
		b.state.UnreadChatMessages += info.UnreadMessages
	}

	// Compute total badge count
	b.state.Total = b.state.NewTlfs + b.state.RekeysNeeded + b.state.NewFollowers + b.state.UnreadChatConversations
}
