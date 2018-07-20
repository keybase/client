package chat

import (
	"encoding/base64"
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
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
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
	sender := NewBlockingSender(h.G(), boxer, h.ri)
	msg := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			TlfName:     tlfName,
			MessageType: msgType,
		},
		MessageBody: body,
	}
	_, _, err := sender.Send(ctx, convID, msg, 0, nil)
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
	baseSender := NewBlockingSender(h.G(), boxer, h.ri)
	sender := NewNonblockingSender(h.G(), baseSender)
	msg := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			TlfName:     tlfName,
			MessageType: msgType,
		},
		MessageBody: body,
	}
	_, _, err := sender.Send(ctx, convID, msg, 0, nil)
	return err
}

func (h *Helper) SendTextByName(ctx context.Context, name string, topicName *string,
	membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, text string) error {
	boxer := NewBoxer(h.G())
	sender := NewBlockingSender(h.G(), boxer, h.ri)
	helper := newSendHelper(h.G(), name, topicName, membersType, ident, sender, h.ri)
	return helper.SendText(ctx, text)
}

func (h *Helper) SendMsgByName(ctx context.Context, name string, topicName *string,
	membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, body chat1.MessageBody,
	msgType chat1.MessageType) error {
	boxer := NewBoxer(h.G())
	sender := NewBlockingSender(h.G(), boxer, h.ri)
	helper := newSendHelper(h.G(), name, topicName, membersType, ident, sender, h.ri)
	return helper.SendBody(ctx, body, msgType)
}

func (h *Helper) SendTextByNameNonblock(ctx context.Context, name string, topicName *string,
	membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, text string) error {
	boxer := NewBoxer(h.G())
	baseSender := NewBlockingSender(h.G(), boxer, h.ri)
	sender := NewNonblockingSender(h.G(), baseSender)
	helper := newSendHelper(h.G(), name, topicName, membersType, ident, sender, h.ri)
	return helper.SendText(ctx, text)
}

func (h *Helper) SendMsgByNameNonblock(ctx context.Context, name string, topicName *string,
	membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, body chat1.MessageBody,
	msgType chat1.MessageType) error {
	boxer := NewBoxer(h.G())
	baseSender := NewBlockingSender(h.G(), boxer, h.ri)
	sender := NewNonblockingSender(h.G(), baseSender)
	helper := newSendHelper(h.G(), name, topicName, membersType, ident, sender, h.ri)
	return helper.SendBody(ctx, body, msgType)
}

func (h *Helper) FindConversations(ctx context.Context, useLocalData bool, name string, topicName *string,
	topicType chat1.TopicType, membersType chat1.ConversationMembersType, vis keybase1.TLFVisibility) ([]chat1.ConversationLocal, error) {
	kuid, err := CurrentUID(h.G())
	if err != nil {
		return nil, err
	}
	uid := gregor1.UID(kuid.ToBytes())

	oneChat := true
	var tname string
	if topicName != nil {
		tname = *topicName
	}
	convs, err := FindConversations(ctx, h.G(), h.DebugLabeler, useLocalData, h.ri, uid, name, topicType,
		membersType, vis, tname, &oneChat)
	return convs, err
}

func (h *Helper) FindConversationsByID(ctx context.Context, convIDs []chat1.ConversationID) ([]chat1.ConversationLocal, error) {
	kuid, err := CurrentUID(h.G())
	if err != nil {
		return nil, err
	}
	uid := gregor1.UID(kuid.ToBytes())
	query := &chat1.GetInboxLocalQuery{
		ConvIDs: convIDs,
	}
	inbox, err := h.G().InboxSource.Read(ctx, uid, nil, true, query, nil)
	if err != nil {
		return nil, err
	}
	return inbox.Convs, nil
}

// GetChannelTopicName gets the name of a team channel even if it's not in the inbox.
func (h *Helper) GetChannelTopicName(ctx context.Context, teamID keybase1.TeamID,
	topicType chat1.TopicType, convID chat1.ConversationID) (topicName string, err error) {
	defer h.Trace(ctx, func() error { return err }, "ChatHelper.GetChannelTopicName")()
	h.Debug(ctx, "for teamID:%v convID:%v", teamID.String(), convID.String())
	kuid, err := CurrentUID(h.G())
	if err != nil {
		return topicName, err
	}
	uid := gregor1.UID(kuid.ToBytes())
	tlfID, err := chat1.TeamIDToTLFID(teamID)
	if err != nil {
		return topicName, err
	}

	// First try the inbox
	query := &chat1.GetInboxLocalQuery{
		ConvIDs:   []chat1.ConversationID{convID},
		TopicType: &topicType,
	}
	inbox, err := h.G().InboxSource.Read(ctx, uid, nil, true, query, nil)
	if err != nil {
		return topicName, err
	}
	h.Debug(ctx, "found inbox convs: %v", len(inbox.Convs))
	for _, conv := range inbox.Convs {
		if conv.GetConvID().Eq(convID) && conv.GetMembersType() == chat1.ConversationMembersType_TEAM {
			return utils.GetTopicName(conv), nil
		}
	}

	// Fallback to TeamChannelSource
	h.Debug(ctx, "using TeamChannelSource")
	topicName, err = h.G().TeamChannelSource.GetChannelTopicName(ctx, uid, tlfID, topicType, convID)
	return topicName, err
}

func (h *Helper) UpgradeKBFSToImpteam(ctx context.Context, tlfName string, tlfID chat1.TLFID, public bool) (err error) {
	ctx = Context(ctx, h.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, NewCachingIdentifyNotifier(h.G()))
	defer h.Trace(ctx, func() error { return err }, "ChatHelper.UpgradeKBFSToImpteam(%s,%s,%v)",
		tlfID, tlfName, public)()
	var cryptKeys []keybase1.CryptKey
	ni, err := CtxKeyFinder(ctx, h.G()).FindForEncryption(ctx, tlfName, tlfID,
		chat1.ConversationMembersType_KBFS, public)
	if err != nil {
		return err
	}
	for _, key := range ni.CryptKeys[chat1.ConversationMembersType_KBFS] {
		cryptKeys = append(cryptKeys, keybase1.CryptKey{
			KeyGeneration: key.Generation(),
			Key:           key.Material(),
		})
	}
	tlfName = ni.CanonicalName
	h.Debug(ctx, "UpgradeKBFSToImpteam: upgrading: TlfName: %s TLFID: %s public: %v keys: %d",
		tlfName, tlfID, public, len(cryptKeys))
	return teams.UpgradeTLFIDToImpteam(ctx, h.G().ExternalG(), tlfName, keybase1.TLFID(tlfID.String()),
		public, keybase1.TeamApplication_CHAT, cryptKeys)
}

func (h *Helper) GetMessages(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgIDs []chat1.MessageID, resolveSupersedes bool) ([]chat1.MessageUnboxed, error) {
	return GetMessages(ctx, h.G(), uid, convID, msgIDs, resolveSupersedes)
}

func GetMessages(ctx context.Context, g *globals.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgIDs []chat1.MessageID, resolveSupersedes bool) ([]chat1.MessageUnboxed, error) {
	conv, err := GetUnverifiedConv(ctx, g, uid, convID, true /* useLocalData */)
	if err != nil {
		return nil, err
	}

	// use ConvSource to get the messages, to try the cache first
	messages, err := g.ConvSource.GetMessages(ctx, conv, uid, msgIDs, nil)
	if err != nil {
		return nil, err
	}

	// unless arg says not to, transform the superseded messages
	if resolveSupersedes {
		messages, err = g.ConvSource.TransformSupersedes(ctx, conv, uid, messages)
		if err != nil {
			return nil, err
		}
	}
	return messages, nil
}

func (h *Helper) AckMobileNotificationSuccess(ctx context.Context, pushIDs []string) {
	defer h.Trace(ctx, func() error { return nil }, "AckMobileNotificationSuccess")()
	// Get session token
	nist, _, err := h.G().ActiveDevice.NISTAndUID(ctx)
	if nist == nil {
		h.Debug(ctx, "AckMobileNotificationSuccess: got a nil NIST, is the user logged out?")
		return
	}
	if err != nil {
		h.Debug(ctx, "AckMobileNotificationSuccess: failed to get logged in session: %s", err.Error())
		return
	}

	// Make an ad hoc connection to gregor
	uri, err := rpc.ParseFMPURI(h.G().Env.GetGregorURI())
	if err != nil {
		h.Debug(ctx, "AckMobileNotificationSuccess: failed to parse chat server UR: %s", err.Error())
		return
	}

	var conn *rpc.Connection
	if uri.UseTLS() {
		rawCA := h.G().Env.GetBundledCA(uri.Host)
		if len(rawCA) == 0 {
			h.Debug(ctx, "AckMobileNotificationSuccess: failed to parse CAs: %s", err.Error())
			return
		}
		conn = rpc.NewTLSConnection(rpc.NewFixedRemote(uri.HostPort),
			[]byte(rawCA), libkb.NewContextifiedErrorUnwrapper(h.G().ExternalG()),
			&remoteNotificationSuccessHandler{}, libkb.NewRPCLogFactory(h.G().ExternalG()),
			logger.LogOutputWithDepthAdder{Logger: h.G().Log}, rpc.ConnectionOpts{})
	} else {
		t := rpc.NewConnectionTransport(uri, nil, libkb.MakeWrapError(h.G().ExternalG()))
		conn = rpc.NewConnectionWithTransport(&remoteNotificationSuccessHandler{}, t,
			libkb.NewContextifiedErrorUnwrapper(h.G().ExternalG()),
			logger.LogOutputWithDepthAdder{Logger: h.G().Log}, rpc.ConnectionOpts{})
	}
	defer conn.Shutdown()

	// Make remote successful call on our ad hoc conn
	cli := chat1.RemoteClient{Cli: NewRemoteClient(h.G(), conn.GetClient())}
	if err = cli.RemoteNotificationSuccessful(ctx,
		chat1.RemoteNotificationSuccessfulArg{
			AuthToken:        gregor1.SessionToken(nist.Token().String()),
			CompanionPushIDs: pushIDs,
		}); err != nil {
		h.Debug(ctx, "AckMobileNotificationSuccess: failed to invoke remote notification success: %",
			err.Error())
	}
}

func (h *Helper) formatPushText(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	membersType chat1.ConversationMembersType, msg chat1.MessageUnboxed) string {
	switch membersType {
	case chat1.ConversationMembersType_TEAM:
		// Try to get the channel name
		ib, err := h.G().InboxSource.Read(ctx, uid, nil, true, &chat1.GetInboxLocalQuery{
			ConvIDs: []chat1.ConversationID{convID},
		}, nil)
		if err != nil || len(ib.Convs) == 0 {
			// Don't give up here, just display the team name only
			h.Debug(ctx, "formatPushText: failed to unbox convo, using team only")
			return fmt.Sprintf("%s (%s): %s", msg.Valid().SenderUsername, msg.Valid().ClientHeader.TlfName,
				msg.Valid().MessageBody.Text().Body)
		}
		return fmt.Sprintf("%s (%s#%s): %s", msg.Valid().SenderUsername, msg.Valid().ClientHeader.TlfName,
			utils.GetTopicName(ib.Convs[0]), msg.Valid().MessageBody.Text().Body)
	default:
		return fmt.Sprintf("%s: %s", msg.Valid().SenderUsername, msg.Valid().MessageBody.Text().Body)
	}
}

func (h *Helper) UnboxMobilePushNotification(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, membersType chat1.ConversationMembersType, payload string) (res string, err error) {
	defer h.Trace(ctx, func() error { return err }, "UnboxMobilePushNotification")()
	// Parse the message payload
	bMsg, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		h.Debug(ctx, "UnboxMobilePushNotification: invalid message payload: %s", err.Error())
		return res, err
	}
	var msgBoxed chat1.MessageBoxed
	mh := codec.MsgpackHandle{WriteExt: true}
	if err = codec.NewDecoderBytes(bMsg, &mh).Decode(&msgBoxed); err != nil {
		h.Debug(ctx, "UnboxMobilePushNotification: failed to msgpack decode payload: %s", err.Error())
		return res, err
	}

	// Unbox first
	vis := keybase1.TLFVisibility_PRIVATE
	if msgBoxed.ClientHeader.TlfPublic {
		vis = keybase1.TLFVisibility_PUBLIC
	}
	unboxInfo := newBasicUnboxConversationInfo(convID, membersType, nil, vis)
	msgUnboxed, err := NewBoxer(h.G()).UnboxMessage(ctx, msgBoxed, unboxInfo)
	if err != nil {
		h.Debug(ctx, "UnboxMobilePushNotification: unbox failed, bailing: %s", err.Error())
		return res, err
	}

	// Check to see if this will be a strict append before adding to the body cache
	if err := h.G().ConvSource.AcquireConversationLock(ctx, uid, convID); err != nil {
		return res, err
	}
	maxMsgID, err := storage.New(h.G(), h.G().ConvSource).GetMaxMsgID(ctx, convID, uid)
	if err == nil {
		if msgUnboxed.GetMessageID() > maxMsgID {
			if _, err = h.G().ConvSource.PushUnboxed(ctx, convID, uid, msgUnboxed); err != nil {
				h.Debug(ctx, "UnboxMobilePushNotification: failed to push message to conv source: %s",
					err.Error())
			}
		} else {
			h.Debug(ctx, "UnboxMobilePushNotification: message from the past, skipping insert: msgID: %d maxMsgID: %d", msgUnboxed.GetMessageID(), maxMsgID)

		}
	} else {
		h.Debug(ctx, "UnboxMobilePushNotification: failed to fetch max msg ID: %s", err)
	}
	h.G().ConvSource.ReleaseConversationLock(ctx, uid, convID)

	// Form the push notification message
	if msgUnboxed.IsValid() && msgUnboxed.GetMessageType() == chat1.MessageType_TEXT {
		res = h.formatPushText(ctx, uid, convID, membersType, msgUnboxed)
		h.Debug(ctx, "UnboxMobilePushNotification: successful unbox")
		return res, nil
	}

	h.Debug(ctx, "UnboxMobilePushNotification: invalid message received: typ: %v",
		msgUnboxed.GetMessageType())
	return "", errors.New("invalid message")
}

type sendHelper struct {
	utils.DebugLabeler

	name        string
	membersType chat1.ConversationMembersType
	ident       keybase1.TLFIdentifyBehavior
	sender      types.Sender
	ri          func() chat1.RemoteInterface

	topicName *string
	convID    chat1.ConversationID
	triple    chat1.ConversationIDTriple

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
	ctx = Context(ctx, s.G(), s.ident, nil, NewCachingIdentifyNotifier(s.G()))
	if err := s.conversation(ctx); err != nil {
		return err
	}
	return s.deliver(ctx, body, mtype)
}

func (s *sendHelper) conversation(ctx context.Context) error {
	kuid, err := CurrentUID(s.G())
	if err != nil {
		return err
	}
	uid := gregor1.UID(kuid.ToBytes())
	conv, err := NewConversation(ctx, s.G(), uid, s.name, s.topicName,
		chat1.TopicType_CHAT, s.membersType, keybase1.TLFVisibility_PRIVATE, s.remoteInterface)
	if err != nil {
		return err
	}
	s.convID = conv.GetConvID()
	s.triple = conv.Info.Triple
	s.name = conv.Info.TlfName
	return nil
}

func (s *sendHelper) deliver(ctx context.Context, body chat1.MessageBody, mtype chat1.MessageType) error {
	msg := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        s.triple,
			TlfName:     s.name,
			MessageType: mtype,
		},
		MessageBody: body,
	}
	_, _, err := s.sender.Send(ctx, s.convID, msg, 0, nil)
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
	ctx = Context(ctx, g, keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, NewCachingIdentifyNotifier(g))
	return newRecentConversationParticipants(g).get(ctx, myUID)
}

var errGetUnverifiedConvNotFound = errors.New("GetUnverifiedConv: conversation not found")
var errGetVerifiedConvNotFound = errors.New("GetVerifiedConv: conversation not found")

func GetUnverifiedConv(ctx context.Context, g *globals.Context, uid gregor1.UID,
	convID chat1.ConversationID, useLocalData bool) (chat1.Conversation, error) {

	inbox, err := g.InboxSource.ReadUnverified(ctx, uid, useLocalData, &chat1.GetInboxQuery{
		ConvIDs: []chat1.ConversationID{convID},
	}, nil)
	if err != nil {
		return chat1.Conversation{}, fmt.Errorf("GetUnverifiedConv: %s", err.Error())
	}
	if len(inbox.ConvsUnverified) == 0 {
		return chat1.Conversation{}, errGetUnverifiedConvNotFound
	}
	if !inbox.ConvsUnverified[0].GetConvID().Eq(convID) {
		return chat1.Conversation{}, fmt.Errorf("GetUnverifiedConv: convID mismatch: %s != %s",
			inbox.ConvsUnverified[0].GetConvID(), convID)
	}
	return inbox.ConvsUnverified[0].Conv, nil
}

func GetVerifiedConv(ctx context.Context, g *globals.Context, uid gregor1.UID,
	convID chat1.ConversationID, useLocalData bool) (res chat1.ConversationLocal, err error) {

	inbox, err := g.InboxSource.Read(ctx, uid, nil, useLocalData, &chat1.GetInboxLocalQuery{
		ConvIDs: []chat1.ConversationID{convID},
	}, nil)
	if err != nil {
		return res, fmt.Errorf("GetVerifiedConv: %s", err.Error())
	}
	if len(inbox.Convs) == 0 {
		return res, errGetVerifiedConvNotFound
	}
	if !inbox.Convs[0].GetConvID().Eq(convID) {
		return res, fmt.Errorf("GetVerifiedConv: convID mismatch: %s != %s",
			inbox.Convs[0].GetConvID(), convID)
	}
	return inbox.Convs[0], nil
}

func PresentConversationLocalWithFetchRetry(ctx context.Context, g *globals.Context,
	uid gregor1.UID, conv chat1.ConversationLocal) (res *chat1.InboxUIItem) {
	if conv.Error != nil {
		// If we get a transient failure, add this to the retrier queue
		if conv.Error.Typ == chat1.ConversationErrorType_TRANSIENT {
			g.FetchRetrier.Failure(ctx, uid,
				NewConversationRetry(g, conv.GetConvID(), &conv.Info.Triple.Tlfid, InboxLoad))
		}
	} else {
		pc := utils.PresentConversationLocal(conv, g.Env.GetUsername().String())
		res = &pc
	}
	return res
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
	useLocalData bool, ri func() chat1.RemoteInterface, uid gregor1.UID, tlfName string,
	topicType chat1.TopicType,
	membersTypeIn chat1.ConversationMembersType, vis keybase1.TLFVisibility, topicName string,
	oneChatPerTLF *bool) (res []chat1.ConversationLocal, err error) {

	findConvosWithMembersType := func(membersType chat1.ConversationMembersType) (res []chat1.ConversationLocal, err error) {
		// Don't look for KBFS conversations anymore, they have mostly been converted, and it is better
		// to just not search for them than to create a double conversation. Make an exception for
		// public conversations.
		if g.GetEnv().GetChatMemberType() != "kbfs" && membersType == chat1.ConversationMembersType_KBFS &&
			vis == keybase1.TLFVisibility_PRIVATE {
			return nil, nil
		}
		// Make sure team topic name makes sense
		if topicName == "" && membersType == chat1.ConversationMembersType_TEAM {
			topicName = globals.DefaultTeamTopic
		}

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

		inbox, err := g.InboxSource.Read(ctx, uid, nil, useLocalData, query, nil)
		if err != nil {
			// don't error out if the TLF name is just unknown, treat it as a complete miss
			if _, ok := err.(UnknownTLFNameError); !ok {
				return res, err
			}
			inbox.Convs = nil
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
				return res, err
			}
			tlfConvs, err := g.TeamChannelSource.GetChannelsFull(ctx, uid, nameInfo.ID, topicType)
			if err != nil {
				debugger.Debug(ctx, "FindConversations: failed to list TLF conversations: %s", err.Error())
				return res, err
			}

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
				return res, OfflineError{}
			}

			// If we miss the inbox, and we are looking for a public TLF, let's try and find
			// any conversation that matches
			nameInfo, err := GetInboxQueryNameInfo(ctx, g, query)
			if err != nil {
				return res, err
			}

			// Call into gregor to try and find some public convs
			pubConvs, err := ri().GetPublicConversations(ctx, chat1.GetPublicConversationsArg{
				TlfID:            nameInfo.ID,
				TopicType:        topicType,
				SummarizeMaxMsgs: true,
			})
			if err != nil {
				return res, err
			}

			// Localize the convs (if any)
			if len(pubConvs.Conversations) > 0 {
				localizer := NewBlockingLocalizer(g)
				convsLocal, err := localizer.Localize(ctx, uid, types.Inbox{
					ConvsUnverified: utils.RemoteConvs(pubConvs.Conversations),
				})
				if err != nil {
					return res, err
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
		return res, nil
	}

	attempts := make(map[chat1.ConversationMembersType]bool)
	mt := membersTypeIn
L:
	for {
		var ierr error
		attempts[mt] = true
		res, ierr = findConvosWithMembersType(mt)
		if ierr != nil || len(res) == 0 {
			if ierr != nil {
				debugger.Debug(ctx, "FindConversations: fail reason: %s mt: %v", ierr, mt)
			} else {
				debugger.Debug(ctx, "FindConversations: fail reason: no convs mt: %v", mt)
			}
			var newMT chat1.ConversationMembersType
			switch mt {
			case chat1.ConversationMembersType_TEAM:
				err = ierr
				debugger.Debug(ctx, "FindConversations: failed with team, aborting")
				break L
			case chat1.ConversationMembersType_IMPTEAMUPGRADE:
				if !attempts[chat1.ConversationMembersType_IMPTEAMNATIVE] {
					newMT = chat1.ConversationMembersType_IMPTEAMNATIVE
					// Only set the error if the members type is the same as what was passed in
					err = ierr
				} else {
					newMT = chat1.ConversationMembersType_KBFS
				}
			case chat1.ConversationMembersType_IMPTEAMNATIVE:
				if !attempts[chat1.ConversationMembersType_IMPTEAMUPGRADE] {
					newMT = chat1.ConversationMembersType_IMPTEAMUPGRADE
					// Only set the error if the members type is the same as what was passed in
					err = ierr
				} else {
					newMT = chat1.ConversationMembersType_KBFS
				}
			case chat1.ConversationMembersType_KBFS:
				debugger.Debug(ctx, "FindConversations: failed with KBFS, aborting")
				// We don't want to return random errors from KBFS if we are falling back to it,
				// just return no conversations and call it a day
				if membersTypeIn == chat1.ConversationMembersType_KBFS {
					err = ierr
				}
				break L
			}
			debugger.Debug(ctx,
				"FindConversations: failing to find anything for %v, trying again for %v", mt, newMT)
			mt = newMT
		} else {
			debugger.Debug(ctx, "FindConversations: success with mt: %v", mt)
			break L
		}
	}
	return res, err
}

// Post a join or leave message. Must be called when the user is in the conv.
// Uses a blocking sender.
func postJoinLeave(ctx context.Context, g *globals.Context, ri func() chat1.RemoteInterface, uid gregor1.UID,
	convID chat1.ConversationID, body chat1.MessageBody) (err error) {
	typ, err := body.MessageType()
	if err != nil {
		return fmt.Errorf("message type for postJoinLeave: %v", err)
	}
	switch typ {
	case chat1.MessageType_JOIN, chat1.MessageType_LEAVE:
	// good
	default:
		return fmt.Errorf("invalid message type for postJoinLeave: %v", typ)
	}

	// Get the conversation from the inbox.
	query := chat1.GetInboxLocalQuery{
		ConvIDs: []chat1.ConversationID{convID},
	}
	ib, err := g.InboxSource.Read(ctx, uid, nil, true, &query, nil)
	if err != nil {
		return fmt.Errorf("inbox read error: %s", err)
	}
	if len(ib.Convs) != 1 {
		return fmt.Errorf("post join/leave: found %d conversations", len(ib.Convs))
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
	sender := NewBlockingSender(g, NewBoxer(g), ri)
	_, _, err = sender.Send(ctx, convID, plaintext, 0, nil)
	return err
}

func JoinConversation(ctx context.Context, g *globals.Context, debugger utils.DebugLabeler,
	ri func() chat1.RemoteInterface, uid gregor1.UID, convID chat1.ConversationID) (err error) {
	alreadyIn, err := g.InboxSource.IsMember(ctx, uid, convID)
	if err != nil {
		debugger.Debug(ctx, "JoinConversation: IsMember err: %s", err.Error())
		// Assume we're not in.
		alreadyIn = false
	}

	// Send the join command even if we're in.
	_, err = ri().JoinConversation(ctx, convID)
	if err != nil {
		debugger.Debug(ctx, "JoinConversation: failed to join conversation: %s", err.Error())
		return err
	}

	if _, err = g.InboxSource.MembershipUpdate(ctx, uid, 0, []chat1.ConversationMember{
		chat1.ConversationMember{
			Uid:    uid,
			ConvID: convID,
		},
	}, nil, nil, nil); err != nil {
		debugger.Debug(ctx, "JoinConversation: failed to apply membership update: %s", err.Error())
	}

	if !alreadyIn {
		// Send a message to the channel after joining.
		joinMessageBody := chat1.NewMessageBodyWithJoin(chat1.MessageJoin{})
		debugger.Debug(ctx, "JoinConversation: sending join message to: %s", convID)
		err := postJoinLeave(ctx, g, ri, uid, convID, joinMessageBody)
		if err != nil {
			debugger.Debug(ctx, "JoinConversation: posting join-conv message failed: %v", err)
			// ignore the error
		}
	}
	return nil
}

func LeaveConversation(ctx context.Context, g *globals.Context, debugger utils.DebugLabeler,
	ri func() chat1.RemoteInterface, uid gregor1.UID, convID chat1.ConversationID) (err error) {
	alreadyIn, err := g.InboxSource.IsMember(ctx, uid, convID)
	if err != nil {
		debugger.Debug(ctx, "LeaveConversation: IsMember err: %s", err.Error())
		// Pretend we're in.
		alreadyIn = true
	}

	// Send a message to the channel to leave the conversation
	if alreadyIn {
		leaveMessageBody := chat1.NewMessageBodyWithLeave(chat1.MessageLeave{})
		err := postJoinLeave(ctx, g, ri, uid, convID, leaveMessageBody)
		if err != nil {
			debugger.Debug(ctx, "LeaveConversation: posting leave-conv message failed: %v", err)
			return err
		}
	} else {
		_, err = ri().LeaveConversation(ctx, convID)
		if err != nil {
			debugger.Debug(ctx, "LeaveConversation: failed to leave conversation as a non-member: %s", err)
			return err
		}
	}

	return nil
}

func PreviewConversation(ctx context.Context, g *globals.Context, debugger utils.DebugLabeler,
	ri func() chat1.RemoteInterface, uid gregor1.UID, convID chat1.ConversationID) (err error) {
	alreadyIn, err := g.InboxSource.IsMember(ctx, uid, convID)
	if err != nil {
		debugger.Debug(ctx, "PreviewConversation: IsMember err: %s", err.Error())
		// Assume we aren't in, server will reject us otherwise.
		alreadyIn = false
	}
	if alreadyIn {
		debugger.Debug(ctx, "PreviewConversation: already in the conversation, no need to preview")
		return nil
	}

	_, err = ri().PreviewConversation(ctx, convID)
	if err != nil {
		debugger.Debug(ctx, "PreviewConversation: failed to preview conversation: %s", err.Error())
		return err
	}
	return nil
}

func NewConversation(ctx context.Context, g *globals.Context, uid gregor1.UID, tlfName string,
	topicName *string, topicType chat1.TopicType, membersType chat1.ConversationMembersType,
	vis keybase1.TLFVisibility, ri func() chat1.RemoteInterface) (chat1.ConversationLocal, error) {
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
	return &newConversationHelper{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "newConversationHelper", false),
		uid:          uid,
		tlfName:      utils.AddUserToTLFName(g, tlfName, vis, membersType),
		topicName:    topicName,
		topicType:    topicType,
		membersType:  membersType,
		vis:          vis,
		ri:           ri,
	}
}

func (n *newConversationHelper) findConversations(ctx context.Context,
	membersType chat1.ConversationMembersType, topicName string, useLocalData bool) ([]chat1.ConversationLocal, error) {
	onechatpertlf := true
	return FindConversations(ctx, n.G(), n.DebugLabeler, useLocalData, n.ri, n.uid, n.tlfName, n.topicType,
		membersType, n.vis, topicName, &onechatpertlf)
}

func (n *newConversationHelper) findExisting(ctx context.Context, topicName string, useLocalData bool) (res []chat1.ConversationLocal, err error) {
	// proceed to findConversations for requested member type
	return n.findConversations(ctx, n.membersType, topicName, useLocalData)
}

func (n *newConversationHelper) create(ctx context.Context) (res chat1.ConversationLocal, reserr error) {
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

	convs, err := n.findExisting(ctx, findConvsTopicName, true)

	// If we find one conversation, then just return it as if we created it.
	if len(convs) == 1 {
		n.Debug(ctx, "found previous conversation that matches, returning")
		return convs[0], err
	}

	if n.G().ExternalG().Env.GetChatMemberType() == "impteam" {
		// if KBFS, return an error. Need to use IMPTEAM now.
		if n.membersType == chat1.ConversationMembersType_KBFS {
			// let it slide in devel for tests
			if n.G().ExternalG().Env.GetRunMode() != libkb.DevelRunMode {
				n.Debug(ctx, "KBFS conversations deprecated; switching membersType from KBFS to IMPTEAM")
				n.membersType = chat1.ConversationMembersType_IMPTEAMNATIVE
			}
		}
	}

	n.Debug(ctx, "no matching previous conversation, proceeding to create new conv")

	isPublic := n.vis == keybase1.TLFVisibility_PUBLIC
	info, err := CtxKeyFinder(ctx, n.G()).Find(ctx, n.tlfName, n.membersType, isPublic)
	if err != nil {
		if n.membersType != chat1.ConversationMembersType_IMPTEAMNATIVE {
			return res, err
		}
		if _, ok := err.(UnknownTLFNameError); !ok {
			return res, err
		}

		// couldn't find implicit team, so make one
		n.Debug(ctx, "making new implicit team %q", n.tlfName)
		_, _, _, err = teams.LookupOrCreateImplicitTeam(ctx, n.G().ExternalG(), n.tlfName, isPublic)
		if err != nil {
			return res, err
		}
		info, err = CtxKeyFinder(ctx, n.G()).Find(ctx, n.tlfName, n.membersType, isPublic)
		if err != nil {
			return res, err
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
			return res, fmt.Errorf("error creating topic ID: %s", err)
		}
		n.Debug(ctx, "attempt: %v [tlfID: %s topicType: %d topicID: %s name: %s public: %v mt: %v]",
			i, triple.Tlfid, triple.TopicType, triple.TopicID, info.CanonicalName, isPublic,
			n.membersType)
		firstMessageBoxed, topicNameState, err := n.makeFirstMessage(ctx, triple, info.CanonicalName,
			n.membersType, n.vis, n.topicName)
		if err != nil {
			// Check for DuplicateTopicNameError and run findExisting again to try and find it
			switch err.(type) {
			case DuplicateTopicNameError:
				n.Debug(ctx, "duplicate topic name encountered, attempting to findExisting again")
				var findErr error
				convs, findErr = n.findExisting(ctx, findConvsTopicName, false)
				if len(convs) == 1 {
					n.Debug(ctx, "found previous conversation that matches, returning")
					return convs[0], findErr
				}
				n.Debug(ctx, "failed to find previous conversation on second attempt: len(convs): %d err: %s",
					len(convs), findErr)
			}
			return res, err
		}

		var ncrres chat1.NewConversationRemoteRes
		ncrres, reserr = n.ri().NewConversationRemote2(ctx, chat1.NewConversationRemote2Arg{
			IdTriple:       triple,
			TLFMessage:     *firstMessageBoxed,
			MembersType:    n.membersType,
			TopicNameState: topicNameState,
		})
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
				return res, fmt.Errorf("error creating conversation: %s", reserr)
			}
		}

		n.Debug(ctx, "established conv: %v", convID)

		// create succeeded; grabbing the conversation and returning
		ib, err := n.G().InboxSource.Read(ctx, n.uid, nil, false,
			&chat1.GetInboxLocalQuery{
				ConvIDs: []chat1.ConversationID{convID},
			}, nil)
		if err != nil {
			return res, err
		}

		if len(ib.Convs) != 1 {
			return res,
				fmt.Errorf("newly created conversation fetch error: found %d conversations", len(ib.Convs))
		}
		res = ib.Convs[0]
		n.Debug(ctx, "fetched conv: %v mt: %v public: %v", res.GetConvID(), res.GetMembersType(),
			res.IsPublic())

		// Update inbox cache
		updateConv := ib.ConvsUnverified[0]
		if err = n.G().InboxSource.NewConversation(ctx, n.uid, 0, updateConv.Conv); err != nil {
			return res, err
		}

		// Clear team channel source
		n.G().TeamChannelSource.ChannelsChanged(ctx, updateConv.Conv.Metadata.IdTriple.Tlfid)

		if res.Error != nil {
			return res, errors.New(res.Error.Message)
		}

		// Send a message to the channel after joining.
		switch n.membersType {
		case chat1.ConversationMembersType_TEAM:
			// don't send join messages to #general
			if findConvsTopicName != globals.DefaultTeamTopic {
				joinMessageBody := chat1.NewMessageBodyWithJoin(chat1.MessageJoin{})
				err := postJoinLeave(ctx, n.G(), n.ri, n.uid, convID, joinMessageBody)
				if err != nil {
					n.Debug(ctx, "posting join-conv message failed: %v", err)
					// ignore the error
				}
			}
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
		return res, nil
	}
	return res, reserr
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
		if membersType == chat1.ConversationMembersType_TEAM {
			return nil, nil, errors.New("team conversations require a topic name")
		}
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

	sender := NewBlockingSender(n.G(), NewBoxer(n.G()), n.ri)
	mbox, _, _, _, topicNameState, err := sender.Prepare(ctx, msg, membersType, nil)
	return mbox, topicNameState, err
}
