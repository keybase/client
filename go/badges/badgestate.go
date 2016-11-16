// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package badges

import (
	"fmt"
	"sync"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
)

// BadgeState represents the number of badges on the app. It's threadsafe.
// Useable from both the client service and gregor server.
// See service:Badger for the service part that owns this.
type BadgeState struct {
	libkb.Contextified
	sync.Mutex

	Total                   int
	NewTlfs                 int
	RekeysNeeded            int
	NewFollowers            int
	UnreadChatMessages      int
	UnreadChatConversations int

	inboxVers chat1.InboxVers
	// Map from ConversationID.String to unread message count.
	chatUnreadMap map[string]int
}

// NewBadgeState creates a new empty BadgeState.
func NewBadgeState(g *libkb.GlobalContext) *BadgeState {
	return &BadgeState{
		Contextified:  libkb.NewContextified(g),
		inboxVers:     chat1.InboxVers(0),
		chatUnreadMap: make(map[string]int),
	}
}

// Exports the state summary
func (b *BadgeState) Export() (interface{} /*will use keybase1.BadgeState when implemented*/, error) {
	b.Lock()
	defer b.Unlock()
	return nil, fmt.Errorf("BadgeState export not implemented")
}

// UpdateWithGregor updates the badge state from a gregor state.
func (b *BadgeState) UpdateWithGregor(gstate gregor.State) error {
	b.Lock()
	defer b.Unlock()

	b.NewTlfs = 0
	b.NewFollowers = 0
	b.RekeysNeeded = 0

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
			b.NewTlfs++
		case "kbfs_tlf_rekey_needed", "kbfs_tlf_sbs_rekey_needed":
			b.RekeysNeeded++
		case "follow":
			b.NewFollowers++
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

	b.chatUnreadMap = make(map[string]int)

	for _, upd := range update.Updates {
		b.updateWithChat(upd)
	}

	b.inboxVers = update.InboxVers
	b.updateCounts()
}

func (b *BadgeState) Clear() {
	b.Total = 0
	b.NewTlfs = 0
	b.RekeysNeeded = 0
	b.NewFollowers = 0
	b.UnreadChatMessages = 0
	b.UnreadChatConversations = 0
	b.inboxVers = chat1.InboxVers(0)
	b.chatUnreadMap = make(map[string]int)
}

func (b *BadgeState) updateWithChat(update chat1.UnreadUpdate) {
	b.chatUnreadMap[update.ConvID.String()] = update.UnreadMessages
}

func (b *BadgeState) updateCounts() {
	// Compute chat counts
	b.UnreadChatMessages = 0
	b.UnreadChatConversations = 0
	for _, c := range b.chatUnreadMap {
		if c > 0 {
			b.UnreadChatConversations++
		}
		b.UnreadChatMessages += c
	}

	// Compute total badge count
	b.Total = b.NewTlfs + b.RekeysNeeded + b.NewFollowers + b.UnreadChatConversations
}
