package chat

import (
	"fmt"
	"sync"

	"github.com/keybase/client/go/chat/pager"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/go-codec/codec"
	"golang.org/x/crypto/nacl/secretbox"
	"golang.org/x/net/context"
)

const blockSize = 100

// If we change this, mae sure to update libkb.EncryptionReasonChatLocalStorage as well!
const version = 1

type boxedLocalMessage struct {
	Version    int               `codec:"V"`
	MsgID      chat1.MessageID   `codec:"I"`
	MsgType    chat1.MessageType `codec:"T"`
	Ciphertext []byte            `codec:"C"`
	Nonce      [24]byte          `codec:"N"`
}

func (b boxedLocalMessage) GetMessageID() chat1.MessageID {
	return b.MsgID
}

func (b boxedLocalMessage) GetMessageType() chat1.MessageType {
	return b.MsgType
}

type Storage struct {
	sync.Mutex
	libkb.Contextified
	getSecretUI func() libkb.SecretUI
}

type blockIndex struct {
	ConvID    chat1.ConversationID
	UID       gregor1.UID
	MaxBlock  int
	BlockSize int
}

type block struct {
	BlockID int
	Msgs    [blockSize]boxedLocalMessage
}

func NewStorage(g *libkb.GlobalContext, getSecretUI func() libkb.SecretUI) *Storage {
	return &Storage{
		Contextified: libkb.NewContextified(g),
		getSecretUI:  getSecretUI,
	}
}

func (s *Storage) debug(format string, args ...interface{}) {
	s.G().Log.Debug("+ chatstorage: "+format, args...)
}

func (s *Storage) makeBlockKey(convID chat1.ConversationID, uid gregor1.UID, blockID int) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatBlocks,
		Key: fmt.Sprintf("bl:%s:%s:%d", uid, convID, blockID),
	}
}

func (s *Storage) makeBlockIndexKey(convID chat1.ConversationID, uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatBlockIndex,
		Key: fmt.Sprintf("bi:%s:%s", uid, convID),
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
	return int(id) / blockSize
}

func (s *Storage) getBlockPosition(id chat1.MessageID) int {
	return int(id) % blockSize
}

func (s *Storage) getMsgID(blockNum, blockPos int) chat1.MessageID {
	return chat1.MessageID(blockNum*blockSize + blockPos)
}

func (s *Storage) createBlockIndex(key libkb.DbKey, convID chat1.ConversationID, uid gregor1.UID) (blockIndex, libkb.ChatStorageError) {
	bi := blockIndex{
		ConvID:    convID,
		UID:       uid,
		MaxBlock:  0,
		BlockSize: blockSize,
	}

	s.debug("createBlockIndex: creating new block index: convID: %d uid: %s", convID, uid)
	_, err := s.createBlock(&bi, 0)
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

func (s *Storage) createBlockSingle(bi blockIndex, blockID int) (block, libkb.ChatStorageError) {
	s.debug("createBlockSingle: creating block: %d", blockID)
	// Write out new block
	b := block{BlockID: blockID}
	if cerr := s.writeBlock(bi, b); cerr != nil {
		return block{}, libkb.NewChatStorageInternalError(s.G(), "createBlockSingle: failed to write block: %s", cerr.Message())
	}
	return b, nil
}

func (s *Storage) createBlock(bi *blockIndex, blockID int) (block, libkb.ChatStorageError) {

	// Create all the blocks up to the one we want
	var b block
	for i := bi.MaxBlock; i <= blockID; i++ {
		b, err := s.createBlockSingle(*bi, i)
		if err != nil {
			return b, err
		}
	}

	// Update block index with new block
	bi.MaxBlock = blockID
	dat, err := s.encode(bi)
	if err != nil {
		return block{}, libkb.NewChatStorageInternalError(s.G(), "createBlock: failed to encode block: %s", err.Error())
	}
	err = s.G().LocalDb.PutRaw(s.makeBlockIndexKey(bi.ConvID, bi.UID), dat)
	if err != nil {
		return block{}, libkb.NewChatStorageInternalError(s.G(), "createBlock: failed to write index: %s", err.Error())
	}

	return b, nil
}

func (s *Storage) getBlock(bi blockIndex, id chat1.MessageID) (block, libkb.ChatStorageError) {
	if id == 0 {
		return block{}, libkb.NewChatStorageInternalError(s.G(), "getBlock: invalid block id: %d", id)
	}
	bn := s.getBlockNumber(id)
	if bn > bi.MaxBlock {
		s.debug("getBlock(): missed high: id: %d maxblock: %d", bn, bi.MaxBlock)
		return block{}, libkb.ChatStorageMissError{}
	}
	return s.readBlock(bi, bn)
}

func (s *Storage) readBlock(bi blockIndex, id int) (block, libkb.ChatStorageError) {

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

func (s *Storage) writeBlock(bi blockIndex, b block) libkb.ChatStorageError {
	s.debug("writeBlock: writing out block: %d", b.BlockID)
	dat, err := s.encode(b)
	if err != nil {
		return libkb.NewChatStorageInternalError(s.G(), "writeBlock: failed to encode: %s", err.Error())
	}
	if err = s.G().LocalDb.PutRaw(s.makeBlockKey(bi.ConvID, bi.UID, b.BlockID), dat); err != nil {
		return libkb.NewChatStorageInternalError(s.G(), "writeBlock: failed to write: %s", err.Error())
	}
	return nil
}

func (s *Storage) maybeNuke(force bool, err libkb.ChatStorageError, convID chat1.ConversationID, uid gregor1.UID) libkb.ChatStorageError {
	// Clear index
	if force || err.ShouldClear() {
		s.G().Log.Warning("chat local storage corrupted: clearing")
		if err := s.G().LocalDb.Delete(s.makeBlockIndexKey(convID, uid)); err != nil {
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

	s.debug("Merge: convID: %d uid: %s num msgs: %d", convID, uid, len(msgs))

	// Get block index first
	bi, err := s.readBlockIndex(convID, uid)
	if err != nil {
		return s.maybeNuke(false, err, convID, uid)
	}

	// Encrypt messages
	encmsgs, err := s.encryptMessages(ctx, uid, msgs)
	if err != nil {
		return s.maybeNuke(false, err, convID, uid)
	}

	// Write out new data into blocks
	if err = s.writeMessages(bi, encmsgs); err != nil {
		return s.maybeNuke(false, err, convID, uid)
	}

	// Update supersededBy pointers
	if err = s.updateAllSupersededBy(ctx, bi, uid, msgs); err != nil {
		return s.maybeNuke(false, err, convID, uid)
	}

	return nil
}

func (s *Storage) updateSupersededBy(ctx context.Context, bmsg *boxedLocalMessage, uid gregor1.UID,
	superID chat1.MessageID) libkb.ChatStorageError {

	// Decrypt
	decmsgs, err := s.decryptMessages(ctx, uid, []boxedLocalMessage{*bmsg})
	if err != nil {
		return err
	}

	decmsg := &decmsgs[0]
	if decmsg.Message != nil {
		decmsg.Message.ServerHeader.SupersededBy = superID
	} else {
		s.debug("updateSupersededBy: skipping id: %d, it is stored as an error", decmsg.GetMessageID())
	}

	// Encrypt
	encmsgs, err := s.encryptMessages(ctx, uid, decmsgs)
	if err != nil {
		return err
	}

	*bmsg = encmsgs[0]
	return nil
}

func (s *Storage) updateAllSupersededBy(ctx context.Context, bi blockIndex, uid gregor1.UID,
	msgs []chat1.MessageFromServerOrError) libkb.ChatStorageError {

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
		pos := s.getBlockPosition(superID)
		superMsg := &b.Msgs[pos]
		s.debug("updateSupersededBy: writing: id: %d superseded: %d blockID: %d pos: %d",
			msgid, superID, b.BlockID, pos)
		if err = s.updateSupersededBy(ctx, superMsg, uid, msgid); err != nil {
			return err
		}
		if err = s.writeBlock(bi, b); err != nil {
			return err
		}
	}

	return nil
}

func (s *Storage) getSecretBoxKey() (fkey [32]byte, err error) {

	// Get secret device key
	encKey, err := engine.GetMySecretKey(s.G(), s.getSecretUI, libkb.DeviceEncryptionKeyType, "encrypt chat message")
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

func (s *Storage) encryptMessages(ctx context.Context, uid gregor1.UID,
	msgs []chat1.MessageFromServerOrError) ([]boxedLocalMessage, libkb.ChatStorageError) {

	s.debug("encrypting %d messages", len(msgs))
	fkey, err := s.getSecretBoxKey()
	if err != nil {
		return nil, libkb.ChatStorageMiscError{Msg: fmt.Sprintf("encryptMessage: failed to get secret key: uid: %s err: %s", uid, err.Error())}
	}

	var res []boxedLocalMessage
	for _, msg := range msgs {
		// Encode message
		encmsg, err := s.encode(msg)
		if err != nil {
			return nil, libkb.ChatStorageMiscError{Msg: fmt.Sprintf("encryptMessage: failed to encode msg: %s", err.Error())}
		}

		// Encrypt message with key derived from device key
		var nonce []byte
		nonce, err = libkb.RandBytes(24)
		if err != nil {
			return nil, libkb.ChatStorageMiscError{Msg: fmt.Sprintf("encryptMessage: failure to generate nonce: %s", err.Error())}
		}
		var fnonce [24]byte
		copy(fnonce[:], nonce)
		sealed := secretbox.Seal(nil, encmsg, &fnonce, &fkey)

		res = append(res, boxedLocalMessage{
			Version:    version,
			MsgID:      msg.GetMessageID(),
			MsgType:    msg.GetMessageType(),
			Ciphertext: sealed,
			Nonce:      fnonce,
		})
	}

	return res, nil
}

func (s *Storage) decryptMessages(ctx context.Context, uid gregor1.UID,
	msgs []boxedLocalMessage) ([]chat1.MessageFromServerOrError, libkb.ChatStorageError) {

	s.debug("decrypting %d messages", len(msgs))

	// Get decryption key
	fkey, err := s.getSecretBoxKey()
	if err != nil {
		return nil, libkb.ChatStorageMiscError{Msg: fmt.Sprintf("decryptMEssage: failed to get secret box key: %s", err.Error())}
	}

	var res []chat1.MessageFromServerOrError
	for _, msg := range msgs {

		// Check for older version
		if msg.Version > version {
			return nil, libkb.NewChatStorageInternalError(s.G(), "decryptMessage: found incompatible message: id: %d version: %d current %d", msg.GetMessageID(), msg.Version, version)
		}

		// Decrypt message
		pt, ok := secretbox.Open(nil, msg.Ciphertext, &msg.Nonce, &fkey)
		if !ok {
			return nil, libkb.NewChatStorageInternalError(s.G(), "decryptMessage: failed to decrypt message: uid: %s msgid: %d err: %s", uid, msg.GetMessageID(), err.Error())
		}

		// Decode message
		var decmsg chat1.MessageFromServerOrError
		if err := s.decode(pt, &decmsg); err != nil {
			return nil, libkb.NewChatStorageInternalError(s.G(), "decryptMessage: failed to decode message: uid: %s msgid: %d err: %s", uid, msg.GetMessageID(), err.Error())
		}

		res = append(res, decmsg)
	}

	return res, nil
}

func (s *Storage) writeMessages(bi blockIndex, msgs []boxedLocalMessage) libkb.ChatStorageError {

	var err libkb.ChatStorageError
	var maxB block
	var newBlock block
	var lastWritten int
	docreate := false

	// Sanity check
	if len(msgs) == 0 {
		return nil
	}

	// Get the maximum  block (create it if we need to)
	maxID := msgs[0].GetMessageID()
	s.debug("writeMessages: maxID: %d num: %d", maxID, len(msgs))
	if maxB, err = s.getBlock(bi, maxID); err != nil {
		if _, ok := err.(libkb.ChatStorageMissError); !ok {
			return err
		}
		docreate = true
	}
	if docreate {
		newBlockID := s.getBlockNumber(maxID)
		s.debug("writeMessages: block not found (creating): maxID: %d id: %d", maxID, newBlockID)
		if _, err = s.createBlock(&bi, newBlockID); err != nil {
			return libkb.NewChatStorageInternalError(s.G(), "writeMessages: failed to create block: %s", err.Message())
		}
		if maxB, err = s.getBlock(bi, maxID); err != nil {
			return libkb.NewChatStorageInternalError(s.G(), "writeMessages: failed to read newly created block: %s", err.Message())
		}
	}

	// Append to the block
	newBlock = maxB
	for index, msg := range msgs {
		msgID := msg.GetMessageID()
		if s.getBlockNumber(msgID) != newBlock.BlockID {
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

type doneFunc func(*[]boxedLocalMessage, int) bool

func (s *Storage) readMessages(res *[]boxedLocalMessage, bi blockIndex,
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
		if b.BlockID == 0 && index == 0 {
			// Short circuit out of here if we are on the null message
			break
		}

		msg := b.Msgs[index]
		if msg.GetMessageID() == 0 {
			s.debug("readMessages: cache entry empty: index: %d block: %d msgID: %d", index, b.BlockID, s.getMsgID(b.BlockID, index))
			return libkb.ChatStorageMissError{}
		}
		bMsgID := msg.GetMessageID()

		// Sanity check
		if bMsgID != s.getMsgID(b.BlockID, index) {
			return libkb.NewChatStorageInternalError(s.G(), "chat entry corruption: bMsgID: %d != %d (block: %d pos: %d)", bMsgID, s.getMsgID(b.BlockID, index), b.BlockID, index)
		}

		s.debug("readMessages: adding msg_id: %d (blockid: %d pos: %d)",
			msg.GetMessageID(), b.BlockID, index)
		*res = append(*res, msg)
		lastAdded = msg.GetMessageID()
	}

	// Check if we read anything, otherwise move to another block and try again
	if !df(res, num) && b.BlockID > 0 {
		return s.readMessages(res, bi, lastAdded-1, num, df)
	}
	return nil
}

func (s *Storage) Fetch(ctx context.Context, conv chat1.Conversation,
	uid gregor1.UID, query *chat1.GetThreadQuery, pagination *chat1.Pagination,
	rl *[]*chat1.RateLimit) (chat1.ThreadView, libkb.ChatStorageError) {
	// All public functions get locks to make access to the database single threaded.
	// They should never be called from private functons.
	s.Lock()
	defer s.Unlock()

	// Get block index first
	convID := conv.Metadata.ConversationID
	bi, err := s.readBlockIndex(convID, uid)
	if err != nil {
		return chat1.ThreadView{}, s.maybeNuke(false, err, convID, uid)
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
			if derr := s.decode(pagination.Next, &pid); derr != nil {
				err = libkb.ChatStorageRemoteError{Msg: "Fetch: failed to decode pager: " + derr.Error()}
				return chat1.ThreadView{}, s.maybeNuke(false, err, convID, uid)
			}
			maxID = pid - 1
		} else {
			if derr := s.decode(pagination.Previous, &pid); derr != nil {
				err = libkb.ChatStorageRemoteError{Msg: "Fetch: failed to decode pager: " + derr.Error()}
				return chat1.ThreadView{}, s.maybeNuke(false, err, convID, uid)
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
	simpleDoneFunc := func(msgs *[]boxedLocalMessage, num int) bool {
		return len(*msgs) >= num
	}
	typedDoneFunc := func(msgs *[]boxedLocalMessage, num int) bool {
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
		df = simpleDoneFunc
	}

	// Run seek looking for all the messages
	var bres []boxedLocalMessage
	if err = s.readMessages(&bres, bi, maxID, num, df); err != nil {
		return chat1.ThreadView{}, err
	}

	// Decrypt messages
	res, err := s.decryptMessages(ctx, uid, bres)
	if err != nil {
		return chat1.ThreadView{}, err
	}

	// Form paged result
	var tres chat1.ThreadView
	var ierr error
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
