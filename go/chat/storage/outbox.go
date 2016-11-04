package storage

import (
	"fmt"
	"sync"

	"golang.org/x/crypto/nacl/secretbox"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Outbox struct {
	sync.Mutex
	libkb.Contextified

	uid         gregor1.UID
	getSecretUI func() libkb.SecretUI
}

const outboxVersion = 1

type diskOutbox struct {
	Version int                  `codec:"V"`
	Records []chat1.OutboxRecord `codec:"O"`
}

type boxedOutbox struct {
	V int
	N [24]byte
	E []byte
}

func NewOutbox(g *libkb.GlobalContext, uid gregor1.UID, getSecretUI func() libkb.SecretUI) *Outbox {
	return &Outbox{
		Contextified: libkb.NewContextified(g),
		getSecretUI:  getSecretUI,
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

func (o *Outbox) readDiskOutbox() (res diskOutbox, err error) {
	key := o.dbKey()
	b, found, err := o.G().LocalChatDb.GetRaw(key)
	if err != nil {
		return res, err
	}
	if !found {
		return res, nil
	}

	// Decode encrypted box
	var boxed boxedOutbox
	if err := decode(b, &boxed); err != nil {
		return res, err
	}
	if boxed.V > cryptoVersion {
		return res, fmt.Errorf("bad crypto version: %d current: %d", boxed.V,
			cryptoVersion)
	}
	enckey, err := getSecretBoxKey(o.G(), o.getSecretUI)
	if err != nil {
		return res, err
	}
	pt, ok := secretbox.Open(nil, boxed.E, &boxed.N, &enckey)
	if !ok {
		return res, fmt.Errorf("failed to decrypt outbox")
	}
	if err = decode(pt, &res); err != nil {
		return res, err
	}
	if res.Version > outboxVersion {
		return res, fmt.Errorf("invalid version of outbox")
	}

	return res, nil
}

func (o *Outbox) writeDiskOutbox(outbox diskOutbox) error {
	key := o.dbKey()

	// Encode outbox
	outbox.Version = outboxVersion
	dat, err := encode(outbox)
	if err != nil {
		return err
	}

	// Encrypt outbox
	enckey, err := getSecretBoxKey(o.G(), o.getSecretUI)
	if err != nil {
		return err
	}
	var nonce []byte
	nonce, err = libkb.RandBytes(24)
	if err != nil {
		return err
	}
	var fnonce [24]byte
	copy(fnonce[:], nonce)
	sealed := secretbox.Seal(nil, dat, &fnonce, &enckey)
	boxed := boxedBlock{
		V: cryptoVersion,
		E: sealed,
		N: fnonce,
	}

	// Encode encrypted outbox
	if dat, err = encode(boxed); err != nil {
		return err
	}

	// Write out
	if err = o.G().LocalChatDb.PutRaw(key, dat); err != nil {
		return err
	}

	return nil
}

func (o *Outbox) maybeNuke(err libkb.ChatStorageError) libkb.ChatStorageError {
	if err.ShouldClear() {
		if err := o.G().LocalChatDb.Delete(o.dbKey()); err != nil {
			o.G().Log.Error("unable to clear inbox on error! err: %s", err.Error())
		}
	}
	return err
}

func (o *Outbox) PushMessage(convID chat1.ConversationID, msg chat1.MessagePlaintext) (chat1.OutboxID, libkb.ChatStorageError) {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox()
	if err != nil {
		return nil, o.maybeNuke(libkb.NewChatStorageInternalError(o.G(),
			"error reading outbox: err: %s", err.Error()))
	}

	// Generate new outbox ID
	var outboxID chat1.OutboxID
	outboxID, err = libkb.RandBytes(8)
	if err != nil {
		return nil, o.maybeNuke(libkb.NewChatStorageInternalError(o.G(),
			"error getting outboxID: err: %s", err.Error()))
	}

	// Append record
	msg.ClientHeader.OutboxID = &outboxID
	obox.Records = append(obox.Records, chat1.OutboxRecord{
		Msg:      msg,
		ConvID:   convID,
		OutboxID: outboxID,
	})

	// Write out box
	if err := o.writeDiskOutbox(obox); err != nil {
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
		return nil, o.maybeNuke(libkb.NewChatStorageInternalError(o.G(),
			"error reading outbox: err: %s", err.Error()))
	}

	return obox.Records, nil
}

func (o *Outbox) PullConversation(convID chat1.ConversationID) ([]chat1.OutboxRecord, error) {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox()
	if err != nil {
		return nil, o.maybeNuke(libkb.NewChatStorageInternalError(o.G(),
			"error reading outbox: err: %s", err.Error()))
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
	if err := o.writeDiskOutbox(obox); err != nil {
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
	if err := o.writeDiskOutbox(obox); err != nil {
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

func (o *Outbox) SprinkleIntoThread(thread *chat1.ThreadView) error {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readDiskOutbox()
	if err != nil {
		return o.maybeNuke(libkb.NewChatStorageInternalError(o.G(), "error reading outbox: err: %s",
			err.Error()))
	}

	// Sprinkle each outbox message in
	for _, obr := range obox.Records {
		if err := o.insertMessage(thread, obr); err != nil {
			return err
		}
	}

	return nil
}
