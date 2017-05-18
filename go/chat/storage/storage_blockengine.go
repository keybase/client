package storage

import (
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/crypto/nacl/secretbox"
	"golang.org/x/net/context"
)

const blockIndexVersion = 6
const blockSize = 100

type blockEngine struct {
	globals.Contextified
	utils.DebugLabeler
}

func newBlockEngine(g *globals.Context) *blockEngine {
	return &blockEngine{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "BlockEngine", true),
	}
}

type blockIndex struct {
	Version       int
	ServerVersion int
	ConvID        chat1.ConversationID
	UID           gregor1.UID
	MaxBlock      int
	BlockSize     int
}

type block struct {
	BlockID int
	Msgs    [blockSize]chat1.MessageUnboxed
}

type boxedBlock struct {
	V int
	N [24]byte
	E []byte
}

func (be *blockEngine) makeBlockKey(convID chat1.ConversationID, uid gregor1.UID, blockID int) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatBlocks,
		Key: fmt.Sprintf("bl:%s:%s:%d", uid, convID, blockID),
	}
}

func (be *blockEngine) getBlockNumber(id chat1.MessageID) int {
	return int(id) / blockSize
}

func (be *blockEngine) getBlockPosition(id chat1.MessageID) int {
	return int(id) % blockSize
}

func (be *blockEngine) getMsgID(blockNum, blockPos int) chat1.MessageID {
	return chat1.MessageID(blockNum*blockSize + blockPos)
}

func (be *blockEngine) createBlockIndex(ctx context.Context, key libkb.DbKey,
	convID chat1.ConversationID, uid gregor1.UID) (blockIndex, Error) {

	be.Debug(ctx, "createBlockIndex: creating new block index: convID: %s uid: %s", convID, uid)

	// Grab latest server version to tag local data with
	srvVers, serr := be.G().ServerCacheVersions.Fetch(ctx)
	if serr != nil {
		return blockIndex{},
			NewInternalError(ctx, be.DebugLabeler, "createBlockIndex: failed to get server versions: %s", serr.Error())
	}

	bi := blockIndex{
		Version:       blockIndexVersion,
		ServerVersion: srvVers.BodiesVers,
		ConvID:        convID,
		UID:           uid,
		MaxBlock:      0,
		BlockSize:     blockSize,
	}

	var err Error
	if _, err = be.createBlock(ctx, &bi, 0); err != nil {
		return bi, NewInternalError(ctx, be.DebugLabeler, "createBlockIndex: failed to create block: %s", err.Message())
	}

	dat, rerr := encode(bi)
	if rerr != nil {
		return bi, NewInternalError(ctx, be.DebugLabeler, "createBlockIndex: failed to encode %s", err.Error())
	}
	if rerr = be.G().LocalChatDb.PutRaw(key, dat); rerr != nil {
		return bi, NewInternalError(ctx, be.DebugLabeler, "createBlockIndex: failed to write: %s", rerr.Error())
	}
	return bi, nil
}

func (be *blockEngine) readBlockIndex(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (blockIndex, Error) {
	key := makeBlockIndexKey(convID, uid)
	raw, found, err := be.G().LocalChatDb.GetRaw(key)
	if err != nil {
		return blockIndex{}, NewInternalError(ctx, be.DebugLabeler, "readBlockIndex: failed to read index block: %s", err.Error())
	}
	if !found {
		// If not found, create a new one and return it
		be.Debug(ctx, "readBlockIndex: no block index found, creating: convID: %d uid: %s", convID, uid)
		return be.createBlockIndex(ctx, key, convID, uid)
	}

	// Decode and return
	var bi blockIndex
	if err = decode(raw, &bi); err != nil {
		return bi, NewInternalError(ctx, be.DebugLabeler, "readBlockIndex: failed to decode: %s", err.Error())
	}
	if bi.Version != blockIndexVersion {
		be.Debug(ctx, "readBlockInbox: version mismatch, creating new index")
		return be.createBlockIndex(ctx, key, convID, uid)
	}

	// Check server version
	if _, err = be.G().ServerCacheVersions.MatchBodies(ctx, bi.ServerVersion); err != nil {
		be.Debug(ctx, "readBlockInbox: server version error: %s, creating new index", err.Error())
		return be.createBlockIndex(ctx, key, convID, uid)
	}

	return bi, nil
}

type bekey string

var bebikey bekey = "bebi"
var beskkey bekey = "besk"

func (be *blockEngine) Init(ctx context.Context, key [32]byte, convID chat1.ConversationID,
	uid gregor1.UID) (context.Context, Error) {

	ctx = context.WithValue(ctx, beskkey, key)

	bi, err := be.readBlockIndex(ctx, convID, uid)
	if err != nil {
		return ctx, err
	}
	ctx = context.WithValue(ctx, bebikey, &bi)

	return ctx, nil
}

func (be *blockEngine) fetchBlockIndex(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID) (bi blockIndex, err Error) {
	var ok bool
	val := ctx.Value(bebikey)
	if bi, ok = val.(blockIndex); !ok {
		bi, err = be.readBlockIndex(ctx, convID, uid)
		if err != nil {
			return bi, err
		}
	}
	be.Debug(ctx, "fetchBlockIndex: maxBlock: %d", bi.MaxBlock)
	return bi, err
}

func (be *blockEngine) fetchSecretKey(ctx context.Context) (key [32]byte, err Error) {
	var ok bool
	val := ctx.Value(beskkey)
	if key, ok = val.([32]byte); !ok {
		return key, MiscError{Msg: "secret key not in context"}
	}
	return key, nil
}

func (be *blockEngine) createBlockSingle(ctx context.Context, bi blockIndex, blockID int) (block, Error) {
	be.Debug(ctx, "createBlockSingle: creating block: %d", blockID)
	// Write out new block
	b := block{BlockID: blockID}
	if cerr := be.writeBlock(ctx, bi, b); cerr != nil {
		return block{}, NewInternalError(ctx, be.DebugLabeler, "createBlockSingle: failed to write block: %s", cerr.Message())
	}
	return b, nil
}

func (be *blockEngine) createBlock(ctx context.Context, bi *blockIndex, blockID int) (block, Error) {

	// Create all the blocks up to the one we want
	var b block
	for i := bi.MaxBlock; i <= blockID; i++ {
		b, err := be.createBlockSingle(ctx, *bi, i)
		if err != nil {
			return b, err
		}
	}

	// Update block index with new block
	bi.MaxBlock = blockID
	dat, err := encode(bi)
	if err != nil {
		return block{}, NewInternalError(ctx, be.DebugLabeler, "createBlock: failed to encode block: %s", err.Error())
	}
	err = be.G().LocalChatDb.PutRaw(makeBlockIndexKey(bi.ConvID, bi.UID), dat)
	if err != nil {
		return block{}, NewInternalError(ctx, be.DebugLabeler, "createBlock: failed to write index: %s", err.Error())
	}

	return b, nil
}

func (be *blockEngine) getBlock(ctx context.Context, bi blockIndex, id chat1.MessageID) (block, Error) {
	if id == 0 {
		return block{}, NewInternalError(ctx, be.DebugLabeler, "getBlock: invalid block id: %d", id)
	}
	bn := be.getBlockNumber(id)
	if bn > bi.MaxBlock {
		be.Debug(ctx, "getBlock(): missed high: id: %d maxblock: %d", bn, bi.MaxBlock)
		return block{}, MissError{}
	}
	return be.readBlock(ctx, bi, bn)
}

func (be *blockEngine) readBlock(ctx context.Context, bi blockIndex, id int) (block, Error) {

	be.Debug(ctx, "readBlock: reading block: %d", id)
	key := be.makeBlockKey(bi.ConvID, bi.UID, id)
	raw, found, err := be.G().LocalChatDb.GetRaw(key)
	if err != nil {
		return block{}, NewInternalError(ctx, be.DebugLabeler, "readBlock: failed to read raw: %s", err.Error())
	}
	if !found {
		// Didn't find it for some reason
		return block{}, NewInternalError(ctx, be.DebugLabeler, "readBlock: block not found: id: %d", id)
	}

	// Decode boxed block
	var b boxedBlock
	if err = decode(raw, &b); err != nil {
		return block{}, NewInternalError(ctx, be.DebugLabeler, "readBlock: failed to decode: %s", err.Error())
	}
	if b.V > cryptoVersion {
		return block{}, NewInternalError(ctx, be.DebugLabeler, "readBlock: bad crypto version: %d current: %d id: %d", b.V, cryptoVersion, id)
	}

	// Decrypt block
	fkey, cerr := be.fetchSecretKey(ctx)
	if cerr != nil {
		return block{}, cerr
	}
	pt, ok := secretbox.Open(nil, b.E, &b.N, &fkey)
	if !ok {
		return block{}, NewInternalError(ctx, be.DebugLabeler, "readBlock: failed to decrypt block: %d", id)
	}

	// Decode payload
	var res block
	if err = decode(pt, &res); err != nil {
		return block{}, NewInternalError(ctx, be.DebugLabeler, "readBlock: failed to decode: %s", err.Error())
	}

	return res, nil
}

func (be *blockEngine) writeBlock(ctx context.Context, bi blockIndex, b block) Error {
	be.Debug(ctx, "writeBlock: writing out block: %d", b.BlockID)

	// Encode block
	dat, err := encode(b)
	if err != nil {
		return NewInternalError(ctx, be.DebugLabeler, "writeBlock: failed to encode: %s", err.Error())
	}

	// Encrypt block
	key, cerr := be.fetchSecretKey(ctx)
	if cerr != nil {
		return cerr
	}
	var nonce []byte
	nonce, err = libkb.RandBytes(24)
	if err != nil {
		return MiscError{Msg: fmt.Sprintf("encryptMessage: failure to generate nonce: %s", err.Error())}
	}
	var fnonce [24]byte
	copy(fnonce[:], nonce)
	sealed := secretbox.Seal(nil, dat, &fnonce, &key)

	// Encode encrypted block
	payload := boxedBlock{
		V: cryptoVersion,
		N: fnonce,
		E: sealed,
	}
	bpayload, err := encode(payload)
	if err != nil {
		return NewInternalError(ctx, be.DebugLabeler, "writeBlock: failed to encode: %s", err.Error())
	}

	// Write out encrypted block
	if err = be.G().LocalChatDb.PutRaw(be.makeBlockKey(bi.ConvID, bi.UID, b.BlockID), bpayload); err != nil {
		return NewInternalError(ctx, be.DebugLabeler, "writeBlock: failed to write: %s", err.Error())
	}
	return nil
}

func (be *blockEngine) WriteMessages(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	msgs []chat1.MessageUnboxed) Error {

	var err Error
	var maxB block
	var newBlock block
	var lastWritten int
	docreate := false

	// Get block index
	bi, err := be.fetchBlockIndex(ctx, convID, uid)
	if err != nil {
		return err
	}

	// Sanity check
	if len(msgs) == 0 {
		return nil
	}

	// Get the maximum  block (create it if we need to)
	maxID := msgs[0].GetMessageID()
	be.Debug(ctx, "writeMessages: maxID: %d num: %d", maxID, len(msgs))
	if maxB, err = be.getBlock(ctx, bi, maxID); err != nil {
		if _, ok := err.(MissError); !ok {
			return err
		}
		docreate = true
	}
	if docreate {
		newBlockID := be.getBlockNumber(maxID)
		be.Debug(ctx, "writeMessages: block not found (creating): maxID: %d id: %d", maxID, newBlockID)
		if _, err = be.createBlock(ctx, &bi, newBlockID); err != nil {
			return NewInternalError(ctx, be.DebugLabeler, "writeMessages: failed to create block: %s", err.Message())
		}
		if maxB, err = be.getBlock(ctx, bi, maxID); err != nil {
			return NewInternalError(ctx, be.DebugLabeler, "writeMessages: failed to read newly created block: %s", err.Message())
		}
	}

	// Append to the block
	newBlock = maxB
	for index, msg := range msgs {
		msgID := msg.GetMessageID()
		if be.getBlockNumber(msgID) != newBlock.BlockID {
			be.Debug(ctx, "writeMessages: crossed block boundary, aborting and writing out: msgID: %d", msgID)
			break
		}
		newBlock.Msgs[be.getBlockPosition(msgID)] = msg
		lastWritten = index
	}

	// Write the block
	if err = be.writeBlock(ctx, bi, newBlock); err != nil {
		return NewInternalError(ctx, be.DebugLabeler, "writeMessages: failed to write block: %s", err.Message())
	}

	// We didn't write everything out in this block, move to another one
	if lastWritten < len(msgs)-1 {
		return be.WriteMessages(ctx, convID, uid, msgs[lastWritten+1:])
	}
	return nil
}

func (be *blockEngine) ReadMessages(ctx context.Context, res ResultCollector,
	convID chat1.ConversationID, uid gregor1.UID, maxID chat1.MessageID) (err Error) {

	// Run all errors through resultCollector
	defer func() {
		if err != nil {
			err = res.Error(err)
		}
	}()

	// Get block index
	bi, err := be.fetchBlockIndex(ctx, convID, uid)
	if err != nil {
		return err
	}

	// Get the current block where max ID is found
	b, err := be.getBlock(ctx, bi, maxID)
	if err != nil {
		return err
	}

	// Add messages to result set
	var lastAdded chat1.MessageID
	maxPos := be.getBlockPosition(maxID)

	be.Debug(ctx, "readMessages: BID: %d maxPos: %d maxID: %d rc: %s", b.BlockID, maxPos, maxID, res)
	for index := maxPos; !res.Done() && index >= 0; index-- {
		if b.BlockID == 0 && index == 0 {
			// Short circuit out of here if we are on the null message
			break
		}

		msg := b.Msgs[index]
		if msg.GetMessageID() == 0 {
			if res.PushPlaceholder(be.getMsgID(b.BlockID, index)) {
				// If the result collector is happy to receive this blank entry, then don't complain
				// and proceed as if this was a hit
				lastAdded = be.getMsgID(b.BlockID, index)
				continue
			} else {
				be.Debug(ctx, "readMessages: cache entry empty: index: %d block: %d msgID: %d", index,
					b.BlockID, be.getMsgID(b.BlockID, index))
				return MissError{}
			}
		}
		bMsgID := msg.GetMessageID()

		// Sanity check
		if bMsgID != be.getMsgID(b.BlockID, index) {
			return NewInternalError(ctx, be.DebugLabeler, "chat entry corruption: bMsgID: %d != %d (block: %d pos: %d)", bMsgID, be.getMsgID(b.BlockID, index), b.BlockID, index)
		}

		be.Debug(ctx, "readMessages: adding msg_id: %d (blockid: %d pos: %d)",
			msg.GetMessageID(), b.BlockID, index)
		lastAdded = msg.GetMessageID()
		res.Push(msg)
	}

	// Check if we read anything, otherwise move to another block and try again
	if !res.Done() && b.BlockID > 0 {
		return be.ReadMessages(ctx, res, convID, uid, lastAdded-1)
	}
	return nil
}
