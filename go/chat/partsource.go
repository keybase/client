package chat

import (
	"context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type partDiskStorage struct {
	Uids []gregor1.UID
	Hash string
}

type CachingParticipantSource struct {
	globals.Contextified
	utils.DebugLabeler

	locktab *libkb.LockTable
	ri      func() chat1.RemoteInterface
}

var _ types.ParticipantSource = (*CachingParticipantSource)(nil)

func NewCachingParticipantSource(g *globals.Context, ri func() chat1.RemoteInterface) *CachingParticipantSource {
	return &CachingParticipantSource{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "CachingParticipantSource", false),
		locktab:      libkb.NewLockTable(),
		ri:           ri,
	}
}

func (s *CachingParticipantSource) Get(ctx context.Context, conv types.RemoteConversation) (res []gregor1.UID, err error) {
	defer s.Trace(ctx, func() error { return err }, "Get")()
	ch := s.GetNonblock(ctx, conv)
	for r := range ch {
		res = r.Uids
	}
	return res, nil
}

func (s *CachingParticipantSource) dbKey(convID chat1.ConversationID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatParticipants,
		Key: convID.String(),
	}
}

func (s *CachingParticipantSource) GetNonblock(ctx context.Context, conv types.RemoteConversation) (resCh chan types.ParticipantResult) {
	resCh = make(chan types.ParticipantResult, 1)
	go func(ctx context.Context) {
		defer s.Trace(ctx, func() error { return nil }, "GetNonblock")()
		defer close(resCh)
		lock := s.locktab.AcquireOnName(ctx, s.G(), conv.ConvIDStr.String())
		defer lock.Release(ctx)

		switch conv.GetMembersType() {
		case chat1.ConversationMembersType_TEAM:
			// handle team separately in here
		default:
			resCh <- types.ParticipantResult{Uids: conv.Conv.Metadata.AllList}
			return
		}

		// load local first and send to channel
		var local partDiskStorage
		found, err := s.G().GetKVStore().GetInto(&local, s.dbKey(conv.GetConvID()))
		if err != nil {
			resCh <- types.ParticipantResult{Err: err}
			return
		}
		if found {
			resCh <- types.ParticipantResult{Uids: local.Uids}
		}

		// load remote if necessary
		localHash := ""
		if found {
			localHash = local.Hash
		}
		partRes, err := s.ri().RefreshParticipantsRemote(ctx, chat1.RefreshParticipantsRemoteArg{
			ConvID: conv.GetConvID(),
			Hash:   localHash,
		})
		if err != nil {
			resCh <- types.ParticipantResult{Err: err}
			return
		}
		if partRes.HashMatch {
			s.Debug(ctx, "GetNonblock: hash match on remote, all done")
			return
		}

		if err := s.G().GetKVStore().PutObj(s.dbKey(conv.GetConvID()), nil, partDiskStorage{
			Uids: partRes.Uids,
			Hash: partRes.Hash,
		}); err != nil {
			s.Debug(ctx, "GetNonblock: failed to store participants: %s", err)
		}
		resCh <- types.ParticipantResult{Uids: partRes.Uids}
	}(globals.BackgroundChatCtx(ctx, s.G()))
	return resCh
}
