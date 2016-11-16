package chat

import (
	"encoding/gob"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/signencrypt"
	"github.com/keybase/client/go/protocol/chat1"
)

type AttachmentInfo struct {
	ObjectKey string                   // s3 destination
	EncKey    signencrypt.SecretboxKey // encryption key
	SignKey   signencrypt.SignKey      // signing key
	VerifyKey signencrypt.VerifyKey    // verification key
	Parts     map[int]string           // map of parts uploaded to S3, key == part number, value == hash of ciphertext
	StartedAt time.Time                // when the upload started
}

type AttachmentStash interface {
	Start(plaintextHash []byte, conversationID chat1.ConversationID, info AttachmentInfo) error
	Lookup(plaintextHash []byte, conversationID chat1.ConversationID) (AttachmentInfo, bool, error)
	RecordPart(plaintextHash []byte, conversationID chat1.ConversationID, partNumber int, hash string) error
	VerifyPart(plaintextHash []byte, conversationID chat1.ConversationID, partNumber int, hash string) (bool, error)
	Finish(plaintextHash []byte, conversationID chat1.ConversationID) error
}

type stashKey struct {
	PlaintextHash  []byte
	ConversationID chat1.ConversationID
}

func (s stashKey) String() string {
	return fmt.Sprintf("%x:%x", s.PlaintextHash, s.ConversationID)
}

var defaultStash = &FileStash{}

var ErrPartNotFound = errors.New("part does not exist in stash")

func StashStart(plaintextHash []byte, conversationID chat1.ConversationID, info AttachmentInfo) error {
	return defaultStash.Start(plaintextHash, conversationID, info)
}

func StashLookup(plaintextHash []byte, conversationID chat1.ConversationID) (AttachmentInfo, bool, error) {
	return defaultStash.Lookup(plaintextHash, conversationID)
}

func StashRecordPart(plaintextHash []byte, conversationID chat1.ConversationID, partNumber int, hash string) error {
	return defaultStash.RecordPart(plaintextHash, conversationID, partNumber, hash)
}

func StashVerifyPart(plaintextHash []byte, conversationID chat1.ConversationID, partNumber int, hash string) (bool, error) {
	return defaultStash.VerifyPart(plaintextHash, conversationID, partNumber, hash)
}

func StashFinish(plaintextHash []byte, conversationID chat1.ConversationID) error {
	return defaultStash.Finish(plaintextHash, conversationID)
}

type FileStash struct {
	sync.Mutex
}

func (f *FileStash) Start(plaintextHash []byte, conversationID chat1.ConversationID, info AttachmentInfo) error {
	f.Lock()
	defer f.Unlock()
	c, err := f.contents()
	if err != nil {
		return err
	}
	info.StartedAt = time.Now()
	key := stashKey{PlaintextHash: plaintextHash, ConversationID: conversationID}
	c[key.String()] = info

	return f.serialize(c)
}

func (f *FileStash) Lookup(plaintextHash []byte, conversationID chat1.ConversationID) (AttachmentInfo, bool, error) {
	f.Lock()
	defer f.Unlock()
	return f.lookup(plaintextHash, conversationID)
}

func (f *FileStash) RecordPart(plaintextHash []byte, conversationID chat1.ConversationID, partNumber int, hash string) error {
	f.Lock()
	defer f.Unlock()
	c, err := f.contents()
	if err != nil {
		return err
	}
	key := stashKey{PlaintextHash: plaintextHash, ConversationID: conversationID}
	info, found := c[key.String()]
	if !found {
		return ErrPartNotFound
	}

	if info.Parts == nil {
		info.Parts = make(map[int]string)
	}

	info.Parts[partNumber] = hash
	c[key.String()] = info
	return f.serialize(c)
}

func (f *FileStash) VerifyPart(plaintextHash []byte, conversationID chat1.ConversationID, partNumber int, hash string) (bool, error) {
	f.Lock()
	defer f.Unlock()
	info, found, err := f.lookup(plaintextHash, conversationID)
	if err != nil {
		return false, err
	}
	if !found {
		return false, ErrPartNotFound
	}

	return info.Parts[partNumber] == hash, nil
}

func (f *FileStash) Finish(plaintextHash []byte, conversationID chat1.ConversationID) error {
	f.Lock()
	defer f.Unlock()
	c, err := f.contents()
	if err != nil {
		return err
	}
	key := stashKey{PlaintextHash: plaintextHash, ConversationID: conversationID}
	delete(c, key.String())
	return f.serialize(c)
}

func (f *FileStash) filename() string {
	return filepath.Join(os.TempDir(), "chat_attachment_stash")
}

func (f *FileStash) contents() (map[string]AttachmentInfo, error) {
	x, err := os.Open(f.filename())
	if err != nil {
		if os.IsNotExist(err) {
			return make(map[string]AttachmentInfo), nil
		}
		return nil, err
	}
	defer x.Close()

	v := make(map[string]AttachmentInfo)
	dec := gob.NewDecoder(x)
	if err := dec.Decode(&v); err != nil {
		return nil, err
	}
	return v, nil
}

func (f *FileStash) serialize(m map[string]AttachmentInfo) error {
	x, err := os.Create(f.filename())
	if err != nil {
		return err
	}
	defer x.Close()
	enc := gob.NewEncoder(x)
	return enc.Encode(m)
}

func (f *FileStash) lookup(plaintextHash []byte, conversationID chat1.ConversationID) (AttachmentInfo, bool, error) {
	c, err := f.contents()
	if err != nil {
		return AttachmentInfo{}, false, err
	}
	key := stashKey{PlaintextHash: plaintextHash, ConversationID: conversationID}
	info, found := c[key.String()]
	return info, found, nil
}
