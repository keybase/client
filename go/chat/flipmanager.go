package chat

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"math"
	"math/big"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/chat/flip"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
)

type sentMessageResult struct {
	MsgID chat1.MessageID
	Err   error
}

type sentMessageListener struct {
	globals.Contextified
	libkb.NoopNotifyListener
	utils.DebugLabeler

	outboxID chat1.OutboxID
	listenCh chan sentMessageResult
}

func newSentMessageListener(g *globals.Context, outboxID chat1.OutboxID) *sentMessageListener {
	return &sentMessageListener{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "sentMessageListener", false),
		outboxID:     outboxID,
		listenCh:     make(chan sentMessageResult, 1),
	}
}

func (n *sentMessageListener) NewChatActivity(uid keybase1.UID, activity chat1.ChatActivity,
	source chat1.ChatActivitySource) {
	if source != chat1.ChatActivitySource_LOCAL {
		return
	}
	st, err := activity.ActivityType()
	if err != nil {
		n.Debug(context.Background(), "NewChatActivity: failed to get type: %s", err)
		return
	}
	switch st {
	case chat1.ChatActivityType_INCOMING_MESSAGE:
		msg := activity.IncomingMessage().Message
		if msg.IsOutbox() {
			return
		}
		if n.outboxID.Eq(msg.GetOutboxID()) {
			n.listenCh <- sentMessageResult{
				MsgID: msg.GetMessageID(),
			}
		}
	case chat1.ChatActivityType_FAILED_MESSAGE:
		for _, obr := range activity.FailedMessage().OutboxRecords {
			if obr.OutboxID.Eq(&n.outboxID) {
				n.listenCh <- sentMessageResult{
					Err: errors.New("failed to send message"),
				}
				break
			}
		}
	}
}

type flipTextMetadata struct {
	LowerBound    string
	ShuffleItems  []string
	DeckShuffle   bool
	HandCardCount uint
	HandTargets   []string
}

type hostMessageInfo struct {
	flipTextMetadata
	ConvID chat1.ConversationID
	MsgID  chat1.MessageID
}

type loadGameJob struct {
	gameID chat1.FlipGameID
	uid    gregor1.UID
	convID chat1.ConversationID
}

type FlipManager struct {
	globals.Contextified
	utils.DebugLabeler

	dealer            *flip.Dealer
	desktopVisualizer *FlipVisualizer
	mobileVisualizer  *FlipVisualizer
	clock             clockwork.Clock
	ri                func() chat1.RemoteInterface
	shutdownMu        sync.Mutex
	shutdownCh        chan struct{}
	forceCh           chan struct{}
	loadGameCh        chan loadGameJob

	gamesMu    sync.Mutex
	games      *lru.Cache
	dirtyGames map[string]chat1.FlipGameID
}

func NewFlipManager(g *globals.Context, ri func() chat1.RemoteInterface) *FlipManager {
	games, _ := lru.New(100)
	m := &FlipManager{
		Contextified:      globals.NewContextified(g),
		DebugLabeler:      utils.NewDebugLabeler(g.GetLog(), "FlipManager", false),
		ri:                ri,
		clock:             clockwork.NewRealClock(),
		games:             games,
		dirtyGames:        make(map[string]chat1.FlipGameID),
		forceCh:           make(chan struct{}, 10),
		loadGameCh:        make(chan loadGameJob, 100),
		desktopVisualizer: NewFlipVisualizer(256, 100),
		mobileVisualizer:  NewFlipVisualizer(220, 100),
	}
	dealer := flip.NewDealer(m)
	m.dealer = dealer
	return m
}

func (m *FlipManager) Start(ctx context.Context, uid gregor1.UID) {
	defer m.Trace(ctx, func() error { return nil }, "Start")()
	m.shutdownMu.Lock()
	shutdownCh := make(chan struct{})
	m.shutdownCh = shutdownCh
	m.shutdownMu.Unlock()
	go func() {
		m.dealer.Run(context.Background())
	}()
	go m.updateLoop(shutdownCh)
	go m.notificationLoop(shutdownCh)
	go m.loadGameLoop(shutdownCh)
}

func (m *FlipManager) Stop(ctx context.Context) (ch chan struct{}) {
	defer m.Trace(ctx, func() error { return nil }, "Stop")()
	m.dealer.Stop()
	m.shutdownMu.Lock()
	if m.shutdownCh != nil {
		close(m.shutdownCh)
		m.shutdownCh = nil
	}
	m.shutdownMu.Unlock()
	ch = make(chan struct{})
	close(ch)
	return ch
}

func (m *FlipManager) makeBkgContext() context.Context {
	ctx := context.Background()
	return Context(ctx, m.G(), keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil, nil)
}

func (m *FlipManager) isHostMessageInfoMsgID(msgID chat1.MessageID) bool {
	// The first message in a flip thread is metadata about the flip, which is message ID 2 since
	// conversations have an initial message from creation.
	return chat1.MessageID(2) == msgID
}

func (m *FlipManager) isStartMsgID(msgID chat1.MessageID) bool {
	// The first message after the host message is the flip start message, which will have message ID 3
	return chat1.MessageID(3) == msgID
}

func (m *FlipManager) getVisualizer() *FlipVisualizer {
	if m.G().GetAppType() == libkb.MobileAppType {
		return m.mobileVisualizer
	}
	return m.desktopVisualizer
}

func (m *FlipManager) notifyDirtyGames() {
	m.gamesMu.Lock()
	defer m.gamesMu.Unlock()
	if len(m.dirtyGames) == 0 {
		return
	}
	defer func() {
		m.dirtyGames = make(map[string]chat1.FlipGameID)
	}()
	ctx := m.makeBkgContext()
	ui, err := m.G().UIRouter.GetChatUI()
	if err != nil || ui == nil {
		m.Debug(ctx, "notifyDirtyGames: no chat UI available for notification")
		return
	}
	var updates []chat1.UICoinFlipStatus
	for _, dg := range m.dirtyGames {
		if game, ok := m.games.Get(dg.String()); ok {
			status := game.(chat1.UICoinFlipStatus)
			m.getVisualizer().Visualize(&status)
			updates = append(updates, status)
		}
	}
	if err := ui.ChatCoinFlipStatus(ctx, updates); err != nil {
		m.Debug(ctx, "notifyDirtyGames: failed to notify status: %s", err)
	}
}

func (m *FlipManager) notificationLoop(shutdownCh chan struct{}) {
	duration := 50 * time.Millisecond
	next := m.clock.Now().Add(duration)
	for {
		select {
		case <-m.clock.AfterTime(next):
			m.notifyDirtyGames()
			next = m.clock.Now().Add(duration)
		case <-m.forceCh:
			m.notifyDirtyGames()
			next = m.clock.Now().Add(duration)
		case <-shutdownCh:
			return
		}
	}
}

func (m *FlipManager) addParticipant(ctx context.Context, status *chat1.UICoinFlipStatus,
	update flip.CommitmentUpdate) {
	username, deviceName, _, err := m.G().GetUPAKLoader().LookupUsernameAndDevice(ctx,
		keybase1.UID(update.User.U.String()), keybase1.DeviceID(update.User.D.String()))
	if err != nil {
		m.Debug(ctx, "addParticipant: failed to get username/device (using IDs): %s", err)
		username = libkb.NewNormalizedUsername(update.User.U.String())
		deviceName = update.User.D.String()
	}
	status.Participants = append(status.Participants, chat1.UICoinFlipParticipant{
		Uid:        update.User.U.String(),
		DeviceID:   update.User.D.String(),
		Username:   username.String(),
		DeviceName: deviceName,
		Commitment: update.Commitment.String(),
	})
	sort.Slice(status.Participants, func(i, j int) bool {
		return status.Participants[i].Username < status.Participants[j].Username
	})
	endingS := ""
	if len(status.Participants) > 1 {
		endingS = "s"
	}
	status.ProgressText = fmt.Sprintf("Gathered %d commitment%s", len(status.Participants), endingS)
}

func (m *FlipManager) addReveal(ctx context.Context, status *chat1.UICoinFlipStatus,
	update flip.RevealUpdate) {
	numReveals := 0
	for index, p := range status.Participants {
		if p.Reveal != nil {
			numReveals++
		}
		if p.Uid == update.User.U.String() && p.DeviceID == update.User.D.String() {
			reveal := update.Reveal.String()
			status.Participants[index].Reveal = &reveal
			numReveals++
		}
	}
	status.ProgressText = fmt.Sprintf("%d participants have revealed secrets", numReveals)
}

func (m *FlipManager) addCardHandResult(ctx context.Context, status *chat1.UICoinFlipStatus,
	result flip.Result, hmi hostMessageInfo) {
	deckIndex := 0
	numCards := len(result.Shuffle)
	var rows []string
	handSize := int(hmi.HandCardCount)
	for targetIndex, target := range hmi.HandTargets {
		if numCards-handSize < deckIndex {
			rows = append(rows, fmt.Sprintf("%d. %s: 🤨", targetIndex+1, target))
			continue
		}
		var hand []string
		for di := deckIndex; di < deckIndex+handSize; di++ {
			hand = append(hand, hmi.ShuffleItems[result.Shuffle[di]])
		}
		rows = append(rows, fmt.Sprintf("%d. %s: %s", targetIndex+1, target,
			strings.TrimRight(strings.Join(hand, ", "), " ")))
		deckIndex += handSize
	}
	status.ResultText = strings.Join(rows, "\n")
}

func (m *FlipManager) addResult(ctx context.Context, status *chat1.UICoinFlipStatus, result flip.Result,
	convID chat1.ConversationID) {
	defer func() {
		if len(status.ResultText) > 0 {
			status.ProgressText += " (complete)"
		}
	}()
	hmi, err := m.getHostMessageInfo(ctx, convID)
	switch {
	case err != nil:
		m.Debug(ctx, "addResult: failed to describe result: %s", err)
		status.Phase = chat1.UICoinFlipPhase_ERROR
		status.ProgressText = "Failed to describe result"
	case result.Big != nil:
		lb := new(big.Int)
		res := new(big.Int)
		lb.SetString(hmi.LowerBound, 0)
		res.Add(lb, result.Big)
		status.ResultText = res.String()
	case result.Bool != nil:
		if *result.Bool {
			status.ResultText = "HEADS"
		} else {
			status.ResultText = "TAILS"
		}
	case result.Int != nil:
		status.ResultText = fmt.Sprintf("%d", *result.Int)
	case len(result.Shuffle) > 0:
		if hmi.HandCardCount > 0 {
			m.addCardHandResult(ctx, status, result, hmi)
			return
		}
		if len(hmi.ShuffleItems) != len(result.Shuffle) {
			status.Phase = chat1.UICoinFlipPhase_ERROR
			status.ProgressText = "Failed to describe shuffle result"
			return
		}
		items := make([]string, len(hmi.ShuffleItems))
		for index, r := range result.Shuffle {
			items[index] = hmi.ShuffleItems[r]
		}
		status.ResultText = strings.TrimRight(strings.Join(items, ", "), " ")
	}
}

func (m *FlipManager) queueDirtyGameID(gameID chat1.FlipGameID, force bool) {
	m.gamesMu.Lock()
	m.dirtyGames[gameID.String()] = gameID
	m.gamesMu.Unlock()
	if force {
		m.forceCh <- struct{}{}
	}
}

func (m *FlipManager) handleSummaryUpdate(ctx context.Context, gameID chat1.FlipGameID,
	update *flip.GameSummary, convID chat1.ConversationID, force bool) {
	defer m.queueDirtyGameID(gameID, force)
	if update.Err != nil {
		var parts []chat1.UICoinFlipParticipant
		oldGame, ok := m.games.Get(gameID.String())
		if ok {
			parts = oldGame.(chat1.UICoinFlipStatus).Participants
		}
		m.games.Add(gameID.String(), chat1.UICoinFlipStatus{
			GameID:       gameID.String(),
			Phase:        chat1.UICoinFlipPhase_ERROR,
			ProgressText: fmt.Sprintf("Complete: %s", update.Err),
			Participants: parts,
		})
		return
	}
	status := chat1.UICoinFlipStatus{
		GameID: gameID.String(),
		Phase:  chat1.UICoinFlipPhase_COMPLETE,
	}
	m.addResult(ctx, &status, update.Result, convID)
	for _, p := range update.Players {
		m.addParticipant(ctx, &status, flip.CommitmentUpdate{
			User:       p.Device,
			Commitment: p.Commitment,
		})
		if p.Reveal != nil {
			m.addReveal(ctx, &status, flip.RevealUpdate{
				User:   p.Device,
				Reveal: *p.Reveal,
			})
		}
	}
	status.ProgressText = "Complete"
	m.games.Add(gameID.String(), status)
}

func (m *FlipManager) handleUpdate(ctx context.Context, update flip.GameStateUpdateMessage, force bool) (err error) {
	gameID := update.Metadata.GameID
	defer func() {
		if err == nil {
			m.queueDirtyGameID(gameID, force)
		}
	}()
	var status chat1.UICoinFlipStatus
	rawGame, ok := m.games.Get(gameID.String())
	if ok {
		status = rawGame.(chat1.UICoinFlipStatus)
	} else {
		status = chat1.UICoinFlipStatus{
			GameID: gameID.String(),
		}
	}
	switch {
	case update.Err != nil:
		status.Phase = chat1.UICoinFlipPhase_ERROR
		status.ProgressText = fmt.Sprintf("Something went wrong: %s", update.Err)
	case update.Commitment != nil:
		status.Phase = chat1.UICoinFlipPhase_COMMITMENT
		m.addParticipant(ctx, &status, *update.Commitment)
	case update.CommitmentComplete != nil:
		status.Phase = chat1.UICoinFlipPhase_REVEALS
		status.ProgressText = "Commitments complete, revealing secrets..."
	case update.Reveal != nil:
		m.addReveal(ctx, &status, *update.Reveal)
	case update.Result != nil:
		status.Phase = chat1.UICoinFlipPhase_COMPLETE
		m.addResult(ctx, &status, *update.Result, update.Metadata.ConversationID)
	default:
		return errors.New("unknown update kind")
	}
	m.games.Add(gameID.String(), status)
	return nil
}

func (m *FlipManager) updateLoop(shutdownCh chan struct{}) {
	for {
		select {
		case msg := <-m.dealer.UpdateCh():
			m.handleUpdate(m.makeBkgContext(), msg, false)
		case <-shutdownCh:
			return
		}
	}
}

const gameIDTopicNamePrefix = "__keybase_coinflip_game_"

func (m *FlipManager) gameTopicNameFromGameID(gameID chat1.FlipGameID) string {
	return fmt.Sprintf("%s%s", gameIDTopicNamePrefix, gameID)
}

var errFailedToParse = errors.New("failed to parse")

func (m *FlipManager) parseMultiDie(arg string, nPlayersApprox int) (start flip.Start, err error) {
	lb := new(big.Int)
	val, ok := lb.SetString(arg, 0)
	if !ok {
		return start, errFailedToParse
	}
	// needs to be a positive number > 0
	if val.Sign() <= 0 {
		return start, errFailedToParse
	}
	return flip.NewStartWithBigInt(m.clock.Now(), val, nPlayersApprox), nil
}

func (m *FlipManager) parseShuffle(arg string, nPlayersApprox int) (start flip.Start, metadata flipTextMetadata, err error) {
	if strings.Contains(arg, ",") {
		var shuffleItems []string
		for _, tok := range strings.Split(arg, ",") {
			shuffleItems = append(shuffleItems, strings.Trim(tok, " "))
		}
		return flip.NewStartWithShuffle(m.clock.Now(), int64(len(shuffleItems)), nPlayersApprox),
			flipTextMetadata{
				ShuffleItems: shuffleItems,
			}, nil
	}
	return start, metadata, errFailedToParse
}

func (m *FlipManager) parseRange(arg string, nPlayersApprox int) (start flip.Start, metadata flipTextMetadata, err error) {
	if !strings.Contains(arg, "..") || strings.Contains(arg, ",") {
		return start, metadata, errFailedToParse
	}
	toks := strings.Split(arg, "..")
	if len(toks) != 2 {
		return start, metadata, errFailedToParse
	}
	lb, ok := new(big.Int).SetString(toks[0], 0)
	if !ok {
		return start, metadata, errFailedToParse
	}
	ub, ok := new(big.Int).SetString(toks[1], 0)
	if !ok {
		return start, metadata, errFailedToParse
	}
	one := new(big.Int).SetInt64(1)
	diff := new(big.Int)
	diff.Sub(ub, lb)
	diff = diff.Add(diff, one)
	if diff.Sign() <= 0 {
		return start, metadata, errFailedToParse
	}
	return flip.NewStartWithBigInt(m.clock.Now(), diff, nPlayersApprox), flipTextMetadata{
		LowerBound: lb.String(),
	}, nil
}

func (m *FlipManager) parseSpecials(arg string, nPlayersApprox int) (start flip.Start, metadata flipTextMetadata, err error) {
	switch {
	case strings.HasPrefix(arg, "cards"):
		deckShuffle, deckShuffleMetadata, _ := m.parseShuffle("2♠️,3♠️,4♠️,5♠️,6♠️,7♠️,8♠️,9♠️,10♠️,J♠️,Q♠️,K♠️,A♠️,2♣️,3♣️,4♣️,5♣️,6♣️,7♣️,8♣️,9♣️,10♣️,J♣️,Q♣️,K♣️,A♣️,2♦️,3♦️,4♦️,5♦️,6♦️,7♦️,8♦️,9♦️,10♦️,J♦️,Q♦️,K♦️,A♦️,2♥️,3♥️,4♥️,5♥️,6♥️,7♥️,8♥️,9♥️,10♥️,J♥️,Q♥️,K♥️,A♥️", nPlayersApprox)
		deckShuffleMetadata.DeckShuffle = true
		if arg == "cards" {
			return deckShuffle, deckShuffleMetadata, nil
		}
		toks := strings.Split(arg, " ")
		if len(toks) < 3 {
			return deckShuffle, deckShuffleMetadata, nil
		}
		handCount, err := strconv.ParseUint(toks[1], 0, 0)
		if err != nil {
			return deckShuffle, deckShuffleMetadata, nil
		}
		return deckShuffle, flipTextMetadata{
			ShuffleItems:  deckShuffleMetadata.ShuffleItems,
			HandCardCount: uint(handCount),
			HandTargets:   toks[2:],
		}, nil
	}
	return start, metadata, errFailedToParse
}

func (m *FlipManager) startFromText(text string, nPlayersApprox int) (start flip.Start, metadata flipTextMetadata) {
	var err error
	toks := strings.Split(strings.TrimRight(text, " "), " ")
	if len(toks) == 1 {
		return flip.NewStartWithBool(m.clock.Now(), nPlayersApprox), flipTextMetadata{}
	}
	// Combine into one argument if there is more than one
	arg := strings.Join(toks[1:], " ")
	// Check for special flips
	if start, metadata, err = m.parseSpecials(arg, nPlayersApprox); err == nil {
		return start, metadata
	}
	// Check for /flip 20
	if start, err = m.parseMultiDie(arg, nPlayersApprox); err == nil {
		return start, flipTextMetadata{
			LowerBound: "1",
		}
	}
	// Check for /flip mikem,karenm,lisam
	if start, metadata, err = m.parseShuffle(arg, nPlayersApprox); err == nil {
		return start, metadata
	}
	// Check for /flip 2..8
	if start, metadata, err = m.parseRange(arg, nPlayersApprox); err == nil {
		return start, metadata
	}
	// Just shuffle the one unknown thing
	return flip.NewStartWithShuffle(m.clock.Now(), 1, nPlayersApprox), flipTextMetadata{
		ShuffleItems: []string{arg},
	}
}

func (m *FlipManager) getHostMessageInfo(ctx context.Context, convID chat1.ConversationID) (res hostMessageInfo, err error) {
	m.Debug(ctx, "getHostMessageInfo: getting host message info for: %s", convID)
	uid, err := utils.AssertLoggedInUID(ctx, m.G())
	if err != nil {
		return res, err
	}
	reason := chat1.GetThreadReason_COINFLIP
	msg, err := m.G().ChatHelper.GetMessage(ctx, uid, convID, 2, false, &reason)
	if err != nil {
		return res, err
	}
	if !msg.IsValid() {
		return res, errors.New("host message invalid")
	}
	if !msg.Valid().MessageBody.IsType(chat1.MessageType_FLIP) {
		return res, fmt.Errorf("invalid host message type: %v", msg.GetMessageType())
	}
	body := msg.Valid().MessageBody.Flip().Text
	if err := json.Unmarshal([]byte(body), &res); err != nil {
		return res, err
	}
	return res, nil
}

func (m *FlipManager) DescribeFlipText(ctx context.Context, text string) string {
	defer m.Trace(ctx, func() error { return nil }, "DescribeFlipText")()
	start, metadata := m.startFromText(text, 0)
	typ, err := start.Params.T()
	if err != nil {
		m.Debug(ctx, "DescribeFlipText: failed get start typ: %s", err)
		return ""
	}
	switch typ {
	case flip.FlipType_BIG:
		if metadata.LowerBound == "1" {
			return fmt.Sprintf("*%s-sided die roll*", new(big.Int).SetBytes(start.Params.Big()))
		}
		lb, _ := new(big.Int).SetString(metadata.LowerBound, 0)
		ub := new(big.Int).Sub(new(big.Int).SetBytes(start.Params.Big()), new(big.Int).SetInt64(1))
		return fmt.Sprintf("*Number in range %s..%s*", metadata.LowerBound,
			new(big.Int).Add(lb, ub))
	case flip.FlipType_BOOL:
		return "*HEADS* or *TAILS*"
	case flip.FlipType_SHUFFLE:
		if metadata.DeckShuffle {
			return "*Shuffling a deck of cards*"
		} else if metadata.HandCardCount > 0 {
			return fmt.Sprintf("*Dealing hands of %d cards*", metadata.HandCardCount)
		}
		return fmt.Sprintf("*Shuffling %s*",
			strings.TrimRight(strings.Join(metadata.ShuffleItems, ", "), " "))
	}
	return ""
}

// StartFlip implements the types.CoinFlipManager interface
func (m *FlipManager) StartFlip(ctx context.Context, uid gregor1.UID, hostConvID chat1.ConversationID,
	tlfName, text string) (err error) {
	defer m.Trace(ctx, func() error { return err }, "StartFlip: convID: %s", hostConvID)()
	gameID := flip.GenerateGameID()
	m.Debug(ctx, "StartFlip: using gameID: %s", gameID)

	// Get host conv using local storage, just bail out if we don't have it
	hostConv, err := utils.GetUnverifiedConv(ctx, m.G(), uid, hostConvID,
		types.InboxSourceDataSourceLocalOnly)
	if err != nil {
		return err
	}

	// First generate the message representing the flip into the host conversation. We also wait for it
	// to actually get sent before doing anything flip related.
	outboxID, err := storage.NewOutboxID()
	if err != nil {
		return err
	}
	listener := newSentMessageListener(m.G(), outboxID)
	nid := m.G().NotifyRouter.AddListener(listener)
	if _, err = m.G().ChatHelper.SendMsgByIDNonblock(ctx, hostConvID, tlfName,
		chat1.NewMessageBodyWithFlip(chat1.MessageFlip{
			Text:   text,
			GameID: gameID,
		}), chat1.MessageType_FLIP, &outboxID); err != nil {
		return err
	}
	sendRes := <-listener.listenCh
	if sendRes.Err != nil {
		return sendRes.Err
	}
	m.G().NotifyRouter.RemoveListener(nid)

	// Generate dev channel for game messages
	topicName := m.gameTopicNameFromGameID(gameID)
	conv, err := m.G().ChatHelper.NewConversationWithMemberSourceConv(ctx, uid, tlfName, &topicName,
		chat1.TopicType_DEV, hostConv.GetMembersType(),
		keybase1.TLFVisibility_PRIVATE, &hostConvID)
	if err != nil {
		return err
	}

	nPlayersApprox := len(hostConv.Conv.Metadata.AllList)
	m.Debug(ctx, "StartFlip: generating parameters for %d players", nPlayersApprox)

	// Preserve the ephemeral lifetime from the conv/message to the game
	// conversation.
	if elf, err := utils.EphemeralLifetimeFromConv(ctx, m.G(), hostConv.Conv); err != nil {
		m.Debug(ctx, "StartFlip: failed to get ephemeral lifetime from conv: %s", err)
		return err
	} else if elf != nil {
		m.Debug(ctx, "StartFlip: setting ephemeral retention for conv: %v", *elf)
		if m.ri().SetConvRetention(ctx, chat1.SetConvRetentionArg{
			ConvID: conv.GetConvID(),
			Policy: chat1.NewRetentionPolicyWithEphemeral(chat1.RpEphemeral{Age: *elf}),
		}); err != nil {
			return err
		}
	}

	// Record metadata of the host message into the game thread as the first message
	start, metadata := m.startFromText(text, nPlayersApprox)
	infoBody, err := json.Marshal(hostMessageInfo{
		flipTextMetadata: metadata,
		ConvID:           hostConvID,
		MsgID:            sendRes.MsgID,
	})
	if err != nil {
		return err
	}
	if err := m.G().ChatHelper.SendMsgByID(ctx, conv.GetConvID(), tlfName,
		chat1.NewMessageBodyWithFlip(chat1.MessageFlip{
			Text:   string(infoBody),
			GameID: gameID,
		}), chat1.MessageType_FLIP); err != nil {
		return err
	}

	// Start the game
	return m.dealer.StartFlipWithGameID(ctx, start, conv.GetConvID(), gameID)
}

// MaybeInjectFlipMessage implements the types.CoinFlipManager interface
func (m *FlipManager) MaybeInjectFlipMessage(ctx context.Context, boxedMsg chat1.MessageBoxed,
	inboxVers chat1.InboxVers, uid gregor1.UID, convID chat1.ConversationID, topicType chat1.TopicType) bool {
	// earliest of outs if this isn't a dev convo, an error, or the outbox ID message
	if topicType != chat1.TopicType_DEV || boxedMsg.GetMessageType() != chat1.MessageType_FLIP ||
		m.isHostMessageInfoMsgID(boxedMsg.GetMessageID()) {
		return false
	}
	defer m.Trace(ctx, func() error { return nil }, "MaybeInjectFlipMessage: convID: %s", convID)()
	// Update inbox for this guy
	if err := m.G().InboxSource.UpdateInboxVersion(ctx, uid, inboxVers); err != nil {
		m.Debug(ctx, "MaybeInjectFlipMessage: failed to update inbox version: %s", err)
		// charge forward here, we will figure it out
	}
	// Unbox the message
	conv, err := utils.GetUnverifiedConv(ctx, m.G(), uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		m.Debug(ctx, "MaybeInjectFlipMessage: failed to get conversation for unbox: %s", err)
		return true
	}
	msg, err := NewBoxer(m.G()).UnboxMessage(ctx, boxedMsg, conv.Conv, nil)
	if err != nil {
		m.Debug(ctx, "MaybeInjectFlipMessage: failed to unbox: %s", err)
		return true
	}
	if err := storage.New(m.G(), nil).SetMaxMsgID(ctx, convID, uid, msg.GetMessageID()); err != nil {
		m.Debug(ctx, "MaybeInjectFlipMessage: failed to write max msgid: %s", err)
		// charge forward from this error
	}
	// Ignore anything from the current device
	sender := flip.UserDevice{
		U: msg.Valid().ClientHeader.Sender,
		D: msg.Valid().ClientHeader.SenderDevice,
	}
	if sender.Eq(m.Me()) {
		return true
	}
	body := msg.Valid().MessageBody
	if !body.IsType(chat1.MessageType_FLIP) {
		m.Debug(ctx, "MaybeInjectFlipMessage: bogus flip message with a non-flip body")
		return true
	}
	if err := m.dealer.InjectIncomingChat(ctx, sender, convID, body.Flip().GameID,
		flip.MakeGameMessageEncoded(body.Flip().Text), m.isStartMsgID(msg.GetMessageID())); err != nil {
		m.Debug(ctx, "MaybeInjectFlipMessage: failed to inject: %s", err)
	}
	return true
}

func (m *FlipManager) loadGame(ctx context.Context, job loadGameJob) (err error) {
	defer m.Trace(ctx, func() error { return err }, "loadGame: convID: %s gameID: %s",
		job.convID, job.gameID)()
	// Attempt to find the conversation for the game ID
	conv, err := utils.GetVerifiedConv(ctx, m.G(), job.uid, job.convID,
		types.InboxSourceDataSourceAll)
	if err != nil {
		m.Debug(ctx, "loadGame: failed to load conv for job: %s", err)
		return err
	}
	topicName := m.gameTopicNameFromGameID(job.gameID)
	flipConvs, err := m.G().ChatHelper.FindConversations(ctx, conv.Info.TlfName,
		&topicName, chat1.TopicType_DEV, conv.GetMembersType(), keybase1.TLFVisibility_PRIVATE)
	if err != nil {
		m.Debug(ctx, "loadGame: failure finding flip conv: %s", err)
		return err
	}
	if len(flipConvs) != 1 {
		m.Debug(ctx, "loadGame: bad number of convs: num: %d", len(flipConvs))
		return errors.New("no conv found")
	}
	flipConv := flipConvs[0]
	tv, err := m.G().ConvSource.PullFull(ctx, flipConv.GetConvID(), job.uid,
		chat1.GetThreadReason_COINFLIP, nil, nil)
	if err != nil {
		m.Debug(ctx, "loadGame: failed to pull thread:  %s", err)
		return err
	}
	if len(tv.Messages) < 3 {
		m.Debug(ctx, "loadGame: not enough messages to replay")
		return errors.New("not enough messages")
	}
	var history flip.GameHistory
	for index := len(tv.Messages) - 3; index >= 0; index-- {
		msg := tv.Messages[index]
		if !msg.IsValid() {
			m.Debug(ctx, "loadGame: skipping invalid message: id: %d", msg.GetMessageID())
			continue
		}
		body := msg.Valid().MessageBody
		if !body.IsType(chat1.MessageType_FLIP) {
			continue
		}
		history = append(history, flip.GameMessageReplayed{
			GameMessageWrappedEncoded: flip.GameMessageWrappedEncoded{
				Sender: flip.UserDevice{
					U: msg.Valid().ClientHeader.Sender,
					D: msg.Valid().ClientHeader.SenderDevice,
				},
				GameID:              job.gameID,
				Body:                flip.MakeGameMessageEncoded(body.Flip().Text),
				FirstInConversation: m.isStartMsgID(msg.GetMessageID()),
			},
			Time: msg.Valid().ServerHeader.Ctime.Time(),
		})
	}
	m.Debug(ctx, "loadGame: playing back %d messages from history", len(history))
	summary, err := flip.Replay(ctx, m, history)
	if err != nil {
		m.Debug(ctx, "loadGame: failed to replay history: %s", err)
		// Make sure we aren't current playing this game, and bail out if we are
		if m.dealer.IsGameActive(ctx, flipConv.GetConvID(), job.gameID) {
			m.Debug(ctx, "loadGame: game is currently active, bailing out")
			return nil
		}
		summary = &flip.GameSummary{
			Err: fmt.Errorf("Replay failed: %s", err),
		}
	}
	m.handleSummaryUpdate(ctx, job.gameID, summary, flipConv.GetConvID(), true)
	return nil
}

func (m *FlipManager) loadGameLoop(shutdownCh chan struct{}) {
	for {
		select {
		case job := <-m.loadGameCh:
			ctx := m.makeBkgContext()
			if err := m.loadGame(ctx, job); err != nil {
				m.Debug(ctx, "loadGameLoop: failed to load game: %s", err)
			}
		case <-shutdownCh:
			return
		}
	}
}

// LoadFlip implements the types.CoinFlipManager interface
func (m *FlipManager) LoadFlip(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	gameID chat1.FlipGameID) {
	defer m.Trace(ctx, func() error { return nil }, "LoadFlip")()
	_, ok := m.games.Get(gameID.String())
	if ok {
		m.queueDirtyGameID(gameID, true)
		return
	}
	// If we miss the in-memory game storage, attempt to replay the game
	m.loadGameCh <- loadGameJob{
		gameID: gameID,
		uid:    uid,
		convID: convID,
	}
}

// CLogf implements the flip.DealersHelper interface
func (m *FlipManager) CLogf(ctx context.Context, fmt string, args ...interface{}) {
	m.Debug(ctx, fmt, args...)
}

// Clock implements the flip.DealersHelper interface
func (m *FlipManager) Clock() clockwork.Clock {
	return m.clock
}

// ServerTime implements the flip.DealersHelper interface
func (m *FlipManager) ServerTime(ctx context.Context) (res time.Time, err error) {
	ctx = Context(ctx, m.G(), keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil, nil)
	defer m.Trace(ctx, func() error { return err }, "ServerTime")()
	sres, err := m.ri().ServerNow(ctx)
	if err != nil {
		return res, err
	}
	return sres.Now.Time(), nil
}

// SendChat implements the flip.DealersHelper interface
func (m *FlipManager) SendChat(ctx context.Context, convID chat1.ConversationID, gameID chat1.FlipGameID,
	msg flip.GameMessageEncoded) (err error) {
	ctx = Context(ctx, m.G(), keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil, nil)
	defer m.Trace(ctx, func() error { return err }, "SendChat: convID: %s", convID)()
	uid, err := utils.AssertLoggedInUID(ctx, m.G())
	if err != nil {
		return err
	}
	conv, err := utils.GetVerifiedConv(ctx, m.G(), uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return err
	}
	_, err = m.G().ChatHelper.SendMsgByIDNonblock(ctx, convID, conv.Info.TlfName,
		chat1.NewMessageBodyWithFlip(chat1.MessageFlip{
			Text:   msg.String(),
			GameID: gameID,
		}), chat1.MessageType_FLIP, nil)
	return err
}

func (m *FlipManager) Me() flip.UserDevice {
	ad := m.G().ActiveDevice
	did := ad.DeviceID()
	hdid := make([]byte, libkb.DeviceIDLen)
	if err := did.ToBytes(hdid); err != nil {
		return flip.UserDevice{}
	}
	return flip.UserDevice{
		U: gregor1.UID(ad.UID().ToBytes()),
		D: gregor1.DeviceID(hdid),
	}
}

// clearGameCache should only be used by tests
func (m *FlipManager) clearGameCache() {
	m.games.Purge()
}

type FlipVisualizer struct {
	width, height         int
	commitmentColors      [256]color.RGBA
	secretColors          [256]color.RGBA
	commitmentMatchColors [256]color.RGBA
}

func NewFlipVisualizer(width, height int) *FlipVisualizer {
	v := &FlipVisualizer{
		height: height, // 50
		width:  width,  // 128
	}
	for i := 0; i < 256; i++ {
		v.commitmentColors[i] = color.RGBA{
			R: uint8(i),
			G: uint8((128 + i*5) % 128),
			B: 255,
			A: 128,
		}
		v.secretColors[i] = color.RGBA{
			R: 255,
			G: uint8(64 + i/2),
			B: 0,
			A: 255,
		}
		v.commitmentMatchColors[i] = color.RGBA{
			R: uint8(i * 3 / 4),
			G: uint8((192 + i*4) % 64),
			B: 255,
			A: 255,
		}
	}
	return v
}

func (v *FlipVisualizer) fillCell(img *image.NRGBA, x, y, cellHeight, cellWidth int, b byte,
	palette [256]color.RGBA) {
	for i := x; i < x+cellWidth; i++ {
		for j := y; j < y+cellHeight; j++ {
			img.Set(i, j, palette[b])
		}
	}
}

func (v *FlipVisualizer) fillRow(img *image.NRGBA, startY, cellHeight, cellWidth int,
	source string, palette [256]color.RGBA) {
	b, _ := hex.DecodeString(source)
	x := 0
	for i := 0; i < len(b); i++ {
		v.fillCell(img, x, startY, cellHeight, cellWidth, b[i], palette)
		x += cellWidth
	}
}

func (v *FlipVisualizer) Visualize(status *chat1.UICoinFlipStatus) {
	cellWidth := int(math.Round(float64(v.width) / 32.0))
	v.width = 32 * cellWidth
	commitmentImg := image.NewNRGBA(image.Rect(0, 0, v.width, v.height))
	secretImg := image.NewNRGBA(image.Rect(0, 0, v.width, v.height))
	numParts := len(status.Participants)
	if numParts > 0 {
		startY := 0
		// just add these next 2 things
		heightAccum := float64(0) // how far into the image we should be
		rawRowHeight := float64(v.height) / float64(numParts)
		for _, p := range status.Participants {
			heightAccum += rawRowHeight
			rowHeight := int(math.Round(heightAccum - float64(startY)))
			if rowHeight > 0 {
				if p.Reveal != nil {
					v.fillRow(commitmentImg, startY, rowHeight, cellWidth, p.Commitment,
						v.commitmentMatchColors)
					v.fillRow(secretImg, startY, rowHeight, cellWidth, *p.Reveal, v.secretColors)
				} else {
					v.fillRow(commitmentImg, startY, rowHeight, cellWidth, p.Commitment, v.commitmentColors)
				}
				startY += rowHeight
			}
		}
	}
	var commitmentBuf, secretBuf bytes.Buffer
	png.Encode(&commitmentBuf, commitmentImg)
	png.Encode(&secretBuf, secretImg)
	status.CommitmentVisualization = base64.StdEncoding.EncodeToString(commitmentBuf.Bytes())
	status.RevealVisualization = base64.StdEncoding.EncodeToString(secretBuf.Bytes())
}
