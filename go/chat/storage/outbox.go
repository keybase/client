package storage

import (
	"fmt"
	"sync"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type Outbox struct {
	sync.Mutex
	libkb.Contextified
	*baseBox
	utils.DebugLabeler

	uid gregor1.UID
}

const outboxVersion = 2

type diskOutbox struct {
	Version int                  `codec:"V"`
	Records []chat1.OutboxRecord `codec:"O"`
}

func NewOutbox(g *libkb.GlobalContext, uid gregor1.UID, getSecretUI func() libkb.SecretUI) *Outbox {
	return &Outbox{
		Contextified: libkb.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "Outbox"),
		baseBox:      newBaseBox(g, getSecretUI),
		uid:          uid,
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

func (o *Outbox) readDiskOutbox() (diskOutbox, ChatStorageError) {
	var obox diskOutbox
	found, err := o.readDiskBox(o.dbKey(), &obox)
	if err != nil {
		return obox, NewChatStorageInternalError(o.DebugLabeler, "failure to read chat outbox: %s",
			err.Error())
	}
	if !found {
		return obox, ChatStorageMissError{}
	}
	if obox.Version > outboxVersion {
		return obox, NewChatStorageInternalError(o.DebugLabeler,
			"invalid outbox version: %d (current: %d)", obox.Version, outboxVersion)
	}
	return obox, nil
}

func (o *Outbox) PushMessage(convID chat1.ConversationID, msg chat1.MessagePlaintext,
	identifyBehavior keybase1.TLFIdentifyBehavior) (chat1.OutboxID, ChatStorageError) {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox()
	if err != nil {
		if _, ok := err.(ChatStorageMissError); !ok {
			return nil, o.maybeNuke(err, o.dbKey())
		}
		obox = diskOutbox{
			Version: outboxVersion,
			Records: []chat1.OutboxRecord{},
		}
	}

	// Generate new outbox ID
	rbs, ierr := libkb.RandBytes(8)
	if ierr != nil {
		return nil, o.maybeNuke(NewChatStorageInternalError(o.DebugLabeler,
			"error getting outboxID: err: %s", ierr.Error()), o.dbKey())
	}

	// Append record
	outboxID := chat1.OutboxID(rbs)
	msg.ClientHeader.OutboxID = &outboxID
	obox.Records = append(obox.Records, chat1.OutboxRecord{
		State:            chat1.NewOutboxStateWithSending(0),
		Msg:              msg,
		ConvID:           convID,
		OutboxID:         outboxID,
		IdentifyBehavior: identifyBehavior,
	})

	// Write out box
	obox.Version = outboxVersion
	if err := o.writeDiskBox(o.dbKey(), obox); err != nil {
		return nil, o.maybeNuke(NewChatStorageInternalError(o.DebugLabeler,
			"error writing outbox: err: %s", err.Error()), o.dbKey())
	}

	return outboxID, nil
}

func (o *Outbox) PullAllConversations() ([]chat1.OutboxRecord, error) {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox()
	if err != nil {
		return nil, o.maybeNuke(err, o.dbKey())
	}

	return obox.Records, nil
}

func (o *Outbox) PullConversation(convID chat1.ConversationID) ([]chat1.OutboxRecord, error) {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox()
	if err != nil {
		return nil, o.maybeNuke(err, o.dbKey())
	}

	var res []chat1.OutboxRecord
	for _, obr := range obox.Records {
		if obr.ConvID.Eq(convID) {
			res = append(res, obr)
		}
	}
	return res, nil
}

func (o *Outbox) PopNOldestMessages(n int) error {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox()
	if err != nil {
		return o.maybeNuke(err, o.dbKey())
	}

	// Pop N off front
	obox.Records = obox.Records[n:]

	// Write out box
	obox.Version = outboxVersion
	if err := o.writeDiskBox(o.dbKey(), obox); err != nil {
		return o.maybeNuke(NewChatStorageInternalError(o.DebugLabeler,
			"error writing outbox: err: %s", err.Error()), o.dbKey())
	}

	return nil
}

func (o *Outbox) RecordFailedAttempt(obid chat1.OutboxID) error {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox()
	if err != nil {
		return o.maybeNuke(err, o.dbKey())
	}

	// Loop through and find record
	var recs []chat1.OutboxRecord
	for _, obr := range obox.Records {
		if obr.OutboxID.Eq(obid) {
			state, err := obr.State.State()
			if err != nil {
				return err
			}
			if state == chat1.OutboxStateType_SENDING {
				obr.State = chat1.NewOutboxStateWithSending(obr.State.Sending() + 1)
			}
		}

		recs = append(recs, obr)
	}

	// Write out box
	obox.Records = recs
	if err := o.writeDiskBox(o.dbKey(), obox); err != nil {
		return o.maybeNuke(NewChatStorageInternalError(o.DebugLabeler,
			"error writing outbox: err: %s", err.Error()), o.dbKey())
	}

	return nil
}

func (o *Outbox) RetryMessage(obid chat1.OutboxID) error {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox()
	if err != nil {
		return o.maybeNuke(err, o.dbKey())
	}

	// Loop through and find record
	var recs []chat1.OutboxRecord
	for _, obr := range obox.Records {
		if obr.OutboxID.Eq(obid) {
			obr.State = chat1.NewOutboxStateWithSending(0)
		}
		recs = append(recs, obr)
	}

	// Write out box
	obox.Records = recs
	if err := o.writeDiskBox(o.dbKey(), obox); err != nil {
		return o.maybeNuke(NewChatStorageInternalError(o.DebugLabeler,
			"error writing outbox: err: %s", err.Error()), o.dbKey())
	}

	return nil
}

func (o *Outbox) MarkAllAsError(errRec chat1.OutboxStateError) ([]chat1.OutboxRecord, error) {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox()
	if err != nil {
		return nil, o.maybeNuke(err, o.dbKey())
	}

	// Loop through and find record
	var recs []chat1.OutboxRecord
	for _, obr := range obox.Records {
		state, err := obr.State.State()
		if err != nil || state == chat1.OutboxStateType_SENDING {
			obr.State = chat1.NewOutboxStateWithError(errRec)
		}
		recs = append(recs, obr)
	}

	// Write out box
	obox.Records = recs
	if err := o.writeDiskBox(o.dbKey(), obox); err != nil {
		return recs, o.maybeNuke(NewChatStorageInternalError(o.DebugLabeler,
			"error writing outbox: err: %s", err.Error()), o.dbKey())
	}

	return recs, nil
}

func (o *Outbox) MarkAsError(obid chat1.OutboxID, errRec chat1.OutboxStateError) error {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox()
	if err != nil {
		return o.maybeNuke(err, o.dbKey())
	}

	// Loop through and find record
	var recs []chat1.OutboxRecord
	for _, obr := range obox.Records {
		if obr.OutboxID.Eq(obid) {
			obr.State = chat1.NewOutboxStateWithError(errRec)
		}
		recs = append(recs, obr)
	}

	// Write out box
	obox.Records = recs
	if err := o.writeDiskBox(o.dbKey(), obox); err != nil {
		return o.maybeNuke(NewChatStorageInternalError(o.DebugLabeler,
			"error writing outbox: err: %s", err.Error()), o.dbKey())
	}

	return nil
}

func (o *Outbox) RemoveMessage(obid chat1.OutboxID) error {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox()
	if err != nil {
		return o.maybeNuke(err, o.dbKey())
	}

	// Scan to find the message and don't include it
	var recs []chat1.OutboxRecord
	for _, obr := range obox.Records {
		if !obr.OutboxID.Eq(obid) {
			recs = append(recs, obr)
		}
	}
	obox.Records = recs

	// Write out box
	if err := o.writeDiskBox(o.dbKey(), obox); err != nil {
		return o.maybeNuke(NewChatStorageInternalError(o.DebugLabeler,
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

func (o *Outbox) insertMessage(thread *chat1.ThreadView, obr chat1.OutboxRecord) error {
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
			o.G().Log.Debug("inserting at: %d msgID: %d", index, msg.GetMessageID())
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

func (o *Outbox) SprinkleIntoThread(convID chat1.ConversationID, thread *chat1.ThreadView) error {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox()
	if err != nil {
		return o.maybeNuke(err, o.dbKey())
	}

	// Sprinkle each outbox message in
	for _, obr := range obox.Records {
		if !obr.ConvID.Eq(convID) {
			continue
		}
		if err := o.insertMessage(thread, obr); err != nil {
			return err
		}
	}

	return nil
}
