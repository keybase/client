package chat

import (
	"context"
	"maps"
	"slices"
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

type participantNotify struct {
	uid   keybase1.UID
	parts map[chat1.ConvIDStr][]chat1.UIParticipant
}

type partDiskStorage struct {
	Uids []gregor1.UID
	Hash string
}

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
		batched, _ := batchedInt.(map[keybase1.UID]map[chat1.ConvIDStr][]chat1.UIParticipant)
		for uid, parts := range batched {
			g.NotifyRouter.HandleChatParticipantsInfo(context.Background(), uid, parts)
		}
	}, func(batchedInt, singleInt any) any {
		batched, _ := batchedInt.(map[keybase1.UID]map[chat1.ConvIDStr][]chat1.UIParticipant)
		single, _ := singleInt.(participantNotify)
		if batched[single.uid] == nil {
			batched[single.uid] = make(map[chat1.ConvIDStr][]chat1.UIParticipant)
		}
		maps.Copy(batched[single.uid], single.parts)
		return batched
	}, func() any {
		return make(map[keybase1.UID]map[chat1.ConvIDStr][]chat1.UIParticipant)
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
		switch dataSource {
		case types.InboxSourceDataSourceAll, types.InboxSourceDataSourceLocalOnly:
			var local partDiskStorage
			// A key-fetch failure must keep the entry. Unusable bytes are a miss:
			// the list is loaded from the server below and written back.
			found, err := s.encryptedDB.GetOrDropUnusable(ctx, s.dbKey(uid, conv.GetConvID()), &local)
			if err != nil {
				resCh <- types.ParticipantResult{Err: err}
				return
			}
			if found {
				resCh <- types.ParticipantResult{Uids: local.Uids}
				localHash = local.Hash
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
				return
			}

			if err := s.encryptedDB.Put(ctx, s.dbKey(uid, conv.GetConvID()), partDiskStorage{
				Uids: partRes.Uids,
				Hash: partRes.Hash,
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
			if r.Err != nil {
				s.Debug(ctx, "GetWithNotifyNonblock: failed to load participants: %s", r.Err)
				continue
			}
			participants, err := s.GetParticipantsFromUids(ctx, r.Uids)
			if err != nil {
				s.Debug(ctx, "GetWithNotifyNonblock: failed to map uids: %s", err)
				continue
			}
			s.notify(participantNotify{
				uid: keybase1.UID(uid.String()),
				parts: map[chat1.ConvIDStr][]chat1.UIParticipant{
					convIDStr: utils.PresentConversationParticipantsLocal(ctx, participants),
				},
			})
		}
	}(globals.BackgroundChatCtx(ctx, s.G()))
}

// patchParticipants drops removed and appends joined members, keeping the order of
// the rest.
func patchParticipants(uids, joined, removed []gregor1.UID) (res []gregor1.UID, changed bool) {
	res = make([]gregor1.UID, 0, len(uids)+len(joined))
	for _, u := range uids {
		if slices.ContainsFunc(removed, u.Eq) {
			changed = true
			continue
		}
		res = append(res, u)
	}
	for _, u := range joined {
		if !slices.ContainsFunc(res, u.Eq) {
			res = append(res, u)
			changed = true
		}
	}
	return res, changed
}

// ApplyMembershipChange patches a conversation's cached participant list with a
// membership push and notifies the new list, using only local data. A conversation
// with no cached list is left alone: whoever shows it loads the list then. The
// patched entry drops its hash so the next remote load always replaces it.
func (s *CachingParticipantSource) ApplyMembershipChange(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, joined, removed []gregor1.UID,
) {
	defer s.Trace(ctx, nil, "ApplyMembershipChange")()
	lock := s.locktab.AcquireOnName(ctx, s.G(), convID.String())
	defer lock.Release(ctx)

	var local partDiskStorage
	found, err := s.encryptedDB.GetOrDropUnusable(ctx, s.dbKey(uid, convID), &local)
	if err != nil || !found {
		return
	}
	uids, changed := patchParticipants(local.Uids, joined, removed)
	if !changed {
		return
	}
	if err := s.encryptedDB.Put(ctx, s.dbKey(uid, convID), partDiskStorage{Uids: uids}); err != nil {
		s.Debug(ctx, "ApplyMembershipChange: failed to store participants: %s", err)
		return
	}

	kuids := make([]keybase1.UID, 0, len(uids))
	for _, u := range uids {
		kuids = append(kuids, keybase1.UID(u.String()))
	}
	rows, err := s.G().UIDMapper.MapUIDsToUsernamePackagesOffline(ctx, s.G(), kuids, time.Hour*24)
	if err != nil {
		s.Debug(ctx, "ApplyMembershipChange: failed to map uids: %s", err)
		return
	}
	participants := make([]chat1.ConversationLocalParticipant, 0, len(rows))
	for _, row := range rows {
		// an unknown name would show as a blank member; the next load fills it in
		if row.NormalizedUsername.IsNil() {
			return
		}
		participants = append(participants, utils.UsernamePackageToParticipant(row))
	}
	s.notify(participantNotify{
		uid: keybase1.UID(uid.String()),
		parts: map[chat1.ConvIDStr][]chat1.UIParticipant{
			convID.ConvIDStr(): utils.PresentConversationParticipantsLocal(ctx, participants),
		},
	})
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
