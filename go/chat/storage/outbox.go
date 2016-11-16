package storage

import (
	"fmt"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Outbox struct {
	sync.Mutex
	libkb.Contextified
	*baseBox

	uid gregor1.UID
}

const outboxVersion = 1

type diskOutbox struct {
	Version int                  `codec:"V"`
	Records []chat1.OutboxRecord `codec:"O"`
}

func NewOutbox(g *libkb.GlobalContext, uid gregor1.UID, getSecretUI func() libkb.SecretUI) *Outbox {
	return &Outbox{
		Contextified: libkb.NewContextified(g),
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

func (o *Outbox) maybeNuke(err libkb.ChatStorageError) libkb.ChatStorageError {
	if err.ShouldClear() {
		if err := o.G().LocalChatDb.Delete(o.dbKey()); err != nil {
			o.G().Log.Error("unable to clear inbox on error! err: %s", err.Error())
		}
	}
	return err
}

func (o *Outbox) readDiskOutbox() (diskOutbox, libkb.ChatStorageError) {
	var obox diskOutbox
	found, err := o.readDiskBox(o.dbKey(), &obox)
	if err != nil {
		return obox, libkb.NewChatStorageInternalError(o.G(), "failure to read chat outbox: %s",
			err.Error())
	}
	if !found {
		return obox, libkb.ChatStorageMissError{}
	}
	if obox.Version > outboxVersion {
		return obox, libkb.NewChatStorageInternalError(o.G(),
			"invalid outbox version: %d (current: %d)", obox.Version, outboxVersion)
	}
	return obox, nil
}

func (o *Outbox) PushMessage(convID chat1.ConversationID, msg chat1.MessagePlaintext) (chat1.OutboxID, libkb.ChatStorageError) {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox()
	if err != nil {
		if _, ok := err.(libkb.ChatStorageMissError); !ok {
			return nil, o.maybeNuke(err)
		}
		obox = diskOutbox{
			Version: outboxVersion,
			Records: []chat1.OutboxRecord{},
		}
	}

	// Generate new outbox ID
	rbs, ierr := libkb.RandBytes(8)
	if ierr != nil {
		return nil, o.maybeNuke(libkb.NewChatStorageInternalError(o.G(),
			"error getting outboxID: err: %s", ierr.Error()))
	}

	// Append record
	outboxID := chat1.OutboxID(rbs)
	msg.ClientHeader.OutboxID = &outboxID
	obox.Records = append(obox.Records, chat1.OutboxRecord{
		Msg:      msg,
		ConvID:   convID,
		OutboxID: outboxID,
	})

	// Write out box
	obox.Version = outboxVersion
	if err := o.writeDiskBox(o.dbKey(), obox); err != nil {
		return nil, o.maybeNuke(libkb.NewChatStorageInternalError(o.G(),
			"error writing outbox: err: %s", err.Error()))
	}

	return outboxID, nil
}

func (o *Outbox) PullAllConversations() ([]chat1.OutboxRecord, error) {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox()
	if err != nil {
		return nil, o.maybeNuke(err)
	}

	return obox.Records, nil
}

func (o *Outbox) PullConversation(convID chat1.ConversationID) ([]chat1.OutboxRecord, error) {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox()
	if err != nil {
		return nil, o.maybeNuke(err)
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
		return o.maybeNuke(libkb.NewChatStorageInternalError(o.G(),
			"error reading outbox: err: %s", err.Error()))
	}

	// Pop N off front
	obox.Records = obox.Records[n:]

	// Write out box
	obox.Version = outboxVersion
	if err := o.writeDiskBox(o.dbKey(), obox); err != nil {
		return o.maybeNuke(libkb.NewChatStorageInternalError(o.G(),
			"error writing outbox: err: %s", err.Error()))
	}

	return nil
}

func (o *Outbox) RemoveMessage(obid chat1.OutboxID) error {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox()
	if err != nil {
		return o.maybeNuke(libkb.NewChatStorageInternalError(o.G(),
			"error reading outbox: err: %s", err.Error()))
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
		return o.maybeNuke(libkb.NewChatStorageInternalError(o.G(),
			"error writing outbox: err: %s", err.Error()))
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

	thread.Messages = res
	return nil
}

func (o *Outbox) SprinkleIntoThread(convID chat1.ConversationID, thread *chat1.ThreadView) error {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox()
	if err != nil {
		return o.maybeNuke(err)
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
