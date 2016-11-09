package chat

import (
	"encoding/gob"
	"fmt"
	"os"
	"path/filepath"

	"github.com/keybase/client/go/chat/signencrypt"
	"github.com/keybase/client/go/protocol/chat1"
)

type AttachmentInfo struct {
	ObjectKey string
	EncKey    signencrypt.SecretboxKey
	SignKey   signencrypt.SignKey
	VerifyKey signencrypt.VerifyKey
}

type AttachmentStash interface {
	Start(plaintextHash []byte, conversationID chat1.ConversationID, info AttachmentInfo) error
	Lookup(plaintextHash []byte, conversationID chat1.ConversationID) (AttachmentInfo, bool, error)
	Finish(plaintextHash []byte, conversationID chat1.ConversationID) error
}

type stashKey struct {
	PlaintextHash  []byte
	ConversationID chat1.ConversationID
}

func (s stashKey) String() string {
	return fmt.Sprintf("%x:%x", s.PlaintextHash, s.ConversationID)
}

type FileStash struct{}

func NewFileStash() *FileStash {
	return &FileStash{}
}

func (f *FileStash) Start(plaintextHash []byte, conversationID chat1.ConversationID, info AttachmentInfo) error {
	c, err := f.contents()
	if err != nil {
		return err
	}
	key := stashKey{PlaintextHash: plaintextHash, ConversationID: conversationID}
	c[key.String()] = info

	return f.serialize(c)
}

func (f *FileStash) Lookup(plaintextHash []byte, conversationID chat1.ConversationID) (AttachmentInfo, bool, error) {
	c, err := f.contents()
	if err != nil {
		return AttachmentInfo{}, false, err
	}
	key := stashKey{PlaintextHash: plaintextHash, ConversationID: conversationID}
	info, found := c[key.String()]
	return info, found, nil
}

func (f *FileStash) Finish(plaintextHash []byte, conversationID chat1.ConversationID) error {
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
