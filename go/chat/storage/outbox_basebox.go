package storage

import (
	"fmt"
	"sort"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	context "golang.org/x/net/context"
)

type outboxBaseboxStorage struct {
	globals.Contextified
	*baseBox
	utils.DebugLabeler

	uid gregor1.UID
}

func newOutboxBaseboxStorage(g *globals.Context, uid gregor1.UID) *outboxBaseboxStorage {
	return &outboxBaseboxStorage{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "outboxBaseboxStorage", false),
		baseBox:      newBaseBox(g),
		uid:          uid,
	}
}

func (s *outboxBaseboxStorage) dbKey() libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatOutbox,
		Key: fmt.Sprintf("ob:%s", s.uid),
	}
}

func (s *outboxBaseboxStorage) clear(ctx context.Context) Error {
	err := s.G().LocalChatDb.Delete(s.dbKey())
	if err != nil {
		return NewInternalError(ctx, s.DebugLabeler, "error clearing outbox: uid: %s err: %s", s.uid, err)
	}
	return nil
}

func (s *outboxBaseboxStorage) readStorage(ctx context.Context) (res diskOutbox, err Error) {
	defer func() { s.maybeNuke(err, s.dbKey()) }()
	found, ierr := s.readDiskBox(ctx, s.dbKey(), &res)
	if ierr != nil {
		return res, NewInternalError(ctx, s.DebugLabeler, "failure to read chat outbox: %s", ierr)
	}
	if !found {
		return res, MissError{}
	}
	if res.Version != outboxVersion {
		s.Debug(ctx, "on disk version not equal to program version, clearing: disk :%d program: %d",
			res.Version, outboxVersion)
		if cerr := s.clear(ctx); cerr != nil {
			return res, cerr
		}
		return diskOutbox{Version: outboxVersion}, nil
	}
	sort.Sort(ByCtimeOrder(res.Records))
	return res, nil
}

func (s *outboxBaseboxStorage) writeStorage(ctx context.Context, do diskOutbox) (err Error) {
	defer func() { s.maybeNuke(err, s.dbKey()) }()
	if ierr := s.writeDiskBox(ctx, s.dbKey(), do); ierr != nil {
		return NewInternalError(ctx, s.DebugLabeler, "error writing outbox: err: %s", ierr)
	}
	return nil
}

func (s *outboxBaseboxStorage) name() string {
	return "db"
}
