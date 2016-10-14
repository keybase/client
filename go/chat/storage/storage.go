package storage

import (
	"fmt"
	"sync"

	"github.com/keybase/client/go/chat/pager"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/go-codec/codec"
	"golang.org/x/net/context"
)

// ***
// If we change this, make sure to update libkb.EncryptionReasonChatLocalStorage as well!
// ***
const cryptoVersion = 1

type Storage struct {
	sync.Mutex
	libkb.Contextified
	getSecretUI func() libkb.SecretUI
	engine      storageEngine
}

type storageEngine interface {
	init(ctx context.Context, key [32]byte, convID chat1.ConversationID,
		uid gregor1.UID) (context.Context, libkb.ChatStorageError)
	writeMessages(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
		msgs []chat1.MessageFromServerOrError) libkb.ChatStorageError
	readMessages(ctx context.Context, res *[]chat1.MessageFromServerOrError,
		convID chat1.ConversationID, uid gregor1.UID, maxID chat1.MessageID, num int,
		df doneFunc) libkb.ChatStorageError
}

func New(g *libkb.GlobalContext, getSecretUI func() libkb.SecretUI) *Storage {
	return &Storage{
		Contextified: libkb.NewContextified(g),
		getSecretUI:  getSecretUI,
		engine:       newBlockEngine(g),
	}
}

func (s *Storage) setEngine(engine storageEngine) {
	s.engine = engine
}

func makeBlockIndexKey(convID chat1.ConversationID, uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatBlockIndex,
		Key: fmt.Sprintf("bi:%s:%s", uid, convID),
	}
}

func encode(input interface{}) ([]byte, error) {
	mh := codec.MsgpackHandle{WriteExt: true}
	var data []byte
	enc := codec.NewEncoderBytes(&data, &mh)
	if err := enc.Encode(input); err != nil {
		return nil, err
	}
	return data, nil
}

func decode(data []byte, res interface{}) error {
	mh := codec.MsgpackHandle{WriteExt: true}
	dec := codec.NewDecoderBytes(data, &mh)
	err := dec.Decode(res)
	return err
}

func simpleDone(msgs *[]chat1.MessageFromServerOrError, num int) bool {
	return len(*msgs) >= num
}

func (s *Storage) debug(format string, args ...interface{}) {
	s.G().Log.Debug("+ chatstorage: "+format, args...)
}

func (s *Storage) MaybeNuke(force bool, err libkb.ChatStorageError, convID chat1.ConversationID, uid gregor1.UID) libkb.ChatStorageError {
	// Clear index
	if force || err.ShouldClear() {
		s.G().Log.Warning("chat local storage corrupted: clearing")
		if err := s.G().LocalDb.Delete(makeBlockIndexKey(convID, uid)); err != nil {
			s.G().Log.Error("failed to delete chat index, clearing entire database")
			if _, err = s.G().LocalDb.Nuke(); err != nil {
				panic("unable to clear local storage")
			}
		}
	}
	return err
}

func (s *Storage) Merge(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, msgs []chat1.MessageFromServerOrError) libkb.ChatStorageError {
	// All public functions get locks to make access to the database single threaded.
	// They should never be called from private functons.
	s.Lock()
	defer s.Unlock()

	var err libkb.ChatStorageError
	s.debug("Merge: convID: %d uid: %s num msgs: %d", convID, uid, len(msgs))

	// Fetch secret key
	key, ierr := s.getSecretBoxKey()
	if ierr != nil {
		return libkb.ChatStorageMiscError{Msg: "unable to get secret key: " + ierr.Error()}
	}

	ctx, err = s.engine.init(ctx, key, convID, uid)
	if err != nil {
		return err
	}

	// Write out new data into blocks
	if err = s.engine.writeMessages(ctx, convID, uid, msgs); err != nil {
		return s.MaybeNuke(false, err, convID, uid)
	}

	// Update supersededBy pointers
	if err = s.updateAllSupersededBy(ctx, convID, uid, msgs); err != nil {
		return s.MaybeNuke(false, err, convID, uid)
	}

	return nil
}

func (s *Storage) updateAllSupersededBy(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgs []chat1.MessageFromServerOrError) libkb.ChatStorageError {

	s.debug("updateSupersededBy: num msgs: %d", len(msgs))
	// Do a pass over all the messages and update supersededBy pointers
	for _, msg := range msgs {

		msgid := msg.GetMessageID()
		if msg.UnboxingError != nil {
			s.debug("updateSupersededBy: skipping potential superseder marked as error: %d", msgid)
			continue
		}

		superID := msg.Message.MessagePlaintext.V1().ClientHeader.Supersedes
		if superID == 0 {
			continue
		}

		s.debug("updateSupersededBy: supersedes: id: %d supersedes: %d", msgid, superID)
		// Read super msg
		var superMsgs []chat1.MessageFromServerOrError
		err := s.engine.readMessages(ctx, &superMsgs, convID, uid, superID, 1, simpleDone)
		if err != nil {
			// If we don't have the message, just keep going
			if _, ok := err.(libkb.ChatStorageMissError); ok {
				continue
			}
			return err
		}
		if len(superMsgs) == 0 {
			continue
		}

		// Update supersededBy on the target message if we have it
		superMsg := &superMsgs[0]
		if superMsg.Message != nil {
			s.debug("updateSupersededBy: writing: id: %d superseded: %d", msgid, superID)
			superMsg.Message.ServerHeader.SupersededBy = msgid
			if err = s.engine.writeMessages(ctx, convID, uid, superMsgs); err != nil {
				return err
			}
		} else {
			s.debug("updateSupersededBy: skipping id: %d, it is stored as an error",
				superMsg.GetMessageID())
		}
	}

	return nil
}

func (s *Storage) getSecretBoxKey() (fkey [32]byte, err error) {
	// Get secret device key
	encKey, err := engine.GetMySecretKey(s.G(), s.getSecretUI, libkb.DeviceEncryptionKeyType,
		"encrypt chat message")
	if err != nil {
		return fkey, err
	}
	kp, ok := encKey.(libkb.NaclDHKeyPair)
	if !ok || kp.Private == nil {
		return fkey, libkb.KeyCannotDecryptError{}
	}

	// Derive symmetric key from device key
	skey, err := encKey.SecretSymmetricKey(libkb.EncryptionReasonChatLocalStorage)
	if err != nil {
		return fkey, err
	}

	copy(fkey[:], skey)
	return fkey, nil
}

type doneFunc func(*[]chat1.MessageFromServerOrError, int) bool

func (s *Storage) Fetch(ctx context.Context, conv chat1.Conversation,
	uid gregor1.UID, query *chat1.GetThreadQuery, pagination *chat1.Pagination,
	rl *[]*chat1.RateLimit) (chat1.ThreadView, libkb.ChatStorageError) {
	// All public functions get locks to make access to the database single threaded.
	// They should never be called from private functons.
	s.Lock()
	defer s.Unlock()

	// Fetch secret key
	key, ierr := s.getSecretBoxKey()
	if ierr != nil {
		return chat1.ThreadView{},
			libkb.ChatStorageMiscError{Msg: "unable to get secret key: " + ierr.Error()}
	}

	// Init storage engine first
	var err libkb.ChatStorageError
	convID := conv.Metadata.ConversationID
	ctx, err = s.engine.init(ctx, key, convID, uid)
	if err != nil {
		return chat1.ThreadView{}, s.MaybeNuke(false, err, convID, uid)
	}

	// Calculate seek parameters
	var maxID chat1.MessageID
	var num int
	if pagination == nil {
		maxID = conv.ReaderInfo.MaxMsgid
		num = 10000
	} else {
		var pid chat1.MessageID
		num = pagination.Num
		if len(pagination.Next) == 0 && len(pagination.Previous) == 0 {
			maxID = conv.ReaderInfo.MaxMsgid
		} else if len(pagination.Next) > 0 {
			if derr := decode(pagination.Next, &pid); derr != nil {
				err = libkb.ChatStorageRemoteError{Msg: "Fetch: failed to decode pager: " + derr.Error()}
				return chat1.ThreadView{}, s.MaybeNuke(false, err, convID, uid)
			}
			maxID = pid - 1
		} else {
			if derr := decode(pagination.Previous, &pid); derr != nil {
				err = libkb.ChatStorageRemoteError{Msg: "Fetch: failed to decode pager: " + derr.Error()}
				return chat1.ThreadView{}, s.MaybeNuke(false, err, convID, uid)
			}
			maxID = chat1.MessageID(int(pid) + num)
		}
	}
	s.debug("Fetch: maxID: %d num: %d", maxID, num)

	// Figure out how to determine we are done seeking
	var df doneFunc
	var typmap map[chat1.MessageType]bool
	if query != nil && len(query.MessageTypes) > 0 {
		typmap = make(map[chat1.MessageType]bool)
		for _, mt := range query.MessageTypes {
			typmap[mt] = true
		}
	}
	typedDoneFunc := func(msgs *[]chat1.MessageFromServerOrError, num int) bool {
		count := 0
		for _, msg := range *msgs {
			if _, ok := typmap[msg.GetMessageType()]; ok {
				count++
			}
		}
		return count >= num
	}
	if len(typmap) > 0 {
		s.debug("Fetch: using typed done function: types: %d", len(typmap))
		df = typedDoneFunc
	} else {
		s.debug("Fetch: using simple done function")
		df = simpleDone
	}

	// Run seek looking for all the messages
	var res []chat1.MessageFromServerOrError
	if err = s.engine.readMessages(ctx, &res, convID, uid, maxID, num, df); err != nil {
		return chat1.ThreadView{}, err
	}

	// Form paged result
	var tres chat1.ThreadView
	var pmsgs []pager.Message
	for _, m := range res {
		pmsgs = append(pmsgs, m)
	}
	if tres.Pagination, ierr = pager.NewThreadPager().MakePage(pmsgs, num); ierr != nil {
		return chat1.ThreadView{}, libkb.NewChatStorageInternalError(s.G(), "Fetch: failed to encode pager: %s", ierr.Error())
	}
	tres.Messages = res

	s.debug("Fetch: cache hit: num: %d", len(res))
	return tres, nil
}
