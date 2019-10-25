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
	if convLocalOptional != nil {
		conv = convLocalOptional
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
	}

	if !(conv.GetTopicType() == chat1.TopicType_CHAT &&
		conv.GetMembersType() == chat1.ConversationMembersType_TEAM &&
		(conv.GetTopicName() == globals.DefaultTeamTopic || debug)) {
		// Cards only exist in the general channel of team chats.
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

	makeCard := func(cardType chat1.JourneycardType, highlightMsgID chat1.MessageID) (*chat1.MessageUnboxedJourneycard, error) {
		pos := jcd.Positions[cardType]
		if pos == nil {
			// Pick a message to use as the base for a frontend ordinal.
			// Get out of the way of any other messages that have taken ordinal offsets of that message.
			prevID := conv.MaxVisibleMsgID()
			ordinal := 1 // offset within
			for _, message := range thread.Messages {
				if message.GetMessageID() > prevID {
					prevID = message.GetMessageID()
					ordinal = 1
				}
				state, err := message.State()
				if err != nil {
					continue
				}
				foundOrdinal := func(foundOrdinal int) {
					if prevID == message.GetMessageID() && foundOrdinal > ordinal {
						ordinal = foundOrdinal + 1
					}
				}
				switch state {
				case chat1.MessageUnboxedState_OUTBOX:
					foundOrdinal(message.Outbox().Ordinal)
				case chat1.MessageUnboxedState_JOURNEYCARD:
					foundOrdinal(message.Journeycard().Ordinal)
				}
			}
			if prevID == 0 {
				debugDebug(ctx, "no message found to use as base for ordinal")
				return nil, nil
			}

			pos = &journeyCardPosition{
				PrevID:  prevID,
				Ordinal: ordinal,
			}

			go cc.savePosition(globals.BackgroundChatCtx(ctx, cc.G()), convID, cardType, *pos)

			// TODO reserve ordinals. Otherwise outbox clobbers journey card ordinals. Something like this:
			// go func() {
			// 	ctx := globals.BackgroundChatCtx(ctx, cc.G())
			// 	err := outbox.ReservePosition(ctx, convID, pos.PrevID, pos.Ordinal)
			// 	if err != nil {
			// 		cc.Debug(ctx, "ReservePosition error: %v", err)
			// 	}
			// }()
		}
		return &chat1.MessageUnboxedJourneycard{
			PrevID:         pos.PrevID,
			Ordinal:        pos.Ordinal,
			CardType:       cardType,
			HighlightMsgID: highlightMsgID,
		}, nil
	}

	if debug {
		// for testing, do special stuff based on channel name:
		switch conv.GetTopicName() {
		case "kb_cards_0_kb":
			return makeCard(chat1.JourneycardType_WELCOME, 0)
		case "kb_cards_1_kb":
			return makeCard(chat1.JourneycardType_POPULAR_CHANNELS, 0)
		case "kb_cards_2_kb":
			return makeCard(chat1.JourneycardType_ADD_PEOPLE, 0)
		case "kb_cards_3_kb":
			return makeCard(chat1.JourneycardType_CREATE_CHANNELS, 0)
		case "kb_cards_4_kb":
			return makeCard(chat1.JourneycardType_MSG_ATTENTION, 3)
		case "kb_cards_5_kb":
			return makeCard(chat1.JourneycardType_USER_AWAY_FOR_LONG, 0)
		case "kb_cards_6_kb":
			return makeCard(chat1.JourneycardType_CHANNEL_INACTIVE, 0)
		case "kb_cards_7_kb":
			return makeCard(chat1.JourneycardType_MSG_NO_ANSWER, 0)
		}
	}

	// TODO card type: WELCOME (interaction with existing system message) (persist its location, disappear when other cards come in)

	// Card type: POPULAR_CHANNELS
	// Gist: "You are in #general. Other popular channels in this team: diplomacy, sportsball"
	// Condition: The team has channels besides general.
	// Condition: User has sent a first message OR a few days have passed since they joined the channel.
	otherChannelsExist := conv.GetTeamType() == chat1.TeamType_COMPLEX
	if otherChannelsExist {
		debugDebug(ctx, "other channels exist")
		show := jcd.SentMessage
		if !show {
			if jcd.JoinedTime == nil {
				debugDebug(ctx, "missing joined time")
				go cc.saveJoinedTime(globals.BackgroundChatCtx(ctx, cc.G()), convID, cc.G().GetClock().Now())
			} else {
				cutoff := time.Hour * 24 * 2
				if cc.G().GetClock().Since(jcd.JoinedTime.Time()) >= cutoff {
					show = true
				} else {
					debugDebug(ctx, "not past time")
				}
			}
		}
		if show {
			return makeCard(chat1.JourneycardType_POPULAR_CHANNELS, 0)
		}
	}

	// TODO card type: ADD_PEOPLE

	// TODO card type: CREATE_CHANNELS

	// TODO card type: MSG_ATTENTION

	// TODO card type: USER_AWAY_FOR_LONG

	// TODO card type: CHANNEL_INACTIVE

	// TODO card type: MSG_NO_ANSWER

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
	PrevID  chat1.MessageID
	Ordinal int
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
