package storage

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"sort"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	context "golang.org/x/net/context"
)

type outboxFilesStorage struct {
	globals.Contextified
	utils.DebugLabeler

	uid gregor1.UID
}

func newOutboxFilesStorage(g *globals.Context, uid gregor1.UID) *outboxFilesStorage {
	return &outboxFilesStorage{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "outboxFilesStorage", false),
		uid:          uid,
	}
}

func (s *outboxFilesStorage) getDir() string {
	base := s.G().GetEnv().GetSharedDataDir()
	return filepath.Join(base, "fileoutbox", s.uid.String())
}

func (s *outboxFilesStorage) getFile(ctx context.Context, path string) *encrypteddb.EncryptedFile {
	return encrypteddb.NewFile(s.G().ExternalG(), path,
		func(ctx context.Context) ([32]byte, error) {
			return GetSecretBoxKey(ctx, s.G().ExternalG(), DefaultSecretUI)
		})
}

func (s *outboxFilesStorage) readStorage(ctx context.Context) (res diskOutbox, err Error) {
	dir := s.getDir()
	res.Version = 1
	fis, ierr := ioutil.ReadDir(dir)
	if ierr != nil {
		if !os.IsNotExist(ierr) {
			s.Debug(ctx, "readStorage: failed to read directory: %s", ierr)
		}
		return res, nil
	}
	for _, fi := range fis {
		var rec chat1.OutboxRecord
		if ierr := s.getFile(ctx, filepath.Join(dir, fi.Name())).Get(ctx, &rec); ierr != nil {
			s.Debug(ctx, "readStorage: failed to read file: %s err: %s", fi.Name(), ierr)
			continue
		}
		res.Records = append(res.Records, rec)
	}
	sort.Sort(ByCtimeOrder(res.Records))
	return res, nil
}

func (s *outboxFilesStorage) writeStorage(ctx context.Context, do diskOutbox) (err Error) {
	dir := s.getDir()
	if ierr := os.RemoveAll(dir); ierr != nil {
		return NewInternalError(ctx, s.DebugLabeler, "failed to remove dir: %s", ierr)
	}
	if ierr := os.MkdirAll(dir, os.ModePerm); ierr != nil {
		return NewInternalError(ctx, s.DebugLabeler, "failed to make dir: %s", ierr)
	}
	for _, rec := range do.Records {
		if ierr := s.getFile(ctx, filepath.Join(dir, rec.OutboxID.String())).Put(ctx, rec); ierr != nil {
			s.Debug(ctx, "writeStorage: failed to write file: %s", ierr)
			continue
		}
	}
	return nil
}

func (s *outboxFilesStorage) name() string {
	return "files"
}
