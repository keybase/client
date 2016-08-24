package client

import (
	"errors"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/gregor/protocol/chat1"
	"github.com/keybase/gregor/protocol/gregor1"
)

const (
	chatLocalMockConversationID chat1.ConversationID = 42
)

type chatLocalMock struct {
}

func (c *chatLocalMock) GetInboxLocal(ctx context.Context, p *chat1.Pagination) (iview chat1.InboxView, err error) {
	iview.Conversations = append(iview.Conversations, chat1.Conversation{
		Metadata: chat1.ConversationMetadata{
			ConversationID: chatLocalMockConversationID,
		},
	})
	return iview, nil
}

func (c *chatLocalMock) mockMessage(idSeed byte, msgType chat1.MessageType) keybase1.Message {
	return keybase1.Message{
		ServerHeader: chat1.MessageServerHeader{
			MessageType:  msgType,
			MessageID:    chat1.MessageID(idSeed),
			Sender:       gregor1.UID{idSeed, 1},
			SenderDevice: gregor1.DeviceID{idSeed, 2},
			Ctime:        gregor1.ToTime(time.Now().Add(-time.Duration(idSeed) * time.Minute)),
		},
		MessagePlaintext: keybase1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				MessageType:  msgType,
				TlfName:      "morty,rick,songgao",
				Sender:       gregor1.UID{idSeed, 1},
				SenderDevice: gregor1.DeviceID{idSeed, 2},
				Conv: chat1.ConversationIDTriple{
					TopicType: chat1.TopicType_CHAT,
					TopicID:   chat1.TopicID{idSeed, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15},
				},
			},
		},
	}
}

func (c *chatLocalMock) GetThreadLocal(ctx context.Context, arg keybase1.GetThreadLocalArg) (tview keybase1.ThreadView, err error) {
	if arg.ConversationID != chatLocalMockConversationID {
		return tview, errors.New("unexpected ConversationID")
	}

	msg := c.mockMessage(1, chat1.MessageType_TEXT)
	msg.MessagePlaintext.MessageBodies = append(msg.MessagePlaintext.MessageBodies, keybase1.MessageBody{
		Type: chat1.MessageType_TEXT,
		Text: &keybase1.MessageText{
			Body: "O_O",
		},
	})
	tview.Messages = append(tview.Messages, msg)

	msg = c.mockMessage(2, chat1.MessageType_TEXT)
	msg.MessagePlaintext.MessageBodies = append(msg.MessagePlaintext.MessageBodies, keybase1.MessageBody{
		Type: chat1.MessageType_TEXT,
		Text: &keybase1.MessageText{
			Body: "Not much; just drinking.",
		},
	})
	tview.Messages = append(tview.Messages, msg)

	msg = c.mockMessage(3, chat1.MessageType_TEXT)
	msg.MessagePlaintext.MessageBodies = append(msg.MessagePlaintext.MessageBodies, keybase1.MessageBody{
		Type: chat1.MessageType_TEXT,
		Text: &keybase1.MessageText{
			Body: "Hey what's up!",
		},
	})
	tview.Messages = append(tview.Messages, msg)

	return tview, nil
}

func (c *chatLocalMock) PostLocal(ctx context.Context, arg keybase1.PostLocalArg) error {
	return errors.New("not implemented")
}

func (c *chatLocalMock) CompleteAndCanonicalizeTlfName(ctx context.Context, tlfName string) (res keybase1.CanonicalTlfName, err error) {
	return res, errors.New("not implemented")
}

func (c *chatLocalMock) GetOrCreateTextConversationLocal(ctx context.Context, arg keybase1.GetOrCreateTextConversationLocalArg) (id chat1.ConversationID, err error) {
	return id, errors.New("not implemented")
}

func (c *chatLocalMock) GetMessagesLocal(ctx context.Context, arg keybase1.MessageSelector) (messages []keybase1.Message, err error) {
	tview, err := c.GetThreadLocal(ctx, keybase1.GetThreadLocalArg{
		ConversationID: chatLocalMockConversationID,
	})
	if err != nil {
		return nil, err
	}
	return tview.Messages, nil
}

func (c *chatLocalMock) NewConversationLocal(ctx context.Context, cID chat1.ConversationIDTriple) (id chat1.ConversationID, err error) {
	return id, errors.New("not implemented")
}

func TestCliInbox(t *testing.T) {
	g := libkb.NewGlobalContextInit()
	term, err := NewTerminal(g)
	if err != nil {
		t.Fatal(err)
	}
	g.UI = &UI{Terminal: term}
	c := &cmdChatInbox{
		Contextified:    libkb.NewContextified(g),
		chatLocalClient: &chatLocalMock{},
	}
	g.ConfigureUsage(c.GetUsage())
	err = c.Run()
	if err != nil {
		t.Fatal(err)
	}
}

func TestParseDurationExtended(t *testing.T) {
	d, err := parseDurationExtended("123d12h2ns")
	if err != nil {
		t.Fatal(err)
	}
	expected := 123*24*time.Hour + 12*time.Hour + 2*time.Nanosecond
	if d != expected {
		t.Fatalf("wrong parsed duration. Expected %v, got %v\n", expected, d)
	}
}
