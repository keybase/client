package storage

import (
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	context "golang.org/x/net/context"
)

type ServerVersions struct {
	globals.Contextified
	utils.DebugLabeler

	cached *chat1.ServerCacheVers
}

func NewServerVersions(g *globals.Context) *ServerVersions {
	return &ServerVersions{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "ServerVersions", false),
	}
}

func (s *ServerVersions) makeKey() libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatBlocks,
		Key: fmt.Sprintf("versions"),
	}
}

func (s *ServerVersions) fetchLocked(ctx context.Context) (chat1.ServerCacheVers, error) {
	// Check in memory first
	if s.cached != nil {
		return *s.cached, nil
	}

	// Read from LevelDb
	raw, found, err := s.G().LocalChatDb.GetRaw(s.makeKey())
	if err != nil {
		s.Debug(ctx, "fetchLocked: failed to read: %s", err.Error())
		return chat1.ServerCacheVers{}, err
	}
	if !found {
		s.Debug(ctx, "no server version found, using defaults")
		return chat1.ServerCacheVers{}, nil
	}
	var srvVers chat1.ServerCacheVers
	if err = decode(raw, &srvVers); err != nil {
		s.Debug(ctx, "fetchLocked: failed to decode: %s", err.Error())
		return chat1.ServerCacheVers{}, err
	}

	// Store in memory
	s.cached = &srvVers
	return *s.cached, nil
}

func (s *ServerVersions) Fetch(ctx context.Context) (chat1.ServerCacheVers, error) {
	locks.Version.Lock()
	defer locks.Version.Unlock()

	return s.fetchLocked(ctx)
}

func (s *ServerVersions) matchLocked(ctx context.Context, vers int,
	versFunc func(chat1.ServerCacheVers) int) (int, error) {
	srvVers, err := s.fetchLocked(ctx)
	if err != nil {
		return 0, err
	}
	retVers := versFunc(srvVers)
	if retVers != vers {
		return retVers, NewVersionMismatchError(chat1.InboxVers(vers), chat1.InboxVers(retVers))
	}
	return retVers, nil
}

func (s *ServerVersions) MatchInbox(ctx context.Context, vers int) (int, error) {
	locks.Version.Lock()
	defer locks.Version.Unlock()

	return s.matchLocked(ctx, vers, func(srvVers chat1.ServerCacheVers) int { return srvVers.InboxVers })
}

func (s *ServerVersions) MatchBodies(ctx context.Context, vers int) (int, error) {
	locks.Version.Lock()
	defer locks.Version.Unlock()

	return s.matchLocked(ctx, vers, func(srvVers chat1.ServerCacheVers) int { return srvVers.BodiesVers })
}

func (s *ServerVersions) Set(ctx context.Context, vers chat1.ServerCacheVers) (err error) {
	locks.Version.Lock()
	defer locks.Version.Unlock()

	// Write in memory
	s.cached = &vers

	// Write out to LevelDB
	dat, err := encode(vers)
	if err != nil {
		s.Debug(ctx, "Sync: failed to encode: %s", err.Error())
		return err
	}
	if err = s.G().LocalChatDb.PutRaw(s.makeKey(), dat); err != nil {
		s.Debug(ctx, "Sync: failed to write: %s", err.Error())
		return err
	}

	return nil
}
