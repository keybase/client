package storage

import (
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	context "golang.org/x/net/context"
)

// For testing
func (s *Storage) GetAllPurgeInfo(ctx context.Context, uid gregor1.UID) (info allPurgeInfo, err error) {
	defer s.Trace(ctx, func() error { return err }, "GetAllPurgeInfo")()
	return s.ephemeralTracker.getAllPurgeInfo(ctx, uid)
}

func (s *Storage) ConvsForEphemeralPurge(ctx context.Context, uid gregor1.UID) (expiredConvs map[string]chat1.EphemeralPurgeInfo, err Error) {
	defer s.Trace(ctx, func() error { return err }, "ConvsForEphemeralPurge")()

	allPurgeInfo, err := s.ephemeralTracker.getAllPurgeInfo(ctx, uid)
	if err != nil {
		return nil, err
	}
	expiredConvs = make(map[string]chat1.EphemeralPurgeInfo)
	now := s.clock.Now()
	for convID, purgeInfo := range allPurgeInfo {
		nextPurgeTime := purgeInfo.NextPurgeTime.Time()
		if purgeInfo.IsActive && (nextPurgeTime.Before(now) || nextPurgeTime.Equal(now)) {
			expiredConvs[convID] = purgeInfo
		}
	}
	return expiredConvs, nil
}

// For a given conversation, purge all ephemeral messages from
// purgeInfo.MinUnexplodedID to the present, updating bookkeeping for the next
// time we need to purge this conv.
func (s *Storage) EphemeralPurge(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, purgeInfo *chat1.EphemeralPurgeInfo) (newPurgeInfo *chat1.EphemeralPurgeInfo, err Error) {
	defer s.Trace(ctx, func() error { return err }, "EphemeralPurge")()

	locks.Storage.Lock()
	defer locks.Storage.Unlock()

	if purgeInfo == nil {
		return nil, nil
	}

	// Fetch secret key
	key, ierr := getSecretBoxKey(ctx, s.G().ExternalG(), DefaultSecretUI)
	if ierr != nil {
		return nil, MiscError{Msg: "unable to get secret key: " + ierr.Error()}
	}

	ctx, err = s.engine.Init(ctx, key, convID, uid)
	if err != nil {
		return nil, err
	}

	maxMsgID, err := s.idtracker.getMaxMessageID(ctx, convID, uid)
	if err != nil {
		return nil, err
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
	case MissError:
		s.Debug(ctx, "record-only ephemeralTracker: no local messages")
		// We don't have these messages in cache, so don't retry this
		// conversation until further notice.
		err := s.ephemeralTracker.inactivatePurgeInfo(ctx, convID, uid)
		return nil, err
	default:
		return nil, err
	}
	newPurgeInfo, err = s.ephemeralPurgeHelper(ctx, convID, uid, rc.Result())
	if err != nil {
		return nil, err
	}
	err = s.ephemeralTracker.setPurgeInfo(ctx, convID, uid, newPurgeInfo)
	return newPurgeInfo, err
}

func (s *Storage) explodeExpiredMessages(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgs []chat1.MessageUnboxed) (err Error) {
	defer s.Trace(ctx, func() error { return err }, "explodeExpiredMessages")()

	purgeInfo, err := s.ephemeralPurgeHelper(ctx, convID, uid, msgs)
	if err != nil {
		return err
	}
	// We may only be merging in some subset of messages, we only update if the
	// info we get is more restrictive that what we have already
	return s.ephemeralTracker.maybeUpdatePurgeInfo(ctx, convID, uid, purgeInfo)
}

// Before adding or removing messages from storage, nuke any expired ones and
// give info for our bookkeeping for the next time we have to purge.
// requires msgs to be sorted by descending message ID
func (s *Storage) ephemeralPurgeHelper(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgs []chat1.MessageUnboxed) (purgeInfo *chat1.EphemeralPurgeInfo, err Error) {
	defer s.Trace(ctx, func() error { return err }, "ephemeralPurgeHelper convID: %v, uid: %v, numMessages %v", convID, uid, len(msgs))()

	if msgs == nil || len(msgs) == 0 {
		return nil, nil
	}

	nextPurgeTime := gregor1.Time(0)
	minUnexplodedID := msgs[0].GetMessageID()
	var exploded []chat1.MessageUnboxed
	var hasExploding bool
	for i, msg := range msgs {
		if !msg.IsValid() {
			s.Debug(ctx, "skipping invalid msg: %v", msg.GetMessageID())
			continue
		}
		mvalid := msg.Valid()
		if mvalid.IsExploding() {
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
				s.Debug(ctx, "skipping unexpired ephemeral msg: %v", msg.GetMessageID())
			} else {
				var emptyBody chat1.MessageBody
				mvalid.MessageBody = emptyBody
				exploded = append(exploded, chat1.NewMessageUnboxedWithValid(mvalid))
				msgs[i] = chat1.NewMessageUnboxedWithValid(mvalid)
				s.Debug(ctx, "purging ephemeral msg: %v", msg.GetMessageID())
				continue
			}
		}

	}
	s.Debug(ctx, "purging %v ephemeral messages", len(exploded))
	err = s.engine.WriteMessages(ctx, convID, uid, exploded)
	if err != nil {
		s.Debug(ctx, "write messages failed: %v", err)
		return nil, err
	}
	return &chat1.EphemeralPurgeInfo{
		MinUnexplodedID: minUnexplodedID,
		NextPurgeTime:   nextPurgeTime,
		IsActive:        hasExploding,
	}, nil
}
