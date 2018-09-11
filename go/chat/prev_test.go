package chat

import (
	"testing"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

type dummyMessage struct {
	id        chat1.MessageID
	hash      chat1.Hash
	prevs     []chat1.MessagePreviousPointer
	exploding bool
}

func expectCode(t *testing.T, err ChatThreadConsistencyError, code ConsistencyErrorCode) {
	if err == nil {
		t.Fatalf("Expected an error. Got nil.")
	}
	if err.Code() != code {
		t.Fatalf("Expected a code %d, but found %d.", code, err.Code())
	}
}

func threadViewFromDummies(dummies []dummyMessage) chat1.ThreadView {
	threadView := chat1.ThreadView{}
	for _, dummy := range dummies {
		messageValid := chat1.MessageUnboxedValid{
			HeaderHash: dummy.hash,
			ServerHeader: chat1.MessageServerHeader{
				MessageID: dummy.id,
			},
			ClientHeader: chat1.MessageClientHeaderVerified{
				Prev: dummy.prevs,
			},
			// no need for a body
		}
		if dummy.exploding {
			// This just needs to be non-nil.
			messageValid.ClientHeader.EphemeralMetadata = &chat1.MsgEphemeralMetadata{}
		}
		msg := chat1.NewMessageUnboxedWithValid(messageValid)
		threadView.Messages = append(threadView.Messages, msg)
	}
	return threadView
}

func TestPrevGood(t *testing.T) {
	thread := threadViewFromDummies([]dummyMessage{
		dummyMessage{
			id:    1,
			hash:  []byte("placeholder"),
			prevs: nil,
		},
		dummyMessage{
			id:   2,
			hash: []byte("placeholder"),
			prevs: []chat1.MessagePreviousPointer{
				chat1.MessagePreviousPointer{
					Id:   1,
					Hash: []byte("placeholder"),
				},
				chat1.MessagePreviousPointer{
					Id:   0, // This one won't exist locally.
					Hash: []byte("nonexistent message hash"),
				},
			},
		},
	})

	unpreved, _, err := CheckPrevPointersAndGetUnpreved(&thread)
	if err != nil {
		t.Fatal(err)
	}

	if len(unpreved) != 1 {
		t.Fatalf("Expected 1 unpreved message, found %d", len(unpreved))
	}
}

func TestPrevDuplicateID(t *testing.T) {
	thread := threadViewFromDummies([]dummyMessage{
		dummyMessage{
			id:    1,
			hash:  []byte("placeholder"),
			prevs: nil,
		},
		dummyMessage{
			id:   1,
			hash: []byte("placeholder"),
		},
	})

	_, _, err := CheckPrevPointersAndGetUnpreved(&thread)
	expectCode(t, err, DuplicateID)
}

func TestPrevInconsistentHash(t *testing.T) {
	thread := threadViewFromDummies([]dummyMessage{
		dummyMessage{
			id:   1,
			hash: []byte("placeholder"),
			prevs: []chat1.MessagePreviousPointer{
				chat1.MessagePreviousPointer{
					Id: 0,
					// We don't have the "real" has for this message, but we
					// can still cause an error by failing to match another
					// prev pointer.
					Hash: []byte("ONE THING"),
				},
			},
		},
		dummyMessage{
			id:   2,
			hash: []byte("placeholder"),
			prevs: []chat1.MessagePreviousPointer{
				chat1.MessagePreviousPointer{
					Id:   0,
					Hash: []byte("ANOTHER THING"), // This doesn't match above!
				},
			},
		},
	})

	_, _, err := CheckPrevPointersAndGetUnpreved(&thread)
	expectCode(t, err, InconsistentHash)
}

func TestPrevOutOfOrder(t *testing.T) {
	thread := threadViewFromDummies([]dummyMessage{
		dummyMessage{
			id:   1,
			hash: []byte("placeholder"),
			prevs: []chat1.MessagePreviousPointer{
				chat1.MessagePreviousPointer{
					Id:   2, // Out of order!
					Hash: []byte("placeholder"),
				},
			},
		},
		dummyMessage{
			id:    2,
			hash:  []byte("placeholder"),
			prevs: []chat1.MessagePreviousPointer{},
		},
	})

	_, _, err := CheckPrevPointersAndGetUnpreved(&thread)
	expectCode(t, err, OutOfOrderID)
}

func TestPrevOutOfOrderEq(t *testing.T) {
	thread := threadViewFromDummies([]dummyMessage{
		dummyMessage{
			id:   1,
			hash: []byte("placeholder"),
			prevs: []chat1.MessagePreviousPointer{
				chat1.MessagePreviousPointer{
					Id:   1, // Points to self!
					Hash: []byte("placeholder"),
				},
			},
		},
	})

	_, _, err := CheckPrevPointersAndGetUnpreved(&thread)
	expectCode(t, err, OutOfOrderID)
}

func TestPrevIncorrectHash(t *testing.T) {
	thread := threadViewFromDummies([]dummyMessage{
		dummyMessage{
			id:   1,
			hash: []byte("placeholder"),
		},
		dummyMessage{
			id:   2,
			hash: []byte("placeholder"),
			prevs: []chat1.MessagePreviousPointer{
				chat1.MessagePreviousPointer{
					Id:   1,
					Hash: []byte("THE WRONG THING"), // This doesn't match above!
				},
			},
		},
	})

	_, _, err := CheckPrevPointersAndGetUnpreved(&thread)
	expectCode(t, err, IncorrectHash)
}

func TestPrevExploding(t *testing.T) {
	thread := threadViewFromDummies([]dummyMessage{
		dummyMessage{
			id:   1,
			hash: []byte("placeholder"),
		},
		dummyMessage{
			exploding: true,
			id:        2,
			hash:      []byte("placeholder"),
			prevs: []chat1.MessagePreviousPointer{
				chat1.MessagePreviousPointer{
					Id:   1,
					Hash: []byte("placeholder"),
				},
			},
		},
		dummyMessage{
			exploding: true,
			id:        3,
			hash:      []byte("placeholder"),
			prevs: []chat1.MessagePreviousPointer{
				chat1.MessagePreviousPointer{
					Id:   2,
					Hash: []byte("placeholder"),
				},
			},
		},
	})

	unprevedRegular, unprevedExploding, err := CheckPrevPointersAndGetUnpreved(&thread)
	require.NoError(t, err)

	// The regular set of unpreved messages shouldn't respect the exploding
	// messages. It should treat message 1 as unpreved, and it should not
	// include message 3.
	require.Equal(t, 1, len(unprevedRegular))
	require.EqualValues(t, 1, unprevedRegular[0].Id)

	// In the exploding messages' view, messages 1 and 2 have both been preved
	// already.
	require.Equal(t, 1, len(unprevedExploding))
	require.EqualValues(t, 3, unprevedExploding[0].Id)
}
