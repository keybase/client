// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package badges

import (
	"golang.org/x/net/context"

	grclient "github.com/keybase/client/go/gregor/client"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
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
}

func NewBadger(g *libkb.GlobalContext) *Badger {
	return &Badger{
		Contextified:   libkb.NewContextified(g),
		badgeState:     NewBadgeState(g.Log),
		iboxVersSource: nullInboxVersionSource{},
	}
}

func (b *Badger) SetInboxVersionSource(s InboxVersionSource) {
	b.iboxVersSource = s
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

func (b *Badger) inboxVersion(ctx context.Context) chat1.InboxVers {
	uid := b.G().Env.GetUID()
	vers, err := b.iboxVersSource.GetInboxVersion(ctx, uid.ToBytes())
	if err != nil {
		b.G().Log.Debug("Badger: inboxVersion error: %s", err.Error())
		return chat1.InboxVers(0)
	}
	return vers
}

func (b *Badger) Resync(ctx context.Context, chatRemote func() chat1.RemoteInterface,
	gcli *grclient.Client, update *chat1.UnreadUpdateFull) error {
	b.G().Log.Debug("Badger resync req")

	var err error
	if update == nil {
		iboxVersion := b.inboxVersion(ctx)
		b.G().Log.Debug("Badger: Resync(): using inbox version: %v", iboxVersion)
		update = new(chat1.UnreadUpdateFull)
		*update, err = chatRemote().GetUnreadUpdateFull(ctx, iboxVersion)
		if err != nil {
			b.G().Log.Warning("Badger resync failed: %v", err)
			return err
		}
	} else {
		b.G().Log.Debug("Badger: Resync(): skipping remote call, data previously obtained")
	}

	state, err := gcli.StateMachineState(ctx, nil)
	if err != nil {
		b.G().Log.Debug("Badger: Resync(): unable to get state: %s", err.Error())
		state = gregor1.State{}
	}
	b.badgeState.UpdateWithChatFull(*update)
	b.badgeState.UpdateWithGregor(state)
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
	b.log(state)
	b.G().NotifyRouter.HandleBadgeState(state)
	return nil
}

func (b *Badger) State() *BadgeState {
	return b.badgeState
}

// Log a copy of the badgestate with some zeros stripped off for brevity.
func (b *Badger) log(state1 keybase1.BadgeState) {
	var state2 keybase1.BadgeState
	state2 = state1
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
		}
		state2.Conversations = append(state2.Conversations, c2)
	}
	b.G().Log.Debug("Badger send: %+v", state2)
}
