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

func SendTextByName(ctx context.Context, g *globals.Context, serverConnection ServerConnection,
	uiSource UISource, nclArg chat1.NewConversationLocalArg, body string) error {

	chatServer := NewServer(g, nil, serverConnection, uiSource)
	sendHelper, err := NewSendHelper(ctx, chatServer, nclArg)
	if err != nil {
		return err
	}
	_, err = sendHelper.Send(ctx, sendHelper.NewPlaintextMessage(body))
	return err
}

func SendMessageByName(ctx context.Context, g *globals.Context, serverConnection ServerConnection,
	uiSource UISource, nclArg chat1.NewConversationLocalArg, msg chat1.MessagePlaintext) error {

	chatServer := NewServer(g, nil, serverConnection, uiSource)
	sendHelper, err := NewSendHelper(ctx, chatServer, nclArg)
	if err != nil {
		return err
	}
	_, err = sendHelper.Send(ctx, msg)
	return err
}

func NewTeamNewConversationLocalArg(tlfName string, topicName *string, identifyBehavior keybase1.TLFIdentifyBehavior) chat1.NewConversationLocalArg {
	return chat1.NewConversationLocalArg{
		TlfName:          tlfName,
		TopicName:        topicName,
		IdentifyBehavior: identifyBehavior,
		TopicType:        chat1.TopicType_CHAT,
		TlfVisibility:    chat1.TLFVisibility_PRIVATE,
		MembersType:      chat1.ConversationMembersType_TEAM,
	}
}

type SendHelper struct {
	utils.DebugLabeler
	globals.Contextified

	ChatServer       *Server
	ConversationID   chat1.ConversationID
	TlfName          string
	Triple           chat1.ConversationIDTriple
	IdentifyBehavior keybase1.TLFIdentifyBehavior
}

func NewSendHelperFromInfo(server *Server, tlfName string, conversationID chat1.ConversationID, triple chat1.ConversationIDTriple, identifyBehavior keybase1.TLFIdentifyBehavior) (*SendHelper, error) {
	return &SendHelper{
		Contextified:     globals.NewContextified(server.G()),
		DebugLabeler:     utils.NewDebugLabeler(server.G().GetLog(), "sendHelper", false),
		ChatServer:       server,
		ConversationID:   conversationID,
		TlfName:          tlfName,
		Triple:           triple,
		IdentifyBehavior: identifyBehavior,
	}, nil
}

func NewSendHelper(ctx context.Context, server *Server, nclArg chat1.NewConversationLocalArg) (*SendHelper, error) {
	nclRes, err := server.NewConversationLocal(ctx, nclArg)
	if err != nil {
		return nil, err
	}
	return NewSendHelperFromInfo(server, nclRes.Conv.Info.TlfName, nclRes.Conv.Info.Id, nclRes.Conv.Info.Triple, nclArg.IdentifyBehavior)
}

func (s *SendHelper) NewPlaintextMessage(body string) chat1.MessagePlaintext {
	return chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        s.Triple,
			TlfName:     s.TlfName,
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{Body: body}),
	}
}

func (s *SendHelper) Send(ctx context.Context, msg chat1.MessagePlaintext) (res chat1.PostLocalRes, err error) {
	return s.ChatServer.PostLocal(ctx,
		chat1.PostLocalArg{
			ConversationID:   s.ConversationID,
			Msg:              msg,
			IdentifyBehavior: s.IdentifyBehavior,
		})
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
	if _, err = g.InboxSource.MembershipUpdate(ctx, uid, 0, []chat1.ConversationMember{
		chat1.ConversationMember{
			Uid:    uid,
			ConvID: convID,
		},
	}, nil); err != nil {
		debugger.Debug(ctx, "JoinConversation: failed to apply membership update: %s", err.Error())
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
