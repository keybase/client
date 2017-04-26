package storage

import (
	"context"
	"fmt"

	"sort"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
)

type Outbox struct {
	globals.Contextified
	*baseBox
	utils.DebugLabeler

	clock clockwork.Clock
	uid   gregor1.UID
}

const outboxVersion = 3

type diskOutbox struct {
	Version int                  `codec:"V"`
	Records []chat1.OutboxRecord `codec:"O"`
}

func NewOutbox(g *globals.Context, uid gregor1.UID) *Outbox {
	return &Outbox{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "Outbox", false),
		baseBox:      newBaseBox(g, true),
		uid:          uid,
		clock:        clockwork.NewRealClock(),
	}
}

func (o *Outbox) GetUID() gregor1.UID {
	return o.uid
}

func (o *Outbox) dbKey() libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatOutbox,
		Key: fmt.Sprintf("ob:%s", o.uid),
	}
}

func (o *Outbox) readDiskOutbox(ctx context.Context) (diskOutbox, Error) {
	var obox diskOutbox
	found, err := o.readDiskBox(ctx, o.dbKey(), &obox)
	if err != nil {
		return obox, NewInternalError(ctx, o.DebugLabeler, "failure to read chat outbox: %s",
			err.Error())
	}
	if !found {
		return obox, MissError{}
	}
	if obox.Version != outboxVersion {
		o.Debug(ctx, "on disk version not equal to program version, clearing: disk :%d program: %d",
			obox.Version, outboxVersion)
		if cerr := o.clear(ctx); cerr != nil {
			return obox, cerr
		}
		return diskOutbox{Version: outboxVersion}, nil
	}
	return obox, nil
}

func (o *Outbox) clear(ctx context.Context) Error {
	err := o.G().LocalChatDb.Delete(o.dbKey())
	if err != nil {
		return NewInternalError(ctx, o.DebugLabeler, "error clearing outbox: uid: %s err: %s", o.uid,
			err.Error())
	}
	return nil
}

func (o *Outbox) newOutboxID() (chat1.OutboxID, error) {
	rbs, err := libkb.RandBytes(8)
	if err != nil {
		return nil, err
	}
	return chat1.OutboxID(rbs), nil
}

type ByCtimeOrder []chat1.OutboxRecord

func (a ByCtimeOrder) Len() int      { return len(a) }
func (a ByCtimeOrder) Swap(i, j int) { a[i], a[j] = a[j], a[i] }
func (a ByCtimeOrder) Less(i, j int) bool {
	return a[i].Ctime.Before(a[j].Ctime)
}

func (o *Outbox) SetClock(cl clockwork.Clock) {
	o.clock = cl
}

func (o *Outbox) PushMessage(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessagePlaintext, identifyBehavior keybase1.TLFIdentifyBehavior) (rec chat1.OutboxRecord, err Error) {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox(ctx)
	if err != nil {
		if _, ok := err.(MissError); !ok {
			return rec, o.maybeNuke(err, o.dbKey())
		}
		obox = diskOutbox{
			Version: outboxVersion,
			Records: []chat1.OutboxRecord{},
		}
	}

	// Generate new outbox ID
	var ierr error
	outboxID, ierr := o.newOutboxID()
	if ierr != nil {
		return rec, o.maybeNuke(NewInternalError(ctx, o.DebugLabeler,
			"error getting outboxID: err: %s", ierr.Error()), o.dbKey())
	}

	// Append record
	msg.ClientHeader.OutboxID = &outboxID
	rec = chat1.OutboxRecord{
		State:            chat1.NewOutboxStateWithSending(0),
		Msg:              msg,
		Ctime:            gregor1.ToTime(o.clock.Now()),
		ConvID:           convID,
		OutboxID:         outboxID,
		IdentifyBehavior: identifyBehavior,
	}
	obox.Records = append(obox.Records, rec)

	// Write out box
	obox.Version = outboxVersion
	if err := o.writeDiskBox(ctx, o.dbKey(), obox); err != nil {
		return rec, o.maybeNuke(NewInternalError(ctx, o.DebugLabeler,
			"error writing outbox: err: %s", err.Error()), o.dbKey())
	}

	return rec, nil
}

// PullAllConversations grabs all outbox entries for the current outbox, and optionally deletes them
// from storage
func (o *Outbox) PullAllConversations(ctx context.Context, includeErrors bool, remove bool) ([]chat1.OutboxRecord, error) {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox(ctx)
	if err != nil {
		return nil, o.maybeNuke(err, o.dbKey())
	}

	var res, errors []chat1.OutboxRecord
	for _, obr := range obox.Records {
		state, err := obr.State.State()
		if err != nil {
			o.Debug(ctx, "PullAllConversations: unknown state item: skipping: err: %s", err.Error())
			continue
		}
		if state == chat1.OutboxStateType_ERROR {
			if includeErrors {
				res = append(res, obr)
			} else {
				errors = append(errors, obr)
			}
		} else {
			res = append(res, obr)
		}
	}
	if remove {
		// Write out box
		obox.Records = errors
		obox.Version = outboxVersion
		if err := o.writeDiskBox(ctx, o.dbKey(), obox); err != nil {
			return nil, o.maybeNuke(NewInternalError(ctx, o.DebugLabeler,
				"error writing outbox: err: %s", err.Error()), o.dbKey())
		}

	}

	return res, nil
}

// RecordFailedAttempt will either modify an existing matching record (if sending) to next attempt
// number, or if the record doesn't exist it adds it in.
func (o *Outbox) RecordFailedAttempt(ctx context.Context, oldObr chat1.OutboxRecord) error {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox(ctx)
	if err != nil {
		if _, ok := err.(MissError); !ok {
			return o.maybeNuke(err, o.dbKey())
		}
		obox = diskOutbox{
			Version: outboxVersion,
			Records: []chat1.OutboxRecord{},
		}
	}

	// Loop through what we have and make sure we don't already have this record in here
	var recs []chat1.OutboxRecord
	added := false
	for _, obr := range obox.Records {
		if obr.OutboxID.Eq(&oldObr.OutboxID) {
			state, err := obr.State.State()
			if err != nil {
				return err
			}
			if state == chat1.OutboxStateType_SENDING {
				obr.State = chat1.NewOutboxStateWithSending(obr.State.Sending() + 1)
			}
			added = true
		}
		recs = append(recs, obr)
	}
	if !added {
		state, err := oldObr.State.State()
		if err != nil {
			return err
		}
		if state == chat1.OutboxStateType_SENDING {
			oldObr.State = chat1.NewOutboxStateWithSending(oldObr.State.Sending() + 1)
		}
		recs = append(recs, oldObr)
		sort.Sort(ByCtimeOrder(recs))
	}

	// Write out box
	obox.Records = recs
	if err := o.writeDiskBox(ctx, o.dbKey(), obox); err != nil {
		return o.maybeNuke(NewInternalError(ctx, o.DebugLabeler,
			"error writing outbox: err: %s", err.Error()), o.dbKey())
	}

	return nil
}

// MarkAsError will either mark an existing record as an error, or it will add the passed
// record as an error with the specified error state
func (o *Outbox) MarkAsError(ctx context.Context, obr chat1.OutboxRecord, errRec chat1.OutboxStateError) error {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox(ctx)
	if err != nil {
		return o.maybeNuke(err, o.dbKey())
	}

	// Loop through and find record
	var recs []chat1.OutboxRecord
	added := false
	for _, iobr := range obox.Records {
		if iobr.OutboxID.Eq(&obr.OutboxID) {
			iobr.State = chat1.NewOutboxStateWithError(errRec)
			added = true
		}
		recs = append(recs, iobr)
	}
	if !added {
		obr.State = chat1.NewOutboxStateWithError(errRec)
		recs = append(recs, obr)
		sort.Sort(ByCtimeOrder(recs))
	}

	// Write out box
	obox.Records = recs
	if err := o.writeDiskBox(ctx, o.dbKey(), obox); err != nil {
		return o.maybeNuke(NewInternalError(ctx, o.DebugLabeler,
			"error writing outbox: err: %s", err.Error()), o.dbKey())
	}

	return nil
}

func (o *Outbox) RetryMessage(ctx context.Context, obid chat1.OutboxID) error {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox(ctx)
	if err != nil {
		return o.maybeNuke(err, o.dbKey())
	}

	// Loop through and find record
	var recs []chat1.OutboxRecord
	for _, obr := range obox.Records {
		if obr.OutboxID.Eq(&obid) {
			obr.State = chat1.NewOutboxStateWithSending(0)
		}
		recs = append(recs, obr)
	}

	// Write out box
	obox.Records = recs
	if err := o.writeDiskBox(ctx, o.dbKey(), obox); err != nil {
		return o.maybeNuke(NewInternalError(ctx, o.DebugLabeler,
			"error writing outbox: err: %s", err.Error()), o.dbKey())
	}

	return nil
}

func (o *Outbox) RemoveMessage(ctx context.Context, obid chat1.OutboxID) error {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox(ctx)
	if err != nil {
		return o.maybeNuke(err, o.dbKey())
	}

	// Scan to find the message and don't include it
	var recs []chat1.OutboxRecord
	for _, obr := range obox.Records {
		if !obr.OutboxID.Eq(&obid) {
			recs = append(recs, obr)
		}
	}
	obox.Records = recs

	// Write out box
	if err := o.writeDiskBox(ctx, o.dbKey(), obox); err != nil {
		return o.maybeNuke(NewInternalError(ctx, o.DebugLabeler,
			"error writing outbox: err: %s", err.Error()), o.dbKey())
	}

	return nil
}

func (o *Outbox) getMsgOrdinal(msg chat1.MessageUnboxed) (chat1.MessageID, error) {
	typ, err := msg.State()
	if err != nil {
		return 0, err
	}

	switch typ {
	case chat1.MessageUnboxedState_OUTBOX:
		return msg.Outbox().Msg.ClientHeader.OutboxInfo.Prev, nil
	default:
		return msg.GetMessageID(), nil
	}
}

func (o *Outbox) insertMessage(ctx context.Context, thread *chat1.ThreadView, obr chat1.OutboxRecord) error {
	prev := obr.Msg.ClientHeader.OutboxInfo.Prev
	inserted := false
	var res []chat1.MessageUnboxed
	for index, msg := range thread.Messages {
		ord, err := o.getMsgOrdinal(msg)
		if err != nil {
			return err
		}
		if !inserted && prev >= ord {
			res = append(res, chat1.NewMessageUnboxedWithOutbox(obr))
			o.Debug(ctx, "inserting at: %d msgID: %d", index, msg.GetMessageID())
			inserted = true
		}
		res = append(res, msg)
	}

	// If we didn't insert this guy, then put it at the front just so the user can see it
	if !inserted {
		res = append([]chat1.MessageUnboxed{chat1.NewMessageUnboxedWithOutbox(obr)},
			res...)
	}

	thread.Messages = res
	return nil
}

func (o *Outbox) SprinkleIntoThread(ctx context.Context, convID chat1.ConversationID,
	thread *chat1.ThreadView) error {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox(ctx)
	if err != nil {
		return o.maybeNuke(err, o.dbKey())
	}

	// Sprinkle each outbox message in
	for _, obr := range obox.Records {
		if !obr.ConvID.Eq(convID) {
			continue
		}
		if err := o.insertMessage(ctx, thread, obr); err != nil {
			return err
		}
	}

	return nil
}
