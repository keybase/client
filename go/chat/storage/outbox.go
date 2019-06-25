package storage

import (
	"context"
	"crypto/sha256"
	"fmt"
	"sync"
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

type outboxStorage interface {
	readStorage(ctx context.Context) (diskOutbox, Error)
	writeStorage(ctx context.Context, do diskOutbox) Error
	name() string
}

type OutboxPendingPreviewFn func(context.Context, *chat1.OutboxRecord) error
type OutboxNewMessageNotifierFn func(context.Context, chat1.OutboxRecord)

type Outbox struct {
	globals.Contextified
	utils.DebugLabeler
	outboxStorage

	clock              clockwork.Clock
	uid                gregor1.UID
	pendingPreviewer   OutboxPendingPreviewFn
	newMessageNotifier OutboxNewMessageNotifierFn
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

func DeriveOutboxID(dat []byte) chat1.OutboxID {
	h := sha256.Sum256(dat)
	return chat1.OutboxID(h[:8])
}

func GetOutboxIDFromURL(url string, convID chat1.ConversationID, msg chat1.MessageUnboxed) chat1.OutboxID {
	seed := fmt.Sprintf("%s:%s:%d", url, convID, msg.GetMessageID())
	return DeriveOutboxID([]byte(seed))
}

func createOutboxStorage(g *globals.Context, uid gregor1.UID) outboxStorage {
	typ := g.GetEnv().GetChatOutboxStorageEngine()
	switch typ {
	case "db":
		return newOutboxBaseboxStorage(g, uid)
	case "files":
		return newOutboxFilesStorage(g, uid)
	case "combined":
		return newOutboxCombinedStorage(g, uid)
	default:
		return newOutboxCombinedStorage(g, uid)
	}
}

var storageReportOnce sync.Once

func PendingPreviewer(p OutboxPendingPreviewFn) func(*Outbox) {
	return func(o *Outbox) {
		o.SetPendingPreviewer(p)
	}
}

func NewMessageNotifier(n OutboxNewMessageNotifierFn) func(*Outbox) {
	return func(o *Outbox) {
		o.SetNewMessageNotifier(n)
	}
}

func NewOutbox(g *globals.Context, uid gregor1.UID, config ...func(*Outbox)) *Outbox {
	st := createOutboxStorage(g, uid)
	o := &Outbox{
		Contextified:  globals.NewContextified(g),
		DebugLabeler:  utils.NewDebugLabeler(g.GetLog(), "Outbox", false),
		outboxStorage: st,
		uid:           uid,
		clock:         clockwork.NewRealClock(),
	}
	for _, c := range config {
		c(o)
	}
	storageReportOnce.Do(func() {
		o.Debug(context.Background(), "NewOutbox: using storage engine: %s", st.name())
	})
	return o
}

func (o *Outbox) SetPendingPreviewer(p OutboxPendingPreviewFn) {
	o.pendingPreviewer = p
}

func (o *Outbox) SetNewMessageNotifier(n OutboxNewMessageNotifierFn) {
	o.newMessageNotifier = n
}

func (o *Outbox) GetUID() gregor1.UID {
	return o.uid
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
	msg chat1.MessagePlaintext, suppliedOutboxID *chat1.OutboxID,
	sendOpts *chat1.SenderSendOptions, prepareOpts *chat1.SenderPrepareOptions,
	identifyBehavior keybase1.TLFIdentifyBehavior) (rec chat1.OutboxRecord, err Error) {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()

	// Read outbox for the user
	obox, err := o.readStorage(ctx)
	if err != nil {
		if _, ok := err.(MissError); !ok {
			return rec, err
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
			return rec, NewInternalError(ctx, o.DebugLabeler, "error getting outboxID: err: %s", ierr)
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
		SendOpts:         sendOpts,
		PrepareOpts:      prepareOpts,
	}
	obox.Records = append(obox.Records, rec)

	// Add any pending attachment previews for the notification and return value
	if o.pendingPreviewer != nil {
		if err := o.pendingPreviewer(ctx, &rec); err != nil {
			o.Debug(ctx, "PushMessage: failed to add pending preview: %s", err)
		}
	}
	// Run the notification before we write to the disk so that it is guaranteed to beat
	// any notifications from the message being sent
	if o.newMessageNotifier != nil {
		o.newMessageNotifier(ctx, rec)
	}

	// Write out diskbox
	obox.Version = outboxVersion
	if err = o.writeStorage(ctx, obox); err != nil {
		return rec, err
	}

	return rec, nil
}

// PullAllConversations grabs all outbox entries for the current outbox, and optionally deletes them
// from storage
func (o *Outbox) PullAllConversations(ctx context.Context, includeErrors bool, remove bool) ([]chat1.OutboxRecord, error) {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()

	// Read outbox for the user
	obox, err := o.readStorage(ctx)
	if err != nil {
		return nil, err
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
		if err := o.writeStorage(ctx, obox); err != nil {
			return nil, err
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
	obox, err := o.readStorage(ctx)
	if err != nil {
		if _, ok := err.(MissError); !ok {
			return err
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
	if err := o.writeStorage(ctx, obox); err != nil {
		return err
	}
	return nil
}

func (o *Outbox) MarkAllAsError(ctx context.Context, errRec chat1.OutboxStateError) (res []chat1.OutboxRecord, err error) {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()
	obox, err := o.readStorage(ctx)
	if err != nil {
		return res, err
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
	if err := o.writeStorage(ctx, obox); err != nil {
		return res, err
	}
	return res, nil
}

// MarkAsError will either mark an existing record as an error, or it will add the passed
// record as an error with the specified error state
func (o *Outbox) MarkAsError(ctx context.Context, obr chat1.OutboxRecord, errRec chat1.OutboxStateError) (res chat1.OutboxRecord, err error) {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()

	// Read outbox for the user
	obox, err := o.readStorage(ctx)
	if err != nil {
		return res, err
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
	if err := o.writeStorage(ctx, obox); err != nil {
		return res, err
	}
	return res, nil
}

func (o *Outbox) RetryMessage(ctx context.Context, obid chat1.OutboxID,
	identifyBehavior *keybase1.TLFIdentifyBehavior) (res *chat1.OutboxRecord, err error) {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()

	// Read outbox for the user
	obox, err := o.readStorage(ctx)
	if err != nil {
		return res, err
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
	if err := o.writeStorage(ctx, obox); err != nil {
		return res, err
	}
	return res, nil
}

func (o *Outbox) GetRecord(ctx context.Context, outboxID chat1.OutboxID) (res chat1.OutboxRecord, err error) {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()
	obox, err := o.readStorage(ctx)
	if err != nil {
		return res, err
	}
	for _, obr := range obox.Records {
		if obr.OutboxID.Eq(&outboxID) {
			return obr, nil
		}
	}
	return res, MissError{}
}

func (o *Outbox) UpdateMessage(ctx context.Context, replaceobr chat1.OutboxRecord) (updated bool, err error) {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()
	obox, err := o.readStorage(ctx)
	if err != nil {
		return false, err
	}
	// Scan to find the message and replace it
	var recs []chat1.OutboxRecord
	for _, obr := range obox.Records {
		if !obr.OutboxID.Eq(&replaceobr.OutboxID) {
			recs = append(recs, obr)
		} else {
			updated = true
			recs = append(recs, replaceobr)
		}
	}
	obox.Records = recs
	if err := o.writeStorage(ctx, obox); err != nil {
		return false, err
	}
	return updated, nil
}

func (o *Outbox) CancelMessagesWithPredicate(ctx context.Context, shouldCancel func(chat1.OutboxRecord) bool) (int, error) {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()

	// Read outbox for the user
	obox, err := o.readStorage(ctx)
	if err != nil {
		if _, ok := err.(MissError); !ok {
			return 0, err
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
	if err := o.writeStorage(ctx, obox); err != nil {
		return 0, err
	}
	return numCancelled, nil
}

func (o *Outbox) RemoveMessage(ctx context.Context, obid chat1.OutboxID) error {
	locks.Outbox.Lock()
	defer locks.Outbox.Unlock()

	// Read outbox for the user
	obox, err := o.readStorage(ctx)
	if err != nil {
		return err
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
	if err := o.writeStorage(ctx, obox); err != nil {
		return err
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

	// Special case a prev of 0, just stick it at the front
	if prev == 0 {
		thread.Messages = append([]chat1.MessageUnboxed{chat1.NewMessageUnboxedWithOutbox(obr)},
			thread.Messages...)
		return nil
	}

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
	obox, err := o.readStorage(ctx)
	if err != nil {
		return err
	}

	// Sprinkle each outbox message in
	threadOutboxIDs := make(map[string]bool)
	for _, m := range thread.Messages {
		outboxID := m.GetOutboxID()
		if outboxID != nil {
			threadOutboxIDs[outboxID.String()] = true
		}
	}
	for _, obr := range obox.Records {
		if !obr.ConvID.Eq(convID) {
			continue
		}
		if threadOutboxIDs[obr.OutboxID.String()] {
			o.Debug(ctx, "skipping outbox item already in the thread: %s", obr.OutboxID)
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
	obox, err := o.readStorage(ctx)
	if err != nil {
		return ephemeralPurged, err
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
	if err := o.writeStorage(ctx, obox); err != nil {
		return ephemeralPurged, err
	}
	return ephemeralPurged, nil
}
