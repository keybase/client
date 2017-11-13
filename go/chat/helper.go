package chat

import (
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"golang.org/x/net/context"
)

type Helper struct {
	globals.Contextified
	utils.DebugLabeler

	ri func() chat1.RemoteInterface
}

func NewHelper(g *globals.Context, ri func() chat1.RemoteInterface) *Helper {
	return &Helper{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Helper", false),
		ri:           ri,
	}
}

func (h *Helper) SendTextByID(ctx context.Context, convID chat1.ConversationID,
	trip chat1.ConversationIDTriple, tlfName string, text string) error {
	return h.SendMsgByID(ctx, convID, trip, tlfName, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: text,
	}), chat1.MessageType_TEXT)
}

func (h *Helper) SendMsgByID(ctx context.Context, convID chat1.ConversationID,
	trip chat1.ConversationIDTriple, tlfName string, body chat1.MessageBody, msgType chat1.MessageType) error {
	boxer := NewBoxer(h.G())
	sender := NewBlockingSender(h.G(), boxer, nil, h.ri)
	msg := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			TlfName:     tlfName,
			MessageType: msgType,
		},
		MessageBody: body,
	}
	_, _, _, err := sender.Send(ctx, convID, msg, 0, nil)
	return err
}

func (h *Helper) SendTextByIDNonblock(ctx context.Context, convID chat1.ConversationID,
	trip chat1.ConversationIDTriple, tlfName string, text string) error {
	return h.SendMsgByIDNonblock(ctx, convID, trip, tlfName, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: text,
	}), chat1.MessageType_TEXT)
}

func (h *Helper) SendMsgByIDNonblock(ctx context.Context, convID chat1.ConversationID,
	trip chat1.ConversationIDTriple, tlfName string, body chat1.MessageBody, msgType chat1.MessageType) error {
	boxer := NewBoxer(h.G())
	baseSender := NewBlockingSender(h.G(), boxer, nil, h.ri)
	sender := NewNonblockingSender(h.G(), baseSender)
	msg := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			TlfName:     tlfName,
			MessageType: msgType,
		},
		MessageBody: body,
	}
	_, _, _, err := sender.Send(ctx, convID, msg, 0, nil)
	return err
}

func (h *Helper) SendTextByName(ctx context.Context, name string, topicName *string,
	membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, text string) error {
	boxer := NewBoxer(h.G())
	sender := NewBlockingSender(h.G(), boxer, nil, h.ri)
	helper := newSendHelper(h.G(), name, topicName, membersType, ident, sender, h.ri)
	return helper.SendText(ctx, text)
}

func (h *Helper) SendMsgByName(ctx context.Context, name string, topicName *string,
	membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, body chat1.MessageBody,
	msgType chat1.MessageType) error {
	boxer := NewBoxer(h.G())
	sender := NewBlockingSender(h.G(), boxer, nil, h.ri)
	helper := newSendHelper(h.G(), name, topicName, membersType, ident, sender, h.ri)
	return helper.SendBody(ctx, body, msgType)
}

func (h *Helper) SendTextByNameNonblock(ctx context.Context, name string, topicName *string,
	membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, text string) error {
	boxer := NewBoxer(h.G())
	baseSender := NewBlockingSender(h.G(), boxer, nil, h.ri)
	sender := NewNonblockingSender(h.G(), baseSender)
	helper := newSendHelper(h.G(), name, topicName, membersType, ident, sender, h.ri)
	return helper.SendText(ctx, text)
}

func (h *Helper) SendMsgByNameNonblock(ctx context.Context, name string, topicName *string,
	membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, body chat1.MessageBody,
	msgType chat1.MessageType) error {
	boxer := NewBoxer(h.G())
	baseSender := NewBlockingSender(h.G(), boxer, nil, h.ri)
	sender := NewNonblockingSender(h.G(), baseSender)
	helper := newSendHelper(h.G(), name, topicName, membersType, ident, sender, h.ri)
	return helper.SendBody(ctx, body, msgType)
}

type sendHelper struct {
	utils.DebugLabeler

	name        string
	membersType chat1.ConversationMembersType
	ident       keybase1.TLFIdentifyBehavior
	sender      types.Sender
	ri          func() chat1.RemoteInterface

	canonicalName string
	topicName     *string
	tlfID         chat1.TLFID
	convID        chat1.ConversationID
	triple        chat1.ConversationIDTriple

	globals.Contextified
}

func newSendHelper(g *globals.Context, name string, topicName *string,
	membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, sender types.Sender,
	ri func() chat1.RemoteInterface) *sendHelper {
	return &sendHelper{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "sendHelper", false),
		name:         name,
		topicName:    topicName,
		membersType:  membersType,
		ident:        ident,
		sender:       sender,
		ri:           ri,
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
	conv, _, err := NewConversation(ctx, s.G(), uid, s.canonicalName, s.topicName,
		chat1.TopicType_CHAT, s.membersType, keybase1.TLFVisibility_PRIVATE, s.remoteInterface)
	if err != nil {
		return err
	}
	s.convID = conv.GetConvID()
	s.triple = conv.Info.Triple
	return nil
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

	mbox, _, _, _, topicNameState, err := s.sender.Prepare(ctx, first, s.membersType, nil)
	if err != nil {
		return err
	}

	ncrres, reserr := s.ri().NewConversationRemote2(ctx, chat1.NewConversationRemote2Arg{
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
	msg := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        s.triple,
			TlfName:     s.canonicalName,
			MessageType: mtype,
		},
		MessageBody: body,
	}
	_, _, _, err := s.sender.Send(ctx, s.convID, msg, 0, nil)
	return err
}

func (s *sendHelper) remoteInterface() chat1.RemoteInterface {
	return s.ri()
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
		if _, ok := err.(storage.MissError); ok {
			r.Debug(ctx, "get: no inbox, returning blank results")
			return nil, nil
		}
		return nil, err
	}

	r.Debug(ctx, "get: convs: %d", len(convs))
	m := make(map[string]float64)
	for _, conv := range convs {
		for _, uid := range conv.Conv.Metadata.ActiveList {
			if uid.Eq(myUID) {
				continue
			}
			m[uid.String()] += r.getActiveScore(ctx, conv.Conv)
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
	return inbox.ConvsUnverified[0].Conv, ratelim, nil
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
	membersTypeIn chat1.ConversationMembersType, vis keybase1.TLFVisibility, topicName string,
	oneChatPerTLF *bool) (res []chat1.ConversationLocal, rl []chat1.RateLimit, err error) {

	findConvosWithMembersType := func(membersType chat1.ConversationMembersType) (res []chat1.ConversationLocal, rl []chat1.RateLimit, err error) {
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
			tlfConvs, irl, err := g.TeamChannelSource.GetChannelsFull(ctx, uid, nameInfo.ID, topicType)
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
		} else if vis == keybase1.TLFVisibility_PUBLIC {
			debugger.Debug(ctx, "FindConversations: no conversations found in inbox, trying public chats")

			// Check for offline and return an error
			if g.InboxSource.IsOffline(ctx) {
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
				convsLocal, err := localizer.Localize(ctx, uid, types.Inbox{
					ConvsUnverified: utils.RemoteConvs(pubConvs.Conversations),
				})
				if err != nil {
					return res, rl, err
				}

				// Search for conversations that match the topic name
				for _, convLocal := range convsLocal {
					if convLocal.Error != nil {
						debugger.Debug(ctx, "FindConversations: skipping convID: %s localization failure: %s",
							convLocal.GetConvID(), convLocal.Error.Message)
						continue
					}
					if convLocal.Info.TopicName == topicName {
						debugger.Debug(ctx, "FindConversations: found matching public conv: id: %s topicName: %s",
							convLocal.GetConvID(), topicName)
						res = append(res, convLocal)
					}
				}
			}

		}
		return res, rl, nil
	}
	res, rl, err = findConvosWithMembersType(membersTypeIn)
	if err != nil || len(res) == 0 {
		switch membersTypeIn {
		case chat1.ConversationMembersType_IMPTEAM:
			// Try again with KBFS
			debugger.Debug(ctx,
				"FindConversations: failing to find anything for IMPTEAM, trying again for KBFS")
			kres, krl, kerr := findConvosWithMembersType(chat1.ConversationMembersType_KBFS)
			rl = utils.AggRateLimits(append(rl, krl...))
			if kerr == nil {
				res = kres
				err = nil
				debugger.Debug(ctx,
					"FindConversations: KBFS pass succeeded without error, returning that result")
			}
		}
	}
	return res, rl, err
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
			TlfPublic:    conv.Info.Visibility == keybase1.TLFVisibility_PUBLIC,
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

	if _, err = g.InboxSource.MembershipUpdate(ctx, uid, 0, []chat1.ConversationMember{
		chat1.ConversationMember{
			Uid:    uid,
			ConvID: convID,
		},
	}, nil, nil); err != nil {
		debugger.Debug(ctx, "JoinConversation: failed to apply membership update: %s", err.Error())
	}

	if !alreadyIn {
		// Send a message to the channel after joining.
		joinMessageBody := chat1.NewMessageBodyWithJoin(chat1.MessageJoin{})
		debugger.Debug(ctx, "JoinConversation: sending join message to: %s", convID)
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

func NewConversation(ctx context.Context, g *globals.Context, uid gregor1.UID, tlfName string, topicName *string,
	topicType chat1.TopicType, membersType chat1.ConversationMembersType, vis keybase1.TLFVisibility,
	ri func() chat1.RemoteInterface) (chat1.ConversationLocal, []chat1.RateLimit, error) {
	helper := newNewConversationHelper(g, uid, tlfName, topicName, topicType, membersType, vis, ri)
	return helper.create(ctx)
}

type newConversationHelper struct {
	globals.Contextified
	utils.DebugLabeler

	uid         gregor1.UID
	tlfName     string
	topicName   *string
	topicType   chat1.TopicType
	membersType chat1.ConversationMembersType
	vis         keybase1.TLFVisibility
	ri          func() chat1.RemoteInterface
}

func newNewConversationHelper(g *globals.Context, uid gregor1.UID, tlfName string, topicName *string,
	topicType chat1.TopicType, membersType chat1.ConversationMembersType, vis keybase1.TLFVisibility,
	ri func() chat1.RemoteInterface) *newConversationHelper {

	if membersType == chat1.ConversationMembersType_IMPTEAM && g.ExternalG().Env.GetChatMemberType() != "impteam" {
		g.Log.Debug("### note: impteam mt requested, but feature flagged off, using kbfs")
		membersType = chat1.ConversationMembersType_KBFS
	}

	return &newConversationHelper{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "newConversationHelper", false),
		uid:          uid,
		tlfName:      tlfName,
		topicName:    topicName,
		topicType:    topicType,
		membersType:  membersType,
		vis:          vis,
		ri:           ri,
	}
}

func (n *newConversationHelper) findConversations(ctx context.Context, membersType chat1.ConversationMembersType, topicName string) ([]chat1.ConversationLocal, []chat1.RateLimit, error) {
	onechatpertlf := true
	return FindConversations(ctx, n.G(), n.DebugLabeler, n.ri, n.uid, n.tlfName, n.topicType, membersType, n.vis, topicName, &onechatpertlf)
}

func (n *newConversationHelper) findExisting(ctx context.Context, topicName string) (res []chat1.ConversationLocal, rl []chat1.RateLimit, err error) {
	// proceed to findConversations for requested member type
	return n.findConversations(ctx, n.membersType, topicName)
}

func (n *newConversationHelper) create(ctx context.Context) (res chat1.ConversationLocal, rl []chat1.RateLimit, reserr error) {
	defer n.Trace(ctx, func() error { return reserr }, "newConversationHelper")()
	// Handle a nil topic name with default values for the members type specified
	if n.topicName == nil {
		// We never want a blank topic name in team chats, always default to the default team name
		switch n.membersType {
		case chat1.ConversationMembersType_TEAM:
			n.topicName = &globals.DefaultTeamTopic
		}
	}

	var findConvsTopicName string
	if n.topicName != nil {
		findConvsTopicName = *n.topicName
	}

	// Find any existing conversations that match this argument specifically. We need to do this check
	// here in the client since we can't see the topic name on the server.

	// NOTE: The CLI already does this. It is hard to move that code completely into the service, since
	// there is a ton of logic in there to try and present a nice looking menu to help out the
	// user and such. For the most part, the CLI just uses FindConversationsLocal though, so it
	// should hopefully just result in a bunch of cache hits on the second invocation.

	convs, irl, err := n.findExisting(ctx, findConvsTopicName)

	// If we find one conversation, then just return it as if we created it.
	rl = append(rl, irl...)
	if len(convs) == 1 {
		n.Debug(ctx, "found previous conversation that matches, returning")
		return convs[0], rl, err
	}

	if n.G().ExternalG().Env.GetChatMemberType() == "impteam" {
		// if KBFS, return an error. Need to use IMPTEAM now.
		if n.membersType == chat1.ConversationMembersType_KBFS {
			// let it slide in devel for tests
			if n.G().ExternalG().Env.GetRunMode() != libkb.DevelRunMode {
				n.Debug(ctx, "KBFS conversations deprecated; switching membersType from KBFS to IMPTEAM")
				n.membersType = chat1.ConversationMembersType_IMPTEAM
			}
		}
	}

	n.Debug(ctx, "no matching previous conversation, proceeding to create new conv")

	isPublic := n.vis == keybase1.TLFVisibility_PUBLIC
	info, err := CtxKeyFinder(ctx, n.G()).Find(ctx, n.tlfName, n.membersType, isPublic)
	if err != nil {
		if n.membersType != chat1.ConversationMembersType_IMPTEAM {
			return res, rl, err
		}
		if _, ok := err.(teams.TeamDoesNotExistError); !ok {
			return res, rl, err
		}

		// couldn't find implicit team, so make one
		n.Debug(ctx, "making new implicit team %q", n.tlfName)
		_, _, _, err = teams.LookupOrCreateImplicitTeam(ctx, n.G().ExternalG(), n.tlfName, isPublic)
		if err != nil {
			return res, rl, err
		}
		info, err = CtxKeyFinder(ctx, n.G()).Find(ctx, n.tlfName, n.membersType, isPublic)
		if err != nil {
			return res, rl, err
		}
	}

	triple := chat1.ConversationIDTriple{
		Tlfid:     info.ID,
		TopicType: n.topicType,
		TopicID:   make(chat1.TopicID, 16),
	}

	for i := 0; i < 5; i++ {
		triple.TopicID, err = utils.NewChatTopicID()
		if err != nil {
			return res, rl, fmt.Errorf("error creating topic ID: %s", err)
		}
		n.Debug(ctx, "attempt: %v [tlfID: %s topicType: %d topicID: %s name: %s]", i, triple.Tlfid,
			triple.TopicType, triple.TopicID, info.CanonicalName)
		firstMessageBoxed, topicNameState, err := n.makeFirstMessage(ctx, triple, info.CanonicalName,
			n.membersType, n.vis, n.topicName)
		if err != nil {
			return res, rl, fmt.Errorf("error preparing message: %s", err)
		}

		var ncrres chat1.NewConversationRemoteRes
		ncrres, reserr = n.ri().NewConversationRemote2(ctx, chat1.NewConversationRemote2Arg{
			IdTriple:       triple,
			TLFMessage:     *firstMessageBoxed,
			MembersType:    n.membersType,
			TopicNameState: topicNameState,
		})
		if ncrres.RateLimit != nil {
			rl = append(rl, *ncrres.RateLimit)
		}
		convID := ncrres.ConvID
		if reserr != nil {
			switch cerr := reserr.(type) {
			case libkb.ChatStalePreviousStateError:
				n.Debug(ctx, "stale topic name state, trying again")
				continue
			case libkb.ChatConvExistsError:
				// This triple already exists.
				n.Debug(ctx, "conv exists: %v", cerr.ConvID)

				if triple.TopicType != chat1.TopicType_CHAT ||
					n.membersType == chat1.ConversationMembersType_TEAM {
					// Not a chat (or is a team) conversation. Multiples are fine. Just retry with a
					// different topic ID.
					continue
				}
				// A chat conversation already exists; just reuse it.
				// Note that from this point on, TopicID is entirely the wrong value.
				convID = cerr.ConvID
			case libkb.ChatCollisionError:
				// The triple did not exist, but a collision occurred on convID. Retry with a different topic ID.
				n.Debug(ctx, "collision: %v", reserr)
				continue
			default:
				return res, rl, fmt.Errorf("error creating conversation: %s", reserr)
			}
		}

		n.Debug(ctx, "established conv: %v", convID)

		// create succeeded; grabbing the conversation and returning
		ib, irl, err := n.G().InboxSource.Read(ctx, n.uid, nil, false,
			&chat1.GetInboxLocalQuery{
				ConvIDs: []chat1.ConversationID{convID},
			}, nil)
		if err != nil {
			return res, rl, err
		}
		if rl != nil {
			rl = append(rl, *irl)
		}

		if len(ib.Convs) != 1 {
			return res, rl,
				fmt.Errorf("newly created conversation fetch error: found %d conversations", len(ib.Convs))
		}
		res = ib.Convs[0]
		n.Debug(ctx, "fetched conv: %v", res.GetConvID())

		// Update inbox cache
		updateConv := ib.ConvsUnverified[0]
		if err = n.G().InboxSource.NewConversation(ctx, n.uid, 0, updateConv.Conv); err != nil {
			return res, rl, err
		}

		// Clear team channel source
		n.G().TeamChannelSource.ChannelsChanged(ctx, updateConv.Conv.Metadata.IdTriple.Tlfid)

		if res.Error != nil {
			return res, rl, errors.New(res.Error.Message)
		}

		// Send a message to the channel after joining.
		switch n.membersType {
		case chat1.ConversationMembersType_TEAM:
			joinMessageBody := chat1.NewMessageBodyWithJoin(chat1.MessageJoin{})
			irl, err := postJoinLeave(ctx, n.G(), n.ri, n.uid, convID, joinMessageBody)
			if err != nil {
				n.Debug(ctx, "posting join-conv message failed: %v", err)
				// ignore the error
			}
			rl = append(rl, irl...)
		default:
			// pass
		}

		// If we created a complex team in the process of creating this conversation, send a special
		// message into the general channel letting everyone know about the change.
		if ncrres.CreatedComplexTeam {
			subBody := chat1.NewMessageSystemWithComplexteam(chat1.MessageSystemComplexTeam{
				Team: n.tlfName,
			})
			body := chat1.NewMessageBodyWithSystem(subBody)
			if err := n.G().ChatHelper.SendMsgByNameNonblock(ctx, n.tlfName, &globals.DefaultTeamTopic,
				chat1.ConversationMembersType_TEAM, keybase1.TLFIdentifyBehavior_CHAT_GUI,
				body, chat1.MessageType_SYSTEM); err != nil {
				n.Debug(ctx, "failed to send complex team intro message: %s", err)
			}
		}

		return res, rl, nil
	}

	return res, rl, reserr
}

func (n *newConversationHelper) makeFirstMessage(ctx context.Context, triple chat1.ConversationIDTriple,
	tlfName string, membersType chat1.ConversationMembersType, tlfVisibility keybase1.TLFVisibility,
	topicName *string) (*chat1.MessageBoxed, *chat1.TopicNameState, error) {
	var msg chat1.MessagePlaintext
	if topicName != nil {
		msg = chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        triple,
				TlfName:     tlfName,
				TlfPublic:   tlfVisibility == keybase1.TLFVisibility_PUBLIC,
				MessageType: chat1.MessageType_METADATA,
				Prev:        nil, // TODO
				// Sender and SenderDevice filled by prepareMessageForRemote
			},
			MessageBody: chat1.NewMessageBodyWithMetadata(
				chat1.MessageConversationMetadata{
					ConversationTitle: *topicName,
				}),
		}
	} else {
		msg = chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        triple,
				TlfName:     tlfName,
				TlfPublic:   tlfVisibility == keybase1.TLFVisibility_PUBLIC,
				MessageType: chat1.MessageType_TLFNAME,
				Prev:        nil, // TODO
				// Sender and SenderDevice filled by prepareMessageForRemote
			},
		}
	}

	sender := NewBlockingSender(n.G(), NewBoxer(n.G()), nil, n.ri)
	mbox, _, _, _, topicNameState, err := sender.Prepare(ctx, msg, membersType, nil)
	return mbox, topicNameState, err
}
