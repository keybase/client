package storage

import (
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/pager"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"golang.org/x/net/context"
)

var maxFetchNum = 10000

type ResultCollector interface {
	Push(msg chat1.MessageUnboxed)
	PushEmpty(msg chat1.MessageUnboxed) bool
	Done() bool
	Result() []chat1.MessageUnboxed
	Error(err Error) Error
	Name() string

	String() string
}

type Storage struct {
	globals.Contextified
	utils.DebugLabeler

	engine       storageEngine
	idtracker    *msgIDTracker
	breakTracker *breakTracker
}

type storageEngine interface {
	Init(ctx context.Context, key [32]byte, convID chat1.ConversationID,
		uid gregor1.UID) (context.Context, Error)
	WriteMessages(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
		msgs []chat1.MessageUnboxed) Error
	ReadMessages(ctx context.Context, res ResultCollector,
		convID chat1.ConversationID, uid gregor1.UID, maxID chat1.MessageID) Error
}

func New(g *globals.Context) *Storage {
	return &Storage{
		Contextified: globals.NewContextified(g),
		engine:       newBlockEngine(g),
		idtracker:    newMsgIDTracker(g),
		breakTracker: newBreakTracker(g),
		DebugLabeler: utils.NewDebugLabeler(g, "Storage", false),
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

// SimpleResultCollector aggregates all results in a the basic way. It is not thread safe.
type SimpleResultCollector struct {
	res    []chat1.MessageUnboxed
	target int
}

func (s *SimpleResultCollector) Push(msg chat1.MessageUnboxed) {
	s.res = append(s.res, msg)
}

func (s *SimpleResultCollector) Done() bool {
	if s.target < 0 {
		return false
	}
	return len(s.res) >= s.target
}

func (s *SimpleResultCollector) Result() []chat1.MessageUnboxed {
	return s.res
}

func (s *SimpleResultCollector) Name() string {
	return "simple"
}

func (s *SimpleResultCollector) String() string {
	return fmt.Sprintf("[ %s: t: %d c: %d ]", s.Name(), s.target, len(s.res))
}

func (s *SimpleResultCollector) Error(err Error) Error {
	if s.target < 0 {
		// Swallow this error if we are not looking for a target
		if _, ok := err.(MissError); ok {
			return nil
		}
	}
	return err
}

func (s *SimpleResultCollector) PushEmpty(chat1.MessageUnboxed) bool {
	return false
}

func NewSimpleResultCollector(num int) *SimpleResultCollector {
	return &SimpleResultCollector{
		target: num,
	}
}

// TypedResultCollector aggregates results with a type contraints. It is not thread safe.
type TypedResultCollector struct {
	res         []chat1.MessageUnboxed
	target, cur int
	typmap      map[chat1.MessageType]bool
}

func NewTypedResultCollector(num int, typs []chat1.MessageType) *TypedResultCollector {
	c := TypedResultCollector{
		target: num,
		typmap: make(map[chat1.MessageType]bool),
	}
	for _, typ := range typs {
		c.typmap[typ] = true
	}
	return &c
}

func (t *TypedResultCollector) Push(msg chat1.MessageUnboxed) {
	t.res = append(t.res, msg)
	if t.typmap[msg.GetMessageType()] {
		t.cur++
	}
}

func (t *TypedResultCollector) Done() bool {
	if t.target < 0 {
		return false
	}
	return t.cur >= t.target
}

func (t *TypedResultCollector) Result() []chat1.MessageUnboxed {
	return t.res
}

func (t *TypedResultCollector) Name() string {
	return "typed"
}

func (t *TypedResultCollector) String() string {
	return fmt.Sprintf("[ %s: t: %d c: %d (%d types) ]", t.Name(), t.target, t.cur, len(t.typmap))
}

func (t *TypedResultCollector) Error(err Error) Error {
	if t.target < 0 {
		// Swallow this error if we are not looking for a target
		if _, ok := err.(MissError); ok {
			return nil
		}
	}
	return err
}

func (t *TypedResultCollector) PushEmpty(msg chat1.MessageUnboxed) bool {
	return false
}

type HoleyResultCollector struct {
	ResultCollector

	maxHoles, holes int
}

func NewHoleyResultCollector(maxHoles int, rc ResultCollector) *HoleyResultCollector {
	return &HoleyResultCollector{
		ResultCollector: rc,
		maxHoles:        maxHoles,
	}
}

func (h *HoleyResultCollector) PushEmpty(msg chat1.MessageUnboxed) bool {
	if h.holes >= h.maxHoles {
		return false
	}

	h.ResultCollector.Push(msg)
	h.holes++
	return true
}

func (s *Storage) MaybeNuke(force bool, err Error, convID chat1.ConversationID, uid gregor1.UID) Error {
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

func (s *Storage) GetMaxMsgID(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (chat1.MessageID, error) {
	locks.Storage.Lock()
	defer locks.Storage.Unlock()

	maxMsgID, err := s.idtracker.getMaxMessageID(ctx, convID, uid)
	if err != nil {
		return maxMsgID, s.MaybeNuke(false, err, convID, uid)
	}
	return maxMsgID, nil
}

func (s *Storage) Merge(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, msgs []chat1.MessageUnboxed) Error {
	// All public functions get locks to make access to the database single threaded.
	// They should never be called from private functons.
	locks.Storage.Lock()
	defer locks.Storage.Unlock()

	var err Error
	s.Debug(ctx, "Merge: convID: %s uid: %s num msgs: %d", convID, uid, len(msgs))

	// Fetch secret key
	key, ierr := getSecretBoxKey(ctx, s.G().ExternalG(), DefaultSecretUI)
	if ierr != nil {
		return MiscError{Msg: "unable to get secret key: " + ierr.Error()}
	}

	ctx, err = s.engine.Init(ctx, key, convID, uid)
	if err != nil {
		return err
	}

	// Write out new data into blocks
	if err = s.engine.WriteMessages(ctx, convID, uid, msgs); err != nil {
		return s.MaybeNuke(false, err, convID, uid)
	}

	// Update supersededBy pointers
	if err = s.updateAllSupersededBy(ctx, convID, uid, msgs); err != nil {
		return s.MaybeNuke(false, err, convID, uid)
	}

	// Update max msg ID if needed
	if len(msgs) > 0 {
		if err := s.idtracker.bumpMaxMessageID(ctx, convID, uid, msgs[0].GetMessageID()); err != nil {
			return s.MaybeNuke(false, err, convID, uid)
		}
	}

	return nil
}

func (s *Storage) updateAllSupersededBy(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgs []chat1.MessageUnboxed) Error {

	s.Debug(ctx, "updateSupersededBy: num msgs: %d", len(msgs))
	// Do a pass over all the messages and update supersededBy pointers
	for _, msg := range msgs {

		msgid := msg.GetMessageID()
		if !msg.IsValid() {
			s.Debug(ctx, "updateSupersededBy: skipping potential superseder marked as error: %d", msgid)
			continue
		}

		superIDs, ierr := utils.GetSupersedes(msg)
		if ierr != nil {
			continue
		}
		if len(superIDs) > 0 {
			s.Debug(ctx, "updateSupersededBy: msgID: %d supersedes: %v", msgid, superIDs)
		}

		// Set all supersedes targets
		for _, superID := range superIDs {
			s.Debug(ctx, "updateSupersededBy: supersedes: id: %d supersedes: %d", msgid, superID)
			// Read super msg
			var superMsgs []chat1.MessageUnboxed
			rc := NewSimpleResultCollector(1)
			err := s.engine.ReadMessages(ctx, rc, convID, uid, superID)
			if err != nil {
				// If we don't have the message, just keep going
				if _, ok := err.(MissError); ok {
					continue
				}
				return err
			}
			superMsgs = rc.Result()
			if len(superMsgs) == 0 {
				continue
			}

			// Update supersededBy on the target message if we have it. And if
			// the superseder is a deletion, delete the body as well.
			superMsg := superMsgs[0]
			if superMsg.IsValid() {
				s.Debug(ctx, "updateSupersededBy: writing: id: %d superseded: %d", msgid, superID)
				mvalid := superMsg.Valid()
				mvalid.ServerHeader.SupersededBy = msgid
				if msg.GetMessageType() == chat1.MessageType_DELETE {
					var emptyBody chat1.MessageBody
					mvalid.MessageBody = emptyBody
				}
				superMsgs[0] = chat1.NewMessageUnboxedWithValid(mvalid)
				if err = s.engine.WriteMessages(ctx, convID, uid, superMsgs); err != nil {
					return err
				}
			} else {
				s.Debug(ctx, "updateSupersededBy: skipping id: %d, it is stored as an error",
					superMsg.GetMessageID())
			}
		}
	}

	return nil
}

func (s *Storage) ResultCollectorFromQuery(ctx context.Context, query *chat1.GetThreadQuery,
	pagination *chat1.Pagination) ResultCollector {
	var num int
	if pagination != nil {
		num = pagination.Num
	} else {
		num = maxFetchNum
	}

	if query != nil && len(query.MessageTypes) > 0 {
		s.Debug(ctx, "ResultCollectorFromQuery: types: %v", query.MessageTypes)
		return NewTypedResultCollector(num, query.MessageTypes)
	}
	return NewSimpleResultCollector(num)
}

func (s *Storage) fetchUpToMsgIDLocked(ctx context.Context, rc ResultCollector,
	convID chat1.ConversationID, uid gregor1.UID, msgID chat1.MessageID, query *chat1.GetThreadQuery,
	pagination *chat1.Pagination) (chat1.ThreadView, Error) {
	// Fetch secret key
	key, ierr := getSecretBoxKey(ctx, s.G().ExternalG(), DefaultSecretUI)
	if ierr != nil {
		return chat1.ThreadView{},
			MiscError{Msg: "unable to get secret key: " + ierr.Error()}
	}

	// Init storage engine first
	var err Error
	ctx, err = s.engine.Init(ctx, key, convID, uid)
	if err != nil {
		return chat1.ThreadView{}, s.MaybeNuke(false, err, convID, uid)
	}

	// Calculate seek parameters
	var maxID chat1.MessageID
	var num int
	if pagination == nil {
		maxID = msgID
		num = maxFetchNum
	} else {
		var pid chat1.MessageID
		num = pagination.Num
		if len(pagination.Next) == 0 && len(pagination.Previous) == 0 {
			maxID = msgID
		} else if len(pagination.Next) > 0 {
			if derr := decode(pagination.Next, &pid); derr != nil {
				err = RemoteError{Msg: "Fetch: failed to decode pager: " + derr.Error()}
				return chat1.ThreadView{}, s.MaybeNuke(false, err, convID, uid)
			}
			maxID = pid - 1
			s.Debug(ctx, "Fetch: next pagination: pid: %d", pid)
		} else {
			if derr := decode(pagination.Previous, &pid); derr != nil {
				err = RemoteError{Msg: "Fetch: failed to decode pager: " + derr.Error()}
				return chat1.ThreadView{}, s.MaybeNuke(false, err, convID, uid)
			}
			maxID = chat1.MessageID(int(pid) + num)
			s.Debug(ctx, "Fetch: prev pagination: pid: %d", pid)
		}
	}
	s.Debug(ctx, "Fetch: maxID: %d num: %d", maxID, num)

	// Figure out how to determine we are done seeking (unless client tells us how to)
	if rc == nil {
		rc = s.ResultCollectorFromQuery(ctx, query, pagination)
	}
	s.Debug(ctx, "Fetch: using result collector: %s", rc)

	// Run seek looking for all the messages
	var res []chat1.MessageUnboxed
	if err = s.engine.ReadMessages(ctx, rc, convID, uid, maxID); err != nil {
		return chat1.ThreadView{}, err
	}
	res = rc.Result()

	// Form paged result
	var tres chat1.ThreadView
	var pmsgs []pager.Message
	for _, m := range res {
		pmsgs = append(pmsgs, m)
	}
	if tres.Pagination, ierr = pager.NewThreadPager().MakePage(pmsgs, num); ierr != nil {
		return chat1.ThreadView{},
			NewInternalError(ctx, s.DebugLabeler, "Fetch: failed to encode pager: %s", ierr.Error())
	}
	tres.Messages = res

	s.Debug(ctx, "Fetch: cache hit: num: %d", len(res))
	return tres, nil
}

func (s *Storage) FetchUpToLocalMaxMsgID(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, rc ResultCollector, query *chat1.GetThreadQuery,
	pagination *chat1.Pagination) (chat1.ThreadView, Error) {
	// All public functions get locks to make access to the database single threaded.
	// They should never be called from private functons.
	locks.Storage.Lock()
	defer locks.Storage.Unlock()

	maxMsgID, err := s.idtracker.getMaxMessageID(ctx, convID, uid)
	if err != nil {
		return chat1.ThreadView{}, err
	}
	s.Debug(ctx, "FetchUpToLocalMaxMsgID: using max msgID: %d", maxMsgID)

	return s.fetchUpToMsgIDLocked(ctx, rc, convID, uid, maxMsgID, query, pagination)
}

func (s *Storage) Fetch(ctx context.Context, conv chat1.Conversation,
	uid gregor1.UID, rc ResultCollector, query *chat1.GetThreadQuery, pagination *chat1.Pagination) (chat1.ThreadView, Error) {
	// All public functions get locks to make access to the database single threaded.
	// They should never be called from private functons.
	locks.Storage.Lock()
	defer locks.Storage.Unlock()

	return s.fetchUpToMsgIDLocked(ctx, rc, conv.Metadata.ConversationID, uid, conv.ReaderInfo.MaxMsgid,
		query, pagination)
}

func (s *Storage) FetchMessages(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgIDs []chat1.MessageID) ([]*chat1.MessageUnboxed, error) {

	// Fetch secret key
	key, ierr := getSecretBoxKey(ctx, s.G().ExternalG(), DefaultSecretUI)
	if ierr != nil {
		return nil, MiscError{Msg: "unable to get secret key: " + ierr.Error()}
	}

	// Init storage engine first
	var err Error
	ctx, err = s.engine.Init(ctx, key, convID, uid)
	if err != nil {
		return nil, s.MaybeNuke(false, err, convID, uid)
	}

	// Run seek looking for each message
	var res []*chat1.MessageUnboxed
	for _, msgID := range msgIDs {
		rc := NewSimpleResultCollector(1)
		var sres []chat1.MessageUnboxed
		if err = s.engine.ReadMessages(ctx, rc, convID, uid, msgID); err != nil {
			if _, ok := err.(MissError); ok {
				res = append(res, nil)
				continue
			} else {
				return nil, s.MaybeNuke(false, err, convID, uid)
			}
		}
		sres = rc.Result()
		res = append(res, &sres[0])
	}

	return res, nil
}

func (s *Storage) UpdateTLFIdentifyBreak(ctx context.Context, tlfID chat1.TLFID,
	breaks []keybase1.TLFIdentifyFailure) error {
	return s.breakTracker.UpdateTLF(ctx, tlfID, breaks)
}

func (s *Storage) IsTLFIdentifyBroken(ctx context.Context, tlfID chat1.TLFID) bool {
	idBroken, err := s.breakTracker.IsTLFBroken(ctx, tlfID)
	if err != nil {
		s.Debug(ctx, "IsTLFIdentifyBroken: got error, so returning broken: %s", err.Error())
		return true
	}
	return idBroken
}
