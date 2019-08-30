// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package badges

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
)

type InboxVersionSource interface {
	GetInboxVersion(context.Context, gregor1.UID) (chat1.InboxVers, error)
}

type nullInboxVersionSource struct {
}

func (n nullInboxVersionSource) GetInboxVersion(ctx context.Context, uid gregor1.UID) (chat1.InboxVers, error) {
	return chat1.InboxVers(0), nil
}

// Badger keeps a BadgeState up to date and broadcasts it to electron.
// This is the client-specific glue.
// The state is kept up to date by subscribing to:
// - All gregor state updates
// - All chat.activity gregor OOBMs
// - Logout
type Badger struct {
	libkb.Contextified
	badgeState     *BadgeState
	iboxVersSource InboxVersionSource
	notifyCh       chan keybase1.BadgeState
	shutdownCh     chan struct{}
}

func NewBadger(g *libkb.GlobalContext) *Badger {
	b := &Badger{
		Contextified:   libkb.NewContextified(g),
		badgeState:     NewBadgeState(g.Log, g.Env),
		iboxVersSource: nullInboxVersionSource{},
		notifyCh:       make(chan keybase1.BadgeState, 1000),
		shutdownCh:     make(chan struct{}),
	}
	go b.notifyLoop()
	g.PushShutdownHook(func() error {
		close(b.shutdownCh)
		return nil
	})
	return b
}

func (b *Badger) notifyLoop() {
	for {
		select {
		case state := <-b.notifyCh:
			b.G().NotifyRouter.HandleBadgeState(state)
		case <-b.shutdownCh:
			return
		}
	}
}

func (b *Badger) SetLocalChatState(s LocalChatState) {
	b.badgeState.SetLocalChatState(s)
}

func (b *Badger) SetInboxVersionSource(s InboxVersionSource) {
	b.iboxVersSource = s
}

func (b *Badger) PushState(ctx context.Context, state gregor.State) {
	b.G().Log.CDebugf(ctx, "Badger update with gregor state")
	if err := b.badgeState.UpdateWithGregor(ctx, state); err != nil {
		b.G().Log.Warning("Badger (PushState) UpdateWithGregor failed: %v", err)
	}
	if err := b.Send(ctx); err != nil {
		b.G().Log.Warning("Badger send (PushState) failed: %v", err)
	}
}

func (b *Badger) PushChatUpdate(ctx context.Context, update chat1.UnreadUpdate, inboxVers chat1.InboxVers) {
	b.G().Log.CDebugf(ctx, "Badger update with chat update")
	b.badgeState.UpdateWithChat(ctx, update, inboxVers)
	if err := b.Send(ctx); err != nil {
		b.G().Log.CDebugf(ctx, "Badger send (PushChatUpdate) failed: %v", err)
	}
}

func (b *Badger) PushChatFullUpdate(ctx context.Context, update chat1.UnreadUpdateFull) {
	b.G().Log.CDebugf(ctx, "Badger update with chat full update")
	b.badgeState.UpdateWithChatFull(ctx, update)
	if err := b.Send(ctx); err != nil {
		b.G().Log.CDebugf(ctx, "Badger send (PushChatFullUpdate) failed: %v", err)
	}
}

func (b *Badger) GetInboxVersionForTest(ctx context.Context) (chat1.InboxVers, error) {
	uid := b.G().Env.GetUID()
	return b.iboxVersSource.GetInboxVersion(ctx, uid.ToBytes())
}

func (b *Badger) SetWalletAccountUnreadCount(ctx context.Context, accountID stellar1.AccountID, unreadCount int) {
	changed := b.badgeState.SetWalletAccountUnreadCount(accountID, unreadCount)
	if !changed {
		return
	}
	b.G().Log.CDebugf(ctx, "Badger sending for SetWalletAccountUnreadCount: %s/%d", accountID, unreadCount)
	if err := b.Send(ctx); err != nil {
		b.G().Log.CDebugf(ctx, "Badger send (SetWalletAccountUnreadCount) failed: %s", err)
	}
}

func (b *Badger) Clear(ctx context.Context) {
	b.badgeState.Clear()
	if err := b.Send(ctx); err != nil {
		b.G().Log.CDebugf(ctx, "Badger send (clear) failed: %v", err)
	}
}

// Send the badgestate to electron
func (b *Badger) Send(ctx context.Context) error {
	state, err := b.badgeState.Export(ctx)
	if err != nil {
		return err
	}
	b.log(ctx, state)
	b.notifyCh <- state
	return nil
}

func (b *Badger) State() *BadgeState {
	return b.badgeState
}

// Log a copy of the badgestate with some zeros stripped off for brevity.
func (b *Badger) log(ctx context.Context, state1 keybase1.BadgeState) {
	state2 := state1
	state2.Conversations = nil
	for _, c1 := range state1.Conversations {
		if c1.UnreadMessages == 0 {
			continue
		}
		c2id := c1.ConvID
		if len(c1.ConvID) >= chat1.DbShortFormLen {
			// This is the db short form for logging brevity only.
			// Don't let this leave this method.
			c2id = chat1.ConversationID([]byte(c1.ConvID)).DbShortForm()
		}

		c2 := keybase1.BadgeConversationInfo{
			ConvID:         c2id,
			UnreadMessages: c1.UnreadMessages,
			BadgeCounts:    c1.BadgeCounts,
		}
		state2.Conversations = append(state2.Conversations, c2)
	}
	b.G().Log.CDebugf(ctx, "Badger send: %+v", state2)
}
