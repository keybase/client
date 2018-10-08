package storage

import (
	"context"
	"fmt"
	"io/ioutil"
	"time"

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

const outboxVersion = 4
const ephemeralPurgeCutoff = 24 * time.Hour
const errorPurgeCutoff = time.Hour * 24 * 7 // one week

type diskOutbox struct {
	Version int                  `codec:"V"`
	Records []chat1.OutboxRecord `codec:"O"`
}

func NewOutboxID() (chat1.OutboxID, error) {
	rbs, err := libkb.RandBytes(8)
	if err != nil {
		return nil, err
	}
	return chat1.OutboxID(rbs), nil
}

func NewOutbox(g *globals.Context, uid gregor1.UID) *Outbox {
	return &Outbox{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Outbox", false),
		baseBox:      newBaseBox(g),
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

func (o *Outbox) ingestMobileSharedOutboxLocked(ctx context.Context) {
	dir := o.G().GetEnv().GetChatMobileSharedOutboxDir()
	files, err := ioutil.ReadDir(dir)
	if err != nil {
		o.Debug(ctx, "ingestMobileSharedOutbox: failed reading shared dir:err: %s", err)
		return
	}
	for _, fi := range files {
		dat, err := ioutil.ReadFile(fi.Name())
		if err != nil {
			o.Debug(ctx, "ingestMobileSharedOutbox: failed reading file: %s err: %s", fi.Name(), err)
			continue
		}
		var rec chat1.OutboxRecord
		if err = decode(dat, &rec); err != nil {
			o.Debug(ctx, "ingestMobileSharedOutbox: failed to decode file: %s err: %s", fi.Name(), err)
			continue
		}
		if _, err = o.pushMessageLocked(ctx, rec.ConvID, rec.Msg, &rec.OutboxID, rec.IdentifyBehavior); err != nil {
			o.Debug(ctx, "ingestMobileSharedOutbox: failed to push rec: %s", err)
			continue
		}
	}
}

func (o *Outbox) readDiskOutbox(ctx context.Context) (res diskOutbox, err Error) {
	found, ierr := o.readDiskBox(ctx, o.dbKey(), &res)
	if ierr != nil {
		return res, NewInternalError(ctx, o.DebugLabeler, "failure to read chat outbox: %s", ierr)
	}
	if !found {
		return res, MissError{}
	}
	if res.Version != outboxVersion {
		o.Debug(ctx, "on disk version not equal to program version, clearing: disk :%d program: %d",
			res.Version, outboxVersion)
		if cerr := o.clear(ctx); cerr != nil {
			return res, cerr
		}
		return diskOutbox{Version: outboxVersion}, nil
	}
	return res, nil
}

func (o *Outbox) clear(ctx context.Context) Error {
	err := o.G().LocalChatDb.Delete(o.dbKey())
	if err != nil {
		return NewInternalError(ctx, o.DebugLabeler, "error clearing outbox: uid: %s err: %s", o.uid,
			err.Error())
	}
	return nil
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

func (o *Outbox) pushMessageLocked(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessagePlaintext, suppliedOutboxID *chat1.OutboxID,
	identifyBehavior keybase1.TLFIdentifyBehavior) (rec chat1.OutboxRecord, err Error) {
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

	// Generate new outbox ID (unless the caller supplied it for us already)
	var outboxID chat1.OutboxID
	if suppliedOutboxID == nil {
		var ierr error
		outboxID, ierr = NewOutboxID()
		if ierr != nil {
			return rec, o.maybeNuke(NewInternalError(ctx, o.DebugLabeler,
				"error getting outboxID: err: %s", ierr.Error()), o.dbKey())
		}
	} else {
		outboxID = *suppliedOutboxID
	}

	// Compute prev ordinal
	prevOrdinal := 1
	for _, obr := range obox.Records {
		if obr.Msg.ClientHeader.OutboxInfo.Prev == msg.ClientHeader.OutboxInfo.Prev &&
			obr.Ordinal >= prevOrdinal {
			prevOrdinal = obr.Ordinal + 1
		}
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
		Ordinal:          prevOrdinal,
	}
	obox.Records = append(obox.Records, rec)

	// Write out diskbox
	obox.Version = outboxVersion
	if err := o.writeDiskBox(ctx, o.dbKey(), obox); err != nil {
		return rec, o.maybeNuke(NewInternalError(ctx, o.DebugLabeler,
			"error writing outbox: err: %s", err.Error()), o.dbKey())
	}

	return rec, nil
}

func (o *Outbox) PushMessage(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessagePlaintext, suppliedOutboxID *chat1.OutboxID,
	identifyBehavior keybase1.TLFIdentifyBehavior) (chat1.OutboxRecord, Error) {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()
	return o.pushMessageLocked(ctx, convID, msg, suppliedOutboxID, identifyBehavior)
}

// PullAllConversations grabs all outbox entries for the current outbox, and optionally deletes them
// from storage
func (o *Outbox) PullAllConversations(ctx context.Context, includeErrors bool, remove bool) ([]chat1.OutboxRecord, error) {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()

	// bring in any records from the mobile shared outbox
	o.ingestMobileSharedOutbox(ctx)

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
		// Write out diskbox
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

	// Write out diskbox
	obox.Records = recs
	if err := o.writeDiskBox(ctx, o.dbKey(), obox); err != nil {
		return o.maybeNuke(NewInternalError(ctx, o.DebugLabeler,
			"error writing outbox: err: %s", err.Error()), o.dbKey())
	}

	return nil
}

func (o *Outbox) MarkAllAsError(ctx context.Context, errRec chat1.OutboxStateError) (res []chat1.OutboxRecord, err error) {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()
	obox, serr := o.readDiskOutbox(ctx)
	if serr != nil {
		return res, o.maybeNuke(serr, o.dbKey())
	}
	var recs []chat1.OutboxRecord
	for _, obr := range obox.Records {
		state, err := obr.State.State()
		if err != nil {
			o.Debug(ctx, "MarkAllAsError: unknown state item: adding: err: %s", err.Error())
			recs = append(recs, obr)
			continue
		}
		if state != chat1.OutboxStateType_ERROR {
			obr.State = chat1.NewOutboxStateWithError(errRec)
			res = append(res, obr)
		}
		recs = append(recs, obr)
	}
	obox.Records = recs
	if err := o.writeDiskBox(ctx, o.dbKey(), obox); err != nil {
		return res, o.maybeNuke(NewInternalError(ctx, o.DebugLabeler,
			"error writing outbox: err: %s", err.Error()), o.dbKey())
	}
	return res, nil
}

// MarkAsError will either mark an existing record as an error, or it will add the passed
// record as an error with the specified error state
func (o *Outbox) MarkAsError(ctx context.Context, obr chat1.OutboxRecord, errRec chat1.OutboxStateError) (res chat1.OutboxRecord, err error) {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()

	// Read outbox for the user
	obox, serr := o.readDiskOutbox(ctx)
	if serr != nil {
		return res, o.maybeNuke(serr, o.dbKey())
	}

	// Loop through and find record
	var recs []chat1.OutboxRecord
	added := false
	for _, iobr := range obox.Records {
		if iobr.OutboxID.Eq(&obr.OutboxID) {
			iobr.State = chat1.NewOutboxStateWithError(errRec)
			added = true
			res = iobr
		}
		recs = append(recs, iobr)
	}
	if !added {
		obr.State = chat1.NewOutboxStateWithError(errRec)
		res = obr
		recs = append(recs, obr)
		sort.Sort(ByCtimeOrder(recs))
	}

	// Write out diskbox
	obox.Records = recs
	if err := o.writeDiskBox(ctx, o.dbKey(), obox); err != nil {
		return res, o.maybeNuke(NewInternalError(ctx, o.DebugLabeler,
			"error writing outbox: err: %s", err.Error()), o.dbKey())
	}

	return res, nil
}

func (o *Outbox) RetryMessage(ctx context.Context, obid chat1.OutboxID,
	identifyBehavior *keybase1.TLFIdentifyBehavior) (res *chat1.OutboxRecord, err error) {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()

	// Read outbox for the user
	obox, ierr := o.readDiskOutbox(ctx)
	if ierr != nil {
		return res, o.maybeNuke(ierr, o.dbKey())
	}

	// Loop through and find record
	var recs []chat1.OutboxRecord
	for _, obr := range obox.Records {
		if obr.OutboxID.Eq(&obid) {
			o.Debug(ctx, "resetting send information on obid: %s", obid)
			obr.State = chat1.NewOutboxStateWithSending(0)
			obr.Ctime = gregor1.ToTime(o.clock.Now())
			if identifyBehavior != nil {
				obr.IdentifyBehavior = *identifyBehavior
			}
			res = &obr
		}
		recs = append(recs, obr)
	}

	// Write out diskbox
	obox.Records = recs
	if err := o.writeDiskBox(ctx, o.dbKey(), obox); err != nil {
		return res, o.maybeNuke(NewInternalError(ctx, o.DebugLabeler,
			"error writing outbox: err: %s", err.Error()), o.dbKey())
	}

	return res, nil
}

func (o *Outbox) UpdateMessage(ctx context.Context, replaceobr chat1.OutboxRecord) error {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()
	obox, err := o.readDiskOutbox(ctx)
	if err != nil {
		return o.maybeNuke(err, o.dbKey())
	}
	// Scan to find the message and replace it
	var recs []chat1.OutboxRecord
	for _, obr := range obox.Records {
		if !obr.OutboxID.Eq(&replaceobr.OutboxID) {
			recs = append(recs, obr)
		} else {
			recs = append(recs, replaceobr)
		}
	}
	obox.Records = recs
	if err := o.writeDiskBox(ctx, o.dbKey(), obox); err != nil {
		return o.maybeNuke(NewInternalError(ctx, o.DebugLabeler,
			"error writing outbox: err: %s", err.Error()), o.dbKey())
	}
	return nil
}

func (o *Outbox) CancelMessagesWithPredicate(ctx context.Context, shouldCancel func(chat1.OutboxRecord) bool) (int, error) {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox(ctx)
	if err != nil {
		if _, ok := err.(MissError); !ok {
			return 0, o.maybeNuke(err, o.dbKey())
		}
	}

	// Remove any records that match the predicate
	var recs []chat1.OutboxRecord
	numCancelled := 0
	for _, obr := range obox.Records {
		if shouldCancel(obr) {
			numCancelled++
		} else {
			recs = append(recs, obr)
		}
	}
	obox.Records = recs

	// Write out box
	if err := o.writeDiskBox(ctx, o.dbKey(), obox); err != nil {
		return 0, o.maybeNuke(NewInternalError(ctx, o.DebugLabeler,
			"error writing outbox: err: %s", err.Error()), o.dbKey())
	}

	return numCancelled, nil
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

func (o *Outbox) getMsgOrdinal(msg chat1.MessageUnboxed) chat1.MessageID {
	if msg.IsValid() && msg.Valid().ClientHeader.OutboxInfo != nil {
		return msg.Valid().ClientHeader.OutboxInfo.Prev
	}
	return msg.GetMessageID()
}

func (o *Outbox) insertMessage(ctx context.Context, thread *chat1.ThreadView, obr chat1.OutboxRecord) error {
	prev := obr.Msg.ClientHeader.OutboxInfo.Prev
	inserted := false
	var res []chat1.MessageUnboxed

	for index, msg := range thread.Messages {
		ord := o.getMsgOrdinal(msg)
		if !inserted && prev >= ord {
			res = append(res, chat1.NewMessageUnboxedWithOutbox(obr))
			o.Debug(ctx, "inserting at: %d msgID: %d total: %d obid: %s prev: %d", index,
				msg.GetMessageID(), len(thread.Messages), obr.OutboxID, prev)
			inserted = true
		}
		res = append(res, msg)
	}

	if !inserted {
		// Check to see if outbox item is so old that it has no place in this thread view (but has
		// a valid prev value)
		if prev > 0 && len(thread.Messages) > 0 &&
			prev < o.getMsgOrdinal(thread.Messages[len(thread.Messages)-1]) {
			oldestMsg := thread.Messages[len(thread.Messages)-1]
			o.Debug(ctx, "outbox item is too old to be included in this thread view: obid: %s prev: %d oldestMsg: %d", obr.OutboxID, prev, oldestMsg.GetMessageID())
			return nil
		}

		// If we didn't insert this guy, then put it at the front just so the user can see it
		o.Debug(ctx, "failed to insert instream, placing at front: obid: %s prev: %d", obr.OutboxID, prev)
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
		st, err := obr.State.State()
		if err != nil {
			continue
		}
		if st == chat1.OutboxStateType_ERROR && obr.State.Error().Typ == chat1.OutboxErrorType_DUPLICATE {
			o.Debug(ctx, "skipping sprinkle on duplicate message error: %s", obr.OutboxID)
			continue
		}
		if err := o.insertMessage(ctx, thread, obr); err != nil {
			return err
		}
	}
	// Update prev values for outbox messages to point at correct place (in case it has changed since
	// some messages got sent)
	for index := len(thread.Messages) - 2; index >= 0; index-- {
		msg := thread.Messages[index]
		typ, err := msg.State()
		if err != nil {
			continue
		}
		if typ == chat1.MessageUnboxedState_OUTBOX {
			obr := msg.Outbox()
			obr.Msg.ClientHeader.OutboxInfo.Prev = thread.Messages[index+1].GetMessageID()
			thread.Messages[index] = chat1.NewMessageUnboxedWithOutbox(obr)
		}
	}

	return nil
}

// OutboxPurge is called periodically to ensure messages don't hang out too
// long in the outbox (since they are not encrypted with ephemeral keys until
// they leave it). Currently we purge anything that is in the error state and
// has been in the outbox for > errorPurgeCutoff minutes for regular messages
// or ephemeralPurgeCutoff minutes for ephemeral messages.
func (o *Outbox) OutboxPurge(ctx context.Context) (ephemeralPurged []chat1.OutboxRecord, err error) {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()

	// Read outbox for the user
	obox, rerr := o.readDiskOutbox(ctx)
	if rerr != nil {
		return ephemeralPurged, o.maybeNuke(rerr, o.dbKey())
	}

	var recs []chat1.OutboxRecord
	for _, obr := range obox.Records {
		st, err := obr.State.State()
		if err != nil {
			o.Debug(ctx, "purging message from outbox with error getting state: %s", err)
			continue
		}
		if st == chat1.OutboxStateType_ERROR {
			if obr.Msg.IsEphemeral() && obr.Ctime.Time().Add(ephemeralPurgeCutoff).Before(o.clock.Now()) {
				o.Debug(ctx, "purging ephemeral message from outbox with error state that was older than %v: %s",
					ephemeralPurgeCutoff, obr.OutboxID)
				ephemeralPurged = append(ephemeralPurged, obr)
				continue
			}

			if !obr.Msg.IsEphemeral() && obr.Ctime.Time().Add(errorPurgeCutoff).Before(o.clock.Now()) {
				o.Debug(ctx, "purging message from outbox with error state that was older than %v: %s",
					errorPurgeCutoff, obr.OutboxID)
				continue
			}
		}
		recs = append(recs, obr)
	}

	obox.Records = recs

	// Write out diskbox
	if err := o.writeDiskBox(ctx, o.dbKey(), obox); err != nil {
		return ephemeralPurged, o.maybeNuke(NewInternalError(ctx, o.DebugLabeler,
			"error writing outbox: err: %s", err.Error()), o.dbKey())
	}

	return ephemeralPurged, nil
}
