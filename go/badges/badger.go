// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package badges

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

// Badger keeps a BadgeState up to date and broadcasts it to electron.
// This is the client-specific glue.
// The state is kept up to date by subscribing to:
// - All gregor state updates
// - All chat.activity gregor OOBMs
// - Logout
type Badger struct {
	libkb.Contextified
	badgeState *BadgeState
}

func NewBadger(g *libkb.GlobalContext) *Badger {
	return &Badger{
		Contextified: libkb.NewContextified(g),
		badgeState:   NewBadgeState(g),
	}
}

func (b *Badger) PushState(state gregor1.State) {
	b.G().Log.Debug("Badger update with gregor state")
	b.badgeState.UpdateWithGregor(state)
	err := b.Send()
	if err != nil {
		b.G().Log.Warning("Badger send (pushstate) failed: %v", err)
	}
}

func (b *Badger) PushChatUpdate(update chat1.UnreadUpdate, inboxVers chat1.InboxVers) {
	b.G().Log.Debug("Badger update with chat update")
	b.badgeState.UpdateWithChat(update, inboxVers)
	err := b.Send()
	if err != nil {
		b.G().Log.Warning("Badger send (pushchatupdate) failed: %v", err)
	}
}

func (b *Badger) Resync(ctx context.Context, remoteClient *chat1.RemoteClient) error {
	b.G().Log.Debug("Badger resync req")
	update, err := remoteClient.GetUnreadUpdateFull(ctx, chat1.InboxVers(0))
	if err != nil {
		b.G().Log.Warning("Badger resync failed: %v", err)
		return err
	}
	b.badgeState.UpdateWithChatFull(update)
	err = b.Send()
	if err != nil {
		b.G().Log.Warning("Badger send (resync) failed: %v", err)
	} else {
		b.G().Log.Debug("Badger resync complete")
	}
	return err
}

func (b *Badger) Clear(ctx context.Context) {
	b.badgeState.Clear()
	err := b.Send()
	if err != nil {
		b.G().Log.Warning("Badger send (clear) failed: %v", err)
	}
}

// Send the badgestate to electron
func (b *Badger) Send() error {
	state, err := b.badgeState.Export()
	if err != nil {
		return err
	}
	b.G().Log.Debug("Badger send")
	b.G().NotifyRouter.HandleBadgeState(state)
	return nil
}

func (b *Badger) State() *BadgeState {
	return b.badgeState
}
