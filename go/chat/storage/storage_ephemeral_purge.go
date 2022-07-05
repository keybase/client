package storage

import (
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	context "golang.org/x/net/context"
)

// For a given conversation, purge all ephemeral messages from
// purgeInfo.MinUnexplodedID to the present, updating bookkeeping for the next
// time we need to purge this conv.
func (s *Storage) EphemeralPurge(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, purgeInfo *chat1.EphemeralPurgeInfo) (newPurgeInfo *chat1.EphemeralPurgeInfo, explodedMsgs []chat1.MessageUnboxed, err Error) {
	var ierr error
	defer s.Trace(ctx, &ierr, "EphemeralPurge")()
	defer func() { ierr = s.castInternalError(err) }()
	lock := locks.StorageLockTab.AcquireOnName(ctx, s.G(), convID.String())
	defer lock.Release(ctx)

	if purgeInfo == nil {
		return nil, nil, nil
	}

	// Fetch secret key
	key, ierr := GetSecretBoxKey(ctx, s.G().ExternalG())
	if ierr != nil {
		return nil, nil, MiscError{Msg: "unable to get secret key: " + ierr.Error()}
	}

	ctx, err = s.engine.Init(ctx, key, convID, uid)
	if err != nil {
		return nil, nil, err
	}

	maxMsgID, err := s.idtracker.getMaxMessageID(ctx, convID, uid)
	if err != nil {
		return nil, nil, err
	}

	// We don't care about holes.
	maxHoles := int(maxMsgID-purgeInfo.MinUnexplodedID) + 1
	var target int
	if purgeInfo.MinUnexplodedID == 0 {
		target = 0 // we need to traverse the whole conversation
	} else {
		target = maxHoles
	}
	rc := NewHoleyResultCollector(maxHoles, NewSimpleResultCollector(target))
	err = s.engine.ReadMessages(ctx, rc, convID, uid, maxMsgID, 0)
	switch err.(type) {
	case nil:
		// ok
		if len(rc.Result()) == 0 {
			ierr := s.G().EphemeralTracker.InactivatePurgeInfo(ctx, convID, uid)
			if ierr != nil {
				return nil, nil, NewInternalError(ctx, s.DebugLabeler, "EphemeralTracker unable to InactivatePurgeInfo: %v", ierr)
			}
			return nil, nil, nil
		}
	case MissError:
		// We don't have these messages in cache, so don't retry this
		// conversation until further notice.
		ierr := s.G().EphemeralTracker.InactivatePurgeInfo(ctx, convID, uid)
		if ierr != nil {
			return nil, nil, NewInternalError(ctx, s.DebugLabeler, "EphemeralTracker unable to InactivatePurgeInfo: %v", ierr)
		}
		return nil, nil, nil
	default:
		return nil, nil, err
	}
	newPurgeInfo, explodedMsgs, err = s.ephemeralPurgeHelper(ctx, convID, uid, rc.Result())
	if err != nil {
		return nil, nil, err
	}
	ierr = s.G().EphemeralTracker.SetPurgeInfo(ctx, convID, uid, newPurgeInfo)
	if ierr != nil {
		return nil, nil, NewInternalError(ctx, s.DebugLabeler, "EphemeralTracker unable to SetPurgeInfo: %v", ierr)
	}
	return newPurgeInfo, explodedMsgs, err
}

func (s *Storage) explodeExpiredMessages(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgs []chat1.MessageUnboxed) (explodedMsgs []chat1.MessageUnboxed, err Error) {
	purgeInfo, explodedMsgs, err := s.ephemeralPurgeHelper(ctx, convID, uid, msgs)
	if err != nil {
		return nil, err
	}
	// We may only be merging in some subset of messages, we only update if the
	// info we get is more restrictive that what we have already
	ierr := s.G().EphemeralTracker.MaybeUpdatePurgeInfo(ctx, convID, uid, purgeInfo)
	if ierr != nil {
		return nil, NewInternalError(ctx, s.DebugLabeler, "EphemeralTracker unable to MaybeUpdatePurgeInfo: %v", ierr)
	}
	return explodedMsgs, nil
}

// Before adding or removing messages from storage, nuke any expired ones and
// give info for our bookkeeping for the next time we have to purge.
// requires msgs to be sorted by descending message ID
func (s *Storage) ephemeralPurgeHelper(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgs []chat1.MessageUnboxed) (purgeInfo *chat1.EphemeralPurgeInfo, explodedMsgs []chat1.MessageUnboxed, err Error) {

	if len(msgs) == 0 {
		return nil, nil, nil
	}

	nextPurgeTime := gregor1.Time(0)
	minUnexplodedID := msgs[0].GetMessageID()
	var allAssets []chat1.Asset
	var allPurged []chat1.MessageUnboxed
	var hasExploding bool
	for i, msg := range msgs {
		if !msg.IsValid() {
			continue
		}
		mvalid := msg.Valid()
		if mvalid.IsEphemeral() {
			if !mvalid.IsEphemeralExpired(s.clock.Now()) {
				hasExploding = true
				// Keep track of the minimum ephemeral message that is not yet
				// exploded.
				if msg.GetMessageID() < minUnexplodedID {
					minUnexplodedID = msg.GetMessageID()
				}
				// Keep track of the next time we'll have purge this conv.
				if nextPurgeTime == 0 || mvalid.Etime() < nextPurgeTime {
					nextPurgeTime = mvalid.Etime()
				}
			} else if mvalid.MessageBody.IsNil() {
				// do nothing
			} else {
				msgPurged, assets := s.purgeMessage(mvalid)
				allAssets = append(allAssets, assets...)
				explodedMsgs = append(explodedMsgs, msgPurged)
				allPurged = append(allPurged, msg)
				msgs[i] = msgPurged
			}
		}
	}

	// queue asset deletions in the background
	if s.assetDeleter != nil {
		s.assetDeleter.DeleteAssets(ctx, uid, convID, allAssets)
	}
	// queue search index update in the background
	go func() {
		err := s.G().Indexer.Remove(ctx, convID, allPurged)
		if err != nil {
			s.Debug(ctx, "Error removing from indexer: %+v", err)
		}
	}()

	if err = s.engine.WriteMessages(ctx, convID, uid, explodedMsgs); err != nil {
		s.Debug(ctx, "write messages failed: %v", err)
		return nil, nil, err
	}

	return &chat1.EphemeralPurgeInfo{
		ConvID:          convID,
		MinUnexplodedID: minUnexplodedID,
		NextPurgeTime:   nextPurgeTime,
		IsActive:        hasExploding,
	}, explodedMsgs, nil
}
