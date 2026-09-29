package chat

import (
	"testing"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

func markUnreadTestMsg(id chat1.MessageID, typ chat1.MessageType) chat1.MessageUnboxed {
	var body chat1.MessageBody
	switch typ {
	case chat1.MessageType_TEXT:
		body = chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hi"})
	case chat1.MessageType_EDIT:
		body = chat1.NewMessageBodyWithEdit(chat1.MessageEdit{MessageID: 1, Body: "edited"})
	case chat1.MessageType_REACTION:
		body = chat1.NewMessageBodyWithReaction(chat1.MessageReaction{MessageID: 1, Body: ":+1:"})
	case chat1.MessageType_DELETE:
		body = chat1.NewMessageBodyWithDelete(chat1.MessageDelete{MessageIDs: []chat1.MessageID{1}})
	case chat1.MessageType_TLFNAME:
		body = chat1.MessageBody{}
	}
	return chat1.NewMessageUnboxedWithValid(chat1.MessageUnboxedValid{
		ServerHeader: chat1.MessageServerHeader{MessageID: id},
		ClientHeader: chat1.MessageClientHeaderVerified{MessageType: typ},
		MessageBody:  body,
	})
}

// A message whose body was deleted keeps its header type but has an empty body.
func markUnreadTestDeleted(id chat1.MessageID) chat1.MessageUnboxed {
	return chat1.NewMessageUnboxedWithValid(chat1.MessageUnboxedValid{
		ServerHeader: chat1.MessageServerHeader{MessageID: id},
		ClientHeader: chat1.MessageClientHeaderVerified{MessageType: chat1.MessageType_TEXT},
		MessageBody:  chat1.MessageBody{},
	})
}

func markUnreadTestPlaceholder(id chat1.MessageID) chat1.MessageUnboxed {
	return chat1.NewMessageUnboxedWithPlaceholder(chat1.MessageUnboxedPlaceholder{MessageID: id})
}

// Marking a conversation unread from a message sets the read position to the newest visible
// message strictly older than it, so that message becomes the first unread one. Messages that do
// not show as a row in the thread (edits, reactions, deletes, deleted bodies, placeholders,
// metadata) are never chosen. With no message given, the newest visible message becomes the
// first unread one. When there is no visible message before the line, or the line is not a
// message in the conversation, nothing changes.
func TestReadPositionForUnreadFrom(t *testing.T) {
	text := chat1.MessageType_TEXT
	// Newest first, as a thread is pulled.
	conv := []chat1.MessageUnboxed{
		markUnreadTestMsg(12, chat1.MessageType_REACTION),
		markUnreadTestMsg(11, text),
		markUnreadTestMsg(10, chat1.MessageType_EDIT),
		markUnreadTestMsg(9, text),
		markUnreadTestMsg(8, chat1.MessageType_DELETE),
		markUnreadTestDeleted(7),
		markUnreadTestPlaceholder(6),
		markUnreadTestMsg(5, chat1.MessageType_REACTION),
		markUnreadTestMsg(4, text),
		markUnreadTestMsg(3, text),
		markUnreadTestMsg(2, text),
		markUnreadTestMsg(1, chat1.MessageType_TLFNAME),
	}

	cases := []struct {
		name   string
		msgs   []chat1.MessageUnboxed
		fromID chat1.MessageID
		wantID chat1.MessageID
		wantOK bool
	}{
		{name: "line in the middle", msgs: conv, fromID: 4, wantID: 3, wantOK: true},
		{name: "line is the oldest visible message", msgs: conv, fromID: 2, wantOK: false},
		{
			name: "hidden, deleted and placeholder messages before the line are skipped",
			msgs: conv, fromID: 9, wantID: 4, wantOK: true,
		},
		{
			name: "no line: the newest visible message becomes the first unread",
			msgs: conv, fromID: 0, wantID: 9, wantOK: true,
		},
		{name: "line not in the conversation", msgs: conv, fromID: 40, wantOK: false},
		{
			name: "order of the loaded messages does not matter",
			msgs: []chat1.MessageUnboxed{
				markUnreadTestMsg(2, text),
				markUnreadTestMsg(4, text),
				markUnreadTestMsg(3, text),
			},
			fromID: 4, wantID: 3, wantOK: true,
		},
		{name: "empty conversation", msgs: nil, fromID: 0, wantOK: false},
		{
			name: "one visible message, no line",
			msgs: []chat1.MessageUnboxed{
				markUnreadTestMsg(2, text),
				markUnreadTestMsg(1, chat1.MessageType_TLFNAME),
			},
			fromID: 0, wantOK: false,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			readID, ok := readPositionForUnreadFrom(tc.msgs, tc.fromID)
			require.Equal(t, tc.wantOK, ok)
			if tc.wantOK {
				require.Equal(t, tc.wantID, readID)
			}
		})
	}
}
