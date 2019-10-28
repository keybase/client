package chat

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type JourneyCardChecker struct {
	globals.Contextified
	utils.DebugLabeler
	storageLock sync.Mutex
	lru         *lru.Cache // TODO in-memory storage is insufficient, add leveldb storage.
	// TODO when it comes to disk storage. Do versioning in a way that makes it easy to reset. But not spam cards. Maybe burn card types for a conv.
}

var _ (types.JourneyCardManager) = (*JourneyCardChecker)(nil)

func NewJourneyCardChecker(g *globals.Context) *JourneyCardChecker {
	labeler := utils.NewDebugLabeler(g.GetLog(), "JourneyCardChecker", false)
	lru, err := lru.New(200)
	if err != nil {
		// lru.New only panics if size <= 0
		log.Panicf("Could not create lru cache: %v", err)
	}
	return &JourneyCardChecker{
		Contextified: globals.NewContextified(g),
		DebugLabeler: labeler,
		lru:          lru,
	}
}

// Choose a journey card to show in the conversation.
// Called by postProcessThread so keep it snappy.
func (cc *JourneyCardChecker) PickCard(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID,
	convLocalOptional *chat1.ConversationLocal,
	thread *chat1.ThreadView,
) (*chat1.MessageUnboxedJourneycard, error) {
	debug := cc.G().GetEnv().GetDebugJourneycard()
	if !debug {
		// Journey cards are gated by the client-side flag KEYBASE_DEBUG_JOURNEYCARD
		return nil, nil
	}
	debugDebug := func(ctx context.Context, format string, args ...interface{}) {
		if debug {
			cc.Debug(ctx, format, args...)
		}
	}

	type ConvEnough interface {
		GetMembersType() chat1.ConversationMembersType
		GetTopicType() chat1.TopicType
		GetTopicName() string
		GetTeamType() chat1.TeamType
		MaxVisibleMsgID() chat1.MessageID
	}

	var conv ConvEnough
	var untrustedTeamRole keybase1.TeamRole
	var tlfID chat1.TLFID
	if convLocalOptional != nil {
		conv = convLocalOptional
		tlfID = convLocalOptional.Info.Triple.Tlfid
		untrustedTeamRole = convLocalOptional.ReaderInfo.UntrustedTeamRole
	} else {
		convFromCache, err := utils.GetUnverifiedConv(ctx, cc.G(), uid, convID, types.InboxSourceDataSourceLocalOnly)
		if err != nil {
			return nil, err
		}
		if convFromCache.LocalMetadata == nil {
			// LocalMetadata is needed to get topicName.
			return nil, fmt.Errorf("conv LocalMetadata not found")
		}
		conv = convFromCache
		tlfID = convFromCache.Conv.Metadata.IdTriple.Tlfid
		if convFromCache.Conv.ReaderInfo != nil {
			untrustedTeamRole = convFromCache.Conv.ReaderInfo.UntrustedTeamRole
		}
	}

	inGeneralChannel := conv.GetTopicName() == globals.DefaultTeamTopic
	if !(conv.GetTopicType() == chat1.TopicType_CHAT &&
		conv.GetMembersType() == chat1.ConversationMembersType_TEAM) {
		// Cards only exist in team chats.
		debugDebug(ctx, "conv not eligible for card: topicType:%v membersType:%v general:%v",
			conv.GetTopicType(), conv.GetMembersType(), conv.GetTopicName() == globals.DefaultTeamTopic)
		return nil, nil
	}

	//  this isn't working:
	/*
		if !thread.Pagination.FirstPage() {
			// only want cards for the initial conversation load
			cc.Debug(ctx, "not first page: %+v", thread.Pagination)
			return nil, nil
		}
	*/

	jcd := cc.getConvData(ctx, convID)

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
				debugDebug(ctx, "no message found to use as base for ordinal")
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

	// TODO factor out individual message filters. This func is getting a bit big. Also might help with dealing
	// with the reversed priorities of cards that have already been shown. Maybe if no new cards trigger, show the
	// latest already shown card.

	// TODO card type: WELCOME (1) (interaction with existing system message) (persist its location, disappear when other cards come in)
	// Condition: Only in #general channel

	// Card type: MSG_NO_ANSWER (C)
	// Gist: "People haven't been talkative in a while. Perhaps post in another channel? <list of channels>"
	// Condition: The last visible message is old, was sent by the logged-in user, and was a long text message.
	{
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
				msg.GetMessageID()
				eligible := func() bool {
					if !msg.IsValidFull() {
						return false
					}
					if !msg.Valid().ClientHeader.Sender.Eq(uid) {
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
				eligibleMsg = 0
				preventerMsg = 9999
				break
			case chat1.MessageUnboxedState_PLACEHOLDER:
				save(msg.Placeholder().MessageID, false)
			case chat1.MessageUnboxedState_JOURNEYCARD:
				save(msg.Journeycard().PrevID, false)
			default:
				debugDebug(ctx, "unrecognized message state: %v", state)
				continue
			}
		}
		show := eligibleMsg != 0 && eligibleMsg >= preventerMsg
		if show {
			return makeCard(chat1.JourneycardType_MSG_NO_ANSWER, 0, true)
		}
	}

	// Card type: ADD_PEOPLE (3)
	// Gist: "Do you know people interested in joining?"
	// Condition: User is an admin.
	// Condition: User has sent messages OR joined channels.
	if untrustedTeamRole.IsAdminOrAbove() {
		show := jcd.SentMessage || !inGeneralChannel
		if !show {
			// Figure whether the user is in other channels.
			topicType := chat1.TopicType_CHAT
			inbox, err := cc.G().InboxSource.ReadUnverified(libkb.WithLogTag(ctx, "xyztag"), uid, types.InboxSourceDataSourceLocalOnly, &chat1.GetInboxQuery{
				TlfID: &tlfID,
				// ConvIDs:   []chat1.ConversationID{convID},
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
			}, nil)
			if err != nil {
				debugDebug(ctx, "ReadUnverified error: %v", err)
			} else {
				debugDebug(ctx, "ReadUnverified found %v convs", len(inbox.ConvsUnverified))
				for _, convOther := range inbox.ConvsUnverified {
					if !convOther.GetConvID().Eq(convID) {
						debugDebug(ctx, "ReadUnverified found alternate conv: %v", convOther.GetTopicName()) // xxx do not log this
						show = true
						break
					}
				}
			}
		}
		if show {
			return makeCard(chat1.JourneycardType_ADD_PEOPLE, 0, true)
		}
	}

	timeSinceJoined := func(duration time.Duration) bool {
		if jcd.JoinedTime == nil {
			debugDebug(ctx, "missing joined time")
			go cc.saveJoinedTime(globals.BackgroundChatCtx(ctx, cc.G()), convID, cc.G().GetClock().Now())
			return false
		} else {
			return cc.G().GetClock().Since(jcd.JoinedTime.Time()) >= duration
		}
	}

	// Card type: POPULAR_CHANNELS
	// Gist: "You are in #general. Other popular channels in this team: diplomacy, sportsball"
	// Condition: Only in #general channel
	// Condition: The team has channels besides general.
	// Condition: User has sent a first message OR a few days have passed since they joined the channel.
	otherChannelsExist := conv.GetTeamType() == chat1.TeamType_COMPLEX
	if (inGeneralChannel || debug) && otherChannelsExist {
		debugDebug(ctx, "other channels exist")
		show := jcd.SentMessage
		if !show && timeSinceJoined(time.Hour*24*2) {
			show = true
		}
		if show {
			return makeCard(chat1.JourneycardType_POPULAR_CHANNELS, 0, true)
		}
	}

	// TODO card type: CREATE_CHANNELS
	// Gist: "Go ahead and create #channels around topics you think are missing."
	// Condition: A few weeks have passed.
	// Condition: User has sent a message.
	if jcd.SentMessage && timeSinceJoined(time.Hour*24*14) {
		return makeCard(chat1.JourneycardType_CREATE_CHANNELS, 0, true)
	}

	// TODO card type: MSG_ATTENTION
	// Gist: "One of your messages is getting a lot of attention! <pointer to message>"
	// Condition: The logged-in user's message gets a lot of reacjis
	// Condition: That message is above the fold.

	// TODO card type: USER_AWAY_FOR_LONG
	// Gist: "Long time no see.... Look at all the things you missed."

	// TODO card type: CHANNEL_INACTIVE
	// Gist: "Zzz... This channel hasn't been very active... Revive it?"

	debugDebug(ctx, "no card at end of checks")
	return nil, nil
}

// The user has sent a message.
func (cc *JourneyCardChecker) SentMessage(ctx context.Context, convID chat1.ConversationID) {
	err := libkb.AcquireWithContextAndTimeout(ctx, &cc.storageLock, 10*time.Second)
	if err != nil {
		cc.Debug(ctx, "SentMessage storageLock error: %v", err)
		return
	}
	defer cc.storageLock.Unlock()
	if convID.IsNil() {
		return
	}
	jcd := cc.getConvDataWithLock(ctx, convID)
	if jcd.SentMessage {
		return
	}
	jcd.SentMessage = true
	cc.lru.Add(convID.String(), jcd)
}

// Get info about a conversation.
// Note the return value may share internal structure with other threads. Do not deeply modify.
func (cc *JourneyCardChecker) getConvData(ctx context.Context, convID chat1.ConversationID) journeyCardConvData {
	err := libkb.AcquireWithContextAndTimeout(ctx, &cc.storageLock, 10*time.Second)
	if err != nil {
		cc.Debug(ctx, "getConvData storageLock error: %v", err)
		return newJourneyCardConvData()
	}
	defer cc.storageLock.Unlock()
	return cc.getConvDataWithLock(ctx, convID)
}

func (cc *JourneyCardChecker) getConvDataWithLock(ctx context.Context, convID chat1.ConversationID) journeyCardConvData {
	if convID.IsNil() {
		return newJourneyCardConvData()
	}
	untyped, ok := cc.lru.Get(convID.String())
	if !ok {
		return newJourneyCardConvData()
	}
	jcd, ok := untyped.(journeyCardConvData)
	if !ok {
		cc.Debug(ctx, "getConvData unexpected type: %T", jcd)
		return newJourneyCardConvData()
	}
	return jcd
}

func (cc *JourneyCardChecker) savePosition(ctx context.Context, convID chat1.ConversationID, cardType chat1.JourneycardType, pos journeyCardPosition) {
	err := libkb.AcquireWithContextAndTimeout(ctx, &cc.storageLock, 10*time.Second)
	if err != nil {
		cc.Debug(ctx, "savePosition storageLock error: %v", err)
		return
	}
	defer cc.storageLock.Unlock()
	if convID.IsNil() {
		return
	}
	jcd := cc.getConvDataWithLock(ctx, convID).CloneSemi()
	jcd.Positions[cardType] = &pos
	cc.lru.Add(convID.String(), jcd)
}

// Save the time the user joined. Discards value if one is already saved.
func (cc *JourneyCardChecker) saveJoinedTime(ctx context.Context, convID chat1.ConversationID, t time.Time) {
	err := libkb.AcquireWithContextAndTimeout(ctx, &cc.storageLock, 10*time.Second)
	if err != nil {
		cc.Debug(ctx, "saveJoinedTime storageLock error: %v", err)
		return
	}
	defer cc.storageLock.Unlock()
	if convID.IsNil() {
		return
	}
	jcd := cc.getConvDataWithLock(ctx, convID) // doesn't deadlock cause using reentrant lock
	if jcd.JoinedTime != nil {
		return
	}
	jcd = jcd.CloneSemi()
	t2 := gregor1.ToTime(t)
	jcd.JoinedTime = &t2
	cc.lru.Add(convID.String(), jcd)
}

type journeyCardPosition struct {
	PrevID chat1.MessageID
}

// Storage for a single conversation's journey cards.
type journeyCardConvData struct {
	Positions   map[chat1.JourneycardType]*journeyCardPosition
	SentMessage bool          // Whether the user has sent a message in this channel.
	JoinedTime  *gregor1.Time // When the user joined the channel (that's the idea, really it's some time when they saw the conv)
}

func newJourneyCardConvData() journeyCardConvData {
	return journeyCardConvData{
		Positions: make(map[chat1.JourneycardType]*journeyCardPosition),
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
