package storage

import (
	"crypto/rand"
	"sort"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type dummyContextFactory struct{}

func (d dummyContextFactory) NewKeyFinder() types.KeyFinder {
	return nil
}

func (d dummyContextFactory) NewUPAKFinder() types.UPAKFinder {
	return nil
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
