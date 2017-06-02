package chat

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

func SendTextByName(ctx context.Context, g *globals.Context, name string, membersType chat1.ConversationMembersType, text string, ri chat1.RemoteInterface) error {
	helper := newSendHelper(g, name, membersType, ri)
	return helper.SendText(ctx, text)
}

func SendMsgByName(ctx context.Context, g *globals.Context, name string, membersType chat1.ConversationMembersType, body chat1.MessageBody, msgType chat1.MessageType, ri chat1.RemoteInterface) error {
	helper := newSendHelper(g, name, membersType, ri)
	return helper.SendBody(ctx, body, msgType)
}

type sendHelper struct {
	name        string
	membersType chat1.ConversationMembersType
	ri          chat1.RemoteInterface

	canonicalName string
	tlfID         chat1.TLFID
	convID        chat1.ConversationID
	triple        chat1.ConversationIDTriple

	infoSrc types.TLFInfoSource
	globals.Contextified
}

func newSendHelper(g *globals.Context, name string, membersType chat1.ConversationMembersType, ri chat1.RemoteInterface) *sendHelper {
	return &sendHelper{
		Contextified: globals.NewContextified(g),
		name:         name,
		membersType:  membersType,
		ri:           ri,
	}
}

func (s *sendHelper) SendText(ctx context.Context, text string) error {
	body := chat1.NewMessageBodyWithText(chat1.MessageText{Body: text})
	return s.SendBody(ctx, body, chat1.MessageType_TEXT)
}

func (s *sendHelper) SendBody(ctx context.Context, body chat1.MessageBody, mtype chat1.MessageType) error {
	if err := s.nameInfo(ctx); err != nil {
		return err
	}

	if err := s.conversation(ctx); err != nil {
		return err
	}

	return s.deliver(ctx, body, mtype)
}

func (s *sendHelper) nameInfo(ctx context.Context) error {
	cname, err := s.infoSource().CompleteAndCanonicalizePrivateTlfName(ctx, s.name)
	if err != nil {
		return err
	}
	s.tlfID, err = chat1.MakeTLFID(cname.TlfID.String())
	if err != nil {
		return err
	}

	s.canonicalName = cname.CanonicalName.String()

	return nil
}

func (s *sendHelper) conversation(ctx context.Context) error {
	uid, err := CurrentUID(s.G())
	if err != nil {
		return err
	}

	vis := chat1.TLFVisibility_PRIVATE
	topic := chat1.TopicType_CHAT
	query := chat1.GetInboxLocalQuery{
		TlfName:       &s.canonicalName,
		TlfVisibility: &vis,
		TopicType:     &topic,
	}

	localizer := NewBlockingLocalizer(s.G(), s.infoSource())
	ib, _, err := s.G().InboxSource.Read(ctx, uid.ToBytes(), localizer, true, &query, nil)
	if err != nil {
		return err
	}

	if len(ib.Convs) > 1 {
		return fmt.Errorf("multiple conversations matched %q", s.canonicalName)
	}
	if len(ib.Convs) == 1 {
		s.convID = ib.Convs[0].Info.Id
		s.triple = ib.Convs[0].Info.Triple
		return nil
	}

	// need new conversation
	return s.newConversation(ctx)
}

func (s *sendHelper) newConversation(ctx context.Context) error {
	s.triple = chat1.ConversationIDTriple{
		Tlfid:     s.tlfID,
		TopicType: chat1.TopicType_CHAT,
	}
	var err error
	s.triple.TopicID, err = utils.NewChatTopicID()
	if err != nil {
		return err
	}

	first := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        s.triple,
			TlfName:     s.canonicalName,
			MessageType: chat1.MessageType_TLFNAME,
		},
	}

	boxer := NewBoxer(s.G(), s.infoSource())
	sender := NewBlockingSender(s.G(), boxer, nil, s.remoteInterface)
	mbox, _, err := sender.Prepare(ctx, first, nil)
	if err != nil {
		return err
	}

	ncrres, reserr := s.ri.NewConversationRemote2(ctx, chat1.NewConversationRemote2Arg{
		IdTriple:    s.triple,
		TLFMessage:  *mbox,
		MembersType: s.membersType,
	})
	convID := ncrres.ConvID
	if reserr != nil {
		switch cerr := reserr.(type) {
		case libkb.ChatConvExistsError:
			convID = cerr.ConvID
		default:
			return fmt.Errorf("error creating conversation: %s", reserr)
		}
	}
	s.convID = convID

	return nil
}

func (s *sendHelper) deliver(ctx context.Context, body chat1.MessageBody, mtype chat1.MessageType) error {
	boxer := NewBoxer(s.G(), s.infoSource())
	sender := NewBlockingSender(s.G(), boxer, nil, s.remoteInterface)
	msg := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        s.triple,
			TlfName:     s.canonicalName,
			MessageType: mtype,
		},
		MessageBody: body,
	}
	_, _, _, err := sender.Send(ctx, s.convID, msg, 0)
	return err
}

func (s *sendHelper) infoSource() types.TLFInfoSource {
	if s.infoSrc == nil {
		s.infoSrc = NewKBFSTLFInfoSource(s.G())
	}
	return s.infoSrc
}

func (s *sendHelper) remoteInterface() chat1.RemoteInterface {
	return s.ri
}

func CurrentUID(g *globals.Context) (keybase1.UID, error) {
	uid := g.Env.GetUID()
	if uid.IsNil() {
		return "", libkb.LoginRequiredError{}
	}
	return uid, nil
}
