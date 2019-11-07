package chat

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

// JourneyCardManager handles user switching and proxies to the active JourneyCardManagerSingleUser.
type JourneyCardManager struct {
	globals.Contextified
	utils.DebugLabeler
	switchLock sync.Mutex
	m          *JourneyCardManagerSingleUser
}

var _ (types.JourneyCardManager) = (*JourneyCardManager)(nil)

func NewJourneyCardManager(g *globals.Context) *JourneyCardManager {
	return &JourneyCardManager{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "JourneyCardManager", false),
	}
}

func (j *JourneyCardManager) get(ctx context.Context, uid gregor1.UID) (*JourneyCardManagerSingleUser, error) {
	if uid.IsNil() {
		return nil, fmt.Errorf("missing uid")
	}
	err := libkb.AcquireWithContextAndTimeout(ctx, &j.switchLock, 10*time.Second)
	if err != nil {
		return nil, fmt.Errorf("JourneyCardManager switchLock error: %v", err)
	}
	defer j.switchLock.Unlock()
	if j.m != nil && !j.m.uid.Eq(uid) {
		j.m = nil
	}
	if j.m == nil {
		j.m = NewJourneyCardManagerSingleUser(j.G(), uid)
		j.Debug(ctx, "switched to uid:%v", uid)
	}
	return j.m, nil
}

func (j *JourneyCardManager) PickCard(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID,
	convLocalOptional *chat1.ConversationLocal,
	thread *chat1.ThreadView,
) (*chat1.MessageUnboxedJourneycard, error) {
	start := j.G().GetClock().Now()
	defer func() {
		duration := j.G().GetClock().Since(start)
		if duration > time.Millisecond*200 {
			j.Debug(ctx, "PickCard took %s", duration)
		}
	}()
	js, err := j.get(ctx, uid)
	if err != nil {
		return nil, err
	}
	return js.PickCard(ctx, convID, convLocalOptional, thread)
}

func (j *JourneyCardManager) SentMessage(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) {
	js, err := j.get(ctx, uid)
	if err != nil {
		j.Debug(ctx, "SentMessage error: %v", err)
		return
	}
	js.SentMessage(ctx, convID)
}

func (j *JourneyCardManager) OnDbNuke(mctx libkb.MetaContext) error {
	return j.clear(mctx.Ctx())
}

func (j *JourneyCardManager) Start(ctx context.Context, uid gregor1.UID) {
	var err error
	defer j.G().CTrace(ctx, "JourneyCardManager.Start", func() error { return nil })()
	_, err = j.get(ctx, uid)
	_ = err // ignore error
}

func (j *JourneyCardManager) Stop(ctx context.Context) chan struct{} {
	var err error
	defer j.G().CTrace(ctx, "JourneyCardManager.Stop", func() error { return nil })()
	err = j.clear(ctx)
	_ = err // ignore error
	ch := make(chan struct{})
	close(ch)
	return ch
}

func (j *JourneyCardManager) clear(ctx context.Context) error {
	err := libkb.AcquireWithContextAndTimeout(ctx, &j.switchLock, 10*time.Second)
	if err != nil {
		return fmt.Errorf("JourneyCardManager switchLock error: %v", err)
	}
	defer j.switchLock.Unlock()
	j.m = nil
	return nil
}

type JourneyCardManagerSingleUser struct {
	globals.Contextified
	utils.DebugLabeler
	uid         gregor1.UID // Each instance of JourneyCardManagerSingleUser works only for a single fixed uid.
	storageLock sync.Mutex
	lru         *lru.Cache
	encryptedDB *encrypteddb.EncryptedDB
}

type logFn func(ctx context.Context, format string, args ...interface{})

func NewJourneyCardManagerSingleUser(g *globals.Context, uid gregor1.UID) *JourneyCardManagerSingleUser {
	lru, err := lru.New(200)
	if err != nil {
		// lru.New only panics if size <= 0
		log.Panicf("Could not create lru cache: %v", err)
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalChatDb
	}
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return storage.GetSecretBoxKeyWithUID(ctx, g.ExternalG(), uid)
	}
	return &JourneyCardManagerSingleUser{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "JourneyCardManager", false),
		uid:          uid,
		lru:          lru,
		encryptedDB:  encrypteddb.New(g.ExternalG(), dbFn, keyFn),
	}
}

func (cc *JourneyCardManagerSingleUser) checkFeature(ctx context.Context) bool {
	if cc.G().GetEnv().GetDebugJourneycard() {
		return true
	}
	ogCtx := ctx
	// G.FeatureFlags seems like the kind of system that might hang on a bad network.
	// PickCard is supposed to be lightning fast, so impose a timeout on FeatureFlags.
	ctx, cancel := context.WithTimeout(ctx, 100*time.Millisecond)
	defer cancel()
	enabled, err := cc.G().FeatureFlags.EnabledWithError(cc.MetaContext(ctx), libkb.FeatureJourneycardPreview)
	if err != nil {
		// Send one out in a goroutine to get the goods for next time.
		ctx, cancel2 := context.WithTimeout(globals.BackgroundChatCtx(ogCtx, cc.G()), 10*time.Second)
		defer cancel2()
		go cc.G().FeatureFlags.Enabled(cc.MetaContext(ctx), libkb.FeatureJourneycardPreview)
		return false
	}
	return enabled
}

// Choose a journey card to show in the conversation.
// Called by postProcessThread so keep it snappy.
func (cc *JourneyCardManagerSingleUser) PickCard(ctx context.Context,
	convID chat1.ConversationID,
	convLocalOptional *chat1.ConversationLocal,
	thread *chat1.ThreadView,
) (*chat1.MessageUnboxedJourneycard, error) {
	debug := cc.checkFeature(ctx)
	if !debug {
		// Journey cards are gated by either client-side flag KEYBASE_DEBUG_JOURNEYCARD or server-driven flag 'journeycard_preview'.
		return nil, nil
	}
	debugDebug := func(ctx context.Context, format string, args ...interface{}) {
		if debug {
			cc.Debug(ctx, format, args...)
		}
	}

	var convInner convForJourneycardInner
	var untrustedTeamRole keybase1.TeamRole
	var tlfID chat1.TLFID
	if convLocalOptional != nil {
		convInner = convLocalOptional
		tlfID = convLocalOptional.Info.Triple.Tlfid
		untrustedTeamRole = convLocalOptional.ReaderInfo.UntrustedTeamRole
	} else {
		convFromCache, err := utils.GetUnverifiedConv(ctx, cc.G(), cc.uid, convID, types.InboxSourceDataSourceLocalOnly)
		if err != nil {
			return nil, err
		}
		if convFromCache.LocalMetadata == nil {
			// LocalMetadata is needed to get topicName.
			return nil, fmt.Errorf("conv LocalMetadata not found")
		}
		convInner = convFromCache
		tlfID = convFromCache.Conv.Metadata.IdTriple.Tlfid
		if convFromCache.Conv.ReaderInfo != nil {
			untrustedTeamRole = convFromCache.Conv.ReaderInfo.UntrustedTeamRole
		}
	}

	conv := convForJourneycard{
		convForJourneycardInner: convInner,
		ConvID:                  convID,
		IsGeneralChannel:        convInner.GetTopicName() == globals.DefaultTeamTopic,
		UntrustedTeamRole:       untrustedTeamRole,
		TlfID:                   tlfID,
	}

	if !(conv.GetTopicType() == chat1.TopicType_CHAT &&
		conv.GetMembersType() == chat1.ConversationMembersType_TEAM) {
		// Cards only exist in team chats.
		cc.Debug(ctx, "conv not eligible for card: topicType:%v membersType:%v general:%v",
			conv.GetTopicType(), conv.GetMembersType(), conv.GetTopicName() == globals.DefaultTeamTopic)
		return nil, nil
	}

	if len(thread.Messages) == 0 {
		cc.Debug(ctx, "skipping empty page")
		return nil, nil
	}

	jcd, err := cc.getConvData(ctx, convID)
	if err != nil {
		return nil, err
	}

	makeCard := func(cardType chat1.JourneycardType, highlightMsgID chat1.MessageID, preferSavedPosition bool) (*chat1.MessageUnboxedJourneycard, error) {
		// preferSavedPosition : If true, the card stays in the position it was previously seen. If false, the card goes at the bottom.
		var pos *journeyCardPosition
		if preferSavedPosition {
			pos = jcd.Positions[cardType]
		}
		if pos == nil {
			// Pick a message to use as the base for a frontend ordinal.
			prevID := conv.MaxVisibleMsgID()
			if prevID == 0 {
				cc.Debug(ctx, "no message found to use as base for ordinal")
				return nil, nil
			}
			pos = &journeyCardPosition{
				PrevID: prevID,
			}
			go cc.savePosition(globals.BackgroundChatCtx(ctx, cc.G()), convID, cardType, *pos)
		} else {
			var foundPrev bool
			for _, msg := range thread.Messages {
				if msg.GetMessageID() == pos.PrevID {
					foundPrev = true
					break
				}
			}
			// If the message that is being used as a prev is not found, omit the card.
			// So that the card isn't presented at the edge of a far away page.
			if !foundPrev {
				cc.Debug(ctx, "omitting card missing prev: %v %v", pos.PrevID, cardType)
				return nil, nil
			}
		}
		ordinal := 1 // Won't conflict with outbox messages since they are all <= outboxOrdinalStart.
		return &chat1.MessageUnboxedJourneycard{
			PrevID:         pos.PrevID,
			Ordinal:        ordinal,
			CardType:       cardType,
			HighlightMsgID: highlightMsgID,
		}, nil
	}

	if debug {
		// for testing, do special stuff based on channel name:
		switch conv.GetTopicName() {
		case "kb_cards_0_kb":
			return makeCard(chat1.JourneycardType_WELCOME, 0, false)
		case "kb_cards_1_kb":
			return makeCard(chat1.JourneycardType_POPULAR_CHANNELS, 0, false)
		case "kb_cards_2_kb":
			return makeCard(chat1.JourneycardType_ADD_PEOPLE, 0, false)
		case "kb_cards_3_kb":
			return makeCard(chat1.JourneycardType_CREATE_CHANNELS, 0, false)
		case "kb_cards_4_kb":
			return makeCard(chat1.JourneycardType_MSG_ATTENTION, 3, false)
		case "kb_cards_5_kb":
			return makeCard(chat1.JourneycardType_USER_AWAY_FOR_LONG, 0, false)
		case "kb_cards_6_kb":
			return makeCard(chat1.JourneycardType_CHANNEL_INACTIVE, 0, false)
		case "kb_cards_7_kb":
			return makeCard(chat1.JourneycardType_MSG_NO_ANSWER, 0, false)
		}
	}

	linearCardOrder := []chat1.JourneycardType{
		chat1.JourneycardType_WELCOME,          // 1 on design
		chat1.JourneycardType_POPULAR_CHANNELS, // 2 on design
		chat1.JourneycardType_ADD_PEOPLE,       // 3 on design
		chat1.JourneycardType_CREATE_CHANNELS,  // 4 on design
		chat1.JourneycardType_CREATE_CHANNELS,  // 4 on design
		chat1.JourneycardType_MSG_ATTENTION,    // 5 on design
	}

	looseCardOrder := []chat1.JourneycardType{
		chat1.JourneycardType_USER_AWAY_FOR_LONG, // A on design
		chat1.JourneycardType_CHANNEL_INACTIVE,   // B on design
		chat1.JourneycardType_MSG_NO_ANSWER,      // C on design
	}

	type cardCondition func(context.Context) bool
	cardConditionTODO := func(ctx context.Context) bool { return false }
	cardConditions := map[chat1.JourneycardType]cardCondition{
		chat1.JourneycardType_WELCOME:            func(ctx context.Context) bool { return cc.cardWelcome(ctx, convID, conv, jcd) },
		chat1.JourneycardType_POPULAR_CHANNELS:   func(ctx context.Context) bool { return cc.cardPopularChannels(ctx, convID, conv, jcd) },
		chat1.JourneycardType_ADD_PEOPLE:         func(ctx context.Context) bool { return cc.cardAddPeople(ctx, conv, jcd, debugDebug) },
		chat1.JourneycardType_CREATE_CHANNELS:    func(ctx context.Context) bool { return cc.cardCreateChannels(ctx, convID, jcd) },
		chat1.JourneycardType_MSG_ATTENTION:      cardConditionTODO,
		chat1.JourneycardType_USER_AWAY_FOR_LONG: cardConditionTODO,
		chat1.JourneycardType_CHANNEL_INACTIVE:   func(ctx context.Context) bool { return cc.cardChannelInactive(ctx, jcd, thread, debugDebug) },
		chat1.JourneycardType_MSG_NO_ANSWER:      func(ctx context.Context) bool { return cc.cardMsgNoAnswer(ctx, jcd, thread, debugDebug) },
	}

	// Prefer showing cards later in the order.
	checkForNeverBeforeSeenCards := func(ctx context.Context, types []chat1.JourneycardType, breakOnShown bool) *chat1.JourneycardType {
		for i := len(types) - 1; i >= 0; i-- {
			cardType := types[i]
			if jcd.HasShownCard(cardType) {
				if breakOnShown {
					break
				} else {
					continue
				}
			}
			if cond, ok := cardConditions[cardType]; ok && cond(ctx) {
				cc.Debug(ctx, "selected new card: %v", cardType)
				return &cardType
			}
		}
		return nil
	}

	var latestPage bool
	if len(thread.Messages) > 0 && conv.MaxVisibleMsgID() > 0 {
		end1 := thread.Messages[0].GetMessageID()
		end2 := thread.Messages[len(thread.Messages)-1].GetMessageID()
		leeway := chat1.MessageID(4) // Some fudge factor in case latest messages are not visible.
		latestPage = (end1+leeway) >= conv.MaxVisibleMsgID() || (end2+leeway) >= conv.MaxVisibleMsgID()
		if !latestPage {
			cc.Debug(ctx, "non-latest page maxvis:%v end1:%v end2:%v", conv.MaxVisibleMsgID(), end1, end2)
		}
	}
	if latestPage != thread.Pagination.FirstPage() {
		cc.Debug(ctx, "latestPage:%v != FirstPage:%v", latestPage, thread.Pagination.FirstPage())
	}

	if latestPage {
		// Prefer showing new "linear" cards. Do not show cards that are prior to one that has been shown.
		if cardType := checkForNeverBeforeSeenCards(ctx, linearCardOrder, true); cardType != nil {
			return makeCard(*cardType, 0, true)
		}
		// Show any new loose cards. It's fine to show A even in C has already been seen.
		if cardType := checkForNeverBeforeSeenCards(ctx, looseCardOrder, false); cardType != nil {
			return makeCard(*cardType, 0, true)
		}
	}

	// TODO card type: MSG_ATTENTION (5 on design)
	// Gist: "One of your messages is getting a lot of attention! <pointer to message>"
	// Condition: The logged-in user's message gets a lot of reacjis
	// Condition: That message is above the fold.

	// TODO card type: USER_AWAY_FOR_LONG (A on design)
	// Gist: "Long time no see.... Look at all the things you missed."

	// No new cards selected. Pick the already-shown card with the most recent prev message ID.
	debugDebug(ctx, "no new cards selected")
	var mostRecentCardType chat1.JourneycardType
	var mostRecentPrev chat1.MessageID
	for cardType, savedPos := range jcd.Positions {
		if savedPos == nil {
			continue
		}
		// Break ties in PrevID using cardType's arbitrary enum value.
		if savedPos.PrevID >= mostRecentPrev && (savedPos.PrevID != mostRecentPrev || cardType > mostRecentCardType) {
			mostRecentCardType = cardType
			mostRecentPrev = savedPos.PrevID
		}
	}
	if mostRecentPrev != 0 {
		debugDebug(ctx, "selected most recent saved card: %v", mostRecentCardType)
		return makeCard(mostRecentCardType, 0, true)
	}

	debugDebug(ctx, "no card at end of checks")
	return nil, nil
}

// Card type: WELCOME (1 on design)
// Condition: Only in #general channel
func (cc *JourneyCardManagerSingleUser) cardWelcome(ctx context.Context, convID chat1.ConversationID, conv convForJourneycard, jcd journeyCardConvData) bool {
	// TODO PICNIC-593 Welcome's interaction with existing system message
	// TODO PICNIC-593 Welcome cards should not show for all pre-existing teams when a client upgrades. That would be a bad transition. May require server support.
	return conv.IsGeneralChannel && false
}

// Card type: POPULAR_CHANNELS (2 on design)
// Gist: "You are in #general. Other popular channels in this team: diplomacy, sportsball"
// Condition: Only in #general channel
// Condition: The team has channels besides general.
// Condition: User has sent a first message OR a few days have passed since they joined the channel.
func (cc *JourneyCardManagerSingleUser) cardPopularChannels(ctx context.Context, convID chat1.ConversationID, conv convForJourneycard, jcd journeyCardConvData) bool {
	otherChannelsExist := conv.GetTeamType() == chat1.TeamType_COMPLEX
	return conv.IsGeneralChannel && otherChannelsExist && (jcd.SentMessage || cc.timeSinceJoined(ctx, conv.ConvID, jcd, time.Hour*24*2))
}

// Card type: ADD_PEOPLE (3 on design)
// Gist: "Do you know people interested in joining?"
// Condition: User is an admin.
// Condition: User has sent messages OR joined channels.
// Condition: A few days on top of POPULAR_CHANNELS have passed since the user joined the channel. In order to space it out from POPULAR_CHANNELS.
func (cc *JourneyCardManagerSingleUser) cardAddPeople(ctx context.Context, conv convForJourneycard, jcd journeyCardConvData,
	debugDebug logFn) bool {
	if !conv.UntrustedTeamRole.IsAdminOrAbove() {
		return false
	}
	if !cc.timeSinceJoined(ctx, conv.ConvID, jcd, time.Hour*24*4) {
		return false
	}
	if jcd.SentMessage || !conv.IsGeneralChannel {
		return true
	}
	// Figure whether the user is in other channels.
	topicType := chat1.TopicType_CHAT
	inbox, err := cc.G().InboxSource.ReadUnverified(ctx, cc.uid, types.InboxSourceDataSourceLocalOnly, &chat1.GetInboxQuery{
		TlfID:     &conv.TlfID,
		TopicType: &topicType,
		MemberStatus: []chat1.ConversationMemberStatus{
			chat1.ConversationMemberStatus_ACTIVE,
			chat1.ConversationMemberStatus_REMOVED,
			chat1.ConversationMemberStatus_LEFT,
			chat1.ConversationMemberStatus_PREVIEW,
		},
		MembersTypes:     []chat1.ConversationMembersType{chat1.ConversationMembersType_TEAM},
		SummarizeMaxMsgs: true,
		SkipBgLoads:      true,
		AllowUnseenQuery: true, // Make an effort, it's ok if convs are missed.
	}, nil)
	if err != nil {
		debugDebug(ctx, "ReadUnverified error: %v", err)
		return false
	}
	debugDebug(ctx, "ReadUnverified found %v convs", len(inbox.ConvsUnverified))
	for _, convOther := range inbox.ConvsUnverified {
		if !convOther.GetConvID().Eq(conv.ConvID) {
			debugDebug(ctx, "ReadUnverified found alternate conv: %v", convOther.GetConvID())
			return true
		}
	}
	return false
}

// Card type: CREATE_CHANNELS (4 on design)
// Gist: "Go ahead and create #channels around topics you think are missing."
// Condition: A few weeks have passed.
// Condition: User has sent a message.
func (cc *JourneyCardManagerSingleUser) cardCreateChannels(ctx context.Context, convID chat1.ConversationID, jcd journeyCardConvData) bool {
	return jcd.SentMessage && cc.timeSinceJoined(ctx, convID, jcd, time.Hour*24*14)
}

// Card type: MSG_NO_ANSWER (C)
// Gist: "People haven't been talkative in a while. Perhaps post in another channel? <list of channels>"
// Condition: The last visible message is old, was sent by the logged-in user, and was a long text message.
func (cc *JourneyCardManagerSingleUser) cardMsgNoAnswer(ctx context.Context,
	jcd journeyCardConvData, thread *chat1.ThreadView, debugDebug logFn) bool {
	// If the latest message is eligible then show the card.
	var eligibleMsg chat1.MessageID  // maximum eligible msg
	var preventerMsg chat1.MessageID // maximum preventer msg
	save := func(msgID chat1.MessageID, eligible bool) {
		if eligible {
			if msgID > eligibleMsg {
				eligibleMsg = msgID
			}
		} else {
			if msgID > preventerMsg {
				preventerMsg = msgID
			}
		}
	}
	for _, msg := range thread.Messages {
		state, err := msg.State()
		if err != nil {
			continue
		}
		switch state {
		case chat1.MessageUnboxedState_VALID:
			eligible := func() bool {
				if !msg.IsValidFull() {
					return false
				}
				if !msg.Valid().ClientHeader.Sender.Eq(cc.uid) {
					return false
				}
				switch msg.GetMessageType() {
				case chat1.MessageType_TEXT:
					const howLongIsLong = 40
					const howOldIsOld = time.Hour * 24
					isLong := (len(msg.Valid().MessageBody.Text().Body) >= howLongIsLong)
					isOld := (cc.G().GetClock().Since(msg.Valid().ServerHeader.Ctime.Time()) >= howOldIsOld)
					answer := isLong && isOld
					return answer
				default:
					return false
				}
			}
			if eligible() {
				save(msg.GetMessageID(), true)
			} else {
				save(msg.GetMessageID(), false)
			}
		case chat1.MessageUnboxedState_ERROR:
			save(msg.Error().MessageID, false)
		case chat1.MessageUnboxedState_OUTBOX:
			// If there's something in the outbox, don't show this card.
			return false
		case chat1.MessageUnboxedState_PLACEHOLDER:
			save(msg.Placeholder().MessageID, false)
		case chat1.MessageUnboxedState_JOURNEYCARD:
			save(msg.Journeycard().PrevID, false)
		default:
			debugDebug(ctx, "unrecognized message state: %v", state)
			continue
		}
	}
	result := eligibleMsg != 0 && eligibleMsg >= preventerMsg
	if result {
		debugDebug(ctx, "cardMsgNoAnswer result:%v eligible:%v preventer:%v n:%v", result, eligibleMsg, preventerMsg, len(thread.Messages))
	}
	return result
}

// Card type: CHANNEL_INACTIVE (B on design)
// Gist: "Zzz... This channel hasn't been very active... Revive it?"
// Condition: The last visible message is old.
func (cc *JourneyCardManagerSingleUser) cardChannelInactive(ctx context.Context,
	jcd journeyCardConvData, thread *chat1.ThreadView, debugDebug logFn) bool {
	// If the latest message is eligible then show the card.
	var eligibleMsg chat1.MessageID  // maximum eligible msg
	var preventerMsg chat1.MessageID // maximum preventer msg
	save := func(msgID chat1.MessageID, eligible bool) {
		if eligible {
			if msgID > eligibleMsg {
				eligibleMsg = msgID
			}
		} else {
			if msgID > preventerMsg {
				preventerMsg = msgID
			}
		}
	}
	for _, msg := range thread.Messages {
		state, err := msg.State()
		if err != nil {
			continue
		}
		switch state {
		case chat1.MessageUnboxedState_VALID:
			eligible := func() bool {
				if !msg.IsValidFull() {
					return false
				}
				const howOldIsOld = time.Hour * 24 * 8
				isOld := (cc.G().GetClock().Since(msg.Valid().ServerHeader.Ctime.Time()) >= howOldIsOld)
				return isOld
			}
			if eligible() {
				save(msg.GetMessageID(), true)
			} else {
				save(msg.GetMessageID(), false)
			}
		case chat1.MessageUnboxedState_ERROR:
			save(msg.Error().MessageID, false)
		case chat1.MessageUnboxedState_OUTBOX:
			// If there's something in the outbox, don't show this card.
			return false
		case chat1.MessageUnboxedState_PLACEHOLDER:
			save(msg.Placeholder().MessageID, false)
		case chat1.MessageUnboxedState_JOURNEYCARD:
			save(msg.Journeycard().PrevID, false)
		default:
			cc.Debug(ctx, "unrecognized message state: %v", state)
			continue
		}
	}
	result := eligibleMsg != 0 && eligibleMsg >= preventerMsg
	if result {
		debugDebug(ctx, "cardChannelInactive result:%v eligible:%v preventer:%v n:%v", result, eligibleMsg, preventerMsg, len(thread.Messages))
	}
	return result
}

func (cc *JourneyCardManagerSingleUser) timeSinceJoined(ctx context.Context, convID chat1.ConversationID, jcd journeyCardConvData, duration time.Duration) bool {
	if jcd.JoinedTime == nil {
		go cc.saveJoinedTime(globals.BackgroundChatCtx(ctx, cc.G()), convID, cc.G().GetClock().Now())
		return false
	}
	return cc.G().GetClock().Since(jcd.JoinedTime.Time()) >= duration
}

// The user has sent a message.
func (cc *JourneyCardManagerSingleUser) SentMessage(ctx context.Context, convID chat1.ConversationID) {
	err := libkb.AcquireWithContextAndTimeout(ctx, &cc.storageLock, 10*time.Second)
	if err != nil {
		cc.Debug(ctx, "SentMessage storageLock error: %v", err)
		return
	}
	defer cc.storageLock.Unlock()
	if convID.IsNil() {
		return
	}
	jcd, err := cc.getConvDataWithLock(ctx, convID)
	if err != nil {
		cc.Debug(ctx, "storage get error: %v", err)
		return
	}
	if jcd.SentMessage {
		return
	}
	jcd.SentMessage = true
	cc.lru.Add(convID.String(), jcd)
	err = cc.encryptedDB.Put(ctx, cc.dbKey(convID), jcd)
	if err != nil {
		cc.Debug(ctx, "storage put error: %v", err)
	}
}

func (cc *JourneyCardManagerSingleUser) dbKey(convID chat1.ConversationID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatJourney,
		Key: fmt.Sprintf("jc|uid:%s|convID:%s", cc.uid, convID),
	}
}

// Get info about a conversation.
// Note the return value may share internal structure with other threads. Do not deeply modify.
func (cc *JourneyCardManagerSingleUser) getConvData(ctx context.Context, convID chat1.ConversationID) (res journeyCardConvData, err error) {
	err = libkb.AcquireWithContextAndTimeout(ctx, &cc.storageLock, 10*time.Second)
	if err != nil {
		return res, fmt.Errorf("getConvData storageLock error: %v", err)
	}
	defer cc.storageLock.Unlock()
	return cc.getConvDataWithLock(ctx, convID)
}

func (cc *JourneyCardManagerSingleUser) getConvDataWithLock(ctx context.Context, convID chat1.ConversationID) (res journeyCardConvData, err error) {
	if convID.IsNil() {
		return res, fmt.Errorf("missing convID")
	}
	untyped, ok := cc.lru.Get(convID.String())
	if ok {
		res, ok = untyped.(journeyCardConvData)
		if !ok {
			return res, fmt.Errorf("JourneyCardManager.getConvData got unexpected type: %T", untyped)
		}
		return res, nil
	}
	// Fetch from persistent storage.
	found, err := cc.encryptedDB.Get(ctx, cc.dbKey(convID), &res)
	if err != nil {
		// This could be something like a "msgpack decode error" due to a severe change to the storage schema.
		// If care is taken when changing storage schema, this shouldn't happen. But just in case,
		// better to start over than to remain stuck.
		cc.Debug(ctx, "db error: %v", err)
		found = false
	}
	if found {
		if res.DiskVersion != journeycardDiskVersion {
			cc.Debug(ctx, "converting jcd version %v -> %v", res.DiskVersion, journeycardDiskVersion)
			// Discard the other version. But try to salvage jcd.Positions if possible.
			oldPositions := res.Positions
			res = newJourneyCardConvData()
			if oldPositions != nil {
				res.Positions = oldPositions
			}
		}
	} else {
		res = newJourneyCardConvData()
	}
	cc.lru.Add(convID.String(), res)
	return res, nil
}

func (cc *JourneyCardManagerSingleUser) savePosition(ctx context.Context, convID chat1.ConversationID, cardType chat1.JourneycardType, pos journeyCardPosition) {
	err := libkb.AcquireWithContextAndTimeout(ctx, &cc.storageLock, 10*time.Second)
	if err != nil {
		cc.Debug(ctx, "savePosition storageLock error: %v", err)
		return
	}
	defer cc.storageLock.Unlock()
	if convID.IsNil() {
		return
	}
	jcd, err := cc.getConvDataWithLock(ctx, convID)
	if err != nil {
		cc.Debug(ctx, "storage get error: %v", err)
		return
	}
	if existing, ok := jcd.Positions[cardType]; ok && existing != nil && *existing == pos {
		// no change
		return
	}
	jcd = jcd.CloneSemi()
	jcd.Positions[cardType] = &pos
	cc.lru.Add(convID.String(), jcd)
	err = cc.encryptedDB.Put(ctx, cc.dbKey(convID), jcd)
	if err != nil {
		cc.Debug(ctx, "storage put error: %v", err)
	}
}

// Save the time the user joined. Discards value if one is already saved.
func (cc *JourneyCardManagerSingleUser) saveJoinedTime(ctx context.Context, convID chat1.ConversationID, t time.Time) {
	err := libkb.AcquireWithContextAndTimeout(ctx, &cc.storageLock, 10*time.Second)
	if err != nil {
		cc.Debug(ctx, "saveJoinedTime storageLock error: %v", err)
		return
	}
	defer cc.storageLock.Unlock()
	if convID.IsNil() {
		return
	}
	jcd, err := cc.getConvDataWithLock(ctx, convID)
	if err != nil {
		cc.Debug(ctx, "storage get error: %v", err)
		return
	}
	if jcd.JoinedTime != nil {
		return
	}
	jcd = jcd.CloneSemi()
	t2 := gregor1.ToTime(t)
	jcd.JoinedTime = &t2
	cc.lru.Add(convID.String(), jcd)
	err = cc.encryptedDB.Put(ctx, cc.dbKey(convID), jcd)
	if err != nil {
		cc.Debug(ctx, "storage put error: %v", err)
	}
}

type journeyCardPosition struct {
	PrevID chat1.MessageID
}

const journeycardDiskVersion int = 1

// Storage for a single conversation's journey cards.
// Bump journeycardDiskVersion when making incompatible changes.
type journeyCardConvData struct {
	DiskVersion int                                            `codec:"v,omitempty" json:"v,omitempty"`
	Positions   map[chat1.JourneycardType]*journeyCardPosition `codec:"p,omitempty" json:"p,omitempty"`
	// Whether the user has sent a message in this channel.
	SentMessage bool `codec:"sm,omitempty" json:"sm,omitempty"`
	// When the user joined the channel (that's the idea, really it's some time when they saw the conv)
	JoinedTime *gregor1.Time `codec:"jt,omitempty" json:"jt,omitempty"`
}

func newJourneyCardConvData() journeyCardConvData {
	return journeyCardConvData{
		DiskVersion: journeycardDiskVersion,
		Positions:   make(map[chat1.JourneycardType]*journeyCardPosition),
	}
}

// Clone just enough. Not a full clone.
func (j journeyCardConvData) CloneSemi() journeyCardConvData {
	ret := j
	ret.Positions = make(map[chat1.JourneycardType]*journeyCardPosition)
	for k, v := range j.Positions {
		ret.Positions[k] = v
	}
	return ret
}

// Whether this card type has already been shown.
func (j *journeyCardConvData) HasShownCard(cardType chat1.JourneycardType) bool {
	return j.Positions[cardType] != nil
}

type convForJourneycardInner interface {
	GetMembersType() chat1.ConversationMembersType
	GetTopicType() chat1.TopicType
	GetTopicName() string
	GetTeamType() chat1.TeamType
	MaxVisibleMsgID() chat1.MessageID
}

type convForJourneycard struct {
	convForJourneycardInner
	ConvID            chat1.ConversationID
	IsGeneralChannel  bool
	UntrustedTeamRole keybase1.TeamRole
	TlfID             chat1.TLFID
}
