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

const readOutboxVersion = 1

type ReadOutboxRecord struct {
	ID          chat1.OutboxID
	ConvID      chat1.ConversationID
	MsgID       chat1.MessageID
	ForceUnread bool
}

type diskReadOutbox struct {
	Version int                `codec:"V"`
	Records []ReadOutboxRecord `codec:"O"`
}

type ReadOutbox struct {
	globals.Contextified
	utils.DebugLabeler
	*baseBox

	uid gregor1.UID
}

func NewReadOutbox(g *globals.Context, uid gregor1.UID) *ReadOutbox {
	return &ReadOutbox{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "ReadOutbox", false),
		baseBox:      newBaseBox(g),
		uid:          uid,
	}
}

func (o *ReadOutbox) dbKey() libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatOutbox,
		Key: fmt.Sprintf("rob:%s", o.uid),
	}
}

func (o *ReadOutbox) clear(ctx context.Context) Error {
	err := o.G().LocalChatDb.Delete(o.dbKey())
	if err != nil {
		return NewInternalError(ctx, o.DebugLabeler, "error clearing read outbox: uid: %s err: %s",
			o.uid, err)
	}
	return nil
}

func (o *ReadOutbox) readStorage(ctx context.Context) (res diskReadOutbox) {
	if memobox := readOutboxMemCache.Get(o.uid); memobox != nil {
		o.Debug(ctx, "hit in memory cache")
		res = *memobox
	} else {
		found, ierr := o.readDiskBox(ctx, o.dbKey(), &res)
		if ierr != nil {
			if _, ok := ierr.(libkb.LoginRequiredError); !ok {
				o.maybeNuke(NewInternalError(ctx, o.DebugLabeler, ierr.Error()), o.dbKey())
			}
			return diskReadOutbox{Version: readOutboxVersion}
		}
		if !found {
			return diskReadOutbox{Version: readOutboxVersion}
		}
		readOutboxMemCache.Put(o.uid, &res)
	}
	if res.Version != readOutboxVersion {
		o.Debug(ctx, "on disk version not equal to program version, clearing: disk :%d program: %d",
			res.Version, readOutboxVersion)
		if cerr := o.clear(ctx); cerr != nil {
			return diskReadOutbox{Version: readOutboxVersion}
		}
		return diskReadOutbox{Version: readOutboxVersion}
	}
	return res
}

func (o *ReadOutbox) writeStorage(ctx context.Context, obox diskReadOutbox) (err Error) {
	if ierr := o.writeDiskBox(ctx, o.dbKey(), obox); ierr != nil {
		return NewInternalError(ctx, o.DebugLabeler, "error writing outbox: err: %s", ierr)
	}
	readOutboxMemCache.Put(o.uid, &obox)
	return nil
}

func (o *ReadOutbox) PushRead(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID, forceUnread bool) (err Error) {
	locks.ReadOutbox.Lock()
	defer locks.ReadOutbox.Unlock()
	obox := o.readStorage(ctx)
	id, ierr := NewOutboxID()
	if ierr != nil {
		return NewInternalError(ctx, o.DebugLabeler, "failed to generate id: %s", ierr)
	}
	obox.Records = append(obox.Records, ReadOutboxRecord{
		ID:          id,
		ConvID:      convID,
		MsgID:       msgID,
		ForceUnread: forceUnread,
	})
	return o.writeStorage(ctx, obox)
}

func (o *ReadOutbox) GetRecords(ctx context.Context) (res []ReadOutboxRecord, err Error) {
	locks.ReadOutbox.Lock()
	defer locks.ReadOutbox.Unlock()
	obox := o.readStorage(ctx)
	return obox.Records, nil
}

func (o *ReadOutbox) RemoveRecord(ctx context.Context, id chat1.OutboxID) Error {
	locks.ReadOutbox.Lock()
	defer locks.ReadOutbox.Unlock()
	obox := o.readStorage(ctx)
	var newrecs []ReadOutboxRecord
	for _, rec := range obox.Records {
		if !rec.ID.Eq(&id) {
			newrecs = append(newrecs, rec)
		}
	}
	obox.Records = newrecs
	return o.writeStorage(ctx, obox)
}
