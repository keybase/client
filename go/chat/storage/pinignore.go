package storage

import (
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"
)

type PinIgnore struct {
	globals.Contextified
	utils.DebugLabeler

	uid gregor1.UID
}

func NewPinIgnore(g *globals.Context, uid gregor1.UID) *PinIgnore {
	return &PinIgnore{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), g.GetPerfLog(), "PinIgnore", false),
		uid:          uid,
	}
}

func (p *PinIgnore) dbKey(convID chat1.ConversationID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatPinIgnore,
		Key: fmt.Sprintf("%s:%s", p.uid, convID),
	}
}

func (p *PinIgnore) IsIgnored(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID) bool {
	var ignoredMsgID chat1.MessageID
	found, err := p.G().GetKVStore().GetInto(&ignoredMsgID, p.dbKey(convID))
	if err != nil {
		p.Debug(ctx, "IsIgnored: failed to read from storage: %s", err)
		return false
	}
	if !found {
		return false
	}
	return msgID == ignoredMsgID
}

func (p *PinIgnore) Ignore(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID) error {
	return p.G().GetKVStore().PutObj(p.dbKey(convID), nil, msgID)
}
