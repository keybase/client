package storage

import (
	"fmt"
	"sync"

	"github.com/keybase/client/go/chat/pager"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/go-codec/codec"
	"golang.org/x/net/context"
)

type resultCollector interface {
	push(msg chat1.MessageUnboxed)
	done() bool
	result() []chat1.MessageUnboxed
	String() string
}

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
		msgs []chat1.MessageUnboxed) libkb.ChatStorageError
	readMessages(ctx context.Context, res resultCollector,
		convID chat1.ConversationID, uid gregor1.UID, maxID chat1.MessageID) libkb.ChatStorageError
	getMaxMessageID(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (
		chat1.MessageID, libkb.ChatStorageError)
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

// simpleResultCollector aggregates all results in a the basic way. It is not thread safe.
type simpleResultCollector struct {
	res    []chat1.MessageUnboxed
	target int
}

func (s *simpleResultCollector) push(msg chat1.MessageUnboxed) {
	s.res = append(s.res, msg)
}

func (s *simpleResultCollector) done() bool {
	return len(s.res) >= s.target
}

func (s *simpleResultCollector) result() []chat1.MessageUnboxed {
	return s.res
}

func (s *simpleResultCollector) String() string {
	return fmt.Sprintf("[ simple: t: %d c: %d]", s.target, len(s.res))
}

func newSimpleResultCollector(num int) *simpleResultCollector {
	return &simpleResultCollector{
		target: num,
	}
}

// typedResultCollector aggregates results with a type contraints. It is not thread safe.
type typedResultCollector struct {
	res         []chat1.MessageUnboxed
	target, cur int
	typmap      map[chat1.MessageType]bool
}

func newTypedResultCollector(num int, typs []chat1.MessageType) *typedResultCollector {
	c := typedResultCollector{
		target: num,
		typmap: make(map[chat1.MessageType]bool),
	}
	for _, typ := range typs {
		c.typmap[typ] = true
	}
	return &c
}

func (t *typedResultCollector) push(msg chat1.MessageUnboxed) {
	t.res = append(t.res, msg)
	if t.typmap[msg.GetMessageType()] {
		t.cur++
	}
}

func (t *typedResultCollector) done() bool {
	return t.cur >= t.target
}

func (t *typedResultCollector) result() []chat1.MessageUnboxed {
	return t.res
}

func (t *typedResultCollector) String() string {
	return fmt.Sprintf("[ typed: t: %d c: %d (%d types) ]", t.target, t.cur, len(t.typmap))
}

func (s *Storage) debug(format string, args ...interface{}) {
	s.G().Log.Debug("+ chatstorage: "+format, args...)
}

func (s *Storage) MaybeNuke(force bool, err libkb.ChatStorageError, convID chat1.ConversationID, uid gregor1.UID) libkb.ChatStorageError {
	// Clear index
	if force || err.ShouldClear() {
		s.G().Log.Warning("chat local storage corrupted: clearing")
		if err := s.G().LocalChatDb.Delete(makeBlockIndexKey(convID, uid)); err != nil {
			s.G().Log.Error("failed to delete chat index, clearing entire database (delete error: %s)", err)
			if _, err = s.G().LocalChatDb.Nuke(); err != nil {
				panic("unable to clear local storage")
			}
		}
	}
	return err
}

func (s *Storage) Merge(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, msgs []chat1.MessageUnboxed) libkb.ChatStorageError {
	// All public functions get locks to make access to the database single threaded.
	// They should never be called from private functons.
	s.Lock()
	defer s.Unlock()

	var err libkb.ChatStorageError
	s.debug("Merge: convID: %s uid: %s num msgs: %d", convID, uid, len(msgs))

	// Fetch secret key
	key, ierr := getSecretBoxKey(s.G(), s.getSecretUI)
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

// getSupersedes must be called with a valid msg
func (s *Storage) getSupersedes(msg chat1.MessageUnboxed) ([]chat1.MessageID, libkb.ChatStorageError) {
	body := msg.Valid().MessageBody
	typ, err := (&body).MessageType()
	if err != nil {
		return nil, libkb.NewChatStorageInternalError(s.G(), "invalid msg: %s", err.Error())
	}

	// We use the message ID in the body over the field in the client header to avoid server trust.
	switch typ {
	case chat1.MessageType_EDIT:
		return []chat1.MessageID{msg.Valid().MessageBody.Edit().MessageID}, nil
	case chat1.MessageType_DELETE:
		return msg.Valid().MessageBody.Delete().MessageIDs, nil
	default:
		return nil, nil
	}
}

func (s *Storage) updateAllSupersededBy(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgs []chat1.MessageUnboxed) libkb.ChatStorageError {

	s.debug("updateSupersededBy: num msgs: %d", len(msgs))
	// Do a pass over all the messages and update supersededBy pointers
	for _, msg := range msgs {

		msgid := msg.GetMessageID()
		if !msg.IsValid() {
			s.debug("updateSupersededBy: skipping potential superseder marked as error: %d", msgid)
			continue
		}

		superIDs, err := s.getSupersedes(msg)
		if err != nil {
			continue
		}
		s.debug("updateSupersededBy: supersedes: %v", superIDs)

		// Set all supersedes targets
		for _, superID := range superIDs {
			s.debug("updateSupersededBy: supersedes: id: %d supersedes: %d", msgid, superID)
			// Read super msg
			var superMsgs []chat1.MessageUnboxed
			rc := newSimpleResultCollector(1)
			err = s.engine.readMessages(ctx, rc, convID, uid, superID)
			if err != nil {
				// If we don't have the message, just keep going
				if _, ok := err.(libkb.ChatStorageMissError); ok {
					continue
				}
				return err
			}
			superMsgs = rc.result()
			if len(superMsgs) == 0 {
				continue
			}

			// Update supersededBy on the target message if we have it
			superMsg := superMsgs[0]
			if superMsg.IsValid() {
				s.debug("updateSupersededBy: writing: id: %d superseded: %d", msgid, superID)
				mvalid := superMsg.Valid()
				mvalid.ServerHeader.SupersededBy = msgid
				superMsgs[0] = chat1.NewMessageUnboxedWithValid(mvalid)
				if err = s.engine.writeMessages(ctx, convID, uid, superMsgs); err != nil {
					return err
				}
			} else {
				s.debug("updateSupersededBy: skipping id: %d, it is stored as an error",
					superMsg.GetMessageID())
			}
		}
	}

	return nil
}

func (s *Storage) fetchUpToMsgIDLocked(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgID chat1.MessageID, query *chat1.GetThreadQuery, pagination *chat1.Pagination) (chat1.ThreadView, libkb.ChatStorageError) {
	// Fetch secret key
	key, ierr := getSecretBoxKey(s.G(), s.getSecretUI)
	if ierr != nil {
		return chat1.ThreadView{},
			libkb.ChatStorageMiscError{Msg: "unable to get secret key: " + ierr.Error()}
	}

	// Init storage engine first
	var err libkb.ChatStorageError
	ctx, err = s.engine.init(ctx, key, convID, uid)
	if err != nil {
		return chat1.ThreadView{}, s.MaybeNuke(false, err, convID, uid)
	}

	// Calculate seek parameters
	var maxID chat1.MessageID
	var num int
	if pagination == nil {
		maxID = msgID
		num = 10000
	} else {
		var pid chat1.MessageID
		num = pagination.Num
		if len(pagination.Next) == 0 && len(pagination.Previous) == 0 {
			maxID = msgID
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
	var rc resultCollector
	if query != nil && len(query.MessageTypes) > 0 {
		rc = newTypedResultCollector(num, query.MessageTypes)
	} else {
		rc = newSimpleResultCollector(num)
	}
	s.debug("Fetch: using result collector: %s", rc)

	// Run seek looking for all the messages
	var res []chat1.MessageUnboxed
	if err = s.engine.readMessages(ctx, rc, convID, uid, maxID); err != nil {
		return chat1.ThreadView{}, err
	}
	res = rc.result()

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

func (s *Storage) FetchUpToLocalMaxMsgID(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, query *chat1.GetThreadQuery, pagination *chat1.Pagination) (chat1.ThreadView, libkb.ChatStorageError) {
	// All public functions get locks to make access to the database single threaded.
	// They should never be called from private functons.
	s.Lock()
	defer s.Unlock()

	maxMsgID, err := s.engine.getMaxMessageID(ctx, convID, uid)
	if err != nil {
		return chat1.ThreadView{}, err
	}

	return s.fetchUpToMsgIDLocked(ctx, convID, uid, maxMsgID, query, pagination)
}

func (s *Storage) Fetch(ctx context.Context, conv chat1.Conversation,
	uid gregor1.UID, query *chat1.GetThreadQuery, pagination *chat1.Pagination) (chat1.ThreadView, libkb.ChatStorageError) {
	// All public functions get locks to make access to the database single threaded.
	// They should never be called from private functons.
	s.Lock()
	defer s.Unlock()

	return s.fetchUpToMsgIDLocked(ctx, conv.Metadata.ConversationID, uid, conv.ReaderInfo.MaxMsgid, query, pagination)
}
