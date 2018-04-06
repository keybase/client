package chat

import "github.com/keybase/client/go/protocol/chat1"

// Ingest a ThreadView, check several invariants, and produce a list of prev
// pointers to not-yet-pointed-to messages. Check several invariants at the
// same time:
// 1. No two messages have the same ID.
// 2. All prev pointers point to messages with lesser IDs.
// 3. All prev pointers to a message agree on that message's header hash.
// 4. For all messages we have locally, the hashes pointing to them are actually correct.
// TODO: All of this should happen in the cache instead of here all at once.
func CheckPrevPointersAndGetUnpreved(thread *chat1.ThreadView) (newPrevsForRegular, newPrevsForExploding []chat1.MessagePreviousPointer, err ChatThreadConsistencyError) {
	// Filter out the messages that gave unboxing errors, and index the rest by
	// ID. Enforce that there are no duplicate IDs or absurd prev pointers.
	// TODO: What should we really be doing with unboxing errors? Do we worry
	//       about an evil server causing them intentionally?
	knownMessages := make(map[chat1.MessageID]chat1.MessageUnboxedValid)

	// As part of checking consistency, build up the set of IDs that have never
	// been preved. There are two views of this set. The regular messages' view
	// "does not see" exploding messages. (This is an important part of making
	// them fully repudiable for small teams.) So exploding message IDs will
	// never show up in the regular unpreved set, and a message is still
	// considered unpreved in this view if all the prev pointers pointing to it
	// are exploding. On the other hand, the exploding messages' view sees
	// everything and treats all messages the same.
	unprevedIDsForRegular := make(map[chat1.MessageID]struct{})
	unprevedIDsForExploding := make(map[chat1.MessageID]struct{})

	for _, messageOrError := range thread.Messages {
		if messageOrError.IsValid() {
			msg := messageOrError.Valid()
			id := msg.ServerHeader.MessageID

			// Check for IDs that show up more than once. IDs are assigned
			// sequentially by the server, so this should really never happen.
			_, alreadyExists := knownMessages[id]
			if alreadyExists {
				return nil, nil, NewChatThreadConsistencyError(
					DuplicateID,
					"MessageID %d is duplicated",
					id)
			}

			// Check that each prev pointer (if any) is a lower ID than the
			// message itself.
			for _, prev := range msg.ClientHeader.Prev {
				if prev.Id >= id {
					return nil, nil, NewChatThreadConsistencyError(
						OutOfOrderID,
						"MessageID %d thinks that message %d is previous.",
						id,
						prev.Id)
				}
			}

			knownMessages[id] = msg
			unprevedIDsForExploding[id] = struct{}{}
			// The regular prev view only sees regular messages.
			if !msg.IsExploding() {
				unprevedIDsForRegular[id] = struct{}{}
			}
		}
	}

	// Using the index we built above, check each prev pointer on each message
	// to make sure its hash is correct. Some prev pointers might refer to
	// messages we don't have locally, and in that case we just check that all
	// prev pointers to that message are *consistent* with each other.
	seenHashes := make(map[chat1.MessageID]chat1.Hash)
	for id, msg := range knownMessages {
		for _, prev := range msg.ClientHeader.Prev {
			// If this message has been referred to before, check that it's
			// always referred to with the same hash.
			seenHash := seenHashes[prev.Id]
			if seenHash != nil {
				// We have seen it before! It's an error if it's different now.
				if !seenHash.Eq(prev.Hash) {
					return nil, nil, NewChatThreadConsistencyError(
						InconsistentHash,
						"MessageID %d has an inconsistent hash for ID %d (%s and %s)",
						id, prev.Id, prev.Hash.String(), seenHash.String())
				}
			} else {
				// We haven't seen it before. Save it.
				seenHashes[prev.Id] = prev.Hash
				// And if we do have the previous message in memory, make sure
				// that what we're saving matches the actual hash for the
				// message. (Note that HeaderHash is computed *locally* at unbox
				// time; we're not taking anyone's word for it.)
				prevMessage, weHaveIt := knownMessages[prev.Id]
				if weHaveIt && !prevMessage.HeaderHash.Eq(prev.Hash) {
					return nil, nil, NewChatThreadConsistencyError(
						IncorrectHash,
						"Message ID %d thinks message ID %d should have hash %s, but it has %s.",
						id, prev.Id, prev.Hash.String(), prevMessage.HeaderHash.String())
				}
				// Also remove this message from the set of "never been pointed
				// to".
				delete(unprevedIDsForExploding, prev.Id)
				// The regular prev view doesn't respect exploding prevs.
				if !msg.IsExploding() {
					delete(unprevedIDsForRegular, prev.Id)
				}
			}
		}
	}

	newPrevsForRegular = []chat1.MessagePreviousPointer{}
	for id := range unprevedIDsForRegular {
		newPrevsForRegular = append(newPrevsForRegular, chat1.MessagePreviousPointer{
			Id:   id,
			Hash: knownMessages[id].HeaderHash,
		})
	}

	newPrevsForExploding = []chat1.MessagePreviousPointer{}
	for id := range unprevedIDsForExploding {
		newPrevsForExploding = append(newPrevsForExploding, chat1.MessagePreviousPointer{
			Id:   id,
			Hash: knownMessages[id].HeaderHash,
		})
	}

	return newPrevsForRegular, newPrevsForExploding, nil
}
