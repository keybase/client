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
	ID     chat1.OutboxID
	ConvID chat1.ConversationID
	MsgID  chat1.MessageID
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
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "ReadOutbox", false),
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

func (o *ReadOutbox) readStorage(ctx context.Context) (res diskReadOutbox, err Error) {
	found, ierr := o.readDiskBox(ctx, o.dbKey(), &res)
	if ierr != nil {
		return res, NewInternalError(ctx, o.DebugLabeler, "failure to read chat read outbox: %s", ierr)
	}
	if !found {
		return diskReadOutbox{Version: readOutboxVersion}, nil
	}
	if res.Version != readOutboxVersion {
		o.Debug(ctx, "on disk version not equal to program version, clearing: disk :%d program: %d",
			res.Version, readOutboxVersion)
		if cerr := o.clear(ctx); cerr != nil {
			return res, cerr
		}
		return diskReadOutbox{Version: readOutboxVersion}, nil
	}
	return res, nil
}

func (o *ReadOutbox) writeStorage(ctx context.Context, do diskReadOutbox) (err Error) {
	if ierr := o.writeDiskBox(ctx, o.dbKey(), do); ierr != nil {
		return NewInternalError(ctx, o.DebugLabeler, "error writing outbox: err: %s", ierr)
	}
	return nil
}

func (o *ReadOutbox) PushRead(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID) (err Error) {
	locks.ReadOutbox.Lock()
	defer locks.ReadOutbox.Unlock()
	obox, err := o.readStorage(ctx)
	if err != nil {
		return err
	}
	id, ierr := NewOutboxID()
	if ierr != nil {
		return NewInternalError(ctx, o.DebugLabeler, "failed to generate id: %s", ierr)
	}
	obox.Records = append(obox.Records, ReadOutboxRecord{
		ID:     id,
		ConvID: convID,
		MsgID:  msgID,
	})
	return o.writeStorage(ctx, obox)
}

func (o *ReadOutbox) GetRecords(ctx context.Context) (res []ReadOutboxRecord, err Error) {
	locks.ReadOutbox.Lock()
	defer locks.ReadOutbox.Unlock()
	obox, err := o.readStorage(ctx)
	if err != nil {
		return res, err
	}
	return obox.Records, nil
}

func (o *ReadOutbox) RemoveRecord(ctx context.Context, id chat1.OutboxID) Error {
	locks.ReadOutbox.Lock()
	defer locks.ReadOutbox.Unlock()
	obox, err := o.readStorage(ctx)
	if err != nil {
		return err
	}
	var newrecs []ReadOutboxRecord
	for _, rec := range obox.Records {
		if !rec.ID.Eq(&id) {
			newrecs = append(newrecs, rec)
		}
	}
	obox.Records = newrecs
	return o.writeStorage(ctx, obox)
}
