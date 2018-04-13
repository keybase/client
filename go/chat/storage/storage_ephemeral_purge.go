package storage

import (
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	context "golang.org/x/net/context"
)

// For a given conversation, purge all ephemeral messages from
// purgeInfo.MinUnexplodedID to the present, updating bookkeeping for the next
// time we need to purge this conv.
func (s *Storage) EphemeralPurge(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, purgeInfo *EphemeralPurgeInfo) (*EphemeralPurgeInfo, Error) {
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

	ctx, err := s.engine.Init(ctx, key, convID, uid)
	if err != nil {
		return nil, err
	}

	maxMsgID, err := s.idtracker.getMaxMessageID(ctx, convID, uid)
	if err != nil {
		return nil, err
	}

	var target int
	if purgeInfo.MinUnexplodedID == 0 {
		target = -1 // we need to traverse the whole conversation
	} else {
		target = int(maxMsgID-purgeInfo.MinUnexplodedID) + 1
	}
	rc := NewSimpleResultCollector(target)
	err = s.engine.ReadMessages(ctx, rc, convID, uid, maxMsgID)
	var newPurgeInfo *EphemeralPurgeInfo
	switch err.(type) {
	case nil:
		// ok
	case MissError:
		s.Debug(ctx, "record-only ephemeralTracker: no local messages")
		// We don't have these messages in cache, so don't retry this
		// conversation until further notice.
		err := s.ephemeralTracker.deletePurgeInfo(ctx, convID, uid)
		return nil, err
	default:
		return nil, err
	}
	newPurgeInfo, _, err = s._filterEphemeralMessages(ctx, convID, uid, rc.Result())
	if err != nil {
		return nil, err
	}
	// End of the line
	if newPurgeInfo.MinUnexplodedID == maxMsgID {
		err = s.ephemeralTracker.deletePurgeInfo(ctx, convID, uid)
		return nil, err
	}
	err = s.ephemeralTracker.setPurgeInfo(ctx, convID, uid, newPurgeInfo)
	return newPurgeInfo, err
}

func (s *Storage) filterEphemeralMessages(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgs []chat1.MessageUnboxed) ([]chat1.MessageUnboxed, Error) {
	s.Debug(ctx, "filterEphemeralMessages convID: %v, uid: %v, numMessages %v", convID, uid, len(msgs))
	purgeInfo, filteredMsgs, err := s._filterEphemeralMessages(ctx, convID, uid, msgs)
	if err != nil {
		return msgs, err
	}

	// We may only be merging in some subset of messages, we only update if the
	// info we get is more restrictive that what we have already
	err = s.ephemeralTracker.maybeUpdatePurgeInfo(ctx, convID, uid, purgeInfo)
	return filteredMsgs, err
}

// Before adding or removing messages from storage, filter them and give info
// for our bookkeeping for the next time we have to purge.
// requires msgs to be sorted by descending message ID
func (s *Storage) _filterEphemeralMessages(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgs []chat1.MessageUnboxed) (*EphemeralPurgeInfo, []chat1.MessageUnboxed, Error) {
	s.Debug(ctx, "_filterEphemeralMessages convID: %v, uid: %v, numMessages %v", convID, uid, len(msgs))

	if msgs == nil || len(msgs) == 0 {
		return nil, msgs, nil
	}

	nextPurgeTime := gregor1.Time(0)
	minUnexplodedID := msgs[0].GetMessageID()
	var unexploded, exploded []chat1.MessageUnboxed
	for _, msg := range msgs {
		if !msg.IsValid() {
			s.Debug(ctx, "skipping invalid msg: %v", msg.GetMessageID())
			unexploded = append(unexploded, msg)
			continue
		}
		mvalid := msg.Valid()
		if mvalid.IsExploding() {
			if !mvalid.IsEphemeralExpired() {
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
				s.Debug(ctx, "purging ephemeral msg: %v", msg.GetMessageID())
				continue
			}
		}

		unexploded = append(unexploded, msg)
	}
	s.Debug(ctx, "purging %v ephemeral messages", len(exploded))
	err := s.engine.WriteMessages(ctx, convID, uid, exploded)
	if err != nil {
		s.Debug(ctx, "write messages failed: %v", err)
		return nil, nil, err
	}

	return &EphemeralPurgeInfo{
		MinUnexplodedID: minUnexplodedID,
		NextPurgeTime:   nextPurgeTime,
	}, unexploded, nil
}
