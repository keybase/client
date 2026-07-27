package chat

import (
	"context"
	"maps"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/sync/semaphore"
)

type partDiskStorage struct {
	Uids     []gregor1.UID
	Hash     string
	CachedAt time.Time
}

// How long a cached participant list is served without asking the server. Every
// localization of a team conversation asks for participants, so without this a
// team screen with N channels costs N remote round trips every time it loads,
// even when nothing has changed and the server only answers HashMatch.
//
// A membership push expires the entry for the convs it touches (see Invalidate),
// so this bounds only changes that arrive by neither a push nor a cache miss.
// Re-localizing a conversation is served from this cache like any other read, so
// it is not itself a refresh path.
const participantsCacheFreshness = 5 * time.Minute

type CachingParticipantSource struct {
	globals.Contextified
	utils.DebugLabeler

	ri          func() chat1.RemoteInterface
	encryptedDB *encrypteddb.EncryptedDB
	sema        *semaphore.Weighted
	locktab     *libkb.LockTable
	notify      func(any)
}

var _ types.ParticipantSource = (*CachingParticipantSource)(nil)

func NewCachingParticipantSource(g *globals.Context, ri func() chat1.RemoteInterface) *CachingParticipantSource {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return storage.GetSecretBoxKey(ctx, g.ExternalG())
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalChatDb
	}
	notify, notifyCancel := libkb.ThrottleBatch(func(batchedInt any) {
		batched, _ := batchedInt.(map[chat1.ConvIDStr][]chat1.UIParticipant)
		g.NotifyRouter.HandleChatParticipantsInfo(context.Background(), batched)
	}, func(batchedInt, singleInt any) any {
		batched, _ := batchedInt.(map[chat1.ConvIDStr][]chat1.UIParticipant)
		single, _ := singleInt.(map[chat1.ConvIDStr][]chat1.UIParticipant)
		maps.Copy(batched, single)
		return batched
	}, func() any {
		return make(map[chat1.ConvIDStr][]chat1.UIParticipant)
	},
		200*time.Millisecond, true)
	g.PushShutdownHook(func(_ libkb.MetaContext) error {
		notifyCancel()
		return nil
	})
	return &CachingParticipantSource{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "CachingParticipantSource", false),
		locktab:      libkb.NewLockTable(),
		ri:           ri,
		encryptedDB:  encrypteddb.New(g.ExternalG(), dbFn, keyFn),
		sema:         semaphore.NewWeighted(20),
		notify:       notify,
	}
}

func (s *CachingParticipantSource) Get(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, dataSource types.InboxSourceDataSourceTyp,
) (res []gregor1.UID, err error) {
	defer s.Trace(ctx, &err, "Get")()
	ch := s.GetNonblock(ctx, uid, convID, dataSource)
	for r := range ch {
		if r.Err != nil {
			return res, r.Err
		}
		res = r.Uids
	}
	return res, nil
}

func (s *CachingParticipantSource) dbKey(uid gregor1.UID, convID chat1.ConversationID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatParticipants,
		Key: uid.String() + convID.String(),
	}
}

// Invalidate expires the cached list for these convs. Membership pushes call it,
// so a join or leave shows up in participant lists and @-mention completion at
// the next read instead of waiting out participantsCacheFreshness.
//
// It expires rather than deletes: the stale list is still the best answer
// available until the server replies, and callers depend on getting it. A
// local-only read has nowhere else to go, and a local-and-remote read emits the
// cached list first so the UI has something to draw while the refresh is in
// flight. The stored hash is kept for the same reason it is normally kept -- the
// server derives it from the membership, so if it still matches, the push
// changed something that does not affect this list and the refetch is free.
func (s *CachingParticipantSource) Invalidate(ctx context.Context, uid gregor1.UID,
	convIDs []chat1.ConversationID,
) {
	for _, convID := range convIDs {
		lock := s.locktab.AcquireOnName(ctx, s.G(), convID.String())
		var local partDiskStorage
		found, err := s.encryptedDB.Get(ctx, s.dbKey(uid, convID), &local)
		switch {
		case err != nil:
			s.Debug(ctx, "Invalidate: failed to read participants for %s: %s", convID, err)
			if err := s.encryptedDB.Delete(ctx, s.dbKey(uid, convID)); err != nil {
				s.Debug(ctx, "Invalidate: failed to delete participants for %s: %s", convID, err)
			}
		case found:
			local.CachedAt = time.Time{}
			if err := s.encryptedDB.Put(ctx, s.dbKey(uid, convID), local); err != nil {
				s.Debug(ctx, "Invalidate: failed to expire participants for %s: %s", convID, err)
			}
		}
		lock.Release(ctx)
	}
}

func (s *CachingParticipantSource) GetNonblock(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, dataSource types.InboxSourceDataSourceTyp,
) (resCh chan types.ParticipantResult) {
	resCh = make(chan types.ParticipantResult, 1)
	go func(ctx context.Context) {
		defer s.Trace(ctx, nil, "GetNonblock")()
		defer close(resCh)
		lock := s.locktab.AcquireOnName(ctx, s.G(), convID.String())
		defer lock.Release(ctx)

		conv, err := utils.GetUnverifiedConv(ctx, s.G(), uid, convID, dataSource)
		if err != nil {
			resCh <- types.ParticipantResult{Err: err}
			return
		}

		switch conv.GetMembersType() {
		case chat1.ConversationMembersType_TEAM:
			// handle team separately in here
		default:
			resCh <- types.ParticipantResult{Uids: conv.Conv.Metadata.AllList}
			return
		}

		// load local first and send to channel
		localHash := ""
		var local partDiskStorage
		var foundLocal bool
		switch dataSource {
		case types.InboxSourceDataSourceAll, types.InboxSourceDataSourceLocalOnly:
			found, err := s.encryptedDB.Get(ctx, s.dbKey(uid, conv.GetConvID()), &local)
			if err != nil {
				resCh <- types.ParticipantResult{Err: err}
				if err := s.encryptedDB.Delete(ctx, s.dbKey(uid, conv.GetConvID())); err != nil {
					s.Debug(ctx, "GetNonblock: failed to delete after read error: %s", err)
				}
				return
			}
			if found {
				foundLocal = true
				resCh <- types.ParticipantResult{Uids: local.Uids}
				localHash = local.Hash
				if !local.CachedAt.IsZero() &&
					s.G().GetClock().Since(local.CachedAt) < participantsCacheFreshness {
					return
				}
			}
		default:
		}

		// load remote if necessary
		switch dataSource {
		case types.InboxSourceDataSourceAll, types.InboxSourceDataSourceRemoteOnly:
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
				// nothing changed, but record that we just checked so the next
				// localization of this conv can be served from disk. Only the
				// remote-only path has to read here: every other path already
				// has the entry in hand from the local read above.
				if !foundLocal {
					found, err := s.encryptedDB.Get(ctx, s.dbKey(uid, conv.GetConvID()), &local)
					if err != nil {
						s.Debug(ctx, "GetNonblock: failed to read back after hash match: %s", err)
						return
					}
					foundLocal = found
				}
				if foundLocal {
					local.CachedAt = s.G().GetClock().Now()
					if err := s.encryptedDB.Put(ctx, s.dbKey(uid, conv.GetConvID()), local); err != nil {
						s.Debug(ctx, "GetNonblock: failed to record refresh time: %s", err)
					}
				}
				return
			}

			if err := s.encryptedDB.Put(ctx, s.dbKey(uid, conv.GetConvID()), partDiskStorage{
				Uids:     partRes.Uids,
				Hash:     partRes.Hash,
				CachedAt: s.G().GetClock().Now(),
			}); err != nil {
				s.Debug(ctx, "GetNonblock: failed to store participants: %s", err)
			}
			resCh <- types.ParticipantResult{Uids: partRes.Uids}
		default:
		}
	}(globals.BackgroundChatCtx(ctx, s.G()))
	return resCh
}

func (s *CachingParticipantSource) GetWithNotifyNonblock(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, dataSource types.InboxSourceDataSourceTyp,
) {
	go func(ctx context.Context) {
		_ = s.sema.Acquire(ctx, 1)
		defer s.sema.Release(1)

		convIDStr := convID.ConvIDStr()
		ch := s.G().ParticipantsSource.GetNonblock(ctx, uid, convID, dataSource)
		for r := range ch {
			participants, err := s.GetParticipantsFromUids(ctx, r.Uids)
			if err != nil {
				s.Debug(ctx, "GetWithNotifyNonblock: failed to map uids: %s", err)
				continue
			}
			s.notify(map[chat1.ConvIDStr][]chat1.UIParticipant{
				convIDStr: utils.PresentConversationParticipantsLocal(ctx, participants),
			})
		}
	}(globals.BackgroundChatCtx(ctx, s.G()))
}

func (s *CachingParticipantSource) GetParticipantsFromUids(
	ctx context.Context,
	uids []gregor1.UID,
) (participants []chat1.ConversationLocalParticipant, err error) {
	kuids := make([]keybase1.UID, 0, len(uids))
	for _, uid := range uids {
		kuids = append(kuids, keybase1.UID(uid.String()))
	}
	rows, err := s.G().UIDMapper.MapUIDsToUsernamePackages(ctx, s.G(), kuids, time.Hour*24,
		time.Minute, true)
	if err != nil {
		return nil, err
	}
	participants = make([]chat1.ConversationLocalParticipant, 0, len(uids))
	for _, row := range rows {
		participants = append(participants, utils.UsernamePackageToParticipant(row))
	}
	return participants, nil
}
