package storage

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/clockwork"
)

type ConversationFailureRecord struct {
	ConvID      chat1.ConversationID `codec:"C"`
	Attempts    int                  `codec:"A"`
	LastAttempt gregor1.Time         `codec:"T"`
}

type ConversationFailureBox struct {
	globals.Contextified
	*baseBox
	utils.DebugLabeler

	uid   gregor1.UID
	key   string
	clock clockwork.Clock
}

func NewConversationFailureBox(g *globals.Context, uid gregor1.UID, key string) *ConversationFailureBox {
	return &ConversationFailureBox{
		Contextified: globals.NewContextified(g),
		baseBox:      newBaseBox(g, false),
		DebugLabeler: utils.NewDebugLabeler(g, "ConversationFailureBox", false),
		uid:          uid,
		key:          key,
		clock:        clockwork.NewRealClock(),
	}
}

func (f *ConversationFailureBox) dbKey() libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatConvFailures,
		Key: fmt.Sprintf("%s:%s", f.uid, f.key),
	}
}

func (f *ConversationFailureBox) Failure(ctx context.Context, convID chat1.ConversationID) (err Error) {
	locks.ConvFailures.Lock()
	defer locks.ConvFailures.Unlock()
	defer f.maybeNukeFn(func() Error { return err }, f.dbKey())

	var failures []ConversationFailureRecord
	_, ierr := f.readDiskBox(ctx, f.dbKey(), &failures)
	if ierr != nil {
		return NewInternalError(ctx, f.DebugLabeler,
			"failed to read conversation failure box: uid: %s err: %s", f.uid, ierr.Error())
	}

	var newFailures []ConversationFailureRecord
	found := false
	for _, failure := range failures {
		if failure.ConvID.Eq(convID) {
			found = true
			failure.Attempts++
			failure.LastAttempt = gregor1.ToTime(f.clock.Now())
			f.Debug(ctx, "Failure: incrementing failure: convID: %s attempt: %d time: %v",
				failure.ConvID, failure.Attempts, gregor1.FromTime(failure.LastAttempt))
		}
		newFailures = append(newFailures, failure)
	}
	if !found {
		f.Debug(ctx, "Failure: adding new conversation: convID: %s", convID)
		newFailures = append(newFailures, ConversationFailureRecord{
			ConvID:      convID,
			LastAttempt: gregor1.ToTime(f.clock.Now()),
			Attempts:    1,
		})
	}

	if err := f.writeDiskBox(ctx, f.dbKey(), newFailures); err != nil {
		return NewInternalError(ctx, f.DebugLabeler,
			"failed to write conversation failure box: uid: %s err: %s", f.uid, err.Error())
	}

	return nil
}

func (f *ConversationFailureBox) Success(ctx context.Context, convID chat1.ConversationID) (err Error) {
	locks.ConvFailures.Lock()
	defer locks.ConvFailures.Unlock()
	defer f.maybeNukeFn(func() Error { return err }, f.dbKey())

	var failures []ConversationFailureRecord
	_, ierr := f.readDiskBox(ctx, f.dbKey(), &failures)
	if ierr != nil {
		return NewInternalError(ctx, f.DebugLabeler,
			"failed to read conversation failure box: uid: %s err: %s", f.uid, ierr.Error())
	}

	var newFailures []ConversationFailureRecord
	for _, failure := range failures {
		if failure.ConvID.Eq(convID) {
			f.Debug(ctx, "Success: removing conversation: %s from failure list", convID)
			continue
		}
		newFailures = append(newFailures, failure)
	}

	if err := f.writeDiskBox(ctx, f.dbKey(), newFailures); err != nil {
		return NewInternalError(ctx, f.DebugLabeler,
			"failed to write conversation failure box: uid: %s err: %s", f.uid, err.Error())
	}

	return nil
}

func (f *ConversationFailureBox) Read(ctx context.Context) (res []ConversationFailureRecord, err Error) {
	locks.ConvFailures.Lock()
	defer locks.ConvFailures.Unlock()
	defer f.maybeNukeFn(func() Error { return err }, f.dbKey())

	var failures []ConversationFailureRecord
	_, ierr := f.readDiskBox(ctx, f.dbKey(), &failures)
	if ierr != nil {
		return nil, NewInternalError(ctx, f.DebugLabeler,
			"failed to read conversation failure box: uid: %s err: %s", f.uid, ierr.Error())
	}

	for _, failure := range failures {
		res = append(res, failure)
	}

	return res, nil
}
