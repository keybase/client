package storage

import (
	"time"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	context "golang.org/x/net/context"
)

func (s *Storage) GetAllPurgeInfo(ctx context.Context, uid gregor1.UID) (allPurgeInfo map[string]chat1.EphemeralPurgeInfo, err error) {
	defer s.Trace(ctx, func() error { return err }, "GetAllPurgeInfo")()
	return s.ephemeralTracker.getAllPurgeInfo(ctx, uid)
}

// For a given conversation, purge all ephemeral messages from
// purgeInfo.MinUnexplodedID to the present, updating bookkeeping for the next
// time we need to purge this conv.
func (s *Storage) EphemeralPurge(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, purgeInfo *chat1.EphemeralPurgeInfo) (newPurgeInfo *chat1.EphemeralPurgeInfo, explodedMsgs []chat1.MessageUnboxed, err Error) {
	defer s.Trace(ctx, func() error { return err }, "EphemeralPurge")()

	locks.Storage.Lock()
	defer locks.Storage.Unlock()

	if purgeInfo == nil {
		return nil, nil, nil
	}

	// Fetch secret key
	key, ierr := GetSecretBoxKey(ctx, s.G().ExternalG(), DefaultSecretUI)
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
	err = s.engine.ReadMessages(ctx, rc, convID, uid, maxMsgID)
	switch err.(type) {
	case nil:
		// ok
		if len(rc.Result()) == 0 {
			err := s.ephemeralTracker.inactivatePurgeInfo(ctx, convID, uid)
			return nil, nil, err
		}
	case MissError:
		s.Debug(ctx, "record-only ephemeralTracker: no local messages")
		// We don't have these messages in cache, so don't retry this
		// conversation until further notice.
		err := s.ephemeralTracker.inactivatePurgeInfo(ctx, convID, uid)
		return nil, nil, err
	default:
		return nil, nil, err
	}
	newPurgeInfo, explodedMsgs, err = s.ephemeralPurgeHelper(ctx, convID, uid, rc.Result())
	if err != nil {
		return nil, nil, err
	}
	err = s.ephemeralTracker.setPurgeInfo(ctx, convID, uid, newPurgeInfo)
	return newPurgeInfo, explodedMsgs, err
}

func (s *Storage) explodeExpiredMessages(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgs []chat1.MessageUnboxed) (explodedMsgs []chat1.MessageUnboxed, err Error) {
	defer s.Trace(ctx, func() error { return err }, "explodeExpiredMessages")()

	purgeInfo, explodedMsgs, err := s.ephemeralPurgeHelper(ctx, convID, uid, msgs)
	if err != nil {
		return nil, err
	}
	// We may only be merging in some subset of messages, we only update if the
	// info we get is more restrictive that what we have already
	return explodedMsgs, s.ephemeralTracker.maybeUpdatePurgeInfo(ctx, convID, uid, purgeInfo)
}

// Before adding or removing messages from storage, nuke any expired ones and
// give info for our bookkeeping for the next time we have to purge.
// requires msgs to be sorted by descending message ID
func (s *Storage) ephemeralPurgeHelper(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgs []chat1.MessageUnboxed) (purgeInfo *chat1.EphemeralPurgeInfo, explodedMsgs []chat1.MessageUnboxed, err Error) {
	defer s.Trace(ctx, func() error { return err }, "ephemeralPurgeHelper convID: %v, uid: %v, numMessages %v", convID, uid, len(msgs))()

	if msgs == nil || len(msgs) == 0 {
		return nil, nil, nil
	}

	nextPurgeTime := gregor1.Time(0)
	minUnexplodedID := msgs[0].GetMessageID()
	var allAssets []chat1.Asset
	var hasExploding bool
	debugPurge := func(logMsg string, msg chat1.MessageUnboxed, now time.Time) {
		mvalid := msg.Valid()
		s.Debug(ctx, "%s msg: %v, etime: %v, serverCtime: %v, serverNow: %v, rtime: %v now: %v, ephemeralMetadata: %v",
			logMsg, msg.GetMessageID(), mvalid.Etime().Time(), mvalid.ServerHeader.Ctime.Time(),
			mvalid.ServerHeader.Now.Time(), mvalid.ClientHeader.Rtime.Time(), now, mvalid.EphemeralMetadata())
	}
	for i, msg := range msgs {
		if !msg.IsValid() {
			continue
		}
		mvalid := msg.Valid()
		if mvalid.IsEphemeral() {
			now := s.clock.Now()
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
				debugPurge("skipping unexpired ephemeral", msg, now)
			} else if mvalid.MessageBody.IsNil() {
				// do nothing
			} else {
				msgPurged, assets := s.purgeMessage(mvalid)
				allAssets = append(allAssets, assets...)
				explodedMsgs = append(explodedMsgs, msgPurged)
				msgs[i] = msgPurged
				debugPurge("purging ephemeral", msg, now)
			}
		}
	}

	// queue asset deletions in the background
	s.assetDeleter.DeleteAssets(ctx, uid, convID, allAssets)

	s.Debug(ctx, "purging %v ephemeral messages", len(explodedMsgs))
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
