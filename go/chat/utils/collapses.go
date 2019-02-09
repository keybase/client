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

type singleCollapseRecord struct {
	Collapsed bool
	Time      time.Time
}

type rangeCollapseRecord struct {
	Collapsed bool
	MsgID     chat1.MessageID
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

func (c *Collapses) rangeKey(uid gregor1.UID, convID chat1.ConversationID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatCollapses,
		Key: fmt.Sprintf("range:%s:%s", uid, convID),
	}
}

func (c *Collapses) ToggleSingle(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID, collapsed bool) error {
	key := c.singleKey(uid, convID, msgID)
	return c.G().GetKVStore().PutObj(key, nil, singleCollapseRecord{
		Collapsed: collapsed,
		Time:      c.clock.Now(),
	})
}

func (c *Collapses) ToggleRange(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID, collapsed bool) error {
	key := c.rangeKey(uid, convID)
	return c.G().GetKVStore().PutObj(key, nil, rangeCollapseRecord{
		Collapsed: collapsed,
		MsgID:     msgID,
		Time:      c.clock.Now(),
	})
}

func (c *Collapses) IsCollapsed(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID, msgType chat1.MessageType) bool {
	if !IsCollapsibleMessageType(msgType) {
		return false
	}
	singleKey := c.singleKey(uid, convID, msgID)
	rangeKey := c.rangeKey(uid, convID)
	// Get both to see which one takes precedence in time order
	var singleRec singleCollapseRecord
	var rangeRec rangeCollapseRecord
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
		if msgID <= rangeRec.MsgID {
			return rangeRec.Collapsed
		}
		return false
	} else if !singleFound && !rangeFound {
		return false
	} else if singleFound && rangeFound {
		if singleRec.Time.After(rangeRec.Time) {
			return singleRec.Collapsed
		}
		if msgID <= rangeRec.MsgID {
			return rangeRec.Collapsed
		}
		return false
	}
	return false
}
