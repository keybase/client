package chat

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"encoding/hex"

	"sort"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

func SendTextByName(ctx context.Context, g *globals.Context, name string, membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, text string, ri chat1.RemoteInterface) error {
	helper := newSendHelper(g, name, membersType, ident, ri)
	return helper.SendText(ctx, text)
}

func SendMsgByName(ctx context.Context, g *globals.Context, name string, membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, body chat1.MessageBody, msgType chat1.MessageType, ri chat1.RemoteInterface) error {
	helper := newSendHelper(g, name, membersType, ident, ri)
	return helper.SendBody(ctx, body, msgType)
}

type sendHelper struct {
	name        string
	membersType chat1.ConversationMembersType
	ri          chat1.RemoteInterface
	ident       keybase1.TLFIdentifyBehavior

	canonicalName string
	tlfID         chat1.TLFID
	convID        chat1.ConversationID
	triple        chat1.ConversationIDTriple

	globals.Contextified
}

func newSendHelper(g *globals.Context, name string, membersType chat1.ConversationMembersType,
	ident keybase1.TLFIdentifyBehavior, ri chat1.RemoteInterface) *sendHelper {
	return &sendHelper{
		Contextified: globals.NewContextified(g),
		name:         name,
		membersType:  membersType,
		ri:           ri,
		ident:        ident,
	}
}

func (s *sendHelper) SendText(ctx context.Context, text string) error {
	body := chat1.NewMessageBodyWithText(chat1.MessageText{Body: text})
	return s.SendBody(ctx, body, chat1.MessageType_TEXT)
}

func (s *sendHelper) SendBody(ctx context.Context, body chat1.MessageBody, mtype chat1.MessageType) error {
	ctx = Context(ctx, s.G(), s.ident, nil, NewIdentifyNotifier(s.G()))
	if err := s.nameInfo(ctx); err != nil {
		return err
	}

	if err := s.conversation(ctx); err != nil {
		return err
	}

	return s.deliver(ctx, body, mtype)
}

func (s *sendHelper) nameInfo(ctx context.Context) error {
	nameInfo, err := CtxKeyFinder(ctx, s.G()).Find(ctx, s.name, s.membersType, false)
	if err != nil {
		return err
	}
	s.tlfID = nameInfo.ID
	s.canonicalName = nameInfo.CanonicalName

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
		Name: &chat1.NameQuery{
			Name:        s.canonicalName,
			MembersType: s.membersType,
		},
		TlfVisibility: &vis,
		TopicType:     &topic,
	}

	ib, _, err := s.G().InboxSource.Read(ctx, uid.ToBytes(), nil, true, &query, nil)
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

	boxer := NewBoxer(s.G())
	sender := NewBlockingSender(s.G(), boxer, nil, s.remoteInterface)
	mbox, _, _, _, err := sender.Prepare(ctx, first, s.membersType, nil)
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
	boxer := NewBoxer(s.G())
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

type recentConversationParticipants struct {
	globals.Contextified
	utils.DebugLabeler
}

func newRecentConversationParticipants(g *globals.Context) *recentConversationParticipants {
	return &recentConversationParticipants{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "recentConversationParticipants", false),
	}
}

func (r *recentConversationParticipants) getActiveScore(ctx context.Context, conv chat1.Conversation) float64 {
	mtime := conv.GetMtime()
	diff := time.Now().Sub(mtime.Time())
	weeksAgo := diff.Seconds() / (time.Hour.Seconds() * 24 * 7)
	val := 10.0 - math.Pow(1.6, weeksAgo)
	if val < 1.0 {
		val = 1.0
	}
	return val
}

func (r *recentConversationParticipants) get(ctx context.Context, myUID gregor1.UID) (res []gregor1.UID, err error) {
	_, convs, err := storage.NewInbox(r.G(), myUID).ReadAll(ctx)
	if err != nil {
		return nil, err
	}

	r.Debug(ctx, "get: convs: %d", len(convs))
	m := make(map[string]float64)
	for _, conv := range convs {
		for _, uid := range conv.Metadata.ActiveList {
			if uid.Eq(myUID) {
				continue
			}
			m[uid.String()] += r.getActiveScore(ctx, conv)
		}
	}
	for suid := range m {
		uid, _ := hex.DecodeString(suid)
		res = append(res, gregor1.UID(uid))
	}

	// Sort by the most appearances in the active lists
	sort.Slice(res, func(i, j int) bool {
		return m[res[i].String()] > m[res[j].String()]
	})
	return res, nil
}

func RecentConversationParticipants(ctx context.Context, g *globals.Context, myUID gregor1.UID) ([]gregor1.UID, error) {
	ctx = Context(ctx, g, keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, NewIdentifyNotifier(g))
	return newRecentConversationParticipants(g).get(ctx, myUID)
}

var errGetUnverifiedConvNotFound = errors.New("GetUnverifiedConv: conversation not found")

func GetUnverifiedConv(ctx context.Context, g *globals.Context, uid gregor1.UID,
	convID chat1.ConversationID, useLocalData bool) (chat1.Conversation, *chat1.RateLimit, error) {

	inbox, ratelim, err := g.InboxSource.ReadUnverified(ctx, uid, useLocalData, &chat1.GetInboxQuery{
		ConvIDs: []chat1.ConversationID{convID},
	}, nil)
	if err != nil {
		return chat1.Conversation{}, ratelim, fmt.Errorf("GetUnverifiedConv: %s", err.Error())
	}
	if len(inbox.ConvsUnverified) == 0 {
		return chat1.Conversation{}, ratelim, errGetUnverifiedConvNotFound
	}
	return inbox.ConvsUnverified[0], ratelim, nil
}

func GetTLFConversations(ctx context.Context, g *globals.Context, debugger utils.DebugLabeler,
	ri func() chat1.RemoteInterface, uid gregor1.UID, tlfID chat1.TLFID, topicType chat1.TopicType,
	membersType chat1.ConversationMembersType) (res []chat1.ConversationLocal, rl []chat1.RateLimit, err error) {

	tlfRes, err := ri().GetTLFConversations(ctx, chat1.GetTLFConversationsArg{
		TlfID:            tlfID,
		TopicType:        topicType,
		MembersType:      membersType,
		SummarizeMaxMsgs: false,
	})
	if tlfRes.RateLimit != nil {
		rl = append(rl, *tlfRes.RateLimit)
	}

	// Localize the conversations
	res, err = NewBlockingLocalizer(g).Localize(ctx, uid, chat1.Inbox{
		ConvsUnverified: tlfRes.Conversations,
	})
	if err != nil {
		debugger.Debug(ctx, "GetTLFConversations: failed to localize conversations: %s", err.Error())
		return res, rl, err
	}
	sort.Sort(utils.ConvLocalByTopicName(res))
	rl = utils.AggRateLimits(rl)
	return res, rl, nil
}
