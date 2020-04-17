package chat

import (
	"context"
	"fmt"
	"log"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/davecgh/go-spew/spew"
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

const cardSinceJoinedCap = time.Hour * 24 * 7 * 4

// JourneyCardManager handles user switching and proxies to the active JourneyCardManagerSingleUser.
type JourneyCardManager struct {
	globals.Contextified
	utils.DebugLabeler
	switchLock sync.Mutex
	m          *JourneyCardManagerSingleUser
	ri         func() chat1.RemoteInterface
}

var _ (types.JourneyCardManager) = (*JourneyCardManager)(nil)

func NewJourneyCardManager(g *globals.Context, ri func() chat1.RemoteInterface) *JourneyCardManager {
	return &JourneyCardManager{
		Contextified: globals.NewContextified(g),
		ri:           ri,
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "JourneyCardManager", false),
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
		j.m = NewJourneyCardManagerSingleUser(j.G(), j.ri, uid)
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

func (j *JourneyCardManager) TimeTravel(ctx context.Context, uid gregor1.UID, duration time.Duration) (int, int, error) {
	js, err := j.get(ctx, uid)
	if err != nil {
		return 0, 0, err
	}
	return js.TimeTravel(ctx, duration)
}

func (j *JourneyCardManager) ResetAllConvs(ctx context.Context, uid gregor1.UID) (err error) {
	js, err := j.get(ctx, uid)
	if err != nil {
		return err
	}
	return js.ResetAllConvs(ctx)
}

func (j *JourneyCardManager) DebugState(ctx context.Context, uid gregor1.UID, teamID keybase1.TeamID) (summary string, err error) {
	js, err := j.get(ctx, uid)
	if err != nil {
		return "", err
	}
	return js.DebugState(ctx, teamID)
}

func (j *JourneyCardManager) SentMessage(ctx context.Context, uid gregor1.UID, teamID keybase1.TeamID, convID chat1.ConversationID) {
	js, err := j.get(ctx, uid)
	if err != nil {
		j.Debug(ctx, "SentMessage error: %v", err)
		return
	}
	js.SentMessage(ctx, teamID, convID)
}

func (j *JourneyCardManager) Dismiss(ctx context.Context, uid gregor1.UID, teamID keybase1.TeamID, convID chat1.ConversationID, jcType chat1.JourneycardType) {
	js, err := j.get(ctx, uid)
	if err != nil {
		j.Debug(ctx, "SentMessage error: %v", err)
		return
	}
	js.Dismiss(ctx, teamID, convID, jcType)
}

func (j *JourneyCardManager) OnDbNuke(mctx libkb.MetaContext) error {
	return j.clear(mctx.Ctx())
}

func (j *JourneyCardManager) Start(ctx context.Context, uid gregor1.UID) {
	var err error
	defer j.G().CTrace(ctx, "JourneyCardManager.Start", nil)()
	_, err = j.get(ctx, uid)
	_ = err // ignore error
}

func (j *JourneyCardManager) Stop(ctx context.Context) chan struct{} {
	var err error
	defer j.G().CTrace(ctx, "JourneyCardManager.Stop", nil)()
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
	ri func() chat1.RemoteInterface
	utils.DebugLabeler
	uid         gregor1.UID // Each instance of JourneyCardManagerSingleUser works only for a single fixed uid.
	storageLock sync.Mutex
	lru         *lru.Cache
	encryptedDB *encrypteddb.EncryptedDB
}

type logFn func(ctx context.Context, format string, args ...interface{})

func NewJourneyCardManagerSingleUser(g *globals.Context, ri func() chat1.RemoteInterface, uid gregor1.UID) *JourneyCardManagerSingleUser {
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
		ri:           ri,
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "JourneyCardManager", false),
		uid:          uid,
		lru:          lru,
		encryptedDB:  encrypteddb.New(g.ExternalG(), dbFn, keyFn),
	}
}

func (cc *JourneyCardManagerSingleUser) checkFeature(ctx context.Context) (enabled bool) {
	if cc.G().GetEnv().GetDebugJourneycard() {
		return true
	}
	if cc.G().Env.GetFeatureFlags().HasFeature(libkb.FeatureJourneycard) {
		return true
	}
	// G.FeatureFlags seems like the kind of system that might hang on a bad network.
	// PickCard is supposed to be lightning fast, so impose a timeout on FeatureFlags.
	var err error
	type enabledAndError struct {
		enabled bool
		err     error
	}
	ret := make(chan enabledAndError)
	go func() {
		enabled, err = cc.G().FeatureFlags.EnabledWithError(cc.MetaContext(ctx), libkb.FeatureJourneycard)
		ret <- enabledAndError{enabled: enabled, err: err}
	}()

	select {
	case <-time.After(100 * time.Millisecond):
		cc.Debug(ctx, "JourneyCardManagerSingleUser#checkFeature timed out: returning false")
		return false
	case enabledAndErrorRet := <-ret:
		if enabledAndErrorRet.err != nil {
			cc.Debug(ctx, "JourneyCardManagerSingleUser#checkFeature errored out (returning false): %v", err)
			return false
		}
		enabled = enabledAndErrorRet.enabled
		cc.Debug(ctx, "JourneyCardManagerSingleUser#checkFeature succeeded: %v", enabled)
		return enabled
	}
}

// Choose a journey card to show in the conversation.
// Called by postProcessThread so keep it snappy.
func (cc *JourneyCardManagerSingleUser) PickCard(ctx context.Context,
	convID chat1.ConversationID,
	convLocalOptional *chat1.ConversationLocal,
	thread *chat1.ThreadView,
) (*chat1.MessageUnboxedJourneycard, error) {
	debug := cc.checkFeature(ctx)
	// For now "debug" doesn't mean much. Everything is logged. After more real world experience
	// this can be used to reduce the amount of logging.
	if !debug {
		// Journey cards are gated by either client-side flag KEYBASE_DEBUG_JOURNEYCARD or server-driven flag 'journeycard'.
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
	var welcomeEligible bool
	var cannotWrite bool
	if convLocalOptional != nil {
		convInner = convLocalOptional
		tlfID = convLocalOptional.Info.Triple.Tlfid
		untrustedTeamRole = convLocalOptional.ReaderInfo.UntrustedTeamRole
		if convLocalOptional.ReaderInfo.Journeycard != nil {
			welcomeEligible = convLocalOptional.ReaderInfo.Journeycard.WelcomeEligible
			if convInner.GetTopicName() == globals.DefaultTeamTopic {
				debugDebug(ctx, "welcomeEligible: convLocalOptional has ReaderInfo.Journeycard: %v", welcomeEligible)
			}
		}
		cannotWrite = convLocalOptional.CannotWrite()
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
			if convFromCache.Conv.ReaderInfo.Journeycard != nil {
				welcomeEligible = convFromCache.Conv.ReaderInfo.Journeycard.WelcomeEligible
				if convInner.GetTopicName() == globals.DefaultTeamTopic {
					debugDebug(ctx, "welcomeEligible: convFromCache has ReaderInfo.Journeycard: %v", welcomeEligible)
				}
			}
			if convFromCache.Conv.ConvSettings != nil && convFromCache.Conv.ConvSettings.MinWriterRoleInfo != nil {
				cannotWrite = untrustedTeamRole.IsOrAbove(convFromCache.Conv.ConvSettings.MinWriterRoleInfo.Role)
			}
		}
	}

	conv := convForJourneycard{
		convForJourneycardInner: convInner,
		ConvID:                  convID,
		IsGeneralChannel:        convInner.GetTopicName() == globals.DefaultTeamTopic,
		UntrustedTeamRole:       untrustedTeamRole,
		TlfID:                   tlfID,
		// TeamID is filled a little later on
		WelcomeEligible: welcomeEligible,
		CannotWrite:     cannotWrite,
	}

	if !(conv.GetTopicType() == chat1.TopicType_CHAT &&
		conv.GetMembersType() == chat1.ConversationMembersType_TEAM) {
		// Cards only exist in team chats.
		cc.Debug(ctx, "conv not eligible for card: topicType:%v membersType:%v general:%v",
			conv.GetTopicType(), conv.GetMembersType(), conv.GetTopicName() == globals.DefaultTeamTopic)
		return nil, nil
	}

	teamID, err := keybase1.TeamIDFromString(tlfID.String())
	if err != nil {
		return nil, err
	}
	conv.TeamID = teamID

	if len(thread.Messages) == 0 {
		cc.Debug(ctx, "skipping empty page")
		return nil, nil
	}

	jcd, err := cc.getTeamData(ctx, teamID)
	if err != nil {
		return nil, err
	}

	makeCard := func(cardType chat1.JourneycardType, highlightMsgID chat1.MessageID, preferSavedPosition bool) (*chat1.MessageUnboxedJourneycard, error) {
		// preferSavedPosition : If true, the card stays in the position it was previously seen. If false, the card goes at the bottom.
		var pos *journeyCardPosition
		if preferSavedPosition {
			pos = jcd.Convs[convID.ConvIDStr()].Positions[cardType]
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
			go cc.savePosition(globals.BackgroundChatCtx(ctx, cc.G()), teamID, convID, cardType, *pos)
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
		cc.Debug(ctx, "makeCard -> prevID:%v cardType:%v jcdCtime:%v", pos.PrevID, cardType, jcd.Ctime.Time())
		res := chat1.MessageUnboxedJourneycard{
			PrevID:         pos.PrevID,
			Ordinal:        ordinal,
			CardType:       cardType,
			HighlightMsgID: highlightMsgID,
		}
		if cardType == chat1.JourneycardType_ADD_PEOPLE {
			res.OpenTeam, err = cc.isOpenTeam(ctx, conv)
			if err != nil {
				cc.Debug(ctx, "isOpenTeam error: %v", err)
			}
		}
		return &res, nil
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
		chat1.JourneycardType_MSG_ATTENTION,    // 5 on design
	}

	looseCardOrder := []chat1.JourneycardType{
		chat1.JourneycardType_CHANNEL_INACTIVE, // B on design
		chat1.JourneycardType_MSG_NO_ANSWER,    // C on design
	}

	type cardCondition func(context.Context) bool
	cardConditionTODO := func(ctx context.Context) bool { return false }
	cardConditions := map[chat1.JourneycardType]cardCondition{
		chat1.JourneycardType_WELCOME:          func(ctx context.Context) bool { return cc.cardWelcome(ctx, convID, conv, jcd, debugDebug) },
		chat1.JourneycardType_POPULAR_CHANNELS: func(ctx context.Context) bool { return cc.cardPopularChannels(ctx, conv, jcd, debugDebug) },
		chat1.JourneycardType_ADD_PEOPLE:       func(ctx context.Context) bool { return cc.cardAddPeople(ctx, conv, jcd, debugDebug) },
		chat1.JourneycardType_CREATE_CHANNELS:  func(ctx context.Context) bool { return cc.cardCreateChannels(ctx, conv, jcd, debugDebug) },
		chat1.JourneycardType_MSG_ATTENTION:    cardConditionTODO,
		chat1.JourneycardType_CHANNEL_INACTIVE: func(ctx context.Context) bool { return cc.cardChannelInactive(ctx, conv, jcd, thread, debugDebug) },
		chat1.JourneycardType_MSG_NO_ANSWER:    func(ctx context.Context) bool { return cc.cardMsgNoAnswer(ctx, conv, jcd, thread, debugDebug) },
	}

	// Prefer showing cards later in the order.
	checkForNeverBeforeSeenCards := func(ctx context.Context, types []chat1.JourneycardType, breakOnShown bool) *chat1.JourneycardType {
		for i := len(types) - 1; i >= 0; i-- {
			cardType := types[i]
			if jcd.hasShownOrDismissedOrLockout(convID, cardType) {
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
	// One might expect thread.Pagination.FirstPage() to be used instead of latestPage.
	// But FirstPage seems to return false often when latestPage is true.

	if latestPage {
		// Prefer showing new "linear" cards. Do not show cards that are prior to one that has been shown.
		if cardType := checkForNeverBeforeSeenCards(ctx, linearCardOrder, true); cardType != nil {
			return makeCard(*cardType, 0, true)
		}
		// Show any new loose cards. It's fine to show A even if C has already been seen.
		if cardType := checkForNeverBeforeSeenCards(ctx, looseCardOrder, false); cardType != nil {
			return makeCard(*cardType, 0, true)
		}
	}

	// TODO card type: MSG_ATTENTION (5 on design)
	// Gist: "One of your messages is getting a lot of attention! <pointer to message>"
	// Condition: The logged-in user's message gets a lot of reacjis
	// Condition: That message is above the fold.

	// No new cards selected. Pick the already-shown card with the most recent prev message ID.
	debugDebug(ctx, "no new cards selected")
	var mostRecentCardType chat1.JourneycardType
	var mostRecentPrev chat1.MessageID
	for cardType, savedPos := range jcd.Convs[convID.ConvIDStr()].Positions {
		if savedPos == nil || jcd.hasDismissed(cardType) {
			continue
		}
		// Break ties in PrevID using cardType's arbitrary enum value.
		if savedPos.PrevID >= mostRecentPrev && (savedPos.PrevID != mostRecentPrev || cardType > mostRecentCardType) {
			mostRecentCardType = cardType
			mostRecentPrev = savedPos.PrevID
		}
	}
	if mostRecentPrev != 0 {
		switch mostRecentCardType {
		case chat1.JourneycardType_CHANNEL_INACTIVE, chat1.JourneycardType_MSG_NO_ANSWER:
			// Special case for these card types. These cards are pointing out a lack of activity
			// in a conv. Subsequent activity in the conv should dismiss them.
			if cc.messageSince(ctx, mostRecentPrev, conv, thread, debugDebug) {
				debugDebug(ctx, "dismissing most recent saved card: %v", mostRecentCardType)
				go cc.Dismiss(globals.BackgroundChatCtx(ctx, cc.G()), teamID, convID, mostRecentCardType)
			} else {
				debugDebug(ctx, "selected most recent saved card: %v", mostRecentCardType)
				return makeCard(mostRecentCardType, 0, true)
			}
		default:
			debugDebug(ctx, "selected most recent saved card: %v", mostRecentCardType)
			return makeCard(mostRecentCardType, 0, true)
		}
	}

	debugDebug(ctx, "no card at end of checks")
	return nil, nil
}

// Card type: WELCOME (1 on design)
// Condition: Only in #general channel
// Condition: Less than 4 weeks have passed since the user joined the team (ish: see JoinedTime).
func (cc *JourneyCardManagerSingleUser) cardWelcome(ctx context.Context, convID chat1.ConversationID, conv convForJourneycard, jcd journeycardData, debugDebug logFn) bool {
	// TODO PICNIC-593 Welcome's interaction with existing system message
	// Welcome cards show not show for all pre-existing teams when a client upgrades to first support journey cards. That would be a bad transition.
	// The server gates whether welcome cards are allowed for a conv. After MarkAsRead-ing a conv, welcome cards are banned.
	if !conv.IsGeneralChannel {
		return false
	}
	debugDebug(ctx, "cardWelcome: welcomeEligible: %v", conv.WelcomeEligible)
	return conv.IsGeneralChannel && conv.WelcomeEligible && cc.timeSinceJoinedLE(ctx, conv.TeamID, conv.ConvID, jcd, cardSinceJoinedCap)
}

// Card type: POPULAR_CHANNELS (2 on design)
// Gist: "You are in #general. Other popular channels in this team: diplomacy, sportsball"
// Condition: Only in #general channel
// Condition: The team has at least 2 channels besides general that the user could join.
// Condition: The user has not joined any other channels in the team.
// Condition: User has sent a first message OR a few days have passed since they joined the channel.
// Condition: Less than 4 weeks have passed since the user joined the team (ish: see JoinedTime).
func (cc *JourneyCardManagerSingleUser) cardPopularChannels(ctx context.Context, conv convForJourneycard,
	jcd journeycardData, debugDebug logFn) bool {
	otherChannelsExist := conv.GetTeamType() == chat1.TeamType_COMPLEX
	simpleQualified := conv.IsGeneralChannel && otherChannelsExist && (jcd.Convs[conv.ConvID.ConvIDStr()].SentMessage || cc.timeSinceJoinedInRange(ctx, conv.TeamID, conv.ConvID, jcd, time.Hour*24*2, cardSinceJoinedCap))
	if !simpleQualified {
		return false
	}
	// Find other channels that the user could join, or that they have joined.
	// Don't get the actual channel names, since for NEVER_JOINED convs LocalMetadata,
	// which has the name, is not generally available. The gui will fetch the names async.
	topicType := chat1.TopicType_CHAT
	joinableStatuses := []chat1.ConversationMemberStatus{ // keep in sync with cards/team-journey/container.tsx
		chat1.ConversationMemberStatus_REMOVED,
		chat1.ConversationMemberStatus_LEFT,
		chat1.ConversationMemberStatus_RESET,
		chat1.ConversationMemberStatus_NEVER_JOINED,
	}
	inbox, err := cc.G().InboxSource.ReadUnverified(ctx, cc.uid, types.InboxSourceDataSourceLocalOnly,
		&chat1.GetInboxQuery{
			TlfID:            &conv.TlfID,
			TopicType:        &topicType,
			MemberStatus:     append(append([]chat1.ConversationMemberStatus{}, joinableStatuses...), everJoinedStatuses...),
			MembersTypes:     []chat1.ConversationMembersType{chat1.ConversationMembersType_TEAM},
			SummarizeMaxMsgs: true,
			SkipBgLoads:      true,
			AllowUnseenQuery: true, // Make an effort, it's ok if convs are missed.
		})
	if err != nil {
		debugDebug(ctx, "cardPopularChannels ReadUnverified error: %v", err)
		return false
	}
	const nJoinableChannelsMin int = 2
	var nJoinableChannels int
	for _, convOther := range inbox.ConvsUnverified {
		if !convOther.GetConvID().Eq(conv.ConvID) {
			if convOther.Conv.ReaderInfo == nil {
				debugDebug(ctx, "cardPopularChannels ReadUnverified missing ReaderInfo: %v", convOther.GetConvID())
				continue
			}
			if memberStatusListContains(everJoinedStatuses, convOther.Conv.ReaderInfo.Status) {
				debugDebug(ctx, "cardPopularChannels ReadUnverified found already-joined conv among %v: %v", len(inbox.ConvsUnverified), convOther.GetConvID())
				return false
			}
			// Found joinable conv
			nJoinableChannels++
		}
	}
	debugDebug(ctx, "cardPopularChannels ReadUnverified found joinable convs %v / %v", nJoinableChannels, len(inbox.ConvsUnverified))
	return nJoinableChannels >= nJoinableChannelsMin
}

// Card type: ADD_PEOPLE (3 on design)
// Gist: "Do you know people interested in joining?"
// Condition: Only in #general channel
// Condition: User is an admin.
// Condition: User has sent messages OR joined channels.
// Condition: A few days on top of POPULAR_CHANNELS have passed since the user joined the channel. In order to space it out from POPULAR_CHANNELS.
// Condition: Less than 4 weeks have passed since the user joined the team (ish: see JoinedTime).
func (cc *JourneyCardManagerSingleUser) cardAddPeople(ctx context.Context, conv convForJourneycard, jcd journeycardData,
	debugDebug logFn) bool {
	if !conv.IsGeneralChannel || !conv.UntrustedTeamRole.IsAdminOrAbove() {
		return false
	}
	if !cc.timeSinceJoinedInRange(ctx, conv.TeamID, conv.ConvID, jcd, time.Hour*24*4, cardSinceJoinedCap) {
		return false
	}
	if jcd.Convs[conv.ConvID.ConvIDStr()].SentMessage {
		return true
	}
	// Figure whether the user has ever joined other channels.
	topicType := chat1.TopicType_CHAT
	inbox, err := cc.G().InboxSource.ReadUnverified(ctx, cc.uid, types.InboxSourceDataSourceLocalOnly,
		&chat1.GetInboxQuery{
			TlfID:            &conv.TlfID,
			TopicType:        &topicType,
			MemberStatus:     everJoinedStatuses,
			MembersTypes:     []chat1.ConversationMembersType{chat1.ConversationMembersType_TEAM},
			SummarizeMaxMsgs: true,
			SkipBgLoads:      true,
			AllowUnseenQuery: true, // Make an effort, it's ok if convs are missed.
		})
	if err != nil {
		debugDebug(ctx, "cardAddPeople ReadUnverified error: %v", err)
		return false
	}
	debugDebug(ctx, "cardAddPeople ReadUnverified found %v convs", len(inbox.ConvsUnverified))
	for _, convOther := range inbox.ConvsUnverified {
		if !convOther.GetConvID().Eq(conv.ConvID) {
			debugDebug(ctx, "cardAddPeople ReadUnverified found alternate conv: %v", convOther.GetConvID())
			return true
		}
	}
	return false
}

// Card type: CREATE_CHANNELS (4 on design)
// Gist: "Go ahead and create #channels around topics you think are missing."
// Condition: User is at least a writer.
// Condition: A few weeks have passed.
// Condition: User has sent a message.
// Condition: There are <= 2 channels in the team.
// Condition: Less than 4 weeks have passed since the user joined the team (ish: see JoinedTime).
func (cc *JourneyCardManagerSingleUser) cardCreateChannels(ctx context.Context, conv convForJourneycard, jcd journeycardData, debugDebug logFn) bool {
	if !conv.UntrustedTeamRole.IsWriterOrAbove() {
		return false
	}
	if !jcd.Convs[conv.ConvID.ConvIDStr()].SentMessage {
		return false
	}
	if !cc.timeSinceJoinedInRange(ctx, conv.TeamID, conv.ConvID, jcd, time.Hour*24*14, cardSinceJoinedCap) {
		return false
	}
	if conv.GetTeamType() == chat1.TeamType_SIMPLE {
		return true
	}
	// Figure out how many channels exist.
	topicType := chat1.TopicType_CHAT
	inbox, err := cc.G().InboxSource.ReadUnverified(ctx, cc.uid, types.InboxSourceDataSourceLocalOnly,
		&chat1.GetInboxQuery{
			TlfID:            &conv.TlfID,
			TopicType:        &topicType,
			MemberStatus:     allConvMemberStatuses,
			MembersTypes:     []chat1.ConversationMembersType{chat1.ConversationMembersType_TEAM},
			SummarizeMaxMsgs: true,
			SkipBgLoads:      true,
			AllowUnseenQuery: true, // Make an effort, it's ok if convs are missed.
		})
	if err != nil {
		debugDebug(ctx, "cardCreateChannels ReadUnverified error: %v", err)
		return false
	}
	debugDebug(ctx, "cardCreateChannels ReadUnverified found %v convs", len(inbox.ConvsUnverified))
	return len(inbox.ConvsUnverified) <= 2
}

// Card type: MSG_NO_ANSWER (C)
// Gist: "People haven't been talkative in a while. Perhaps post in another channel? <list of channels>"
// Condition: In a channel besides general.
// Condition: The last visible message is old, was sent by the logged-in user, and was a long text message, and has not been reacted to.
func (cc *JourneyCardManagerSingleUser) cardMsgNoAnswer(ctx context.Context, conv convForJourneycard,
	jcd journeycardData, thread *chat1.ThreadView, debugDebug logFn) bool {
	if conv.IsGeneralChannel {
		return false
	}
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
					const howOldIsOld = time.Hour * 24 * 3
					isLong := (len(msg.Valid().MessageBody.Text().Body) >= howLongIsLong)
					isOld := (cc.G().GetClock().Since(msg.Valid().ServerHeader.Ctime.Time().Add(-jcd.TimeOffset.ToDuration())) >= howOldIsOld)
					hasNoReactions := len(msg.Valid().Reactions.Reactions) == 0
					answer := isLong && isOld && hasNoReactions
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
// Condition: User can write in the channel.
// Condition: The last visible message is old.
// Condition: A card besides WELCOME has been shown in the team.
func (cc *JourneyCardManagerSingleUser) cardChannelInactive(ctx context.Context,
	conv convForJourneycard, jcd journeycardData, thread *chat1.ThreadView,
	debugDebug logFn) bool {
	if conv.CannotWrite || !jcd.ShownCardBesidesWelcome {
		return false
	}
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
				isOld := (cc.G().GetClock().Since(msg.Valid().ServerHeader.Ctime.Time().Add(-jcd.TimeOffset.ToDuration())) >= howOldIsOld)
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

func (cc *JourneyCardManagerSingleUser) timeSinceJoinedInRange(ctx context.Context, teamID keybase1.TeamID, convID chat1.ConversationID, jcd journeycardData, minDuration time.Duration, maxDuration time.Duration) bool {
	joinedTime := jcd.Convs[convID.ConvIDStr()].JoinedTime
	if joinedTime == nil {
		go cc.saveJoinedTime(globals.BackgroundChatCtx(ctx, cc.G()), teamID, convID, cc.G().GetClock().Now())
		return false
	}
	since := cc.G().GetClock().Since(joinedTime.Time().Add(-jcd.TimeOffset.ToDuration()))
	return since >= minDuration && since <= maxDuration
}

// JoinedTime <= duration
func (cc *JourneyCardManagerSingleUser) timeSinceJoinedLE(ctx context.Context, teamID keybase1.TeamID, convID chat1.ConversationID, jcd journeycardData, duration time.Duration) bool {
	joinedTime := jcd.Convs[convID.ConvIDStr()].JoinedTime
	if joinedTime == nil {
		go cc.saveJoinedTime(globals.BackgroundChatCtx(ctx, cc.G()), teamID, convID, cc.G().GetClock().Now())
		return true
	}
	return cc.G().GetClock().Since(joinedTime.Time().Add(-jcd.TimeOffset.ToDuration())) <= duration
}

func (cc *JourneyCardManagerSingleUser) messageSince(ctx context.Context, msgID chat1.MessageID,
	conv convForJourneycard, thread *chat1.ThreadView, debugDebug logFn) bool {
	for _, msg := range thread.Messages {
		state, err := msg.State()
		if err != nil {
			continue
		}
		switch state {
		case chat1.MessageUnboxedState_VALID, chat1.MessageUnboxedState_ERROR, chat1.MessageUnboxedState_PLACEHOLDER:
			if msg.GetMessageID() > msgID {
				return true
			}
		case chat1.MessageUnboxedState_OUTBOX:
			return true
		case chat1.MessageUnboxedState_JOURNEYCARD:
		default:
			debugDebug(ctx, "unrecognized message state: %v", state)
			continue
		}
	}
	return false
}

// The user has sent a message.
func (cc *JourneyCardManagerSingleUser) SentMessage(ctx context.Context, teamID keybase1.TeamID, convID chat1.ConversationID) {
	err := libkb.AcquireWithContextAndTimeout(ctx, &cc.storageLock, 10*time.Second)
	if err != nil {
		cc.Debug(ctx, "SentMessage storageLock error: %v", err)
		return
	}
	defer cc.storageLock.Unlock()
	if teamID.IsNil() || convID.IsNil() {
		return
	}
	jcd, err := cc.getTeamDataWithLock(ctx, teamID)
	if err != nil {
		cc.Debug(ctx, "storage get error: %v", err)
		return
	}
	if jcd.Convs[convID.ConvIDStr()].SentMessage {
		return
	}
	jcd = jcd.MutateConv(convID, func(conv journeycardConvData) journeycardConvData {
		conv.SentMessage = true
		return conv
	})
	cc.lru.Add(teamID.String(), jcd)
	err = cc.encryptedDB.Put(ctx, cc.dbKey(teamID), jcd)
	if err != nil {
		cc.Debug(ctx, "storage put error: %v", err)
	}
	cc.saveJoinedTimeWithLock(globals.BackgroundChatCtx(ctx, cc.G()), teamID, convID, cc.G().GetClock().Now())
}

func (cc *JourneyCardManagerSingleUser) Dismiss(ctx context.Context, teamID keybase1.TeamID, convID chat1.ConversationID, cardType chat1.JourneycardType) {
	var err error
	defer cc.G().CTrace(ctx, fmt.Sprintf("JourneyCardManagerSingleUser.Dismiss(cardType:%v, teamID:%v, convID:%v)",
		cardType, teamID, convID.DbShortFormString()), &err)()
	err = libkb.AcquireWithContextAndTimeout(ctx, &cc.storageLock, 10*time.Second)
	if err != nil {
		cc.Debug(ctx, "Dismiss storageLock error: %v", err)
		return
	}
	defer cc.storageLock.Unlock()
	if convID.IsNil() {
		return
	}
	jcd, err := cc.getTeamDataWithLock(ctx, teamID)
	if err != nil {
		cc.Debug(ctx, "storage get error: %v", err)
		return
	}
	if jcd.Dismissals[cardType] {
		return
	}
	jcd = jcd.PrepareToMutateDismissals() // clone Dismissals to avoid modifying shared conv.
	jcd.Dismissals[cardType] = true
	cc.lru.Add(teamID.String(), jcd)
	err = cc.encryptedDB.Put(ctx, cc.dbKey(teamID), jcd)
	if err != nil {
		cc.Debug(ctx, "storage put error: %v", err)
	}
}

func (cc *JourneyCardManagerSingleUser) dbKey(teamID keybase1.TeamID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatJourney,
		// Key: fmt.Sprintf("jc|uid:%s|convID:%s", cc.uid, convID), // used with DiskVersion 1
		Key: fmt.Sprintf("jc|uid:%s|teamID:%s", cc.uid, teamID),
	}
}

// Get info about a team and its conversations.
// Note the return value may share internal structure with other threads. Do not deeply modify.
func (cc *JourneyCardManagerSingleUser) getTeamData(ctx context.Context, teamID keybase1.TeamID) (res journeycardData, err error) {
	err = libkb.AcquireWithContextAndTimeout(ctx, &cc.storageLock, 10*time.Second)
	if err != nil {
		return res, fmt.Errorf("getTeamData storageLock error: %v", err)
	}
	defer cc.storageLock.Unlock()
	return cc.getTeamDataWithLock(ctx, teamID)
}

func (cc *JourneyCardManagerSingleUser) getTeamDataWithLock(ctx context.Context, teamID keybase1.TeamID) (res journeycardData, err error) {
	if teamID.IsNil() {
		return res, fmt.Errorf("missing teamID")
	}
	untyped, ok := cc.lru.Get(teamID.String())
	if ok {
		res, ok = untyped.(journeycardData)
		if !ok {
			return res, fmt.Errorf("JourneyCardManager.getConvData got unexpected type: %T", untyped)
		}
		return res, nil
	}
	// Fetch from persistent storage.
	found, err := cc.encryptedDB.Get(ctx, cc.dbKey(teamID), &res)
	if err != nil {
		// This could be something like a "msgpack decode error" due to a severe change to the storage schema.
		// If care is taken when changing storage schema, this shouldn't happen. But just in case,
		// better to start over than to remain stuck.
		cc.Debug(ctx, "db error: %v", err)
		found = false
	}
	if found {
		switch res.DiskVersion {
		case 1:
			// Version 1 is obsolete. Ignore it.
			res = newJourneycardData()
		case journeycardDiskVersion:
			// good
		default:
			cc.Debug(ctx, "converting jcd version %v -> %v", res.DiskVersion, journeycardDiskVersion)
			// Accept any subset of the data that was deserialized.
		}
	} else {
		res = newJourneycardData()
	}
	cc.lru.Add(teamID.String(), res)
	return res, nil
}

func (cc *JourneyCardManagerSingleUser) hasTeam(ctx context.Context, teamID keybase1.TeamID) (found bool, nConvs int, err error) {
	err = libkb.AcquireWithContextAndTimeout(ctx, &cc.storageLock, 10*time.Second)
	if err != nil {
		return false, 0, fmt.Errorf("getTeamData storageLock error: %v", err)
	}
	defer cc.storageLock.Unlock()
	var jcd journeycardData
	found, err = cc.encryptedDB.Get(ctx, cc.dbKey(teamID), &jcd)
	if err != nil || !found {
		return found, 0, err
	}
	return found, len(jcd.Convs), nil
}

func (cc *JourneyCardManagerSingleUser) savePosition(ctx context.Context, teamID keybase1.TeamID, convID chat1.ConversationID, cardType chat1.JourneycardType, pos journeyCardPosition) {
	err := libkb.AcquireWithContextAndTimeout(ctx, &cc.storageLock, 10*time.Second)
	if err != nil {
		cc.Debug(ctx, "savePosition storageLock error: %v", err)
		return
	}
	defer cc.storageLock.Unlock()
	if teamID.IsNil() || convID.IsNil() {
		return
	}
	jcd, err := cc.getTeamDataWithLock(ctx, teamID)
	if err != nil {
		cc.Debug(ctx, "storage get error: %v", err)
		return
	}
	if conv, ok := jcd.Convs[convID.ConvIDStr()]; ok {
		if existing, ok := conv.Positions[cardType]; ok && existing != nil && *existing == pos {
			if !journeycardTypeOncePerTeam[cardType] || jcd.Lockin[cardType].Eq(convID) {
				// no change
				return
			}
		}
	}
	jcd = jcd.MutateConv(convID, func(conv journeycardConvData) journeycardConvData {
		conv = conv.PrepareToMutatePositions() // clone Positions to avoid modifying shared conv.
		conv.Positions[cardType] = &pos
		return conv
	})
	if journeycardTypeOncePerTeam[cardType] {
		jcd = jcd.SetLockin(cardType, convID)
	}
	if cardType != chat1.JourneycardType_WELCOME {
		jcd.ShownCardBesidesWelcome = true
	}
	cc.lru.Add(teamID.String(), jcd)
	err = cc.encryptedDB.Put(ctx, cc.dbKey(teamID), jcd)
	if err != nil {
		cc.Debug(ctx, "storage put error: %v", err)
	}
}

// Save the time the user joined. Discards value if one is already saved.
func (cc *JourneyCardManagerSingleUser) saveJoinedTime(ctx context.Context, teamID keybase1.TeamID, convID chat1.ConversationID, t time.Time) {
	err := libkb.AcquireWithContextAndTimeout(ctx, &cc.storageLock, 10*time.Second)
	if err != nil {
		cc.Debug(ctx, "saveJoinedTime storageLock error: %v", err)
		return
	}
	defer cc.storageLock.Unlock()
	cc.saveJoinedTimeWithLock(ctx, teamID, convID, t)
}

func (cc *JourneyCardManagerSingleUser) saveJoinedTimeWithLock(ctx context.Context, teamID keybase1.TeamID, convID chat1.ConversationID, t time.Time) {
	cc.saveJoinedTimeWithLockInner(ctx, teamID, convID, t, false)
}

func (cc *JourneyCardManagerSingleUser) saveJoinedTimeWithLockInner(ctx context.Context, teamID keybase1.TeamID, convID chat1.ConversationID, t time.Time, acceptUpdate bool) {
	if teamID.IsNil() || convID.IsNil() {
		return
	}
	jcd, err := cc.getTeamDataWithLock(ctx, teamID)
	if err != nil {
		cc.Debug(ctx, "storage get error: %v", err)
		return
	}
	if jcd.Convs[convID.ConvIDStr()].JoinedTime != nil && !acceptUpdate {
		return
	}
	t2 := gregor1.ToTime(t)
	jcd = jcd.MutateConv(convID, func(conv journeycardConvData) journeycardConvData {
		conv.JoinedTime = &t2
		return conv
	})
	cc.lru.Add(teamID.String(), jcd)
	err = cc.encryptedDB.Put(ctx, cc.dbKey(teamID), jcd)
	if err != nil {
		cc.Debug(ctx, "storage put error: %v", err)
	}
}

func (cc *JourneyCardManagerSingleUser) isOpenTeam(ctx context.Context, conv convForJourneycard) (open bool, err error) {
	teamID, err := keybase1.TeamIDFromString(conv.TlfID.String())
	if err != nil {
		return false, err
	}
	return cc.G().GetTeamLoader().IsOpenCached(ctx, teamID)
}

// TimeTravel simulates moving all known conversations forward in time.
// For use simulating a user experience without the need to wait hours for cards to appear.
// Returns the number of known teams and convs.
func (cc *JourneyCardManagerSingleUser) TimeTravel(ctx context.Context, duration time.Duration) (nTeams, nConvs int, err error) {
	err = libkb.AcquireWithContextAndTimeout(ctx, &cc.storageLock, 10*time.Second)
	if err != nil {
		return 0, 0, err
	}
	defer cc.storageLock.Unlock()
	teamIDs, err := cc.getKnownTeamsForDebuggingWithLock(ctx)
	if err != nil {
		return 0, 0, err
	}
	for _, teamID := range teamIDs {
		jcd, err := cc.getTeamDataWithLock(ctx, teamID)
		if err != nil {
			return len(teamIDs), 0, fmt.Errorf("teamID:%v err:%v", teamID, err)
		}
		jcd.TimeOffset = gregor1.ToDurationMsec(jcd.TimeOffset.ToDuration() + duration)
		cc.Debug(ctx, "time travel teamID:%v", teamID, jcd.TimeOffset)
		nConvs += len(jcd.Convs)
		cc.lru.Add(teamID.String(), jcd)
		err = cc.encryptedDB.Put(ctx, cc.dbKey(teamID), jcd)
		if err != nil {
			cc.Debug(ctx, "storage put error: %v", err)
			return len(teamIDs), 0, err
		}
	}
	return nConvs, len(teamIDs), nil
}

// ResetAllConvs deletes storage for all conversations.
// For use simulating a fresh user experience without the need to switch accounts.
func (cc *JourneyCardManagerSingleUser) ResetAllConvs(ctx context.Context) (err error) {
	err = libkb.AcquireWithContextAndTimeout(ctx, &cc.storageLock, 10*time.Second)
	if err != nil {
		return err
	}
	defer cc.storageLock.Unlock()
	teamIDs, err := cc.getKnownTeamsForDebuggingWithLock(ctx)
	if err != nil {
		return err
	}
	cc.lru.Purge()
	for _, teamID := range teamIDs {
		err = cc.encryptedDB.Delete(ctx, cc.dbKey(teamID))
		if err != nil {
			return fmt.Errorf("teamID:%v err:%v", teamID, err)
		}
	}
	return nil
}

func (cc *JourneyCardManagerSingleUser) DebugState(ctx context.Context, teamID keybase1.TeamID) (summary string, err error) {
	jcd, err := cc.getTeamData(ctx, teamID)
	if err != nil {
		return "", err
	}
	convs := jcd.Convs
	jcd.Convs = nil // Blank out convs for the first spew. They will be shown separately.
	summary = spew.Sdump(jcd)
	if jcd.TimeOffset != 0 {
		summary += fmt.Sprintf("\nTime travel offset: %v", jcd.TimeOffset.ToDuration())
	}
	for convIDStr, conv := range convs {
		summary += fmt.Sprintf("\n%v:\n%v", convIDStr, spew.Sdump(conv))
		if conv.JoinedTime != nil {
			since := cc.G().GetClock().Since(conv.JoinedTime.Time().Add(jcd.TimeOffset.ToDuration()))
			summary += fmt.Sprintf("Since joined: %v (%.1f days)", since, float64(since)/float64(time.Hour*24))
		}
	}
	return summary, nil
}

func (cc *JourneyCardManagerSingleUser) getKnownTeamsForDebuggingWithLock(ctx context.Context) (teams []keybase1.TeamID, err error) {
	innerKeyPrefix := fmt.Sprintf("jc|uid:%s|teamID:", cc.uid)
	prefix := libkb.DbKey{
		Typ: libkb.DBChatJourney,
		Key: innerKeyPrefix,
	}.ToBytes()
	leveldb, ok := cc.G().LocalChatDb.GetEngine().(*libkb.LevelDb)
	if !ok {
		return nil, fmt.Errorf("could not get leveldb")
	}
	dbKeys, err := leveldb.KeysWithPrefixes(prefix)
	if err != nil {
		return nil, err
	}
	for dbKey := range dbKeys {
		if dbKey.Typ == libkb.DBChatJourney && strings.HasPrefix(dbKey.Key, innerKeyPrefix) {
			teamID, err := keybase1.TeamIDFromString(dbKey.Key[len(innerKeyPrefix):])
			if err != nil {
				return nil, err
			}
			teams = append(teams, teamID)
		}
	}
	return teams, nil
}

type journeyCardPosition struct {
	PrevID chat1.MessageID `codec:"p,omitempty" json:"p,omitempty"`
}

const journeycardDiskVersion int = 2

// Storage for a single team's journey cards.
// Bump journeycardDiskVersion when making incompatible changes.
type journeycardData struct {
	DiskVersion int                                     `codec:"v,omitempty" json:"v,omitempty"`
	Convs       map[chat1.ConvIDStr]journeycardConvData `codec:"cv,omitempty" json:"cv,omitempty"`
	Dismissals  map[chat1.JourneycardType]bool          `codec:"ds,omitempty" json:"ds,omitempty"`
	// Some card types can only appear once. This map locks a type into a particular conv.
	Lockin                  map[chat1.JourneycardType]chat1.ConversationID `codec:"l,omitempty" json:"l,omitempty"`
	ShownCardBesidesWelcome bool                                           `codec:"sbw,omitempty" json:"sbw,omitempty"`
	// When this data was first saved. For debugging unexpected data loss.
	Ctime      gregor1.Time         `codec:"c,omitempty" json:"c,omitempty"`
	TimeOffset gregor1.DurationMsec `codec:"to,omitempty" json:"to,omitempty"` // Time travel for testing/debugging
}

type journeycardConvData struct {
	// codec `d` has been used in the past for Dismissals
	Positions map[chat1.JourneycardType]*journeyCardPosition `codec:"p,omitempty" json:"p,omitempty"`
	// Whether the user has sent a message in this channel.
	SentMessage bool `codec:"sm,omitempty" json:"sm,omitempty"`
	// When the user joined the channel (that's the idea, really it's some time when they saw the conv)
	JoinedTime *gregor1.Time `codec:"jt,omitempty" json:"jt,omitempty"`
}

func newJourneycardData() journeycardData {
	return journeycardData{
		DiskVersion: journeycardDiskVersion,
		Convs:       make(map[chat1.ConvIDStr]journeycardConvData),
		Dismissals:  make(map[chat1.JourneycardType]bool),
		Lockin:      make(map[chat1.JourneycardType]chat1.ConversationID),
		Ctime:       gregor1.ToTime(time.Now()),
	}
}

func newJourneycardConvData() journeycardConvData {
	return journeycardConvData{
		Positions: make(map[chat1.JourneycardType]*journeyCardPosition),
	}
}

// Return a new instance where the conv entry has been mutated.
// Without modifying the receiver itself.
// The caller should take that `apply` does not deeply mutate its argument.
// If the conversation did not exist, a new entry is created.
func (j *journeycardData) MutateConv(convID chat1.ConversationID, apply func(journeycardConvData) journeycardConvData) journeycardData {
	selectedConvIDStr := convID.ConvIDStr()
	updatedConvs := make(map[chat1.ConvIDStr]journeycardConvData)
	for convIDStr, conv := range j.Convs {
		if convIDStr == selectedConvIDStr {
			updatedConvs[convIDStr] = apply(conv)
		} else {
			updatedConvs[convIDStr] = conv
		}
	}
	if _, found := updatedConvs[selectedConvIDStr]; !found {
		updatedConvs[selectedConvIDStr] = apply(newJourneycardConvData())
	}
	res := *j // Copy so that Convs can be assigned without aliasing.
	res.Convs = updatedConvs
	return res
}

// Return a new instance where Lockin has been modified.
// Without modifying the receiver itself.
func (j *journeycardData) SetLockin(cardType chat1.JourneycardType, convID chat1.ConversationID) (res journeycardData) {
	res = *j
	res.Lockin = make(map[chat1.JourneycardType]chat1.ConversationID)
	for k, v := range j.Lockin {
		res.Lockin[k] = v
	}
	res.Lockin[cardType] = convID
	return res
}

// Whether this card type has one of:
// - already been shown (conv)
// - been dismissed (team wide)
// - lockin to a different conv (team wide)
func (j *journeycardData) hasShownOrDismissedOrLockout(convID chat1.ConversationID, cardType chat1.JourneycardType) bool {
	if j.Dismissals[cardType] {
		return true
	}
	if lockinConvID, found := j.Lockin[cardType]; found {
		if !lockinConvID.Eq(convID) {
			return true
		}
	}
	if c, found := j.Convs[convID.ConvIDStr()]; found {
		return c.Positions[cardType] != nil
	}
	return false
}

// Whether this card type has been dismissed.
func (j *journeycardData) hasDismissed(cardType chat1.JourneycardType) bool {
	return j.Dismissals[cardType]
}

func (j *journeycardData) PrepareToMutateDismissals() (res journeycardData) {
	res = *j
	res.Dismissals = make(map[chat1.JourneycardType]bool)
	for k, v := range j.Dismissals {
		res.Dismissals[k] = v
	}
	return res
}

func (j *journeycardConvData) PrepareToMutatePositions() (res journeycardConvData) {
	res = *j
	res.Positions = make(map[chat1.JourneycardType]*journeyCardPosition)
	for k, v := range j.Positions {
		res.Positions[k] = v
	}
	return res
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
	TeamID            keybase1.TeamID
	WelcomeEligible   bool
	CannotWrite       bool
}

var journeycardTypeOncePerTeam = map[chat1.JourneycardType]bool{
	chat1.JourneycardType_WELCOME:          true,
	chat1.JourneycardType_POPULAR_CHANNELS: true,
	chat1.JourneycardType_ADD_PEOPLE:       true,
	chat1.JourneycardType_CREATE_CHANNELS:  true,
}

var journeycardShouldNotRunOnReason = map[chat1.GetThreadReason]bool{
	chat1.GetThreadReason_BACKGROUNDCONVLOAD: true,
	chat1.GetThreadReason_FIXRETRY:           true,
	chat1.GetThreadReason_PREPARE:            true,
	chat1.GetThreadReason_SEARCHER:           true,
	chat1.GetThreadReason_INDEXED_SEARCH:     true,
	chat1.GetThreadReason_KBFSFILEACTIVITY:   true,
	chat1.GetThreadReason_COINFLIP:           true,
	chat1.GetThreadReason_BOTCOMMANDS:        true,
}

// The user has joined the conversations at some point.
var everJoinedStatuses = []chat1.ConversationMemberStatus{
	chat1.ConversationMemberStatus_ACTIVE,
	chat1.ConversationMemberStatus_REMOVED,
	chat1.ConversationMemberStatus_LEFT,
	chat1.ConversationMemberStatus_PREVIEW,
}

var allConvMemberStatuses []chat1.ConversationMemberStatus

func init() {
	var allConvMemberStatuses []chat1.ConversationMemberStatus
	for s := range chat1.ConversationMemberStatusRevMap {
		allConvMemberStatuses = append(allConvMemberStatuses, s)
	}
	sort.Slice(allConvMemberStatuses, func(i, j int) bool { return allConvMemberStatuses[i] < allConvMemberStatuses[j] })
}

func memberStatusListContains(a []chat1.ConversationMemberStatus, v chat1.ConversationMemberStatus) bool {
	for _, el := range a {
		if el == v {
			return true
		}
	}
	return false
}
