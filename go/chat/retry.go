package chat

import (
	"context"
	"fmt"
	"sync"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/clockwork"
	"time"
)

type FetchType int

const (
	InboxLoad FetchType = iota
	ThreadLoad
)



type FetchRetrier struct {
	libkb.Contextified
	sync.Mutex
	utils.DebugLabeler

	clock clockwork.Clock
}

func NewFetchRetrier(g *libkb.GlobalContext) *FetchRetrier {
	return &FetchRetrier{
		Contextified: libkb.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "FetchRetrier", false),
		clock: clockwork.NewRealClock(),
	}
}

func (f *FetchRetrier) dbKey(uid gregor1.UID, kind FetchType) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatFetchRetrier,
		Key: fmt.Sprintf("%s:%d", uid, kind),
	}
}

func (f *FetchRetrier) maybeNuke(ctx context.Context, err error, uid gregor1.UID, 
	kind FetchType) {
	if err != nil {
		f.Debug(ctx, "maybeNuke: nuking local copy")
		if err := f.G().LocalChatDb.Delete(f.dbKey(uid, kind)); err != nil {
			f.Debug(ctx, "maybeNuke: error trying to nuke db: %s", err.Error())
		}
	}
}

type convModifyFunc func(chat1.ConversationID, failureLedger) failureLedge

func (f *FetchRetrier) writeConversation(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, kind FetchType, cmf convModifyFunc) error {
	defer f.maybeNuke(ctx, err, uid, kind)

	// Read current data (if any)
	var failures failureLedger
	key := f.dbKey(uid, kind)
	_, err := f.G().LocalChatDb.GetInto(&failures, key)
	if err != nil {
		f.Debug(ctx, "writeConversation: failed to get current list, using empty: %s",
			err.Error())
		return err
	}
	failures = cmf(convID, failures)

	if err := f.G().LocalChatDb.PutObj(key, nil, failures); err != nil {
		f.Debug(ctx, "writeConversation: failed to write list: %s", err.Error())
		return err
	}

	return nil
}

func (f *FetchRetrier) Failure(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	kind FetchType) (err error) {
	f.Lock()
	defer f.Unlock()
	defer f.Trace(ctx, func() error { return err }, fmt.Sprintf("Failure(%s)", convID))()

	return f.writeConversation(ctx, convID, uid, kind,
		func(convID chat1.ConversationID, convIDs []chat1.ConversationID) []chat1.ConversationID {
			return append(convIDs, convID)
		},
	)
}

func (f *FetchRetrier) Success(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	kind FetchType) (err error) {
	f.Lock()
	defer f.Unlock()
	defer f.Trace(ctx, func() error { return err }, fmt.Sprintf("Success(%s)", convID))()

	return f.writeConversation(ctx, convID, uid, kind,
		func(convID chat1.ConversationID, convIDs []chat1.ConversationID) (res []chat1.ConversationID) {
			for _, cid := range convIDs {
				if !cid.Eq(convID) {
					res = append(res, convID)
				}
			}
			return res
		},
	)
}

func (f *FetchRetrier) Reconnect() {

}

func (f *FetchRetrier) retryLoop() {
	for {
		select {
			case <-f.clock.After(
		}

	}
}

func (f *FetchRetrier) retryOnce() {

}
