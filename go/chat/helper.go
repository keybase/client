package chat

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

func SendTextByName(ctx context.Context, g *globals.Context, name string, topicName string,
	membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, text string,
	ri chat1.RemoteInterface) error {
	helper := newSendHelper(g, name, topicName, membersType, ident, ri)
	return helper.SendText(ctx, text)
}

func SendMsgByName(ctx context.Context, g *globals.Context, name string, topicName string,
	membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, body chat1.MessageBody,
	msgType chat1.MessageType, ri chat1.RemoteInterface) error {
	helper := newSendHelper(g, name, topicName, membersType, ident, ri)
	return helper.SendBody(ctx, body, msgType)
}

type sendHelper struct {
	utils.DebugLabeler

	name        string
	membersType chat1.ConversationMembersType
	ri          chat1.RemoteInterface
	ident       keybase1.TLFIdentifyBehavior

	canonicalName string
	topicName     string
	tlfID         chat1.TLFID
	convID        chat1.ConversationID
	triple        chat1.ConversationIDTriple

	globals.Contextified
}

func newSendHelper(g *globals.Context, name string, topicName string,
	membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, ri chat1.RemoteInterface) *sendHelper {
	return &sendHelper{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "sendHelper", false),
		name:         name,
		topicName:    topicName,
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
	kuid, err := CurrentUID(s.G())
	if err != nil {
		return err
	}
	uid := gregor1.UID(kuid.ToBytes())

	oneChatPerTLF := true
	convs, _, err := FindConversations(ctx, s.G(), s.DebugLabeler, s.remoteInterface, uid, s.canonicalName,
		chat1.TopicType_CHAT, s.membersType, chat1.TLFVisibility_PRIVATE, s.topicName, &oneChatPerTLF)
	if err != nil {
		return err
	}
	if len(convs) > 1 {
		return fmt.Errorf("multiple conversations matched %q", s.canonicalName)
	}
	if len(convs) == 1 {
		s.convID = convs[0].Info.Id
		s.triple = convs[0].Info.Triple
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
	mbox, _, _, _, topicNameState, err := sender.Prepare(ctx, first, s.membersType, nil)
	if err != nil {
		return err
	}

	ncrres, reserr := s.ri.NewConversationRemote2(ctx, chat1.NewConversationRemote2Arg{
		IdTriple:       s.triple,
		TLFMessage:     *mbox,
		MembersType:    s.membersType,
		TopicNameState: topicNameState,
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
	_, _, _, err := sender.Send(ctx, s.convID, msg, 0, nil)
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
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "recentConversationParticipants", false),
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
	membersType chat1.ConversationMembersType, includeAuxiliaryInfo bool) (res []chat1.ConversationLocal, rl []chat1.RateLimit, err error) {

	tlfRes, err := ri().GetTLFConversations(ctx, chat1.GetTLFConversationsArg{
		TlfID:                tlfID,
		TopicType:            topicType,
		MembersType:          membersType,
		SummarizeMaxMsgs:     false,
		IncludeAuxiliaryInfo: includeAuxiliaryInfo,
	})
	if err != nil {
		return res, rl, err
	}
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

func GetTopicNameState(ctx context.Context, g *globals.Context, debugger utils.DebugLabeler,
	convs []chat1.ConversationLocal,
	uid gregor1.UID, tlfID chat1.TLFID, topicType chat1.TopicType,
	membersType chat1.ConversationMembersType) (res chat1.TopicNameState, err error) {

	var pairs chat1.ConversationIDMessageIDPairs
	sort.Sort(utils.ConvLocalByConvID(convs))
	for _, conv := range convs {
		msg, err := conv.GetMaxMessage(chat1.MessageType_METADATA)
		if err != nil {
			debugger.Debug(ctx, "GetTopicNameState: skipping convID: %s, no metadata message",
				conv.GetConvID())
			continue
		}
		if !msg.IsValid() {
			debugger.Debug(ctx, "GetTopicNameState: skipping convID: %s, invalid metadata message",
				conv.GetConvID())
			continue
		}
		pairs.Pairs = append(pairs.Pairs, chat1.ConversationIDMessageIDPair{
			ConvID: conv.GetConvID(),
			MsgID:  msg.GetMessageID(),
		})
	}

	if res, err = utils.CreateTopicNameState(pairs); err != nil {
		debugger.Debug(ctx, "GetTopicNameState: failed to create topic name state: %s", err.Error())
		return res, err
	}

	return res, nil
}

func FindConversations(ctx context.Context, g *globals.Context, debugger utils.DebugLabeler,
	ri func() chat1.RemoteInterface, uid gregor1.UID, tlfName string, topicType chat1.TopicType,
	membersType chat1.ConversationMembersType, vis chat1.TLFVisibility, topicName string,
	oneChatPerTLF *bool) (res []chat1.ConversationLocal, rl []chat1.RateLimit, err error) {
	query := &chat1.GetInboxLocalQuery{
		Name: &chat1.NameQuery{
			Name:        tlfName,
			MembersType: membersType,
		},
		TlfVisibility:     &vis,
		TopicName:         &topicName,
		TopicType:         &topicType,
		OneChatTypePerTLF: oneChatPerTLF,
	}
	inbox, irl, err := g.InboxSource.Read(ctx, uid, nil, true, query, nil)
	if err != nil {
		return res, rl, err
	}
	if irl != nil {
		rl = append(rl, *irl)
	}

	// If we have inbox hits, return those
	if len(inbox.Convs) > 0 {
		debugger.Debug(ctx, "FindConversations: found conversations in inbox: tlfName: %s num: %d",
			tlfName, len(inbox.Convs))
		res = inbox.Convs
	} else if membersType == chat1.ConversationMembersType_TEAM {
		// If this is a team chat that we are looking for, then let's try searching all
		// chats on the team to see if any match the arguments before giving up.
		// No need to worry (yet) about conflicting with public code path, since there
		// are not any public team chats.

		// Fetch the TLF ID from specified name
		nameInfo, err := CtxKeyFinder(ctx, g).Find(ctx, tlfName, membersType, false)
		if err != nil {
			debugger.Debug(ctx, "FindConversations: failed to get TLFID from name: %s", err.Error())
			return res, rl, err
		}
		tlfConvs, irl, err := GetTLFConversations(ctx, g, debugger, ri,
			uid, nameInfo.ID, topicType, membersType, false)
		if err != nil {
			debugger.Debug(ctx, "FindConversations: failed to list TLF conversations: %s", err.Error())
			return res, rl, err
		}
		rl = append(rl, irl...)

		for _, tlfConv := range tlfConvs {
			if utils.GetTopicName(tlfConv) == topicName {
				res = append(res, tlfConv)
			}
		}
		if len(res) > 0 {
			debugger.Debug(ctx, "FindConversations: found team channels: num: %d", len(res))
		}
	} else if vis == chat1.TLFVisibility_PUBLIC {
		debugger.Debug(ctx, "FindConversation: no conversations found in inbox, trying public chats")

		// Check for offline and return an error
		if g.InboxSource.IsOffline() {
			return res, rl, OfflineError{}
		}

		// If we miss the inbox, and we are looking for a public TLF, let's try and find
		// any conversation that matches
		nameInfo, err := GetInboxQueryNameInfo(ctx, g, query)
		if err != nil {
			return res, rl, err
		}

		// Call into gregor to try and find some public convs
		pubConvs, err := ri().GetPublicConversations(ctx, chat1.GetPublicConversationsArg{
			TlfID:            nameInfo.ID,
			TopicType:        topicType,
			SummarizeMaxMsgs: true,
		})
		if err != nil {
			return res, rl, err
		}
		if pubConvs.RateLimit != nil {
			rl = append(rl, *pubConvs.RateLimit)
		}

		// Localize the convs (if any)
		if len(pubConvs.Conversations) > 0 {
			localizer := NewBlockingLocalizer(g)
			convsLocal, err := localizer.Localize(ctx, uid, chat1.Inbox{
				ConvsUnverified: pubConvs.Conversations,
			})
			if err != nil {
				return res, rl, err
			}

			// Search for conversations that match the topic name
			for _, convLocal := range convsLocal {
				if convLocal.Info.TopicName == topicName {
					debugger.Debug(ctx, "FindConversation: found matching public conv: id: %s topicName: %s",
						convLocal.GetConvID(), topicName)
					res = append(res, convLocal)
				}
			}
		}

	}
	return res, rl, nil
}

// Post a join or leave message. Must be called when the user is in the conv.
// Uses a blocking sender.
func postJoinLeave(ctx context.Context, g *globals.Context, ri func() chat1.RemoteInterface, uid gregor1.UID,
	convID chat1.ConversationID, body chat1.MessageBody) (rl []chat1.RateLimit, err error) {
	typ, err := body.MessageType()
	if err != nil {
		return nil, fmt.Errorf("message type for postJoinLeave: %v", err)
	}
	switch typ {
	case chat1.MessageType_JOIN, chat1.MessageType_LEAVE:
	// good
	default:
		return nil, fmt.Errorf("invalid message type for postJoinLeave: %v", typ)
	}

	// Get the conversation from the inbox.
	query := chat1.GetInboxLocalQuery{
		ConvIDs: []chat1.ConversationID{convID},
	}
	ib, irl, err := g.InboxSource.Read(ctx, uid, nil, true, &query, nil)
	if len(ib.Convs) != 1 {
		return rl, fmt.Errorf("post join/leave: found %d conversations", len(ib.Convs))
	}
	if irl != nil {
		rl = append(rl, *irl)
	}
	conv := ib.Convs[0]

	plaintext := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:         conv.Info.Triple,
			TlfName:      conv.Info.TlfName,
			TlfPublic:    conv.Info.Visibility == chat1.TLFVisibility_PUBLIC,
			MessageType:  typ,
			Supersedes:   chat1.MessageID(0),
			Deletes:      nil,
			Prev:         nil, // Filled by Sender
			Sender:       nil, // Filled by Sender
			SenderDevice: nil, // Filled by Sender
			MerkleRoot:   nil, // Filled by Boxer
			OutboxID:     nil,
			OutboxInfo:   nil,
		},
		MessageBody: body,
	}

	// Send with a blocking sender
	sender := NewBlockingSender(g, NewBoxer(g), nil, ri)
	_, _, irl, err = sender.Send(ctx, convID, plaintext, 0, nil)
	if irl != nil {
		rl = append(rl, *irl)
	}
	return rl, err
}

func JoinConversation(ctx context.Context, g *globals.Context, debugger utils.DebugLabeler,
	ri func() chat1.RemoteInterface, uid gregor1.UID, convID chat1.ConversationID) (rl []chat1.RateLimit, err error) {
	alreadyIn, irl, err := g.InboxSource.IsMember(ctx, uid, convID)
	if err != nil {
		debugger.Debug(ctx, "JoinConversation: IsMember err: %s", err.Error())
		// Assume we're not in.
		alreadyIn = false
	}
	if irl != nil {
		rl = append(rl, *irl)
	}

	// Send the join command even if we're in.
	joinRes, err := ri().JoinConversation(ctx, convID)
	if err != nil {
		debugger.Debug(ctx, "JoinConversation: failed to join conversation: %s", err.Error())
		return rl, err
	}
	if joinRes.RateLimit != nil {
		rl = append(rl, *joinRes.RateLimit)
	}

	if !alreadyIn {
		// Send a message to the channel after joining.
		joinMessageBody := chat1.NewMessageBodyWithJoin(chat1.MessageJoin{})
		irl, err := postJoinLeave(ctx, g, ri, uid, convID, joinMessageBody)
		if err != nil {
			debugger.Debug(ctx, "JoinConversation: posting join-conv message failed: %v", err)
			// ignore the error
		}
		rl = append(rl, irl...)
	}
	return rl, nil
}

func LeaveConversation(ctx context.Context, g *globals.Context, debugger utils.DebugLabeler,
	ri func() chat1.RemoteInterface, uid gregor1.UID, convID chat1.ConversationID) (rl []chat1.RateLimit, err error) {
	alreadyIn, irl, err := g.InboxSource.IsMember(ctx, uid, convID)
	if err != nil {
		debugger.Debug(ctx, "LeaveConversation: IsMember err: %s", err.Error())
		// Pretend we're in.
		alreadyIn = true
	}
	if irl != nil {
		rl = append(rl, *irl)
	}

	// Send a message to the channel before leaving
	if alreadyIn {
		leaveMessageBody := chat1.NewMessageBodyWithLeave(chat1.MessageLeave{})
		irl, err := postJoinLeave(ctx, g, ri, uid, convID, leaveMessageBody)
		if err != nil {
			debugger.Debug(ctx, "LeaveConversation: posting leave-conv message failed: %v", err)
			// ignore the error
		}
		rl = append(rl, irl...)
	}

	leaveRes, err := ri().LeaveConversation(ctx, convID)
	if err != nil {
		debugger.Debug(ctx, "LeaveConversation: failed to leave conversation: %s", err.Error())
		return rl, err
	}
	if leaveRes.RateLimit != nil {
		rl = append(rl, *leaveRes.RateLimit)
	}

	return rl, nil
}
