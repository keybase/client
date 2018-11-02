package chat

import (
	"context"
	"encoding/json"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type DevConversationBackedStorage struct {
	globals.Contextified
	utils.DebugLabeler

	ri func() chat1.RemoteInterface
}

func NewDevConversationBackedStorage(g *globals.Context, ri func() chat1.RemoteInterface) *DevConversationBackedStorage {
	return &DevConversationBackedStorage{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "DevConversationBackedStorage", false),
		ri:           ri,
	}
}

func (s *DevConversationBackedStorage) Put(ctx context.Context, name string, src interface{}) (err error) {
	defer s.Trace(ctx, func() error { return err }, "Put(%s)", name)()
	uid, err := utils.AssertLoggedInUID(ctx, s.G())
	if err != nil {
		return err
	}
	username := s.G().ActiveDevice.Username(libkb.NewMetaContext(ctx, s.G().ExternalG())).String()
	dat, err := json.Marshal(src)
	if err != nil {
		return err
	}
	conv, err := NewConversation(ctx, s.G(), uid, username, &name, chat1.TopicType_DEV,
		chat1.ConversationMembersType_IMPTEAMNATIVE, keybase1.TLFVisibility_PRIVATE, s.ri)
	if err != nil {
		return err
	}
	if _, _, err = NewBlockingSender(s.G(), NewBoxer(s.G()), s.ri).Send(ctx, conv.GetConvID(),
		chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        conv.Info.Triple,
				TlfName:     username,
				MessageType: chat1.MessageType_TEXT,
			},
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: string(dat),
			}),
		}, 0, nil); err != nil {
		return err
	}
	return nil
}

func (s *DevConversationBackedStorage) Get(ctx context.Context, name string, dest interface{}) (found bool, err error) {
	defer s.Trace(ctx, func() error { return err }, "Get(%s)", name)()
	uid, err := utils.AssertLoggedInUID(ctx, s.G())
	if err != nil {
		return false, err
	}
	username := s.G().ActiveDevice.Username(libkb.NewMetaContext(ctx, s.G().ExternalG())).String()

	convs, err := FindConversations(ctx, s.G(), s.DebugLabeler, true, s.ri, uid, username,
		chat1.TopicType_DEV, chat1.ConversationMembersType_IMPTEAMNATIVE, keybase1.TLFVisibility_PRIVATE,
		name, nil)
	if err != nil {
		return false, err
	}
	if len(convs) == 0 {
		return false, nil
	}
	conv := convs[0]
	tv, err := s.G().ConvSource.Pull(ctx, conv.GetConvID(), uid, chat1.GetThreadReason_GENERAL,
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, &chat1.Pagination{Num: 1})
	if err != nil {
		return false, err
	}
	if len(tv.Messages) == 0 {
		return false, nil
	}
	msg := tv.Messages[0]
	if !msg.IsValid() {
		return false, nil
	}
	body := msg.Valid().MessageBody
	if !body.IsType(chat1.MessageType_TEXT) {
		return false, nil
	}
	if err = json.Unmarshal([]byte(body.Text().Body), dest); err != nil {
		return false, err
	}
	return true, nil
}
