// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/badges"
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
	badgeState *badges.BadgeState
}

func newBadger(g *libkb.GlobalContext) *Badger {
	return &Badger{
		Contextified: libkb.NewContextified(g),
		badgeState:   badges.NewBadgeState(g),
	}
}

func (b *Badger) PushState(state gregor1.State) {
	b.badgeState.UpdateWithGregor(state)
}

func (b *Badger) PushChatUpdate(update chat1.UnreadUpdate, inboxVers chat1.InboxVers) {
	b.G().Log.Debug("@@@ badger chat update start: %v", update)
	b.badgeState.UpdateWithChat(update, inboxVers)
	b.G().Log.Debug("@@@ done")
}

func (b *Badger) Resync(ctx context.Context, remoteClient *chat1.RemoteClient) error {
	b.G().Log.Debug("@@@ badger resync start")
	update, err := remoteClient.GetUnreadUpdateFull(ctx, chat1.InboxVers(0))
	if err != nil {
		b.G().Log.Warning("Badger resync failed: %v", err)
		return err
	}
	b.G().Log.Debug("@@@ badger resync do %v", update)
	b.badgeState.UpdateWithChatFull(update)
	b.G().Log.Debug("@@@ done")
	return nil
}

func (b *Badger) Clear() {
	b.badgeState.Clear()
}
