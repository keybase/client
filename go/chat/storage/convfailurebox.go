package storage

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

const maxConvAttempts = 10

type failureEntry struct {
	ConvID   chat1.ConversationID `codec:"C"`
	Attempts int                  `codec:"A"`
}

type ConversationFailureBox struct {
	libkb.Contextified
	*baseBox
	utils.DebugLabeler

	uid gregor1.UID
	key string
}

func NewConversationFailureBox(g *libkb.GlobalContext, uid gregor1.UID, key string) *ConversationFailureBox {
	return &ConversationFailureBox{
		Contextified: libkb.NewContextified(g),
		baseBox:      newBaseBox(g),
		DebugLabeler: utils.NewDebugLabeler(g, "ConversationFailureBox", false),
		uid:          uid,
		key:          key,
	}
}

func (f *ConversationFailureBox) dbKey() libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatConvFailures,
		Key: fmt.Sprintf("%s:%s", f.uid, f.key),
	}
}

func (f *ConversationFailureBox) Failure(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID) (err Error) {
	locks.ConvFailures.Lock()
	defer locks.ConvFailures.Unlock()
	defer f.maybeNukeFn(func() Error { return err }, f.dbKey())

	var failures []failureEntry
	_, ierr := f.readDiskBox(ctx, f.dbKey(), &failures)
	if ierr != nil {
		return NewInternalError(ctx, f.DebugLabeler,
			"failed to read conversation failure box: uid: %s err: %", uid, ierr.Error())
	}

	var newFailures []failureEntry
	found := false
	for _, failure := range failures {
		if failure.ConvID.Eq(convID) {
			found = true
			failure.Attempts++
			if failure.Attempts > maxConvAttempts {
				f.Debug(ctx, "Failure: conversation: %s over max failures, dropping...", convID)
				continue
			}
		}
		newFailures = append(newFailures, failure)
	}
	if !found {
		newFailures = append(newFailures, failureEntry{
			ConvID: convID,
		})
	}

	if err := f.writeDiskBox(ctx, f.dbKey(), newFailures); err != nil {
		return NewInternalError(ctx, f.DebugLabeler,
			"failed to write conversation failure box: uid: %s err: %s", uid, err.Error())
	}

	return nil
}

func (f *ConversationFailureBox) Success(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID) (err Error) {
	locks.ConvFailures.Lock()
	defer locks.ConvFailures.Unlock()
	defer f.maybeNukeFn(func() Error { return err }, f.dbKey())

	var failures []failureEntry
	_, ierr := f.readDiskBox(ctx, f.dbKey(), &failures)
	if ierr != nil {
		return NewInternalError(ctx, f.DebugLabeler,
			"failed to read conversation failure box: uid: %s err: %", uid, ierr.Error())
	}

	var newFailures []failureEntry
	for _, failure := range failures {
		if failure.ConvID.Eq(convID) {
			f.Debug(ctx, "Success: removing conversation: %d from failure list", convID)
			continue
		}
		newFailures = append(newFailures, failure)
	}

	if err := f.writeDiskBox(ctx, f.dbKey(), newFailures); err != nil {
		return NewInternalError(ctx, f.DebugLabeler,
			"failed to write conversation failure box: uid: %s err: %s", uid, err.Error())
	}

	return nil
}
