package client

/* NOTE: This file is very out-dated. Maybe we can just remove this all
* together. */

import (
	"errors"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

const (
	chatLocalMockConversationID chat1.ConversationID = 42
)

type chatLocalMock struct {
}

func (c *chatLocalMock) GetInboxLocal(ctx context.Context, arg chat1.GetInboxLocalArg) (iview chat1.InboxView, err error) {
	iview.Conversations = append(iview.Conversations, chat1.Conversation{
		Metadata: chat1.ConversationMetadata{
			ConversationID: chatLocalMockConversationID,
		},
	})
	return iview, nil
}

func (c *chatLocalMock) mockMessage(idSeed byte, msgType chat1.MessageType, body chat1.MessageBody) chat1.Message {
	return chat1.Message{
		ServerHeader: chat1.MessageServerHeader{
			MessageType:  msgType,
			MessageID:    chat1.MessageID(idSeed),
			Sender:       gregor1.UID{idSeed, 1},
			SenderDevice: gregor1.DeviceID{idSeed, 2},
			Ctime:        gregor1.ToTime(time.Now().Add(-time.Duration(idSeed) * time.Minute)),
		},
		MessagePlaintext: chat1.NewMessagePlaintextWithV1(chat1.MessagePlaintextV1{
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
			MessageBody: body,
		}),
	}
}

func (c *chatLocalMock) GetThreadLocal(ctx context.Context, arg chat1.GetThreadLocalArg) (tview chat1.ThreadView, err error) {
	if arg.ConversationID != chatLocalMockConversationID {
		return tview, errors.New("unexpected ConversationID")
	}

	body := chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "O_O blah blah blah this is a really long line and I don't know what I'm talking about hahahahaha OK long enough",
	})
	msg := c.mockMessage(2, chat1.MessageType_TEXT, body)
	tview.Messages = append(tview.Messages, msg)

	body = chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "Not much; just drinking.",
	})
	msg = c.mockMessage(3, chat1.MessageType_TEXT, body)
	tview.Messages = append(tview.Messages, msg)

	body = chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "Hey what's up!",
	})
	msg = c.mockMessage(4, chat1.MessageType_TEXT, body)
	tview.Messages = append(tview.Messages, msg)

	return tview, nil
}

func (c *chatLocalMock) PostLocal(ctx context.Context, arg chat1.PostLocalArg) error {
	return errors.New("PostLocal not implemented")
}

func (c *chatLocalMock) CompleteAndCanonicalizeTlfName(ctx context.Context, tlfName string) (res keybase1.CanonicalTlfName, err error) {
	// TODO
	return keybase1.CanonicalTlfName(tlfName), nil
}

func (c *chatLocalMock) ResolveConversationLocal(ctx context.Context, arg chat1.ConversationInfoLocal) (conversations []chat1.ConversationInfoLocal, err error) {
	conversations = append(conversations, chat1.ConversationInfoLocal{
		TlfName:   "morty,rick,songgao",
		TopicName: "random",
		TopicType: chat1.TopicType_CHAT,
		Id:        chatLocalMockConversationID,
	})
	return conversations, nil
}

func (c *chatLocalMock) GetInboxSummaryLocal(ctx context.Context, arg chat1.GetInboxSummaryLocalQuery) (res chat1.GetInboxSummaryLocalRes, err error) {
	res.Conversations, err = c.GetMessagesLocal(ctx, chat1.MessageSelector{})
	if err != nil {
		return res, err
	}

	res.More, err = c.GetMessagesLocal(ctx, chat1.MessageSelector{})
	if err != nil {
		return res, err
	}
	res.More[0].Info.TlfName = "morty,songgao"
	res.More[0].Info.Id++
	res.More[0].Messages[0].ServerHeader.Ctime -= 1000 * 3600 * 24 * 5

	res.MoreTotal = 1000

	return res, nil
}

func (c *chatLocalMock) UpdateTopicNameLocal(ctx context.Context, arg chat1.UpdateTopicNameLocalArg) (err error) {
	return errors.New("UpdateTopicNameLocal not implemented")
}

func (c *chatLocalMock) GetMessagesLocal(ctx context.Context, arg chat1.MessageSelector) (messages []chat1.ConversationLocal, err error) {
	tview, err := c.GetThreadLocal(ctx, chat1.GetThreadLocalArg{
		ConversationID: chatLocalMockConversationID,
	})
	if err != nil {
		return nil, err
	}
	tview.Messages[0].Info = &chat1.MessageInfoLocal{IsNew: true, SenderUsername: "songgao", SenderDeviceName: "MacBook"}
	tview.Messages[1].Info = &chat1.MessageInfoLocal{IsNew: true, SenderUsername: "rick", SenderDeviceName: "bottle-opener"}
	tview.Messages[2].Info = &chat1.MessageInfoLocal{IsNew: false, SenderUsername: "morty", SenderDeviceName: "toothbrush"}
	return []chat1.ConversationLocal{
		chat1.ConversationLocal{
			Info: &chat1.ConversationInfoLocal{
				Id:        chatLocalMockConversationID,
				TlfName:   "morty,rick,songgao",
				TopicName: "",
				TopicType: chat1.TopicType_CHAT,
			},
			Messages: tview.Messages,
		},
	}, nil
}

func (c *chatLocalMock) NewConversationLocal(ctx context.Context, cID chat1.ConversationInfoLocal) (id chat1.ConversationInfoLocal, err error) {
	return id, errors.New("NewConversationLocal not implemented")
}

func TestCliList(t *testing.T) {
	g := libkb.NewGlobalContextInit()
	term, err := NewTerminal(g)
	if err != nil {
		t.Fatal(err)
	}
	g.UI = &UI{Terminal: term}
	c := &cmdChatList{
		Contextified: libkb.NewContextified(g),
	}
	g.ConfigureUsage(c.GetUsage())
	c.fetcher.chatClient = &chatLocalMock{}
	err = c.Run()
	if err != nil {
		t.Fatal(err)
	}
}

func TestCliRead(t *testing.T) {
	t.Skip("not needed")
	g := libkb.NewGlobalContextInit()
	term, err := NewTerminal(g)
	if err != nil {
		t.Fatal(err)
	}
	g.UI = &UI{Terminal: term}
	c := &cmdChatRead{
		Contextified: libkb.NewContextified(g),
		fetcher: messageFetcher{
			selector: chat1.MessageSelector{
				MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
			},
			resolver: conversationResolver{
				TlfName: "morty,rick,songgao",
			},
			chatClient: &chatLocalMock{},
		},
	}
	g.ConfigureUsage(c.GetUsage())
	err = c.Run()
	if err != nil {
		t.Fatal(err)
	}
}
