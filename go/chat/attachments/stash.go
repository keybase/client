package attachments

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

type StashKey struct {
	OutboxID chat1.OutboxID
	Preview  bool
}

func NewStashKey(outboxID chat1.OutboxID, preview bool) StashKey {
	return StashKey{
		OutboxID: outboxID,
		Preview:  preview,
	}
}

func (s StashKey) String() string {
	return fmt.Sprintf("%s:%v", s.OutboxID, s.Preview)
}

type AttachmentStash interface {
	Start(key StashKey, info AttachmentInfo) error
	Lookup(key StashKey) (AttachmentInfo, bool, error)
	RecordPart(key StashKey, partNumber int, hash string) error
	Finish(key StashKey) error
}

var ErrPartNotFound = errors.New("part does not exist in stash")

type FileStash struct {
	dir string
	sync.Mutex
}

func NewFileStash(dir string) *FileStash {
	return &FileStash{dir: dir}
}

func (f *FileStash) Start(key StashKey, info AttachmentInfo) error {
	f.Lock()
	defer f.Unlock()
	c, err := f.contents()
	if err != nil {
		return err
	}
	info.StartedAt = time.Now()
	c[key.String()] = info

	return f.serialize(c)
}

func (f *FileStash) Lookup(key StashKey) (AttachmentInfo, bool, error) {
	f.Lock()
	defer f.Unlock()
	return f.lookup(key)
}

func (f *FileStash) RecordPart(key StashKey, partNumber int, hash string) error {
	f.Lock()
	defer f.Unlock()
	c, err := f.contents()
	if err != nil {
		return err
	}
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

func (f *FileStash) Finish(key StashKey) error {
	f.Lock()
	defer f.Unlock()
	c, err := f.contents()
	if err != nil {
		return err
	}
	delete(c, key.String())
	return f.serialize(c)
}

func (f *FileStash) filename() string {
	if f.dir == "" {
		panic("FileStash used with no directory")
	}
	return filepath.Join(f.dir, "chat_attachment_stash")
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

func (f *FileStash) lookup(key StashKey) (AttachmentInfo, bool, error) {
	c, err := f.contents()
	if err != nil {
		return AttachmentInfo{}, false, err
	}
	info, found := c[key.String()]
	return info, found, nil
}
