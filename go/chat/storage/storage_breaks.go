package storage

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type breakTracker struct {
	libkb.Contextified
	utils.DebugLabeler
}

func newBreakTracker(g *libkb.GlobalContext) *breakTracker {
	return &breakTracker{
		Contextified: libkb.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "BreakTracker", false),
	}
}

func (b *breakTracker) makeKey(convID chat1.ConversationID, uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatBlocks,
		Key: fmt.Sprintf("breaks:%s:%s", uid, convID),
	}
}

func (b *breakTracker) UpdateConv(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	breaks []keybase1.TLFIdentifyFailure) error {

	key := b.makeKey(convID, uid)

	dat, err := encode(breaks)
	if err != nil {
		return NewInternalError(ctx, b.DebugLabeler, "encode error: %s", err.Error())
	}
	if err = b.G().LocalChatDb.PutRaw(key, dat); err != nil {
		return NewInternalError(ctx, b.DebugLabeler, "PutRaw error: %s", err.Error())
	}

	return nil
}

func (b *breakTracker) IsConvBroken(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (bool, error) {

	key := b.makeKey(convID, uid)
	raw, found, err := b.G().LocalChatDb.GetRaw(key)
	if err != nil {
		return true, NewInternalError(ctx, b.DebugLabeler, "GetRaw error: %s", err.Error())
	}
	if found {
		var breaks []keybase1.TLFIdentifyFailure
		if err = decode(raw, &breaks); err != nil {
			return true, NewInternalError(ctx, b.DebugLabeler, "decode error: %s", err.Error())
		}

		return len(breaks) != 0, nil
	}

	// Assume to be broken if we have no record
	return true, nil
}
