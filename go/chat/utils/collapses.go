package utils

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/clockwork"
	"golang.org/x/net/context"
)

type collapseRecord struct {
	Collapsed bool
	Time      time.Time
}

type Collapses struct {
	globals.Contextified
	DebugLabeler

	clock clockwork.Clock
}

func NewCollapses(g *globals.Context) *Collapses {
	return &Collapses{
		Contextified: globals.NewContextified(g),
		DebugLabeler: NewDebugLabeler(g.GetLog(), "Utils.Collapses", false),
		clock:        clockwork.NewRealClock(),
	}
}

func (c *Collapses) singleKey(uid gregor1.UID, convID chat1.ConversationID, msgID chat1.MessageID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatCollapses,
		Key: fmt.Sprintf("single:%s:%s:%d", uid, convID, msgID),
	}
}

func (c *Collapses) rangeKey(uid gregor1.UID, convID chat1.ConversationID, msgID chat1.MessageID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatCollapses,
		Key: fmt.Sprintf("range:%s:%s:%d", uid, convID, msgID),
	}
}

func (c *Collapses) toggle(ctx context.Context, key libkb.DbKey, uid gregor1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID, collapsed bool) error {
	if err := c.G().GetKVStore().PutObj(key, nil, collapseRecord{
		Collapsed: collapsed,
		Time:      c.clock.Now(),
	}); err != nil {
		return err
	}
	return nil
}

func (c *Collapses) ToggleSingle(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID, collapsed bool) error {
	return c.toggle(ctx, c.singleKey(uid, convID, msgID), uid, convID, msgID, collapsed)
}

func (c *Collapses) ToggleRange(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID, collapsed bool) error {
	return c.toggle(ctx, c.rangeKey(uid, convID, msgID), uid, convID, msgID, collapsed)
}

func (c *Collapses) IsCollapsed(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID) bool {
	singleKey := c.singleKey(uid, convID, msgID)
	rangeKey := c.rangeKey(uid, convID, msgID)
	// Get both to see which one takes precedence in time order
	var singleRec, rangeRec collapseRecord
	singleFound, err := c.G().GetKVStore().GetInto(&singleRec, singleKey)
	if err != nil {
		c.Debug(ctx, "IsCollapsed: failed to read single record: %s", err)
		singleFound = false
	}
	rangeFound, err := c.G().GetKVStore().GetInto(&rangeRec, rangeKey)
	if err != nil {
		c.Debug(ctx, "IsCollapsed: failed to read range record: %s", err)
		rangeFound = false
	}
	if singleFound && !rangeFound {
		return singleRec.Collapsed
	} else if !singleFound && rangeFound {
		return rangeRec.Collapsed
	} else if !singleFound && !rangeFound {
		return false
	} else if singleFound && rangeFound {
		if singleRec.Time.After(rangeRec.Time) {
			return singleRec.Collapsed
		}
		return rangeRec.Collapsed
	}
	return false
}
