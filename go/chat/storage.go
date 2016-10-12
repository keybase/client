package chat

import (
	"context"
	"fmt"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/go-codec/codec"
)

// TODO:
// ***
// Error handling
// Gregor OOBM integration
// TEST!!!!1111!!!!one!
// ***

const maxBlockSize = 100

type Storage struct {
	sync.Mutex
	libkb.Contextified
}

type blockIndex struct {
	ConvID   chat1.ConversationID
	UID      gregor1.UID
	MaxBlock int
}

type block struct {
	BlockID int
	Msgs    [maxBlockSize]chat1.MessageFromServerOrError
}

type convIndex struct {
	ConvIDs []chat1.ConversationID
}

func NewStorage(g *libkb.GlobalContext) *Storage {
	return &Storage{
		Contextified: libkb.NewContextified(g),
	}
}

func (s *Storage) debug(format string, args ...interface{}) {
	s.G().Log.Debug("+ chatcache: "+format, args...)
}

func (s *Storage) makeBlockKey(convID chat1.ConversationID, uid gregor1.UID, blockID int) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatBlocks,
		Key: fmt.Sprintf("bl:%s:%s:%d", convID, uid, blockID),
	}
}

func (s *Storage) makeBlockIndexKey(convID chat1.ConversationID, uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatBlockIndex,
		Key: fmt.Sprintf("bi:%s:%s", convID, uid),
	}
}

func (s *Storage) makeConvIndexKey(uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatConvIndex,
		Key: uid.String(),
	}
}

func (s *Storage) encode(input interface{}) ([]byte, error) {
	mh := codec.MsgpackHandle{WriteExt: true}
	var data []byte
	enc := codec.NewEncoderBytes(&data, &mh)
	if err := enc.Encode(input); err != nil {
		return nil, err
	}
	return data, nil
}

func (s *Storage) decode(data []byte, res interface{}) error {
	mh := codec.MsgpackHandle{WriteExt: true}
	dec := codec.NewDecoderBytes(data, &mh)
	err := dec.Decode(res)
	return err
}

func (s *Storage) getBlockNumber(id chat1.MessageID) int {
	return int(id) / maxBlockSize
}

func (s *Storage) getBlockPosition(id chat1.MessageID) int {
	// We subtract off 1 here because there is no msgID == 0
	return int(id)%maxBlockSize - 1
}

func (s *Storage) getMsgID(blockNum, blockPos int) chat1.MessageID {
	return chat1.MessageID(blockNum*maxBlockSize + blockPos + 1)
}

func (s *Storage) getIndex(uid gregor1.UID) (convIndex, bool, error) {
	raw, found, err := s.G().LocalDb.GetRaw(s.makeConvIndexKey(uid))
	if err != nil {
		return convIndex{}, false, err
	}
	if found {
		var si convIndex
		if err := s.decode(raw, &si); err == nil {
			return si, true, nil
		}
	}
	return convIndex{}, found, nil
}

func (s *Storage) mergeConvIndex(convID chat1.ConversationID, uid gregor1.UID) libkb.ChatStorageError {
	// Get current index
	si, found, err := s.getIndex(uid)
	if err != nil {
		return libkb.NewChatStorageInternalError(s.G(), "failed to fetch conv index: %s", err.Error())
	}

	// Add new convID to index if it is not there
	var res convIndex
	if !found {
		res.ConvIDs = []chat1.ConversationID{convID}
	} else {
		for _, cid := range si.ConvIDs {
			if cid == convID {
				return nil
			}
		}
		res.ConvIDs = append(si.ConvIDs, convID)
	}

	// Write index out
	dat, err := s.encode(res)
	if err != nil {
		return libkb.NewChatStorageInternalError(s.G(), "failed to encode conv index: %s", err.Error())
	}
	err = s.G().LocalDb.PutRaw(s.makeConvIndexKey(uid), dat)
	if err != nil {
		return libkb.NewChatStorageInternalError(s.G(), "failed to write conv index: %s", err.Error())
	}
	return nil
}

func (s *Storage) createBlockIndex(key libkb.DbKey, convID chat1.ConversationID, uid gregor1.UID) (blockIndex, libkb.ChatStorageError) {
	bi := blockIndex{
		ConvID:   convID,
		UID:      uid,
		MaxBlock: -1,
	}

	s.debug("createBlockIndex: creating new block index: convID: %d uid: %s", convID, uid)
	_, err := s.createBlock(&bi)
	if err != nil {
		return bi, libkb.NewChatStorageInternalError(s.G(), "createBlockIndex: failed to create block: %s", err.Message())
	}

	dat, rerr := s.encode(bi)
	if rerr != nil {
		return bi, libkb.NewChatStorageInternalError(s.G(), "createBlockIndex: failed to encode %s", err.Error())
	}
	if rerr = s.G().LocalDb.PutRaw(key, dat); rerr != nil {
		return bi, libkb.NewChatStorageInternalError(s.G(), "createBlockIndex: failed to write: %s", rerr.Error())
	}
	return bi, nil
}

func (s *Storage) readBlockIndex(convID chat1.ConversationID, uid gregor1.UID) (blockIndex, libkb.ChatStorageError) {
	key := s.makeBlockIndexKey(convID, uid)
	raw, found, err := s.G().LocalDb.GetRaw(key)
	if err != nil {
		return blockIndex{}, libkb.NewChatStorageInternalError(s.G(), "readBlockIndex: failed to read index block: %s", err.Error())
	}
	if !found {
		// If not found, create a new one and return it
		s.debug("readBlockIndex: no block index found, creating: convID: %d uid: %s", convID, uid)
		return s.createBlockIndex(key, convID, uid)
	}

	// Decode and return
	var bi blockIndex
	if err = s.decode(raw, &bi); err != nil {
		return bi, libkb.NewChatStorageInternalError(s.G(), "readBlockIndex: failed to decode: %s", err.Error())
	}
	return bi, nil
}

func (s *Storage) createBlock(bi *blockIndex) (block, libkb.ChatStorageError) {

	// Update block index with new block
	bi.MaxBlock++
	dat, err := s.encode(bi)
	if err != nil {
		return block{}, libkb.NewChatStorageInternalError(s.G(), "createBlock: failed to encode block: %s", err.Error())
	}
	s.debug("createBlock: creating block: %d", bi.MaxBlock)
	err = s.G().LocalDb.PutRaw(s.makeBlockIndexKey(bi.ConvID, bi.UID), dat)
	if err != nil {
		return block{}, libkb.NewChatStorageInternalError(s.G(), "createBlock: failed to write index: %s", err.Error())
	}

	// Write out new block
	b := block{BlockID: bi.MaxBlock}
	if cerr := s.writeBlock(bi, b); err != nil {
		return block{}, libkb.NewChatStorageInternalError(s.G(), "createBlock: failed to write block: %s", cerr.Message())
	}

	return b, nil
}

func (s *Storage) getBlock(bi *blockIndex, id chat1.MessageID) (block, libkb.ChatStorageError) {
	if id == 0 {
		return block{}, libkb.NewChatStorageInternalError(s.G(), "getBlock: invalid block id: %d", id)
	}
	bn := s.getBlockNumber(id)
	if bn > bi.MaxBlock {
		s.debug("getBlock(): missed high: id: %d max: %d", bn, bi.MaxBlock)
		return block{}, libkb.ChatStorageMissError{}
	}
	return s.readBlock(bi, bn)
}

func (s *Storage) readBlock(bi *blockIndex, id int) (block, libkb.ChatStorageError) {

	s.debug("readBlock: reading block: %d", id)
	key := s.makeBlockKey(bi.ConvID, bi.UID, id)
	raw, found, err := s.G().LocalDb.GetRaw(key)
	if err != nil {
		return block{}, libkb.NewChatStorageInternalError(s.G(), "readBlock: failed to read raw: %s", err.Error())
	}
	if !found {
		// Didn't find it for some reason
		return block{}, libkb.NewChatStorageInternalError(s.G(), "readBlock: block not found: id: %d", id)
	}

	var b block
	if err = s.decode(raw, &b); err != nil {
		return block{}, libkb.NewChatStorageInternalError(s.G(), "readBlock: failed to decode: %s", err.Error())
	}
	return b, nil
}

func (s *Storage) writeBlock(bi *blockIndex, b block) libkb.ChatStorageError {
	dat, err := s.encode(b)
	if err != nil {
		return libkb.NewChatStorageInternalError(s.G(), "writeBlock: failed to encode: %s", err.Error())
	}
	if err = s.G().LocalDb.PutRaw(s.makeBlockKey(bi.ConvID, bi.UID, b.BlockID), dat); err != nil {
		return libkb.NewChatStorageInternalError(s.G(), "writeBlock: failed to write: %s", err.Error())
	}
	return nil
}

func (s *Storage) mustNuke(err libkb.ChatStorageError, convID chat1.ConversationID, uid gregor1.UID) libkb.ChatStorageError {
	// Clear index
	if err.ShouldClear() {
		s.G().Log.Warning("chat local storage corrupted: clearing")
		if err := s.G().LocalDb.Delete(s.makeBlockIndexKey(convID, uid)); err != nil {
			if _, err = s.G().LocalDb.Nuke(); err != nil {
				panic("unable to clear local storage")
			}
		}
	}
	return err
}

func (s *Storage) Merge(convID chat1.ConversationID, uid gregor1.UID, msgs []chat1.MessageFromServerOrError) libkb.ChatStorageError {
	s.Lock()
	defer s.Unlock()

	// Merge convID into uid index
	if err := s.mergeConvIndex(convID, uid); err != nil {
		return s.mustNuke(err, convID, uid)
	}

	// Get block index first
	bi, err := s.readBlockIndex(convID, uid)
	if err != nil {
		return s.mustNuke(err, convID, uid)
	}

	// Write out new data into blocks
	if err = s.writeMessages(&bi, msgs); err != nil {
		return s.mustNuke(err, convID, uid)
	}

	// Update supersededBy pointers
	if err = s.updateSupersededBy(&bi, msgs); err != nil {
		return s.mustNuke(err, convID, uid)
	}

	return nil
}

func (s *Storage) updateSupersededBy(bi *blockIndex, msgs []chat1.MessageFromServerOrError) libkb.ChatStorageError {

	// Do a pass over all the messages and update supersededBy pointers
	for _, msg := range msgs {
		superID := msg.Message.MessagePlaintext.V1().ClientHeader.Supersedes
		if superID == 0 {
			continue
		}

		// Read block with super msg on it
		b, err := s.getBlock(bi, superID)
		if err != nil {
			// If we don't have the block, just keep going
			if _, ok := err.(libkb.ChatStorageMissError); ok {
				continue
			}
			return err
		}

		// Update supersededBy on the target message if we have it
		superMsg := &b.Msgs[s.getBlockPosition(superID)]
		if superMsg.Message != nil {
			superMsg.Message.ServerHeader.SupersededBy = superID
			if err = s.writeBlock(bi, b); err != nil {
				return err
			}
		}
	}

	return nil
}

func (s *Storage) writeMessages(bi *blockIndex, msgs []chat1.MessageFromServerOrError) libkb.ChatStorageError {
	var err libkb.ChatStorageError
	var maxB block
	var newBlock block
	var lastWritten int
	docreate := false

	// Get the maximum  block (create it if we need to)
	maxID := msgs[0].Message.ServerHeader.MessageID
	s.debug("writeMessages: maxID: %d num: %d", maxID, len(msgs))
	if maxB, err = s.getBlock(bi, maxID); err != nil {
		if _, ok := err.(libkb.ChatStorageMissError); !ok {
			return err
		}
		docreate = true
	}
	if docreate {
		s.debug("writeMessages: block not found (creating): maxID: %d id: %d", maxID,
			s.getBlockNumber(maxID))
		if _, err = s.createBlock(bi); err != nil {
			return libkb.NewChatStorageInternalError(s.G(), "writeMessages: failed to create block: %s", err.Message())
		}
		if maxB, err = s.getBlock(bi, maxID); err != nil {
			return libkb.NewChatStorageInternalError(s.G(), "writeMessages: failed to read newly created block: %s", err.Message())
		}
	}

	// Append to the block
	newBlock.Msgs = maxB.Msgs
	for index, msg := range msgs {
		msgID := msg.Message.ServerHeader.MessageID
		if s.getBlockNumber(msgID) != maxB.BlockID {
			s.debug("writeMessages: crossed block boundary, aborting and writing out: msgID: %d", msgID)
			break
		}
		newBlock.Msgs[s.getBlockPosition(msgID)] = msg
		lastWritten = index
	}

	// Write the block
	if err = s.writeBlock(bi, newBlock); err != nil {
		return libkb.NewChatStorageInternalError(s.G(), "writeMessages: failed to write block: %s", err.Message())
	}

	// We didn't write everything out in this block, move to another one
	if lastWritten < len(msgs)-1 {
		return s.writeMessages(bi, msgs[lastWritten+1:])
	}
	return nil
}

type doneFunc func(*[]chat1.MessageFromServerOrError, int) bool

func (s *Storage) readMessages(res *[]chat1.MessageFromServerOrError, bi *blockIndex,
	maxID chat1.MessageID, num int, df doneFunc) libkb.ChatStorageError {

	// Get the current block where max ID is found
	b, err := s.getBlock(bi, maxID)
	if err != nil {
		return err
	}

	// Add messages to result set
	var lastAdded chat1.MessageID
	maxPos := s.getBlockPosition(maxID)

	s.debug("readMessages: BID: %d maxPos: %d maxID: %d num: %d", b.BlockID, maxPos, maxID, num)
	for index := maxPos; len(*res) < num && index >= 0; index-- {

		msg := b.Msgs[index]
		if msg.Message == nil {
			s.debug("readMessages: cache entry empty: index: %d block: %d msgID: %d", index, b.BlockID, s.getMsgID(b.BlockID, index))
			return libkb.ChatStorageMissError{}
		}
		bMsgID := msg.Message.ServerHeader.MessageID

		// Sanity check
		if bMsgID != s.getMsgID(b.BlockID, index) {
			return libkb.NewChatStorageInternalError(s.G(), "chat entry corruption: bMsgID: %d != %d (block: %d pos: %d)", bMsgID, s.getMsgID(b.BlockID, index), b.BlockID, index)
		}

		s.debug("readMessages: adding msg_id: %d", msg.Message.ServerHeader.MessageID)
		*res = append(*res, msg)
		lastAdded = msg.Message.ServerHeader.MessageID
	}

	// Check if we read anything, otherwise move to another block and try again
	if !df(res, num) && b.BlockID > 0 {
		return s.readMessages(res, bi, lastAdded-1, num, df)
	}
	return nil
}

func (s *Storage) getRemoteMaxID(ctx context.Context, ri chat1.RemoteInterface, convID chat1.ConversationID) (chat1.MessageID, libkb.ChatStorageError) {

	s.debug("getRemoteMaxID: fetching remote max for: %d", convID)
	conv, err := ri.GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query: &chat1.GetInboxQuery{
			ConvID: &convID,
		},
	})
	if err != nil {
		return 0, libkb.ChatStorageRemoteError{Msg: err.Error()}
	}
	if len(conv.Inbox.Conversations) == 0 {
		return 0, libkb.ChatStorageRemoteError{Msg: fmt.Sprintf("conv not found: %d", convID)}
	}
	return conv.Inbox.Conversations[0].ReaderInfo.MaxMsgid, nil
}

func (s *Storage) Fetch(ctx context.Context, ri chat1.RemoteInterface, convID chat1.ConversationID,
	uid gregor1.UID, query *chat1.GetThreadQuery,
	pagination *chat1.Pagination) ([]chat1.MessageFromServerOrError, libkb.ChatStorageError) {

	s.Lock()
	defer s.Unlock()

	// Get block index first
	bi, err := s.readBlockIndex(convID, uid)
	if err != nil {
		return nil, s.mustNuke(err, convID, uid)
	}

	// Calculate seek parameters
	var maxID chat1.MessageID
	var num int
	if pagination == nil {
		if maxID, err = s.getRemoteMaxID(ctx, ri, convID); err != nil {
			return nil, s.mustNuke(err, convID, uid)
		}
		num = 10000
	} else {
		var pid chat1.MessageID
		num = pagination.Num
		if len(pagination.Next) == 0 && len(pagination.Previous) == 0 {
			if maxID, err = s.getRemoteMaxID(ctx, ri, convID); err != nil {
				return nil, s.mustNuke(err, convID, uid)
			}
		} else if len(pagination.Next) > 0 {
			if derr := s.decode(pagination.Next, &pid); derr != nil {
				err = libkb.ChatStorageRemoteError{Msg: "Fetch: failed to decode pager: " + derr.Error()}
				return nil, s.mustNuke(err, convID, uid)
			}
			maxID = pid
		} else {
			if derr := s.decode(pagination.Previous, &pid); derr != nil {
				err = libkb.ChatStorageRemoteError{Msg: "Fetch: failed to decode pager: " + derr.Error()}
				return nil, s.mustNuke(err, convID, uid)
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
	simpleDoneFunc := func(msgs *[]chat1.MessageFromServerOrError, num int) bool {
		return len(*msgs) >= num
	}
	typedDoneFunc := func(msgs *[]chat1.MessageFromServerOrError, num int) bool {
		count := 0
		for _, msg := range *msgs {
			if _, ok := typmap[msg.Message.ServerHeader.MessageType]; ok {
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
		df = simpleDoneFunc
	}

	// Run seek looking for all the messages
	var res []chat1.MessageFromServerOrError
	if err = s.readMessages(&res, &bi, maxID, num, df); err != nil {
		return nil, err
	}

	s.debug("Fetch: cache hit: num: %d", len(res))
	return res, nil
}
