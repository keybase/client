package storage

import (
	"errors"
	"fmt"
	"sort"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/pager"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/keybase/go-codec/codec"
	"golang.org/x/net/context"
)

var maxFetchNum = 1000

type ResultCollector interface {
	Push(msg chat1.MessageUnboxed)
	PushPlaceholder(msgID chat1.MessageID) bool
	Done() bool
	Result() []chat1.MessageUnboxed
	Error(err Error) Error
	Name() string
	SetTarget(num int)

	String() string
}

type Storage struct {
	globals.Contextified
	utils.DebugLabeler

	engine           storageEngine
	idtracker        *msgIDTracker
	breakTracker     *breakTracker
	delhTracker      *delhTracker
	ephemeralTracker *ephemeralTracker
	assetDeleter     AssetDeleter
	clock            clockwork.Clock
}

type storageEngine interface {
	Init(ctx context.Context, key [32]byte, convID chat1.ConversationID,
		uid gregor1.UID) (context.Context, Error)
	WriteMessages(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
		msgs []chat1.MessageUnboxed) Error
	ReadMessages(ctx context.Context, res ResultCollector,
		convID chat1.ConversationID, uid gregor1.UID, maxID, minID chat1.MessageID) Error
	ClearMessages(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
		msgIDs []chat1.MessageID) Error
}

type AssetDeleter interface {
	DeleteAssets(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, assets []chat1.Asset)
}

type DummyAssetDeleter struct{}

func (d DummyAssetDeleter) DeleteAssets(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	assets []chat1.Asset) {

}

func New(g *globals.Context, assetDeleter AssetDeleter) *Storage {
	return &Storage{
		Contextified:     globals.NewContextified(g),
		engine:           newBlockEngine(g),
		idtracker:        newMsgIDTracker(g),
		breakTracker:     newBreakTracker(g),
		delhTracker:      newDelhTracker(g),
		ephemeralTracker: newEphemeralTracker(g),
		assetDeleter:     assetDeleter,
		clock:            clockwork.NewRealClock(),
		DebugLabeler:     utils.NewDebugLabeler(g.GetLog(), "Storage", false),
	}
}

func (s *Storage) setEngine(engine storageEngine) {
	s.engine = engine
}

func (s *Storage) SetClock(clock clockwork.Clock) {
	s.clock = clock
}

func (s *Storage) SetAssetDeleter(assetDeleter AssetDeleter) {
	s.assetDeleter = assetDeleter
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

// SimpleResultCollector aggregates all results in a basic way. It is not thread safe.
type SimpleResultCollector struct {
	res                  []chat1.MessageUnboxed
	target, cur, curScan int
}

var _ ResultCollector = (*SimpleResultCollector)(nil)

func (s *SimpleResultCollector) Push(msg chat1.MessageUnboxed) {
	s.res = append(s.res, msg)
	if !msg.IsValidDeleted() {
		s.cur++
	}
	s.curScan++
}

func (s *SimpleResultCollector) Done() bool {
	if s.target < 0 {
		return false
	}
	return s.cur >= s.target || s.curScan >= maxFetchNum
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

func (s *SimpleResultCollector) PushPlaceholder(chat1.MessageID) bool {
	return false
}

func (s *SimpleResultCollector) SetTarget(num int) {
	s.target = num
}

func NewSimpleResultCollector(num int) *SimpleResultCollector {
	return &SimpleResultCollector{
		target: num,
	}
}

type InsatiableResultCollector struct {
	res []chat1.MessageUnboxed
}

var _ ResultCollector = (*InsatiableResultCollector)(nil)

// InsatiableResultCollector aggregates all messages all the way back.
// Its result can include holes.
func NewInsatiableResultCollector() *InsatiableResultCollector {
	return &InsatiableResultCollector{}
}

func (s *InsatiableResultCollector) Push(msg chat1.MessageUnboxed) {
	s.res = append(s.res, msg)
}

func (s *InsatiableResultCollector) Done() bool {
	return false
}

func (s *InsatiableResultCollector) Result() []chat1.MessageUnboxed {
	return s.res
}

func (s *InsatiableResultCollector) Name() string {
	return "inf"
}

func (s *InsatiableResultCollector) String() string {
	return fmt.Sprintf("[ %s: c: %d ]", s.Name(), len(s.res))
}

func (s *InsatiableResultCollector) Error(err Error) Error {
	return err
}

func (s *InsatiableResultCollector) SetTarget(num int) {}

func (s *InsatiableResultCollector) PushPlaceholder(chat1.MessageID) bool {
	// Missing messages are a-ok
	return true
}

// TypedResultCollector aggregates results with a type constraints. It is not thread safe.
type TypedResultCollector struct {
	res                  []chat1.MessageUnboxed
	target, cur, curScan int
	typmap               map[chat1.MessageType]bool
}

var _ ResultCollector = (*TypedResultCollector)(nil)

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
	if !msg.IsValidDeleted() && t.typmap[msg.GetMessageType()] {
		t.cur++
	}
	t.curScan++
}

func (t *TypedResultCollector) Done() bool {
	if t.target < 0 {
		return false
	}
	return t.cur >= t.target || t.curScan >= maxFetchNum
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

func (t *TypedResultCollector) PushPlaceholder(msgID chat1.MessageID) bool {
	return false
}

func (t *TypedResultCollector) SetTarget(num int) {
	t.target = num
}

type HoleyResultCollector struct {
	ResultCollector

	maxHoles, holes int
}

var _ ResultCollector = (*HoleyResultCollector)(nil)

func NewHoleyResultCollector(maxHoles int, rc ResultCollector) *HoleyResultCollector {
	return &HoleyResultCollector{
		ResultCollector: rc,
		maxHoles:        maxHoles,
	}
}

func (h *HoleyResultCollector) PushPlaceholder(msgID chat1.MessageID) bool {
	if h.holes >= h.maxHoles {
		return false
	}

	h.ResultCollector.Push(chat1.NewMessageUnboxedWithPlaceholder(chat1.MessageUnboxedPlaceholder{
		MessageID: msgID,
	}))
	h.holes++
	return true
}

func (h *HoleyResultCollector) Holes() int {
	return h.holes
}

func (s *Storage) Nuke(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) Error {
	lock := locks.StorageLockTab.AcquireOnName(ctx, s.G(), convID.String())
	defer lock.Release(ctx)
	return s.maybeNukeLocked(ctx, true /* force */, nil /* error */, convID, uid)
}

func (s *Storage) maybeNukeLocked(ctx context.Context, force bool, err Error, convID chat1.ConversationID,
	uid gregor1.UID) Error {
	// Clear index
	if force || err.ShouldClear() {
		s.Debug(ctx, "chat local storage corrupted: clearing")
		if err := s.G().LocalChatDb.Delete(makeBlockIndexKey(convID, uid)); err != nil {
			s.Debug(ctx, "failed to delete chat index, clearing entire local storage (delete error: %s)",
				err)
			if _, err = s.G().LocalChatDb.Nuke(); err != nil {
				s.Debug(ctx, "failed to delete chat local storage: %s", err)
			}
		}
		if err := s.idtracker.clear(convID, uid); err != nil {
			s.Debug(ctx, "failed to clear max message storage: %s", err)
		}
		if err := s.ephemeralTracker.clear(uid); err != nil {
			s.Debug(ctx, "failed to clear ephemeral tracker storage: %s", err)
		}
	}
	return err
}

func (s *Storage) SetMaxMsgID(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	msgID chat1.MessageID) (err Error) {
	defer s.Trace(ctx, func() error { return err }, "SetMaxMsgID")()
	lock := locks.StorageLockTab.AcquireOnName(ctx, s.G(), convID.String())
	defer lock.Release(ctx)
	return s.idtracker.bumpMaxMessageID(ctx, convID, uid, msgID)
}

func (s *Storage) GetMaxMsgID(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (maxMsgID chat1.MessageID, err Error) {
	defer s.Trace(ctx, func() error { return err }, "GetMaxMsgID")()
	lock := locks.StorageLockTab.AcquireOnName(ctx, s.G(), convID.String())
	defer lock.Release(ctx)

	if maxMsgID, err = s.idtracker.getMaxMessageID(ctx, convID, uid); err != nil {
		return maxMsgID, s.maybeNukeLocked(ctx, false, err, convID, uid)
	}
	return maxMsgID, nil
}

type MergeResult struct {
	Expunged        *chat1.Expunge
	Exploded        []chat1.MessageUnboxed
	ReactionTargets []chat1.MessageUnboxed
	UnfurlTargets   []chat1.MessageUnboxed
	RepliesAffected []chat1.MessageUnboxed
}

type FetchResult struct {
	Thread   chat1.ThreadView
	Exploded []chat1.MessageUnboxed
}

// Merge requires msgs to be sorted by descending message ID
func (s *Storage) Merge(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, msgs []chat1.MessageUnboxed) (res MergeResult, err Error) {
	defer s.Trace(ctx, func() error { return err }, "Merge")()
	return s.MergeHelper(ctx, convID, uid, msgs, nil)
}

func (s *Storage) Expunge(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, expunge chat1.Expunge) (res MergeResult, err Error) {
	defer s.Trace(ctx, func() error { return err }, "Expunge")()
	// Merge with no messages, just the expunge.
	return s.MergeHelper(ctx, convID, uid, nil, &expunge)
}

// MergeHelper requires msgs to be sorted by descending message ID
// expunge is optional
func (s *Storage) MergeHelper(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, msgs []chat1.MessageUnboxed, expunge *chat1.Expunge) (res MergeResult, err Error) {
	defer s.Trace(ctx, func() error { return err }, "MergeHelper")()
	lock := locks.StorageLockTab.AcquireOnName(ctx, s.G(), convID.String())
	defer lock.Release(ctx)

	s.Debug(ctx, "MergeHelper: convID: %s uid: %s num msgs: %d", convID, uid, len(msgs))

	// Fetch secret key
	key, ierr := GetSecretBoxKey(ctx, s.G().ExternalG(), DefaultSecretUI)
	if ierr != nil {
		return res, MiscError{Msg: "unable to get secret key: " + ierr.Error()}
	}

	ctx, err = s.engine.Init(ctx, key, convID, uid)
	if err != nil {
		return res, err
	}

	// Write out new data into blocks
	if err = s.engine.WriteMessages(ctx, convID, uid, msgs); err != nil {
		return res, s.maybeNukeLocked(ctx, false, err, convID, uid)
	}

	// Update supersededBy pointers
	updateRes, err := s.updateAllSupersededBy(ctx, convID, uid, msgs)
	if err != nil {
		return res, s.maybeNukeLocked(ctx, false, err, convID, uid)
	}
	res.ReactionTargets = updateRes.reactionTargets
	res.UnfurlTargets = updateRes.unfurlTargets
	res.RepliesAffected = updateRes.repliesAffected

	if err = s.updateMinDeletableMessage(ctx, convID, uid, msgs); err != nil {
		return res, s.maybeNukeLocked(ctx, false, err, convID, uid)
	}

	// Process any DeleteHistory messages
	expunged, err := s.handleDeleteHistory(ctx, convID, uid, msgs, expunge)
	if err != nil {
		return res, s.maybeNukeLocked(ctx, false, err, convID, uid)
	}
	res.Expunged = expunged

	exploded, err := s.explodeExpiredMessages(ctx, convID, uid, msgs)
	if err != nil {
		return res, s.maybeNukeLocked(ctx, false, err, convID, uid)
	}
	res.Exploded = exploded

	// Update max msg ID if needed
	if len(msgs) > 0 {
		if err := s.idtracker.bumpMaxMessageID(ctx, convID, uid, msgs[0].GetMessageID()); err != nil {
			return res, s.maybeNukeLocked(ctx, false, err, convID, uid)
		}
	}

	// queue search index update in the background
	go s.G().Indexer.Add(ctx, convID, uid, msgs)

	return res, nil
}

type updateAllSupersededByRes struct {
	reactionTargets []chat1.MessageUnboxed
	unfurlTargets   []chat1.MessageUnboxed
	repliesAffected []chat1.MessageUnboxed
}

func (s *Storage) isReply(msg chat1.MessageUnboxed) *chat1.MessageID {
	if !msg.IsValid() {
		return nil
	}
	body := msg.Valid().MessageBody
	if body.IsType(chat1.MessageType_TEXT) && body.Text().ReplyTo != nil && *body.Text().ReplyTo > 0 {
		return body.Text().ReplyTo
	}
	return nil
}

func (s *Storage) updateAllSupersededBy(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, inMsgs []chat1.MessageUnboxed) (res updateAllSupersededByRes, err Error) {
	s.Debug(ctx, "updateSupersededBy: num msgs: %d", len(inMsgs))
	// Do a pass over all the messages and update supersededBy pointers

	var allAssets []chat1.Asset
	var allPurged []chat1.MessageUnboxed
	// We return a set of reaction targets that have been updated
	updatedReactionTargets := map[chat1.MessageID]chat1.MessageUnboxed{}
	// Unfurl targets
	updatedUnfurlTargets := map[chat1.MessageID]chat1.MessageUnboxed{}
	repliesAffected := map[chat1.MessageID]chat1.MessageUnboxed{}

	// Sort in reverse order so this playback works as it would have if we received these
	// in real-time
	msgs := make([]chat1.MessageUnboxed, len(inMsgs))
	copy(msgs, inMsgs)
	sort.Slice(msgs, func(i, j int) bool {
		return msgs[i].GetMessageID() < msgs[j].GetMessageID()
	})
	for _, msg := range msgs {
		msgid := msg.GetMessageID()
		if !msg.IsValid() {
			s.Debug(ctx, "updateSupersededBy: skipping potential superseder marked as not valid: %v", msg.DebugString())
			continue
		}

		supersededIDs, ierr := utils.GetSupersedes(msg)
		if ierr != nil {
			continue
		}
		if replyID := s.isReply(msg); replyID != nil {
			supersededIDs = append(supersededIDs, *replyID)
		}
		// Set all supersedes targets
		for _, supersededID := range supersededIDs {
			if supersededID == 0 {
				s.Debug(ctx, "updateSupersededBy: skipping invalid supersededID: %v for msg: %v", supersededID, msg.DebugString())
				continue
			}

			s.Debug(ctx, "updateSupersededBy: msg: %v supersedes: %v", msg.DebugString(), supersededID)
			// Read superseded msg
			superMsg, err := s.getMessage(ctx, convID, uid, supersededID)
			if err != nil {
				return res, err
			}
			if superMsg == nil {
				continue
			}

			// Update supersededBy and reactionIDs on the target message if we
			// have it. If the superseder is a deletion, delete the body as
			// well. If we are deleting a reaction, update the reaction's
			// target message.
			if superMsg.IsValid() {
				s.Debug(ctx, "updateSupersededBy: writing: id: %d superseded: %d", msgid, supersededID)
				mvalid := superMsg.Valid()

				newMsgs := []chat1.MessageUnboxed{}
				switch msg.GetMessageType() {
				case chat1.MessageType_TEXT:
					mvalid.ServerHeader.Replies = append(mvalid.ServerHeader.Replies, msg.GetMessageID())
					newMsg := chat1.NewMessageUnboxedWithValid(mvalid)
					newMsgs = append(newMsgs, newMsg)
				case chat1.MessageType_UNFURL:
					unfurl := msg.Valid().MessageBody.Unfurl()
					utils.SetUnfurl(&mvalid, msg.GetMessageID(), unfurl.Unfurl)
					newMsg := chat1.NewMessageUnboxedWithValid(mvalid)
					newMsgs = append(newMsgs, newMsg)
					updatedUnfurlTargets[superMsg.GetMessageID()] = newMsg
				case chat1.MessageType_REACTION:
					// If we haven't modified any reaction data, we don't want
					// to send it up for a notification.
					reactionUpdate := false
					// reactions don't update SupersededBy, instead they rely
					// on ReactionIDs
					mvalid.ServerHeader.ReactionIDs, reactionUpdate =
						s.updateReactionIDs(mvalid.ServerHeader.ReactionIDs, msgid)
					newMsg := chat1.NewMessageUnboxedWithValid(mvalid)
					newMsgs = append(newMsgs, newMsg)
					if reactionUpdate {
						updatedReactionTargets[superMsg.GetMessageID()] = newMsg
					}
				case chat1.MessageType_DELETE:
					mvalid.ServerHeader.SupersededBy = msgid
					s.updateRepliesAffected(ctx, convID, uid, mvalid.ServerHeader.Replies, repliesAffected)
					switch superMsg.GetMessageType() {
					case chat1.MessageType_UNFURL:
						updatedTarget, err := s.updateUnfurlTargetOnDelete(ctx, convID, uid, *superMsg)
						if err != nil {
							s.Debug(ctx, "updateSupersededBy: failed to update unfurl target: %s", err)
						} else {
							updatedUnfurlTargets[updatedTarget.GetMessageID()] = updatedTarget
							newMsgs = append(newMsgs, updatedTarget)
						}
					case chat1.MessageType_REACTION:
						// We have to find the message we are reacting to and
						// update it's ReactionIDs as well.
						newTargetMsg, reactionUpdate, err := s.updateReactionTargetOnDelete(ctx, convID, uid,
							superMsg)
						if err != nil {
							return res, err
						} else if newTargetMsg != nil {
							if reactionUpdate {
								updatedReactionTargets[newTargetMsg.GetMessageID()] = *newTargetMsg
							}
							newMsgs = append(newMsgs, *newTargetMsg)
						}
					}
					msgPurged, assets := s.purgeMessage(mvalid)
					allPurged = append(allPurged, *superMsg)
					allAssets = append(allAssets, assets...)
					newMsgs = append(newMsgs, msgPurged)
				case chat1.MessageType_EDIT:
					s.updateRepliesAffected(ctx, convID, uid, mvalid.ServerHeader.Replies, repliesAffected)
					fallthrough
				default:
					mvalid.ServerHeader.SupersededBy = msgid
					newMsg := chat1.NewMessageUnboxedWithValid(mvalid)
					newMsgs = append(newMsgs, newMsg)
				}
				if err = s.engine.WriteMessages(ctx, convID, uid, newMsgs); err != nil {
					return res, err
				}
			} else {
				s.Debug(ctx, "updateSupersededBy: skipping id: %d, it is stored as an error",
					superMsg.GetMessageID())
			}
		}
	}

	// queue asset deletions in the background
	s.assetDeleter.DeleteAssets(ctx, uid, convID, allAssets)
	// queue search index update in the background
	go s.G().Indexer.Remove(ctx, convID, uid, allPurged)

	return updateAllSupersededByRes{
		reactionTargets: s.flatten(updatedReactionTargets),
		unfurlTargets:   s.flatten(updatedUnfurlTargets),
		repliesAffected: s.flatten(repliesAffected),
	}, nil
}

func (s *Storage) flatten(m map[chat1.MessageID]chat1.MessageUnboxed) (res []chat1.MessageUnboxed) {
	for _, msg := range m {
		res = append(res, msg)
	}
	return res
}

func (s *Storage) updateMinDeletableMessage(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgs []chat1.MessageUnboxed) Error {

	de := func(format string, args ...interface{}) {
		s.Debug(ctx, "updateMinDeletableMessage: "+fmt.Sprintf(format, args...))
	}

	// The min deletable message ID in this new batch of messages.
	var minDeletableMessageBatch *chat1.MessageID
	for _, msg := range msgs {
		msgid := msg.GetMessageID()
		if !msg.IsValid() {
			continue
		}
		if !chat1.IsDeletableByDeleteHistory(msg.GetMessageType()) {
			continue
		}
		if msg.Valid().MessageBody.IsNil() {
			continue
		}
		if minDeletableMessageBatch == nil || msgid < *minDeletableMessageBatch {
			minDeletableMessageBatch = &msgid
		}
	}

	// Update the tracker to min(mem, batch)
	if minDeletableMessageBatch != nil {
		mem, err := s.delhTracker.getEntry(ctx, convID, uid)
		switch err.(type) {
		case nil:
			if mem.MinDeletableMessage > 0 && *minDeletableMessageBatch >= mem.MinDeletableMessage {
				// no need to update
				return nil
			}
		case MissError:
			// We have no memory
		default:
			return err
		}

		err = s.delhTracker.setMinDeletableMessage(ctx, convID, uid, *minDeletableMessageBatch)
		if err != nil {
			de("failed to store delh track: %v", err)
		}
	}

	return nil
}

// Apply any new DeleteHistory from msgs.
// Returns a non-nil expunge if deletes happened.
// Shortcircuits so it's ok to call a lot.
// The actual effect will be to delete upto the max of `expungeExplicit` (which can be nil)
//   and the DeleteHistory-type messages.
func (s *Storage) handleDeleteHistory(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgs []chat1.MessageUnboxed, expungeExplicit *chat1.Expunge) (*chat1.Expunge, Error) {

	de := func(format string, args ...interface{}) {
		s.Debug(ctx, "handleDeleteHistory: "+fmt.Sprintf(format, args...))
	}

	// Find the DeleteHistory message with the maximum upto value.
	expungeActive := expungeExplicit
	for _, msg := range msgs {
		msgid := msg.GetMessageID()
		if !msg.IsValid() {
			de("skipping message marked as not valid: %v", msg.DebugString())
			continue
		}
		if msg.GetMessageType() != chat1.MessageType_DELETEHISTORY {
			continue
		}
		mvalid := msg.Valid()
		bodyType, err := mvalid.MessageBody.MessageType()
		if err != nil {
			de("skipping corrupted message body: %v", err)
			continue
		}
		if bodyType != chat1.MessageType_DELETEHISTORY {
			de("skipping wrong message body type: %v", err)
			continue
		}
		delh := mvalid.MessageBody.Deletehistory()
		de("found DeleteHistory: id:%v upto:%v", msgid, delh.Upto)
		if delh.Upto <= 0 {
			de("skipping malformed delh")
			continue
		}

		if expungeActive == nil || (delh.Upto > expungeActive.Upto) {
			expungeActive = &chat1.Expunge{
				Basis: mvalid.ServerHeader.MessageID,
				Upto:  delh.Upto,
			}
		}
	}

	// Noop if there is no Expunge or DeleteHistory messages
	if expungeActive == nil {
		return nil, nil
	}
	if expungeActive.Upto == 0 {
		return nil, nil
	}

	mem, err := s.delhTracker.getEntry(ctx, convID, uid)
	switch err.(type) {
	case nil:
		if mem.MaxDeleteHistoryUpto >= expungeActive.Upto {
			// No-op if the effect has already been applied locally
			de("skipping delh with no new effect: (upto local:%v >= msg:%v)", mem.MaxDeleteHistoryUpto, expungeActive.Upto)
			return nil, nil
		}
		if expungeActive.Upto < mem.MinDeletableMessage {
			// Record-only if it would delete messages earlier than the local min.
			de("record-only delh: (%v < %v)", expungeActive.Upto, mem.MinDeletableMessage)
			err := s.delhTracker.setMaxDeleteHistoryUpto(ctx, convID, uid, expungeActive.Upto)
			if err != nil {
				de("failed to store delh track: %v", err)
			}
			return nil, nil
		}
		// No shortcuts, fallthrough to apply.
	case MissError:
		// We have no memory, assume it needs to be applied
	default:
		return nil, err
	}

	return s.applyExpunge(ctx, convID, uid, *expungeActive)
}

// Apply a delete history.
// Returns a non-nil expunge if deletes happened.
// Always runs through local messages.
func (s *Storage) applyExpunge(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, expunge chat1.Expunge) (*chat1.Expunge, Error) {

	s.Debug(ctx, "applyExpunge(%v, %v, %v)", convID, uid, expunge.Upto)

	de := func(format string, args ...interface{}) {
		s.Debug(ctx, "applyExpunge: "+fmt.Sprintf(format, args...))
	}

	rc := NewInsatiableResultCollector() // collect all messages
	err := s.engine.ReadMessages(ctx, rc, convID, uid, expunge.Upto-1, 0)
	switch err.(type) {
	case nil:
		// ok
	case MissError:
		de("record-only delh: no local messages")
		err := s.delhTracker.setMaxDeleteHistoryUpto(ctx, convID, uid, expunge.Upto)
		if err != nil {
			de("failed to store delh track: %v", err)
		}
		return nil, nil
	default:
		return nil, err
	}

	var allAssets []chat1.Asset
	var writeback, allPurged []chat1.MessageUnboxed
	for _, msg := range rc.Result() {
		if !chat1.IsDeletableByDeleteHistory(msg.GetMessageType()) {
			// Skip message types that cannot be deleted this way
			continue
		}
		if !msg.IsValid() {
			de("skipping invalid msg: %v", msg.DebugString())
			continue
		}
		mvalid := msg.Valid()
		if mvalid.MessageBody.IsNil() {
			continue
		}
		mvalid.ServerHeader.SupersededBy = expunge.Basis // Can be 0
		msgPurged, assets := s.purgeMessage(mvalid)
		allPurged = append(allPurged, msg)
		allAssets = append(allAssets, assets...)
		writeback = append(writeback, msgPurged)
	}

	// queue asset deletions in the background
	s.assetDeleter.DeleteAssets(ctx, uid, convID, allAssets)
	// queue search index update in the background
	go s.G().Indexer.Remove(ctx, convID, uid, allPurged)

	de("deleting %v messages", len(writeback))
	if err = s.engine.WriteMessages(ctx, convID, uid, writeback); err != nil {
		de("write messages failed: %v", err)
		return nil, err
	}

	err = s.delhTracker.setDeletedUpto(ctx, convID, uid, expunge.Upto)
	if err != nil {
		de("failed to store delh track: %v", err)
	}

	return &expunge, nil
}

// clearUpthrough clears up to the given message ID, inclusive
func (s *Storage) clearUpthrough(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	upthrough chat1.MessageID) (err Error) {
	defer s.Trace(ctx, func() error { return err }, "clearUpthrough")()
	key, ierr := GetSecretBoxKey(ctx, s.G().ExternalG(), DefaultSecretUI)
	if ierr != nil {
		return MiscError{Msg: "unable to get secret key: " + ierr.Error()}
	}
	ctx, err = s.engine.Init(ctx, key, convID, uid)
	if err != nil {
		return err
	}

	var msgIDs []chat1.MessageID
	for m := upthrough; m > 0; m-- {
		msgIDs = append(msgIDs, m)
	}
	return s.engine.ClearMessages(ctx, convID, uid, msgIDs)
}

// ClearBefore clears all messages up to (but not including) the upto messageID
func (s *Storage) ClearBefore(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	upto chat1.MessageID) (err Error) {
	defer s.Trace(ctx, func() error { return err }, fmt.Sprintf("ClearBefore: convID: %s, uid: %s, msgID: %d", convID, uid, upto))()
	lock := locks.StorageLockTab.AcquireOnName(ctx, s.G(), convID.String())
	defer lock.Release(ctx)

	// Abort, we don't want to overflow uint (chat1.MessageID)
	if upto == 0 {
		return nil
	}
	return s.clearUpthrough(ctx, convID, uid, upto-1)
}

func (s *Storage) ClearAll(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (err Error) {
	defer s.Trace(ctx, func() error { return err }, "ClearAll")()
	lock := locks.StorageLockTab.AcquireOnName(ctx, s.G(), convID.String())
	defer lock.Release(ctx)
	maxMsgID, err := s.idtracker.getMaxMessageID(ctx, convID, uid)
	if err != nil {
		return err
	}
	return s.clearUpthrough(ctx, convID, uid, maxMsgID)
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
	pagination *chat1.Pagination) (res FetchResult, err Error) {

	if err = isAbortedRequest(ctx); err != nil {
		return res, err
	}
	// Fetch secret key
	key, ierr := GetSecretBoxKey(ctx, s.G().ExternalG(), DefaultSecretUI)
	if ierr != nil {
		return res, MiscError{Msg: "unable to get secret key: " + ierr.Error()}
	}

	// Init storage engine first
	ctx, err = s.engine.Init(ctx, key, convID, uid)
	if err != nil {
		return res, s.maybeNukeLocked(ctx, false, err, convID, uid)
	}

	// Calculate seek parameters
	var maxID, minID chat1.MessageID
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
				return res, s.maybeNukeLocked(ctx, false, err, convID, uid)
			}
			maxID = pid - 1
			minID = 0
			s.Debug(ctx, "Fetch: next pagination: pid: %d", pid)
		} else {
			if derr := decode(pagination.Previous, &pid); derr != nil {
				err = RemoteError{Msg: "Fetch: failed to decode pager: " + derr.Error()}
				return res, s.maybeNukeLocked(ctx, false, err, convID, uid)
			}
			maxID = chat1.MessageID(int(pid) + num)
			minID = pid
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
	if err = s.engine.ReadMessages(ctx, rc, convID, uid, maxID, minID); err != nil {
		return res, err
	}
	msgs := rc.Result()

	// Clear out any ephemeral messages that have exploded before we hand these
	// messages out.
	explodedMsgs, err := s.explodeExpiredMessages(ctx, convID, uid, msgs)
	if err != nil {
		return res, err
	}
	res.Exploded = explodedMsgs

	// Get the stored latest point upto which has been deleted.
	// `maxDeletedUpto` can be behind the times, so the pager is patched later in ConvSource.
	// It will be behind the times if a retention policy is the last expunger and only a full inbox sync has happened.
	var maxDeletedUpto chat1.MessageID
	delh, err := s.delhTracker.getEntry(ctx, convID, uid)
	switch err.(type) {
	case nil:
		maxDeletedUpto = delh.MaxDeleteHistoryUpto
	case MissError:
	default:
		return res, err
	}
	s.Debug(ctx, "Fetch: using max deleted upto: %v for pager", maxDeletedUpto)

	// Form paged result
	var pmsgs []pager.Message
	for _, m := range msgs {
		pmsgs = append(pmsgs, m)
	}
	if res.Thread.Pagination, ierr = pager.NewThreadPager().MakePage(pmsgs, num, maxDeletedUpto); ierr != nil {
		return res,
			NewInternalError(ctx, s.DebugLabeler, "Fetch: failed to encode pager: %s", ierr.Error())
	}
	res.Thread.Messages = msgs

	s.Debug(ctx, "Fetch: cache hit: num: %d", len(msgs))
	return res, nil
}

func (s *Storage) FetchUpToLocalMaxMsgID(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, rc ResultCollector, iboxMaxMsgID chat1.MessageID,
	query *chat1.GetThreadQuery, pagination *chat1.Pagination) (res FetchResult, err Error) {
	defer s.Trace(ctx, func() error { return err }, "FetchUpToLocalMaxMsgID")()
	lock := locks.StorageLockTab.AcquireOnName(ctx, s.G(), convID.String())
	defer lock.Release(ctx)

	maxMsgID, err := s.idtracker.getMaxMessageID(ctx, convID, uid)
	if err != nil {
		return res, err
	}
	if iboxMaxMsgID > maxMsgID {
		s.Debug(ctx, "FetchUpToLocalMaxMsgID: overriding locally stored max msgid with ibox: %d",
			iboxMaxMsgID)
		maxMsgID = iboxMaxMsgID
	}
	s.Debug(ctx, "FetchUpToLocalMaxMsgID: using max msgID: %d", maxMsgID)

	return s.fetchUpToMsgIDLocked(ctx, rc, convID, uid, maxMsgID, query, pagination)
}

func (s *Storage) Fetch(ctx context.Context, conv chat1.Conversation,
	uid gregor1.UID, rc ResultCollector, query *chat1.GetThreadQuery, pagination *chat1.Pagination) (res FetchResult, err Error) {
	defer s.Trace(ctx, func() error { return err }, "Fetch")()
	lock := locks.StorageLockTab.AcquireOnName(ctx, s.G(), conv.GetConvID().String())
	defer lock.Release(ctx)

	return s.fetchUpToMsgIDLocked(ctx, rc, conv.GetConvID(), uid, conv.ReaderInfo.MaxMsgid,
		query, pagination)
}

func (s *Storage) FetchMessages(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgIDs []chat1.MessageID) (res []*chat1.MessageUnboxed, err Error) {
	defer s.Trace(ctx, func() error { return err }, "FetchMessages")()
	lock := locks.StorageLockTab.AcquireOnName(ctx, s.G(), convID.String())
	defer lock.Release(ctx)
	if err = isAbortedRequest(ctx); err != nil {
		return res, err
	}
	// Fetch secret key
	key, ierr := GetSecretBoxKey(ctx, s.G().ExternalG(), DefaultSecretUI)
	if ierr != nil {
		return nil, MiscError{Msg: "unable to get secret key: " + ierr.Error()}
	}

	// Init storage engine first
	ctx, err = s.engine.Init(ctx, key, convID, uid)
	if err != nil {
		return nil, s.maybeNukeLocked(ctx, false, err, convID, uid)
	}

	// Run seek looking for each message
	for _, msgID := range msgIDs {
		msg, err := s.getMessage(ctx, convID, uid, msgID)
		if err != nil {
			return nil, s.maybeNukeLocked(ctx, false, err, convID, uid)
		}
		// If we have a versioning error but our client now understands the new
		// version, don't return the error message
		if msg != nil && msg.IsError() && msg.Error().ParseableVersion() {
			msg = nil
		}
		res = append(res, msg)
	}

	return res, nil
}

func (s *Storage) FetchUnreadlineID(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, readMsgID chat1.MessageID) (msgID *chat1.MessageID, err Error) {
	defer s.Trace(ctx, func() error { return err }, "FetchUnreadlineID")()
	lock := locks.StorageLockTab.AcquireOnName(ctx, s.G(), convID.String())
	defer lock.Release(ctx)
	if err = isAbortedRequest(ctx); err != nil {
		return nil, err
	}
	// Fetch secret key
	key, ierr := GetSecretBoxKey(ctx, s.G().ExternalG(), DefaultSecretUI)
	if ierr != nil {
		return nil, MiscError{Msg: "unable to get secret key: " + ierr.Error()}
	}

	// Init storage engine first
	ctx, err = s.engine.Init(ctx, key, convID, uid)
	if err != nil {
		return nil, s.maybeNukeLocked(ctx, false, err, convID, uid)
	}

	// Run seek looking for each message
	for unreadlineID := readMsgID + 1; unreadlineID < readMsgID+1000; unreadlineID++ {
		msg, err := s.getMessage(ctx, convID, uid, unreadlineID)
		if err != nil {
			return nil, s.maybeNukeLocked(ctx, false, err, convID, uid)
		}
		// If we are missing any messages just abort.
		if msg == nil {
			return nil, nil
		}
		// return the first non-deleted visible message we have
		if msg.IsValidFull() && utils.IsVisibleChatMessageType(msg.GetMessageType()) {
			return &unreadlineID, nil
		}
	}

	return nil, nil
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

func (s *Storage) getMessage(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, msgID chat1.MessageID) (*chat1.MessageUnboxed, Error) {
	rc := NewSimpleResultCollector(1)
	if err := s.engine.ReadMessages(ctx, rc, convID, uid, msgID, 0); err != nil {
		// If we don't have the message, just keep going
		if _, ok := err.(MissError); ok {
			return nil, nil
		}
		return nil, err
	}
	res := rc.Result()
	if len(res) == 0 {
		return nil, nil
	}
	return &res[0], nil
}

func (s *Storage) updateUnfurlTargetOnDelete(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, unfurlMsg chat1.MessageUnboxed) (res chat1.MessageUnboxed, err error) {
	defer s.Trace(ctx, func() error { return err }, "updateUnfurlTargetOnDelete(%d)",
		unfurlMsg.GetMessageID())()
	if unfurlMsg.Valid().MessageBody.IsNil() {
		return unfurlMsg, errors.New("unfurl already deleted")
	}
	targetMsgID := unfurlMsg.Valid().MessageBody.Unfurl().MessageID
	targetMsg, err := s.getMessage(ctx, convID, uid, targetMsgID)
	if err != nil || targetMsg == nil {
		s.Debug(ctx, "updateUnfurlTargetOnDelete: no target message found: err: %s", err)
		return unfurlMsg, err
	}
	if !targetMsg.IsValid() {
		s.Debug(ctx, "updateUnfurlTargetOnDelete: target message is unvalid")
		return unfurlMsg, nil
	}
	mvalid := targetMsg.Valid()
	utils.RemoveUnfurl(&mvalid, unfurlMsg.GetMessageID())
	return chat1.NewMessageUnboxedWithValid(mvalid), nil
}

func (s *Storage) updateRepliesAffected(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	replies []chat1.MessageID, replyMap map[chat1.MessageID]chat1.MessageUnboxed) {
	if len(replies) == 0 {
		return
	}
	defer s.Trace(ctx, func() error { return nil }, "updateRepliesAffected: num: %d", len(replies))()
	for _, reply := range replies {
		if _, ok := replyMap[reply]; ok {
			continue
		}
		replyMsg, err := s.getMessage(ctx, convID, uid, reply)
		if err != nil || replyMsg == nil {
			s.Debug(ctx, "updateRepliesAffected: failed to get message: err: %s", err)
			continue
		}
		replyMap[reply] = *replyMsg
	}
}

func (s *Storage) GetExplodedReplies(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	exploded []chat1.MessageUnboxed) []chat1.MessageUnboxed {
	if len(exploded) == 0 {
		return nil
	}
	defer s.Trace(ctx, func() error { return nil }, "getExplodedReplies: num: %d", len(exploded))()
	var replies []chat1.MessageID
	for _, msg := range exploded {
		if !msg.IsValid() {
			continue
		}
		replies = append(replies, msg.Valid().ServerHeader.Replies...)
	}
	replyMap := make(map[chat1.MessageID]chat1.MessageUnboxed)
	s.updateRepliesAffected(ctx, convID, uid, replies, replyMap)
	return s.flatten(replyMap)
}

// updateReactionIDs appends `msgid` to `reactionIDs` if it is not already
// present.
func (s *Storage) updateReactionIDs(reactionIDs []chat1.MessageID, msgid chat1.MessageID) ([]chat1.MessageID, bool) {
	for _, reactionID := range reactionIDs {
		if reactionID == msgid {
			return reactionIDs, false
		}
	}
	return append(reactionIDs, msgid), true
}

// updateReactionTargetOnDelete modifies the reaction's target message when the
// reaction itself is deleted
func (s *Storage) updateReactionTargetOnDelete(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, reactionMsg *chat1.MessageUnboxed) (*chat1.MessageUnboxed, bool, Error) {
	s.Debug(ctx, "updateReactionTargetOnDelete: reationMsg: %v", reactionMsg)

	if reactionMsg.Valid().MessageBody.IsNil() {
		return nil, false, nil
	}

	targetMsgID := reactionMsg.Valid().MessageBody.Reaction().MessageID
	targetMsg, err := s.getMessage(ctx, convID, uid, targetMsgID)
	if err != nil || targetMsg == nil {
		return nil, false, err
	}
	if targetMsg.IsValid() {
		mvalid := targetMsg.Valid()
		reactionIDs := []chat1.MessageID{}
		for _, msgID := range mvalid.ServerHeader.ReactionIDs {
			if msgID != reactionMsg.GetMessageID() {
				reactionIDs = append(reactionIDs, msgID)
			}
		}
		updated := len(mvalid.ServerHeader.ReactionIDs) != len(reactionIDs)
		mvalid.ServerHeader.ReactionIDs = reactionIDs
		newMsg := chat1.NewMessageUnboxedWithValid(mvalid)
		return &newMsg, updated, nil
	}
	return nil, false, nil
}

// Clears the body of a message and returns any assets to be deleted.
func (s *Storage) purgeMessage(mvalid chat1.MessageUnboxedValid) (chat1.MessageUnboxed, []chat1.Asset) {
	assets := utils.AssetsForMessage(s.G(), mvalid.MessageBody)
	var emptyBody chat1.MessageBody
	mvalid.MessageBody = emptyBody
	var emptyReactions chat1.ReactionMap
	mvalid.Reactions = emptyReactions
	return chat1.NewMessageUnboxedWithValid(mvalid), assets
}
