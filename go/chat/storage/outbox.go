package storage

import (
	"fmt"
	"sync"

	"golang.org/x/crypto/nacl/secretbox"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
)

type Outbox struct {
	sync.Mutex
	libkb.Contextified

	getSecretUI func() libkb.SecretUI
}

type boxedOutbox struct {
	V int
	N [24]byte
	E []byte
}

func NewOutbox(g *libkb.GlobalContext, getSecretUI func() libkb.SecretUI) *Outbox {
	return &Outbox{
		Contextified: libkb.NewContextified(g),
		getSecretUI:  getSecretUI,
	}
}

func (o *Outbox) dbKey() libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatOutbox,
		Key: "ob",
	}
}

func (o *Outbox) readBox() ([]chat1.OutboxRecord, error) {
	key := o.dbKey()
	b, found, err := o.G().LocalChatDb.GetRaw(key)
	if err != nil {
		return nil, err
	}
	if !found {
		return []chat1.OutboxRecord{}, nil
	}

	// Decode encrypted box
	var boxed boxedOutbox
	if err := decode(b, &boxed); err != nil {
		return nil, err
	}
	if boxed.V > cryptoVersion {
		return []chat1.OutboxRecord{}, fmt.Errorf("bad crypto version: %d current: %d", boxed.V,
			cryptoVersion)
	}
	enckey, err := getSecretBoxKey(o.G(), o.getSecretUI)
	if err != nil {
		return []chat1.OutboxRecord{}, err
	}
	pt, ok := secretbox.Open(nil, boxed.E, &boxed.N, &enckey)
	if !ok {
		return []chat1.OutboxRecord{}, fmt.Errorf("failed to decrypt outbox")
	}
	var res []chat1.OutboxRecord
	if err = decode(pt, &res); err != nil {
		return []chat1.OutboxRecord{}, err
	}

	return res, nil
}

func (o *Outbox) writeBox(outbox []chat1.OutboxRecord) error {
	key := o.dbKey()

	// Encode outbox
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

func (o *Outbox) Push(convID chat1.ConversationID, msg chat1.MessagePlaintext) (chat1.OutboxID, libkb.ChatStorageError) {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readBox()
	if err != nil {
		return nil, o.maybeNuke(libkb.NewChatStorageInternalError(o.G(),
			"error reading outbox: err: %s", err.Error()))
	}

	// Generate new outbox ID
	var outboxID chat1.OutboxID
	outboxID, err = libkb.RandBytes(16)
	if err != nil {
		return nil, o.maybeNuke(libkb.NewChatStorageInternalError(o.G(),
			"error getting outboxID: err: %s", err.Error()))
	}

	// Append record
	obox = append(obox, chat1.OutboxRecord{
		Msg:      msg,
		ConvID:   convID,
		OutboxID: outboxID,
	})

	// Write out box
	if err := o.writeBox(obox); err != nil {
		return nil, o.maybeNuke(libkb.NewChatStorageInternalError(o.G(),
			"error writing outbox: err: %s", err.Error()))
	}

	return outboxID, nil
}

func (o *Outbox) Pull() ([]chat1.OutboxRecord, error) {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readBox()
	if err != nil {
		return nil, o.maybeNuke(libkb.NewChatStorageInternalError(o.G(),
			"error reading outbox: err: %s", err.Error()))
	}

	return obox, nil
}

func (o *Outbox) PullConv(convID chat1.ConversationID) ([]chat1.OutboxRecord, error) {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readBox()
	if err != nil {
		return nil, o.maybeNuke(libkb.NewChatStorageInternalError(o.G(),
			"error reading outbox: err: %s", err.Error()))
	}

	var res []chat1.OutboxRecord
	for _, obr := range obox {
		if obr.ConvID.Eq(convID) {
			res = append(res, obr)
		}
	}
	return res, nil
}

func (o *Outbox) PopN(n int) error {
	o.Lock()
	defer o.Unlock()

	// Read outbox for the user
	obox, err := o.readBox()
	if err != nil {
		return o.maybeNuke(libkb.NewChatStorageInternalError(o.G(),
			"error reading outbox: err: %s", err.Error()))
	}

	// Pop N off front
	obox = obox[n:]

	// Write out box
	if err := o.writeBox(obox); err != nil {
		return o.maybeNuke(libkb.NewChatStorageInternalError(o.G(),
			"error writing outbox: err: %s", err.Error()))
	}

	return nil
}
