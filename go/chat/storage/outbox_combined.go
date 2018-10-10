package storage

import (
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/gregor1"
	context "golang.org/x/net/context"
)

type outboxCombinedStorage struct {
	globals.Contextified
	utils.DebugLabeler

	baseStorage  *outboxBaseboxStorage
	filesStorage *outboxFilesStorage
}

func newOutboxCombinedStorage(g *globals.Context, uid gregor1.UID) *outboxCombinedStorage {
	return &outboxCombinedStorage{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "outboxCombinedStorage", false),
		baseStorage:  newOutboxBaseboxStorage(g, uid),
		filesStorage: newOutboxFilesStorage(g, uid),
	}
}

func (s *outboxCombinedStorage) readStorage(ctx context.Context) (res diskOutbox, err Error) {
	baseRes, err := s.baseStorage.readStorage(ctx)
	if err != nil {
		return res, err
	}
	fileRes, err := s.filesStorage.readStorage(ctx)
	if err != nil {
		return res, err
	}
	res.Version = baseRes.Version
	res.Records = append(baseRes.Records, fileRes.Records...)
	if len(fileRes.Records) > 0 {
		// write down into base storage anything from file storage
		// and clear file storage
		if err := s.baseStorage.writeStorage(ctx, res); err != nil {
			return res, err
		}
		if err := s.filesStorage.writeStorage(ctx, diskOutbox{}); err != nil {
			s.Debug(ctx, "readStorage: failed to clear files storage: %s", err)
		}
	}
	return res, nil
}

func (s *outboxCombinedStorage) writeStorage(ctx context.Context, do diskOutbox) Error {
	return s.baseStorage.writeStorage(ctx, do)
}

func (s *outboxCombinedStorage) name() string {
	return "combined"
}
