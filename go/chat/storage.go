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
// Supersedes
// Error handling
// Gregor OOBM integration
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

func (s *Storage) getBlock(bi *blockIndex, id chat1.MessageID) (block, bool, error) {
	if id == 0 {
		return block{}, false, fmt.Errorf("invalid block id: %d", id)
	}
	return s.readBlock(bi, s.getBlockNumber(id))
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

func (s *Storage) mergeConvIndex(convID chat1.ConversationID, uid gregor1.UID) error {
	// Get current index
	si, found, err := s.getIndex(uid)
	if err != nil {
		return err
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
		return err
	}
	return s.G().LocalDb.PutRaw(s.makeConvIndexKey(uid), dat)
}

func (s *Storage) createBlockIndex(key libkb.DbKey, convID chat1.ConversationID, uid gregor1.UID) (blockIndex, error) {
	bi := blockIndex{
		ConvID:   convID,
		UID:      uid,
		MaxBlock: -1,
	}

	s.debug("createBlockIndex: creating new block index: convID: %d uid: %s", convID, uid)
	_, err := s.createBlock(&bi)
	if err != nil {
		return bi, err
	}

	dat, err := s.encode(bi)
	if err != nil {
		return bi, err
	}
	return bi, s.G().LocalDb.PutRaw(key, dat)
}

func (s *Storage) readBlockIndex(convID chat1.ConversationID, uid gregor1.UID) (blockIndex, error) {
	key := s.makeBlockIndexKey(convID, uid)
	raw, found, err := s.G().LocalDb.GetRaw(key)
	if err != nil {
		return blockIndex{}, err
	}
	if !found {
		// If not found, create a new one and return it
		s.debug("readBlockIndex: no block index found, creating: convID: %d uid: %s", convID, uid)
		return s.createBlockIndex(key, convID, uid)
	}

	// Decode and return
	var bi blockIndex
	if err = s.decode(raw, &bi); err != nil {
		return bi, err
	}
	return bi, nil
}

func (s *Storage) createBlock(bi *blockIndex) (block, error) {

	// Update block index with new block
	bi.MaxBlock++
	dat, err := s.encode(bi)
	if err != nil {
		return block{}, err
	}
	s.debug("createBlock: creating block: %d", bi.MaxBlock)
	err = s.G().LocalDb.PutRaw(s.makeBlockIndexKey(bi.ConvID, bi.UID), dat)
	if err != nil {
		return block{}, err
	}

	// Write out new block
	b := block{BlockID: bi.MaxBlock}
	key := s.makeBlockKey(bi.ConvID, bi.UID, bi.MaxBlock)
	dat, err = s.encode(b)
	if err != nil {
		return block{}, err
	}

	return b, s.G().LocalDb.PutRaw(key, dat)
}

func (s *Storage) readBlock(bi *blockIndex, id int) (block, bool, error) {

	s.debug("readBlock: reading block: %d", id)
	key := s.makeBlockKey(bi.ConvID, bi.UID, id)
	raw, found, err := s.G().LocalDb.GetRaw(key)
	if err != nil {
		return block{}, false, err
	}
	if !found {
		// Didn't find it for some reason
		return block{}, false, nil
	}

	var b block
	if err = s.decode(raw, &b); err != nil {
		return block{}, found, err
	}
	return b, found, nil
}

func (s *Storage) Merge(convID chat1.ConversationID, uid gregor1.UID, msgs []chat1.MessageFromServerOrError) error {
	s.Lock()
	defer s.Unlock()

	// Merge convID into uid index
	if err := s.mergeConvIndex(convID, uid); err != nil {
		return err
	}

	// Get block index first
	bi, err := s.readBlockIndex(convID, uid)
	if err != nil {
		return err
	}

	// Write out new data into blocks
	return s.writeMessages(&bi, msgs)
}

func (s *Storage) writeMessages(bi *blockIndex, msgs []chat1.MessageFromServerOrError) error {
	var err error
	var maxB block
	var newBlock block
	var lastWritten int
	var found bool

	// Get the maximum  block (create it if we need to)
	maxID := msgs[0].Message.ServerHeader.MessageID
	s.debug("writeMessages: maxID: %d num: %d", maxID, len(msgs))
	if maxB, found, err = s.getBlock(bi, maxID); err != nil {
		return err
	}
	if !found {
		s.debug("writeMessages: block not found (creating): maxID: %d id: %d", maxID,
			s.getBlockNumber(maxID))
		if _, err = s.createBlock(bi); err != nil {
			return nil
		}
		if maxB, found, err = s.getBlock(bi, maxID); err != nil {
			return err
		}
		if !found {
			return fmt.Errorf("weird block request, not found, aborting")
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
	dat, err := s.encode(newBlock)
	if err != nil {
		return err
	}
	if err = s.G().LocalDb.PutRaw(s.makeBlockKey(bi.ConvID, bi.UID, maxB.BlockID), dat); err != nil {
		return err
	}

	// We didn't write everything out in this block, move to another one
	if lastWritten < len(msgs)-1 {
		return s.writeMessages(bi, msgs[lastWritten+1:])
	}
	return nil
}

type doneFunc func(*[]chat1.MessageFromServerOrError, int) bool

func (s *Storage) readMessages(res *[]chat1.MessageFromServerOrError, bi *blockIndex,
	maxID chat1.MessageID, num int, df doneFunc) error {

	// Get the current block where max ID is found
	b, found, err := s.getBlock(bi, maxID)
	if err != nil {
		return err
	}
	if !found {
		return fmt.Errorf("no block for read")
	}

	// Add messages to result set
	var lastAdded chat1.MessageID
	maxPos := s.getBlockPosition(maxID)

	s.debug("readMessages: BID: %d maxPos: %d maxID: %d num: %d", b.BlockID, maxPos, maxID, num)
	for index := maxPos; len(*res) < num && index >= 0; index-- {

		msg := b.Msgs[index]
		if msg.Message == nil {
			s.debug("readMessages: cache entry empty: index: %d block: %d msgID: %d", index, b.BlockID, s.getMsgID(b.BlockID, index))
			return fmt.Errorf("chat entry not found: index: %d", index)
		}
		bMsgID := msg.Message.ServerHeader.MessageID

		// Sanity check
		if bMsgID != s.getMsgID(b.BlockID, index) {
			return fmt.Errorf("chat entry corruption: bMsgID: %d != %d (block: %d pos: %d)",
				bMsgID, s.getMsgID(b.BlockID, index), b.BlockID, index)
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

func (s *Storage) getRemoteMaxID(ctx context.Context, ri chat1.RemoteInterface, convID chat1.ConversationID) (chat1.MessageID, error) {

	s.debug("getRemoteMaxID: fetching remote max for: %d", convID)
	conv, err := ri.GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query: &chat1.GetInboxQuery{
			ConvID: &convID,
		},
	})
	if err != nil {
		return 0, err
	}
	if len(conv.Inbox.Conversations) == 0 {
		return 0, fmt.Errorf("no conv found: %d", convID)
	}
	return conv.Inbox.Conversations[0].ReaderInfo.MaxMsgid, nil
}

func (s *Storage) Fetch(ctx context.Context, ri chat1.RemoteInterface, convID chat1.ConversationID,
	uid gregor1.UID, query *chat1.GetThreadQuery,
	pagination *chat1.Pagination) ([]chat1.MessageFromServerOrError, error) {

	s.Lock()
	defer s.Unlock()

	// Get block index first
	bi, err := s.readBlockIndex(convID, uid)
	if err != nil {
		return nil, err
	}

	// Calculate seek parameters
	var maxID chat1.MessageID
	var num int
	if pagination == nil {
		if maxID, err = s.getRemoteMaxID(ctx, ri, convID); err != nil {
			return nil, err
		}
		num = 10000
	} else {
		var pid chat1.MessageID
		num = pagination.Num
		if len(pagination.Next) == 0 && len(pagination.Previous) == 0 {
			if maxID, err = s.getRemoteMaxID(ctx, ri, convID); err != nil {
				return nil, err
			}
		} else if len(pagination.Next) > 0 {
			if err = s.decode(pagination.Next, &pid); err != nil {
				return nil, err
			}
			maxID = pid
		} else {
			if err = s.decode(pagination.Previous, &pid); err != nil {
				return nil, err
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
