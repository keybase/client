package storage

import (
	"crypto/rand"
	"sort"
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	insecureTriplesec "github.com/keybase/go-triplesec-insecure"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type dummyContextFactory struct{}

func (d dummyContextFactory) NewKeyFinder() types.KeyFinder {
	return nil
}

func (d dummyContextFactory) NewUPAKFinder() types.UPAKFinder {
	return nil
}

func setupCommonTest(t testing.TB, name string) kbtest.ChatTestContext {
	tc := externalstest.SetupTest(t, name, 2)

	// use an insecure triplesec in tests
	tc.G.NewTriplesec = func(passphrase []byte, salt []byte) (libkb.Triplesec, error) {
		warner := func() { tc.G.Log.Warning("Installing insecure Triplesec with weak stretch parameters") }
		isProduction := func() bool {
			return tc.G.Env.GetRunMode() == libkb.ProductionRunMode
		}
		return insecureTriplesec.NewCipher(passphrase, salt, libkb.ClientTriplesecVersion, warner, isProduction)
	}
	ctc := kbtest.ChatTestContext{
		TestContext: tc,
		ChatG: &globals.ChatContext{
			AttachmentUploader: types.DummyAttachmentUploader{},
			Unfurler:           types.DummyUnfurler{},
			EphemeralPurger:    types.DummyEphemeralPurger{},
			EphemeralTracker:   types.DummyEphemeralTracker{},
			Indexer:            types.DummyIndexer{},
			CtxFactory:         dummyContextFactory{},
		},
	}
	ctc.Context().ServerCacheVersions = NewServerVersions(ctc.Context())
	return ctc
}

func MakeEdit(id chat1.MessageID, supersedes chat1.MessageID) chat1.MessageUnboxed {
	msg := chat1.MessageUnboxedValid{
		ServerHeader: chat1.MessageServerHeader{
			MessageID: id,
		},
		ClientHeader: chat1.MessageClientHeaderVerified{
			MessageType: chat1.MessageType_EDIT,
		},
		MessageBody: chat1.NewMessageBodyWithEdit(chat1.MessageEdit{
			MessageID: supersedes,
			Body:      "edit",
		}),
	}
	return chat1.NewMessageUnboxedWithValid(msg)
}

func MakeEphemeralEdit(id chat1.MessageID, supersedes chat1.MessageID, ephemeralMetadata *chat1.MsgEphemeralMetadata, now gregor1.Time) chat1.MessageUnboxed {
	msg := MakeEdit(id, supersedes)
	mvalid := msg.Valid()
	mvalid.ServerHeader.Ctime = now
	mvalid.ServerHeader.Now = now
	mvalid.ClientHeader.Rtime = now
	mvalid.ClientHeader.EphemeralMetadata = ephemeralMetadata
	return chat1.NewMessageUnboxedWithValid(mvalid)
}

func MakeDelete(id chat1.MessageID, originalMessage chat1.MessageID, allEdits []chat1.MessageID) chat1.MessageUnboxed {
	msg := chat1.MessageUnboxedValid{
		ServerHeader: chat1.MessageServerHeader{
			MessageID: id,
		},
		ClientHeader: chat1.MessageClientHeaderVerified{
			MessageType: chat1.MessageType_DELETE,
		},
		MessageBody: chat1.NewMessageBodyWithDelete(chat1.MessageDelete{
			MessageIDs: append([]chat1.MessageID{originalMessage}, allEdits...),
		}),
	}
	return chat1.NewMessageUnboxedWithValid(msg)
}

func MakeText(id chat1.MessageID, text string) chat1.MessageUnboxed {
	msg := chat1.MessageUnboxedValid{
		ServerHeader: chat1.MessageServerHeader{
			MessageID: id,
		},
		ClientHeader: chat1.MessageClientHeaderVerified{
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: text,
		}),
	}
	return chat1.NewMessageUnboxedWithValid(msg)
}

func MakeEphemeralText(id chat1.MessageID, text string, ephemeralMetadata *chat1.MsgEphemeralMetadata, now gregor1.Time) chat1.MessageUnboxed {
	msg := MakeText(id, text)
	mvalid := msg.Valid()
	mvalid.ServerHeader.Ctime = now
	mvalid.ServerHeader.Now = now
	mvalid.ClientHeader.Rtime = now
	mvalid.ClientHeader.EphemeralMetadata = ephemeralMetadata
	return chat1.NewMessageUnboxedWithValid(mvalid)
}

func MakeHeadlineMessage(id chat1.MessageID) chat1.MessageUnboxed {
	msg := chat1.MessageUnboxedValid{
		ServerHeader: chat1.MessageServerHeader{
			MessageID: id,
		},
		ClientHeader: chat1.MessageClientHeaderVerified{
			MessageType: chat1.MessageType_HEADLINE,
		},
		MessageBody: chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{
			Headline: "discus discuss",
		}),
	}
	return chat1.NewMessageUnboxedWithValid(msg)
}

func MakeDeleteHistory(id chat1.MessageID, upto chat1.MessageID) chat1.MessageUnboxed {
	msg := chat1.MessageUnboxedValid{
		ServerHeader: chat1.MessageServerHeader{
			MessageID: id,
		},
		ClientHeader: chat1.MessageClientHeaderVerified{
			MessageType: chat1.MessageType_DELETEHISTORY,
		},
		MessageBody: chat1.NewMessageBodyWithDeletehistory(chat1.MessageDeleteHistory{
			Upto: upto,
		}),
	}
	return chat1.NewMessageUnboxedWithValid(msg)
}

func MakeMsgWithType(id chat1.MessageID, typ chat1.MessageType) chat1.MessageUnboxed {
	msg := chat1.MessageUnboxedValid{
		ServerHeader: chat1.MessageServerHeader{
			MessageID: id,
		},
		ClientHeader: chat1.MessageClientHeaderVerified{
			MessageType: typ,
		},
	}
	return chat1.NewMessageUnboxedWithValid(msg)
}

func MakeConversationAt(convID chat1.ConversationID, maxID chat1.MessageID) chat1.Conversation {
	return chat1.Conversation{
		Metadata: chat1.ConversationMetadata{
			ConversationID: convID,
		},
		ReaderInfo: &chat1.ConversationReaderInfo{
			MaxMsgid: maxID,
		},
	}
}

func randBytes(n int) []byte {
	ret := make([]byte, n)
	_, err := rand.Read(ret)
	if err != nil {
		panic(err)
	}
	return ret
}

func MakeConvID() chat1.ConversationID {
	rbytes := randBytes(8)
	return chat1.ConversationID(rbytes)
}

func MakeConversation(maxID chat1.MessageID) chat1.Conversation {
	return MakeConversationAt(MakeConvID(), maxID)
}

// Sort messages by ID descending
func SortMessagesDesc(msgs []chat1.MessageUnboxed) []chat1.MessageUnboxed {
	res := make([]chat1.MessageUnboxed, len(msgs))
	copy(res, msgs)
	sort.SliceStable(res, func(i, j int) bool {
		return res[j].GetMessageID() < res[i].GetMessageID()
	})
	return res
}

func MustMerge(t testing.TB, storage *Storage,
	convID chat1.ConversationID, uid gregor1.UID, msgs []chat1.MessageUnboxed) MergeResult {
	conv, err := NewInbox(storage.G()).GetConversation(context.Background(), uid, convID)
	switch err.(type) {
	case nil:
	case MissError:
		conv = types.NewEmptyRemoteConversation(convID)
	default:
		require.NoError(t, err)
	}
	res, err := storage.Merge(context.Background(), conv, uid, msgs)
	require.NoError(t, err)
	return res
}
