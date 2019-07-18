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

type startFlipSendStatus struct {
	status     types.FlipSendStatus
	flipConvID chat1.ConversationID
}

func newSentMessageListener(g *globals.Context, outboxID chat1.OutboxID) *sentMessageListener {
	return &sentMessageListener{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "sentMessageListener", false),
		outboxID:     outboxID,
		listenCh:     make(chan sentMessageResult, 10),
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
	LowerBound        string
	ShuffleItems      []string
	DeckShuffle       bool
	HandCardCount     uint
	HandTargets       []string
	ConvMemberShuffle bool
}

type hostMessageInfo struct {
	flipTextMetadata
	ConvID chat1.ConversationID
	MsgID  chat1.MessageID
}

type loadGameJob struct {
	uid        gregor1.UID
	hostConvID chat1.ConversationID
	hostMsgID  chat1.MessageID
	gameID     chat1.FlipGameID
	flipConvID chat1.ConversationID
	resCh      chan chat1.UICoinFlipStatus
	errCh      chan error
}

type convParticipationsRateLimit struct {
	count int
	reset time.Time
}

type FlipManager struct {
	globals.Contextified
	utils.DebugLabeler

	dealer           *flip.Dealer
	visualizer       *FlipVisualizer
	clock            clockwork.Clock
	ri               func() chat1.RemoteInterface
	started          bool
	shutdownMu       sync.Mutex
	shutdownCh       chan struct{}
	dealerShutdownCh chan struct{}
	dealerCancel     context.CancelFunc
	forceCh          chan struct{}
	loadGameCh       chan loadGameJob
	maybeInjectCh    chan func()

	deck           string
	cardMap        map[string]int
	cardReverseMap map[int]string

	gamesMu        sync.Mutex
	games          *lru.Cache
	dirtyGames     map[string]chat1.FlipGameID
	flipConvs      *lru.Cache
	gameMsgIDs     *lru.Cache
	gameOutboxIDMu sync.Mutex
	gameOutboxIDs  *lru.Cache

	partMu                     sync.Mutex
	maxConvParticipations      int
	maxConvParticipationsReset time.Duration
	convParticipations         map[string]convParticipationsRateLimit

	// testing only
	testingServerClock clockwork.Clock
}

func NewFlipManager(g *globals.Context, ri func() chat1.RemoteInterface) *FlipManager {
	games, _ := lru.New(200)
	flipConvs, _ := lru.New(200)
	gameMsgIDs, _ := lru.New(200)
	gameOutboxIDs, _ := lru.New(200)
	m := &FlipManager{
		Contextified:               globals.NewContextified(g),
		DebugLabeler:               utils.NewDebugLabeler(g.GetLog(), "FlipManager", false),
		ri:                         ri,
		clock:                      clockwork.NewRealClock(),
		games:                      games,
		dirtyGames:                 make(map[string]chat1.FlipGameID),
		forceCh:                    make(chan struct{}, 10),
		loadGameCh:                 make(chan loadGameJob, 200),
		convParticipations:         make(map[string]convParticipationsRateLimit),
		maxConvParticipations:      1000,
		maxConvParticipationsReset: 5 * time.Minute,
		visualizer:                 NewFlipVisualizer(128, 80),
		cardMap:                    make(map[string]int),
		cardReverseMap:             make(map[int]string),
		flipConvs:                  flipConvs,
		gameMsgIDs:                 gameMsgIDs,
		gameOutboxIDs:              gameOutboxIDs,
		maybeInjectCh:              make(chan func(), 2000),
	}
	dealer := flip.NewDealer(m)
	m.dealer = dealer
	m.deck = "2♠️,3♠️,4♠️,5♠️,6♠️,7♠️,8♠️,9♠️,10♠️,J♠️,Q♠️,K♠️,A♠️,2♣️,3♣️,4♣️,5♣️,6♣️,7♣️,8♣️,9♣️,10♣️,J♣️,Q♣️,K♣️,A♣️,2♦️,3♦️,4♦️,5♦️,6♦️,7♦️,8♦️,9♦️,10♦️,J♦️,Q♦️,K♦️,A♦️,2♥️,3♥️,4♥️,5♥️,6♥️,7♥️,8♥️,9♥️,10♥️,J♥️,Q♥️,K♥️,A♥️"
	for index, card := range strings.Split(m.deck, ",") {
		m.cardMap[card] = index
		m.cardReverseMap[index] = card
	}
	return m
}

func (m *FlipManager) Start(ctx context.Context, uid gregor1.UID) {
	defer m.Trace(ctx, func() error { return nil }, "Start")()
	m.shutdownMu.Lock()
	if m.started {
		m.shutdownMu.Unlock()
		return
	}
	m.started = true
	var dealerCtx context.Context
	shutdownCh := make(chan struct{})
	dealerShutdownCh := make(chan struct{})
	m.shutdownCh = shutdownCh
	m.dealerShutdownCh = dealerShutdownCh
	dealerCtx, m.dealerCancel = context.WithCancel(context.Background())
	m.shutdownMu.Unlock()

	go func(shutdownCh chan struct{}) {
		m.dealer.Run(dealerCtx)
		close(shutdownCh)
	}(dealerShutdownCh)
	go m.updateLoop(shutdownCh)
	go m.notificationLoop(shutdownCh)
	go m.loadGameLoop(shutdownCh)
	go m.maybeInjectLoop(shutdownCh)
}

func (m *FlipManager) Stop(ctx context.Context) (ch chan struct{}) {
	defer m.Trace(ctx, func() error { return nil }, "Stop")()
	m.dealer.Stop()

	m.shutdownMu.Lock()
	defer m.shutdownMu.Unlock()
	m.started = false
	if m.shutdownCh != nil {
		m.dealerCancel()
		close(m.shutdownCh)
		m.shutdownCh = nil
	}
	if m.dealerShutdownCh != nil {
		ch = m.dealerShutdownCh
		m.dealerShutdownCh = nil
	} else {
		ch = make(chan struct{})
		close(ch)
	}
	return ch
}

func (m *FlipManager) makeBkgContext() context.Context {
	ctx := context.Background()
	return globals.ChatCtx(ctx, m.G(), keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil, nil)
}

func (m *FlipManager) isHostMessageInfoMsgID(msgID chat1.MessageID) bool {
	// The first message in a flip thread is metadata about the flip, which is
	// message ID 2 since conversations have an initial message from creation.
	return chat1.MessageID(2) == msgID
}

func (m *FlipManager) startMsgID() chat1.MessageID {
	return chat1.MessageID(3)
}

func (m *FlipManager) isStartMsgID(msgID chat1.MessageID) bool {
	// The first message after the host message is the flip start message,
	// which will have message ID 3
	return m.startMsgID() == msgID
}

func (m *FlipManager) getVisualizer() *FlipVisualizer {
	return m.visualizer
}

func (m *FlipManager) notifyDirtyGames() {
	m.gamesMu.Lock()
	if len(m.dirtyGames) == 0 {
		m.gamesMu.Unlock()
		return
	}
	dirtyGames := m.dirtyGames
	m.dirtyGames = make(map[string]chat1.FlipGameID)
	m.gamesMu.Unlock()

	ctx := m.makeBkgContext()
	ui, err := m.G().UIRouter.GetChatUI()
	if err != nil || ui == nil {
		m.Debug(ctx, "notifyDirtyGames: no chat UI available for notification")
		return
	}
	var updates []chat1.UICoinFlipStatus
	m.Debug(ctx, "notifyDirtyGames: notifying about %d games", len(dirtyGames))
	for _, dg := range dirtyGames {
		if game, ok := m.games.Get(dg.String()); ok {
			status := game.(chat1.UICoinFlipStatus)
			m.getVisualizer().Visualize(&status)
			presentStatus := status.DeepCopy()
			m.sortParticipants(&presentStatus)
			updates = append(updates, presentStatus)
		}
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := ui.ChatCoinFlipStatus(ctx, updates); err != nil {
		m.Debug(ctx, "notifyDirtyGames: failed to notify status: %s", err)
	} else {
		m.Debug(ctx, "notifyDirtyGames: UI notified")
	}
}

func (m *FlipManager) notificationLoop(shutdownCh chan struct{}) {
	duration := 50 * time.Millisecond
	next := m.clock.Now().Add(duration)
	m.Debug(context.Background(), "notificationLoop: starting")
	for {
		select {
		case <-m.clock.AfterTime(next):
			m.notifyDirtyGames()
			next = m.clock.Now().Add(duration)
		case <-m.forceCh:
			m.notifyDirtyGames()
			next = m.clock.Now().Add(duration)
		case <-shutdownCh:
			m.Debug(context.Background(), "notificationLoop: exiting")
			return
		}
	}
}

func (m *FlipManager) sortParticipants(status *chat1.UICoinFlipStatus) {
	sort.Slice(status.Participants, func(i, j int) bool {
		return status.Participants[i].Username < status.Participants[j].Username
	})
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
	endingS := ""
	if len(status.Participants) > 1 {
		endingS = "s"
	}
	status.ProgressText = fmt.Sprintf("Gathered %d commitment%s", len(status.Participants), endingS)
}

func (m *FlipManager) finalizeParticipants(ctx context.Context, status *chat1.UICoinFlipStatus,
	cc flip.CommitmentComplete) {
	completeMap := make(map[string]bool)
	mapKey := func(u, d string) string {
		return u + "," + d
	}
	for _, p := range cc.Players {
		completeMap[mapKey(p.Ud.U.String(), p.Ud.D.String())] = true
	}
	var filteredParts []chat1.UICoinFlipParticipant
	for _, p := range status.Participants {
		if completeMap[mapKey(p.Uid, p.DeviceID)] {
			filteredParts = append(filteredParts, p)
		}
	}
	filteredMap := make(map[string]bool)
	for _, p := range filteredParts {
		filteredMap[mapKey(p.Uid, p.DeviceID)] = true
	}
	status.Participants = filteredParts
	for _, p := range cc.Players {
		if !filteredMap[mapKey(p.Ud.U.String(), p.Ud.D.String())] {
			m.addParticipant(ctx, status, flip.CommitmentUpdate{
				User:       p.Ud,
				Commitment: p.C,
			})
		}
	}
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

func (m *FlipManager) cardIndex(card string) (int, error) {
	if index, ok := m.cardMap[card]; ok {
		return index, nil
	}
	return 0, fmt.Errorf("unknown card: %s", card)
}

func (m *FlipManager) addCardHandResult(ctx context.Context, status *chat1.UICoinFlipStatus,
	result flip.Result, hmi hostMessageInfo) {
	deckIndex := 0
	numCards := len(result.Shuffle)
	handSize := int(hmi.HandCardCount)
	var uiHandResult []chat1.UICoinFlipHand
	for _, target := range hmi.HandTargets {
		if numCards-handSize < deckIndex {
			uiHandResult = append(uiHandResult, chat1.UICoinFlipHand{
				Target: target,
			})
			continue
		}
		var hand []string
		uiHand := chat1.UICoinFlipHand{
			Target: target,
		}
		for di := deckIndex; di < deckIndex+handSize; di++ {
			card := hmi.ShuffleItems[result.Shuffle[di]]
			hand = append(hand, card)
			cardIndex, err := m.cardIndex(card)
			if err != nil {
				m.Debug(ctx, "addCardHandResult: failed to get card: %s", err)
				m.setGenericError(status, "Failed to describe card hand result")
				return
			}
			uiHand.Hand = append(uiHand.Hand, cardIndex)
		}
		uiHandResult = append(uiHandResult, uiHand)
		deckIndex += handSize
	}
	resultInfo := chat1.NewUICoinFlipResultWithHands(uiHandResult)
	status.ResultInfo = &resultInfo
}

func (m *FlipManager) setGenericError(status *chat1.UICoinFlipStatus, errMsg string) {
	status.Phase = chat1.UICoinFlipPhase_ERROR
	status.ProgressText = errMsg
	errorInfo := chat1.NewUICoinFlipErrorWithGeneric(status.ProgressText)
	status.ErrorInfo = &errorInfo
}

func (m *FlipManager) resultToText(result chat1.UICoinFlipResult) string {
	typ, err := result.Typ()
	if err != nil {
		return ""
	}
	switch typ {
	case chat1.UICoinFlipResultTyp_COIN:
		if result.Coin() {
			return "HEADS"
		}
		return "TAILS"
	case chat1.UICoinFlipResultTyp_NUMBER:
		return result.Number()
	case chat1.UICoinFlipResultTyp_DECK:
		var cards []string
		for _, cardIndex := range result.Deck() {
			cards = append(cards, m.cardReverseMap[cardIndex])
		}
		return strings.TrimRight(strings.Join(cards, ", "), " ")
	case chat1.UICoinFlipResultTyp_SHUFFLE:
		return strings.TrimRight(strings.Join(result.Shuffle(), ", "), " ")
	case chat1.UICoinFlipResultTyp_HANDS:
		var rows []string
		for index, hand := range result.Hands() {
			if len(hand.Hand) == 0 {
				rows = append(rows, fmt.Sprintf("%d. %s: 🤨", index+1, hand.Target))
			} else {
				var cards []string
				for _, cardIndex := range hand.Hand {
					cards = append(cards, m.cardReverseMap[cardIndex])
				}
				rows = append(rows, fmt.Sprintf("%d. %s: %s", index+1, hand.Target,
					strings.TrimRight(strings.Join(cards, ", "), " ")))
			}
		}
		return strings.Join(rows, "\n")
	}
	return ""
}

func (m *FlipManager) addResult(ctx context.Context, status *chat1.UICoinFlipStatus, result flip.Result,
	convID chat1.ConversationID) {
	defer func() {
		if status.ResultInfo != nil {
			status.ResultText = m.resultToText(*status.ResultInfo)
		}
		if len(status.ResultText) > 0 {
			status.ProgressText += " (complete)"
		}
	}()
	hmi, err := m.getHostMessageInfo(ctx, convID)
	switch {
	case err != nil:
		m.Debug(ctx, "addResult: failed to describe result: %s", err)
		m.setGenericError(status, "Failed to describe result")
	case result.Big != nil:
		lb := new(big.Int)
		res := new(big.Int)
		lb.SetString(hmi.LowerBound, 0)
		res.Add(lb, result.Big)
		resultInfo := chat1.NewUICoinFlipResultWithNumber(res.String())
		status.ResultInfo = &resultInfo
	case result.Bool != nil:
		resultInfo := chat1.NewUICoinFlipResultWithCoin(*result.Bool)
		status.ResultInfo = &resultInfo
	case result.Int != nil:
		resultInfo := chat1.NewUICoinFlipResultWithNumber(fmt.Sprintf("%d", *result.Int))
		status.ResultInfo = &resultInfo
	case len(result.Shuffle) > 0:
		if hmi.HandCardCount > 0 {
			m.addCardHandResult(ctx, status, result, hmi)
			return
		}
		if len(hmi.ShuffleItems) != len(result.Shuffle) {
			m.setGenericError(status, "Failed to describe shuffle result")
			return
		}
		items := make([]string, len(hmi.ShuffleItems))
		for index, r := range result.Shuffle {
			items[index] = hmi.ShuffleItems[r]
		}
		var resultInfo chat1.UICoinFlipResult
		if hmi.DeckShuffle {
			var cardIndexes []int
			for _, card := range items {
				cardIndex, err := m.cardIndex(card)
				if err != nil {
					m.Debug(ctx, "addResult: failed to get card: %s", err)
					m.setGenericError(status, "Failed to describe deck result")
					return
				}
				cardIndexes = append(cardIndexes, cardIndex)
			}
			resultInfo = chat1.NewUICoinFlipResultWithDeck(cardIndexes)
		} else {
			resultInfo = chat1.NewUICoinFlipResultWithShuffle(items)
		}
		status.ResultInfo = &resultInfo
	}
}

func (m *FlipManager) queueDirtyGameID(ctx context.Context, gameID chat1.FlipGameID, force bool) {
	m.gamesMu.Lock()
	m.dirtyGames[gameID.String()] = gameID
	m.gamesMu.Unlock()
	if force {
		select {
		case m.forceCh <- struct{}{}:
		default:
			m.Debug(ctx, "queueDirtyGameID: failed to write onto forceCh!")
		}
	}
}

func (m *FlipManager) getErrorParticipant(ctx context.Context, a flip.UserDevice) chat1.UICoinFlipErrorParticipant {
	username, deviceName, _, err := m.G().GetUPAKLoader().LookupUsernameAndDevice(ctx,
		keybase1.UID(a.U.String()), keybase1.DeviceID(a.D.String()))
	if err != nil {
		m.Debug(ctx, "getErrorParticipant: failed to get names: %s", err)
		return chat1.UICoinFlipErrorParticipant{
			User:   a.U.String(),
			Device: a.D.String(),
		}
	}
	return chat1.UICoinFlipErrorParticipant{
		User:   username.String(),
		Device: deviceName,
	}

}

func (m *FlipManager) formatError(ctx context.Context, rawErr error) chat1.UICoinFlipError {
	switch terr := rawErr.(type) {
	case flip.AbsenteesError:
		// lookup all the absentees
		var absentees []chat1.UICoinFlipErrorParticipant
		for _, a := range terr.Absentees {
			absentees = append(absentees, m.getErrorParticipant(ctx, a))
		}
		return chat1.NewUICoinFlipErrorWithAbsentee(chat1.UICoinFlipAbsenteeError{
			Absentees: absentees,
		})
	case flip.TimeoutError:
		return chat1.NewUICoinFlipErrorWithTimeout()
	case flip.GameAbortedError:
		return chat1.NewUICoinFlipErrorWithAborted()
	case flip.DuplicateRegistrationError:
		return chat1.NewUICoinFlipErrorWithDupreg(m.getErrorParticipant(ctx, terr.U))
	case flip.DuplicateCommitmentCompleteError:
		return chat1.NewUICoinFlipErrorWithDupcommitcomplete(m.getErrorParticipant(ctx, terr.U))
	case flip.DuplicateRevealError:
		return chat1.NewUICoinFlipErrorWithDupreveal(m.getErrorParticipant(ctx, terr.U))
	case flip.CommitmentMismatchError:
		return chat1.NewUICoinFlipErrorWithCommitmismatch(m.getErrorParticipant(ctx, terr.U))
	}
	return chat1.NewUICoinFlipErrorWithGeneric(rawErr.Error())
}

func (m *FlipManager) handleSummaryUpdate(ctx context.Context, gameID chat1.FlipGameID,
	update *flip.GameSummary, convID chat1.ConversationID, force bool) (status chat1.UICoinFlipStatus) {
	defer m.queueDirtyGameID(ctx, gameID, force)
	if update.Err != nil {
		var parts []chat1.UICoinFlipParticipant
		oldGame, ok := m.games.Get(gameID.String())
		if ok {
			parts = oldGame.(chat1.UICoinFlipStatus).Participants
		}
		formatted := m.formatError(ctx, update.Err)
		status = chat1.UICoinFlipStatus{
			GameID:       gameID.String(),
			Phase:        chat1.UICoinFlipPhase_ERROR,
			ProgressText: fmt.Sprintf("Something went wrong: %s", update.Err),
			Participants: parts,
			ErrorInfo:    &formatted,
		}
		m.games.Add(gameID.String(), status)
		return status
	}
	status = chat1.UICoinFlipStatus{
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
	return status
}

func (m *FlipManager) handleUpdate(ctx context.Context, update flip.GameStateUpdateMessage, force bool) (err error) {
	gameID := update.Metadata.GameID
	defer m.Trace(ctx, func() error { return err }, "handleUpdate: gameID: %s", gameID)()
	defer func() {
		if err == nil {
			m.queueDirtyGameID(ctx, gameID, force)
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
		m.Debug(ctx, "handleUpdate: error received")
		status.Phase = chat1.UICoinFlipPhase_ERROR
		status.ProgressText = fmt.Sprintf("Something went wrong: %s", update.Err)
		formatted := m.formatError(ctx, update.Err)
		status.ErrorInfo = &formatted
	case update.Commitment != nil:
		m.Debug(ctx, "handleUpdate: commit received")
		// Only care about these while we are in the commitment phase
		if status.Phase == chat1.UICoinFlipPhase_COMMITMENT {
			status.ErrorInfo = nil
			status.Phase = chat1.UICoinFlipPhase_COMMITMENT
			m.addParticipant(ctx, &status, *update.Commitment)
		}
	case update.CommitmentComplete != nil:
		m.Debug(ctx, "handleUpdate: complete received")
		status.ErrorInfo = nil
		status.Phase = chat1.UICoinFlipPhase_REVEALS
		m.finalizeParticipants(ctx, &status, *update.CommitmentComplete)
	case update.Reveal != nil:
		m.Debug(ctx, "handleUpdate: reveal received")
		m.addReveal(ctx, &status, *update.Reveal)
	case update.Result != nil:
		m.Debug(ctx, "handleUpdate: result received")
		status.Phase = chat1.UICoinFlipPhase_COMPLETE
		status.ErrorInfo = nil
		m.addResult(ctx, &status, *update.Result, update.Metadata.ConversationID)
	default:
		return errors.New("unknown update kind")
	}
	m.games.Add(gameID.String(), status)
	return nil
}

func (m *FlipManager) updateLoop(shutdownCh chan struct{}) {
	m.Debug(context.Background(), "updateLoop: starting")
	for {
		select {
		case msg := <-m.dealer.UpdateCh():
			m.handleUpdate(m.makeBkgContext(), msg, false)
		case <-shutdownCh:
			m.Debug(context.Background(), "updateLoop: exiting")
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

const shuffleSeparaters = ",，"

func (m *FlipManager) parseShuffle(arg string, nPlayersApprox int) (start flip.Start, metadata flipTextMetadata, err error) {
	if strings.ContainsAny(arg, shuffleSeparaters) {
		var shuffleItems []string
		for _, tok := range strings.FieldsFunc(arg, func(c rune) bool {
			return strings.ContainsRune(shuffleSeparaters, c)
		}) {
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

func (m *FlipManager) parseSpecials(arg string, convMembers []chat1.ConversationLocalParticipant,
	nPlayersApprox int) (start flip.Start, metadata flipTextMetadata, err error) {
	switch {
	case strings.HasPrefix(arg, "cards"):
		deckShuffle, deckShuffleMetadata, _ := m.parseShuffle(m.deck, nPlayersApprox)
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
		var targets []string
		handParts := strings.Split(strings.Join(toks[2:], " "), ",")
		if len(handParts) == 1 && (handParts[0] == "@here" || handParts[0] == "@channel") {
			for _, memb := range convMembers {
				targets = append(targets, memb.Username)
			}
		} else {
			for _, pt := range handParts {
				t := strings.Trim(pt, " ")
				if len(t) > 0 {
					targets = append(targets, t)
				}
			}
		}
		return deckShuffle, flipTextMetadata{
			ShuffleItems:  deckShuffleMetadata.ShuffleItems,
			HandCardCount: uint(handCount),
			HandTargets:   targets,
		}, nil
	case arg == "@here" || arg == "@channel":
		if len(convMembers) == 0 {
			return flip.NewStartWithShuffle(m.clock.Now(), 1, nPlayersApprox), flipTextMetadata{
				ShuffleItems:      []string{"@here"},
				ConvMemberShuffle: true,
			}, nil
		}
		var usernames []string
		for _, memb := range convMembers {
			usernames = append(usernames, memb.Username)
		}
		return flip.NewStartWithShuffle(m.clock.Now(), int64(len(usernames)), nPlayersApprox),
			flipTextMetadata{
				ShuffleItems:      usernames,
				ConvMemberShuffle: true,
			}, nil
	}
	return start, metadata, errFailedToParse
}

func (m *FlipManager) startFromText(text string, convMembers []chat1.ConversationLocalParticipant) (start flip.Start, metadata flipTextMetadata) {
	var err error
	nPlayersApprox := len(convMembers)
	toks := strings.Split(strings.TrimRight(text, " "), " ")
	if len(toks) == 1 {
		return flip.NewStartWithBool(m.clock.Now(), nPlayersApprox), flipTextMetadata{}
	}
	// Combine into one argument if there is more than one
	arg := strings.Join(toks[1:], " ")
	// Check for special flips
	if start, metadata, err = m.parseSpecials(arg, convMembers, nPlayersApprox); err == nil {
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
	start, metadata := m.startFromText(text, nil)
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
		} else if metadata.ConvMemberShuffle {
			return "*Shuffling all members of the conversation*"
		} else if metadata.HandCardCount > 0 {
			return fmt.Sprintf("*Dealing hands of %d cards*", metadata.HandCardCount)
		}
		return fmt.Sprintf("*Shuffling %s*",
			strings.TrimRight(strings.Join(metadata.ShuffleItems, ", "), " "))
	}
	return ""
}

func (m *FlipManager) setStartFlipSendStatus(ctx context.Context, outboxID chat1.OutboxID,
	status types.FlipSendStatus, flipConvID *chat1.ConversationID) {
	payload := startFlipSendStatus{
		status: status,
	}
	if flipConvID != nil {
		payload.flipConvID = *flipConvID
	}
	m.flipConvs.Add(outboxID.String(), payload)
	m.G().MessageDeliverer.ForceDeliverLoop(ctx)
}

// StartFlip implements the types.CoinFlipManager interface
func (m *FlipManager) StartFlip(ctx context.Context, uid gregor1.UID, hostConvID chat1.ConversationID,
	tlfName, text string, inOutboxID *chat1.OutboxID) (err error) {
	defer m.Trace(ctx, func() error { return err }, "StartFlip: convID: %s", hostConvID)()
	gameID := flip.GenerateGameID()
	m.Debug(ctx, "StartFlip: using gameID: %s", gameID)

	// Get host conv using local storage, just bail out if we don't have it
	hostConv, err := utils.GetVerifiedConv(ctx, m.G(), uid, hostConvID,
		types.InboxSourceDataSourceLocalOnly)
	if err != nil {
		return err
	}

	// First generate the message representing the flip into the host conversation. We also wait for it
	// to actually get sent before doing anything flip related.
	var outboxID chat1.OutboxID
	if inOutboxID != nil {
		outboxID = *inOutboxID
	} else {
		if outboxID, err = storage.NewOutboxID(); err != nil {
			return err
		}
	}

	// Generate dev channel for game message
	var conv chat1.ConversationLocal
	m.setStartFlipSendStatus(ctx, outboxID, types.FlipSendStatusInProgress, nil)
	convCreatedCh := make(chan error)
	go func() {
		var err error
		topicName := m.gameTopicNameFromGameID(gameID)
		conv, err = NewConversationWithMemberSourceConv(ctx, m.G(), uid, tlfName, &topicName,
			chat1.TopicType_DEV, hostConv.GetMembersType(),
			keybase1.TLFVisibility_PRIVATE, m.ri, NewConvFindExistingSkip, &hostConvID)
		convCreatedCh <- err
	}()

	listener := newSentMessageListener(m.G(), outboxID)
	nid := m.G().NotifyRouter.AddListener(listener)
	if err := m.sendNonblock(ctx, hostConvID, text, tlfName, outboxID, gameID, chat1.TopicType_CHAT); err != nil {
		m.Debug(ctx, "StartFlip: failed to send flip message: %s", err)
		m.setStartFlipSendStatus(ctx, outboxID, types.FlipSendStatusError, nil)
		m.G().NotifyRouter.RemoveListener(nid)
		return err
	}
	if err := <-convCreatedCh; err != nil {
		m.setStartFlipSendStatus(ctx, outboxID, types.FlipSendStatusError, nil)
		m.G().NotifyRouter.RemoveListener(nid)
		return err
	}
	flipConvID := conv.GetConvID()
	m.Debug(ctx, "StartFlip: flip conv created: %s", flipConvID)
	m.setStartFlipSendStatus(ctx, outboxID, types.FlipSendStatusSent, &flipConvID)
	sendRes := <-listener.listenCh
	m.G().NotifyRouter.RemoveListener(nid)
	if sendRes.Err != nil {
		return sendRes.Err
	}

	// Preserve the ephemeral lifetime from the conv/message to the game
	// conversation.
	if elf, err := utils.EphemeralLifetimeFromConv(ctx, m.G(), hostConv); err != nil {
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
	m.Debug(ctx, "StartFlip: generating parameters for %d players", len(hostConv.Info.Participants))
	start, metadata := m.startFromText(text, hostConv.Info.Participants)
	infoBody, err := json.Marshal(hostMessageInfo{
		flipTextMetadata: metadata,
		ConvID:           hostConvID,
		MsgID:            sendRes.MsgID,
	})
	if err != nil {
		return err
	}
	if err := m.G().ChatHelper.SendMsgByID(ctx, flipConvID, tlfName,
		chat1.NewMessageBodyWithFlip(chat1.MessageFlip{
			Text:   string(infoBody),
			GameID: gameID,
		}), chat1.MessageType_FLIP, keybase1.TLFVisibility_PRIVATE); err != nil {
		return err
	}

	// Start the game
	return m.dealer.StartFlipWithGameID(ctx, start, flipConvID, gameID)
}

func (m *FlipManager) shouldIgnoreInject(ctx context.Context, hostConvID, flipConvID chat1.ConversationID,
	gameID chat1.FlipGameID) bool {
	if m.dealer.IsGameActive(ctx, flipConvID, gameID) {
		return false
	}
	// Ignore any flip messages for non-active games when not in the foreground
	appBkg := m.G().IsMobileAppType() &&
		m.G().MobileAppState.State() != keybase1.MobileAppState_FOREGROUND
	partViolation := m.isConvParticipationViolation(ctx, hostConvID)
	return appBkg || partViolation
}

func (m *FlipManager) isConvParticipationViolation(ctx context.Context, convID chat1.ConversationID) bool {
	m.partMu.Lock()
	defer m.partMu.Unlock()
	if rec, ok := m.convParticipations[convID.String()]; ok {
		m.Debug(ctx, "isConvParticipationViolation: rec: count: %d remain: %v", rec.count,
			m.clock.Now().Sub(rec.reset))
		if rec.reset.Before(m.clock.Now()) {
			return false
		}
		if rec.count >= m.maxConvParticipations {
			m.Debug(ctx, "isConvParticipationViolation: violation: convID: %s remaining: %v",
				convID, m.clock.Now().Sub(rec.reset))
			return true
		}
		return false
	}
	return false
}

func (m *FlipManager) recordConvParticipation(ctx context.Context, convID chat1.ConversationID) {
	m.partMu.Lock()
	defer m.partMu.Unlock()
	addNew := func() {
		m.convParticipations[convID.String()] = convParticipationsRateLimit{
			count: 1,
			reset: m.clock.Now().Add(m.maxConvParticipationsReset),
		}
	}
	if rec, ok := m.convParticipations[convID.String()]; ok {
		if rec.reset.Before(m.clock.Now()) {
			addNew()
		} else {
			rec.count++
			m.convParticipations[convID.String()] = rec
		}
	} else {
		addNew()
	}
}

func (m *FlipManager) injectIncomingChat(ctx context.Context, uid gregor1.UID,
	convID, hostConvID chat1.ConversationID, gameID chat1.FlipGameID, msg chat1.MessageUnboxed) error {
	if !msg.IsValid() {
		m.Debug(ctx, "injectIncomingChat: skipping invalid message: %d", msg.GetMessageID())
		return errors.New("invalid message")
	}
	if msg.Valid().ClientHeader.OutboxID != nil &&
		m.isSentOutboxID(ctx, gameID, *msg.Valid().ClientHeader.OutboxID) {
		m.Debug(ctx, "injectIncomingChat: skipping sent outboxID message: %d outboxID: %s ",
			msg.GetMessageID(), msg.Valid().ClientHeader.OutboxID)
		return nil
	}
	body := msg.Valid().MessageBody
	if !body.IsType(chat1.MessageType_FLIP) {
		return errors.New("non-flip message")
	}

	sender := flip.UserDevice{
		U: msg.Valid().ClientHeader.Sender,
		D: msg.Valid().ClientHeader.SenderDevice,
	}
	m.recordConvParticipation(ctx, hostConvID) // record the inject for rate limiting purposes
	m.gameMsgIDs.Add(gameID.String(), msg.GetMessageID())
	m.Debug(ctx, "injectIncomingChat: injecting: gameID: %s msgID: %d", gameID, msg.GetMessageID())
	return m.dealer.InjectIncomingChat(ctx, sender, convID, gameID,
		flip.MakeGameMessageEncoded(body.Flip().Text), m.isStartMsgID(msg.GetMessageID()))
}

func (m *FlipManager) updateActiveGame(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	hostConvID chat1.ConversationID, nextMsg chat1.MessageUnboxed, gameID chat1.FlipGameID) (err error) {
	defer func() {
		if err == nil {
			if err = m.injectIncomingChat(ctx, uid, convID, hostConvID, gameID, nextMsg); err != nil {
				m.Debug(ctx, "updateActiveGame: failed to inject next message: %s", err)
			}
		}
	}()
	m.Debug(ctx, "updateActiveGame: uid: %s convID: %s gameID: %s nextMsgID: %d", uid, convID, gameID,
		nextMsg.GetMessageID())
	// Get current msg ID of the game if we know about it
	var msgIDStart chat1.MessageID
	if storedMsgIDIface, ok := m.gameMsgIDs.Get(gameID.String()); ok {
		storedMsgID := storedMsgIDIface.(chat1.MessageID)
		if nextMsg.GetMessageID() == storedMsgID+1 {
			m.Debug(ctx, "updateActiveGame: truly incremental update, injecting...")
			return nil
		} else if nextMsg.GetMessageID() <= storedMsgID {
			m.Debug(ctx, "updateActiveGame: update from the past, ignoring: stored: %d", storedMsgID)
			return errors.New("update from the past")
		}
		m.Debug(ctx, "updateActiveGame: gapped update: storedMsgID: %d", storedMsgID)
		msgIDStart = storedMsgID
	} else {
		if m.isStartMsgID(nextMsg.GetMessageID()) {
			// if this is a start msg, then just send it in
			m.Debug(ctx, "updateActiveGame: starting new game: convID: %s gameID: %s", convID, gameID)
			return nil
		}
		m.Debug(ctx, "updateActiveGame: unknown game, setting start to 0")
	}
	// Otherwise, grab the thread and inject everything that has happened so far
	tv, err := m.G().ConvSource.PullFull(ctx, convID, uid, chat1.GetThreadReason_COINFLIP, nil, nil)
	if err != nil {
		return err
	}
	m.Debug(ctx, "updateActiveGame: got %d messages, injecting...", len(tv.Messages))
	for i := len(tv.Messages) - 3; i >= 0; i-- {
		msg := tv.Messages[i]
		if msg.GetMessageID() <= msgIDStart {
			m.Debug(ctx, "updateActiveGame: skipping known msgID: %d", msg.GetMessageID())
			continue
		}
		if msg.GetMessageID() >= nextMsg.GetMessageID() {
			m.Debug(ctx, "updateActiveGame: reached current msgID, finishing...")
			return nil
		}
		if err := m.injectIncomingChat(ctx, uid, convID, hostConvID, gameID, msg); err != nil {
			m.Debug(ctx, "updateActiveGame: failed to inject: %s", err)
		}
	}
	return nil
}

func (m *FlipManager) maybeInjectLoop(shutdownCh chan struct{}) {
	m.Debug(context.Background(), "maybeInjectLoop: starting")
	for {
		select {
		case closure := <-m.maybeInjectCh:
			closure()
		case <-shutdownCh:
			m.Debug(context.Background(), "maybeInjectLoop: exiting loop")
			return
		}
	}
}

// MaybeInjectFlipMessage implements the types.CoinFlipManager interface
func (m *FlipManager) MaybeInjectFlipMessage(ctx context.Context, boxedMsg chat1.MessageBoxed,
	inboxVers chat1.InboxVers, uid gregor1.UID, convID chat1.ConversationID, topicType chat1.TopicType) bool {
	// earliest of outs if this isn't a dev convo, an error, or the outbox ID message
	if topicType != chat1.TopicType_DEV || boxedMsg.GetMessageType() != chat1.MessageType_FLIP ||
		m.isHostMessageInfoMsgID(boxedMsg.GetMessageID()) {
		return false
	}
	defer m.Trace(ctx, func() error { return nil }, "MaybeInjectFlipMessage: uid: %s convID: %s", uid, convID)()

	// Update inbox for this guy
	if err := m.G().InboxSource.UpdateInboxVersion(ctx, uid, inboxVers); err != nil {
		m.Debug(ctx, "MaybeInjectFlipMessage: failed to update inbox version: %s", err)
		// charge forward here, we will figure it out
	}
	if err := storage.New(m.G(), nil).SetMaxMsgID(ctx, convID, uid, boxedMsg.GetMessageID()); err != nil {
		m.Debug(ctx, "MaybeInjectFlipMessage: failed to write max msgid: %s", err)
		// charge forward from this error
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
	if !msg.IsValid() {
		m.Debug(ctx, "MaybeInjectFlipMessage: failed to unbox msg")
		return true
	}
	body := msg.Valid().MessageBody
	if !body.IsType(chat1.MessageType_FLIP) {
		m.Debug(ctx, "MaybeInjectFlipMessage: bogus flip message with a non-flip body")
		return true
	}
	// Ignore anything from the current device
	ctx = globals.BackgroundChatCtx(ctx, m.G())
	select {
	case m.maybeInjectCh <- func() {
		defer m.Trace(ctx, func() error { return nil },
			"MaybeInjectFlipMessage(goroutine): uid: %s convID: %s id: %d",
			uid, convID, msg.GetMessageID())()
		if m.Me().Eq(flip.UserDevice{
			U: msg.Valid().ClientHeader.Sender,
			D: msg.Valid().ClientHeader.SenderDevice,
		}) {
			m.gameMsgIDs.Add(body.Flip().GameID.String(), msg.GetMessageID())
			return
		}
		// Check to see if we are going to participate from this inject
		hmi, err := m.getHostMessageInfo(ctx, convID)
		if err != nil {
			m.Debug(ctx, "MaybeInjectFlipMessage: failed to get host message info: %s", err)
			return
		}
		if m.shouldIgnoreInject(ctx, hmi.ConvID, convID, body.Flip().GameID) {
			m.Debug(ctx, "MaybeInjectFlipMessage: ignored flip message")
			return
		}
		// Check to see if the game is unknown, and if so, then rebuild and see what we can do
		if err := m.updateActiveGame(ctx, uid, convID, hmi.ConvID, msg, body.Flip().GameID); err != nil {
			m.Debug(ctx, "MaybeInjectFlipMessage: failed to rebuild non-active game: %s", err)
		}
	}:
	default:
		m.Debug(ctx, "MaybeInjectFlipMessage: failed to dispatch job, queue full!")
	}
	return true
}

func (m *FlipManager) HasActiveGames(ctx context.Context) bool {
	return m.dealer.HasActiveGames(ctx)
}

func (m *FlipManager) loadGame(ctx context.Context, job loadGameJob) (err error) {
	defer m.Trace(ctx, func() error { return err },
		"loadGame: hostConvID: %s flipConvID: %s gameID: %s hostMsgID: %d",
		job.hostConvID, job.flipConvID, job.gameID, job.hostMsgID)()
	defer func() {
		if err != nil {
			job.errCh <- err
		}
	}()

	// Check to make sure the flip conversation aligns with the host message
	flipConvID := job.flipConvID
	hmi, err := m.getHostMessageInfo(ctx, flipConvID)
	if err != nil {
		m.Debug(ctx, "loadGame: failed to get host message info: %s", err)
		return err
	}
	if !(hmi.ConvID.Eq(job.hostConvID) && hmi.MsgID == job.hostMsgID) {
		m.Debug(ctx, "loadGame: host message info mismatch: job.hostConvID: %s hmi.ConvID: %s job.hostMsgID: %d hmi.msgID: %d", job.hostConvID, hmi.ConvID, job.hostMsgID, hmi.MsgID)
		return errors.New("flip conversation does not match host message info")
	}

	tv, err := m.G().ConvSource.PullFull(ctx, flipConvID, job.uid,
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
		if m.dealer.IsGameActive(ctx, flipConvID, job.gameID) {
			m.Debug(ctx, "loadGame: game is currently active, bailing out")
			return errors.New("game is active")
		}
		// Spawn off this error notification in a goroutine and only deliver it if the game is not active
		// after the timer
		summary = &flip.GameSummary{
			Err: err,
		}
		go func(ctx context.Context, summary *flip.GameSummary) {
			m.clock.Sleep(5 * time.Second)
			rawGame, ok := m.games.Get(job.gameID.String())
			if ok {
				status := rawGame.(chat1.UICoinFlipStatus)
				switch status.Phase {
				case chat1.UICoinFlipPhase_ERROR:
					// we'll send our error if there is an error on the screen
				default:
					// any other phase we will send nothing
					m.Debug(ctx, "loadGame: after pausing, we have a status in phase: %v", status.Phase)
					return
				}
			}
			m.Debug(ctx, "loadGame: game had no action after pausing, sending error")
			job.resCh <- m.handleSummaryUpdate(ctx, job.gameID, summary, flipConvID, true)
		}(globals.BackgroundChatCtx(ctx, m.G()), summary)
	} else {
		job.resCh <- m.handleSummaryUpdate(ctx, job.gameID, summary, flipConvID, true)
	}
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
func (m *FlipManager) LoadFlip(ctx context.Context, uid gregor1.UID, hostConvID chat1.ConversationID,
	hostMsgID chat1.MessageID, flipConvID chat1.ConversationID, gameID chat1.FlipGameID) (res chan chat1.UICoinFlipStatus, err chan error) {
	defer m.Trace(ctx, func() error { return nil }, "LoadFlip")()
	stored, ok := m.games.Get(gameID.String())
	if ok {
		switch stored.(chat1.UICoinFlipStatus).Phase {
		case chat1.UICoinFlipPhase_ERROR:
			// do nothing here, just replay if we are storing an error
		default:
			m.queueDirtyGameID(ctx, gameID, true)
			res = make(chan chat1.UICoinFlipStatus, 1)
			res <- stored.(chat1.UICoinFlipStatus)
			err = make(chan error, 1)
			return res, err
		}
	}
	// If we miss the in-memory game storage, attempt to replay the game
	job := loadGameJob{
		uid:        uid,
		hostConvID: hostConvID,
		hostMsgID:  hostMsgID,
		flipConvID: flipConvID,
		gameID:     gameID,
		resCh:      make(chan chat1.UICoinFlipStatus, 1),
		errCh:      make(chan error, 1),
	}
	select {
	case m.loadGameCh <- job:
	default:
		m.Debug(ctx, "LoadFlip: queue full: gameID: %s hostConvID %s flipConvID: %s", gameID, hostConvID,
			flipConvID)
		job.errCh <- errors.New("queue full")
	}
	return job.resCh, job.errCh
}

func (m *FlipManager) IsFlipConversationCreated(ctx context.Context, outboxID chat1.OutboxID) (convID chat1.ConversationID, status types.FlipSendStatus) {
	defer m.Trace(ctx, func() error { return nil }, "IsFlipConversationCreated")()
	if rec, ok := m.flipConvs.Get(outboxID.String()); ok {
		status := rec.(startFlipSendStatus)
		switch status.status {
		case types.FlipSendStatusSent:
			convID = status.flipConvID
		}
		return convID, status.status
	}
	return convID, types.FlipSendStatusError
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
	ctx = globals.ChatCtx(ctx, m.G(), keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil, nil)
	defer m.Trace(ctx, func() error { return err }, "ServerTime")()
	if m.testingServerClock != nil {
		return m.testingServerClock.Now(), nil
	}
	sres, err := m.ri().ServerNow(ctx)
	if err != nil {
		return res, err
	}
	return sres.Now.Time(), nil
}

func (m *FlipManager) sendNonblock(ctx context.Context, convID chat1.ConversationID, text, tlfName string,
	outboxID chat1.OutboxID, gameID chat1.FlipGameID, topicType chat1.TopicType) error {
	sender := NewNonblockingSender(m.G(), NewBlockingSender(m.G(), NewBoxer(m.G()), m.ri))
	_, _, err := sender.Send(ctx, convID, chat1.MessagePlaintext{
		MessageBody: chat1.NewMessageBodyWithFlip(chat1.MessageFlip{
			Text:   text,
			GameID: gameID,
		}),
		ClientHeader: chat1.MessageClientHeader{
			TlfName:     tlfName,
			MessageType: chat1.MessageType_FLIP,
			Conv: chat1.ConversationIDTriple{
				TopicType: topicType,
			},
		},
	}, 0, &outboxID, nil, nil)
	return err
}

func (m *FlipManager) isSentOutboxID(ctx context.Context, gameID chat1.FlipGameID, outboxID chat1.OutboxID) bool {
	m.gameOutboxIDMu.Lock()
	defer m.gameOutboxIDMu.Unlock()
	if omIface, ok := m.gameOutboxIDs.Get(gameID.String()); ok {
		om := omIface.(map[string]bool)
		return om[outboxID.String()]
	}
	return false
}

func (m *FlipManager) registerSentOutboxID(ctx context.Context, gameID chat1.FlipGameID,
	outboxID chat1.OutboxID) {
	m.gameOutboxIDMu.Lock()
	defer m.gameOutboxIDMu.Unlock()
	var om map[string]bool
	if omIface, ok := m.gameOutboxIDs.Get(gameID.String()); ok {
		om = omIface.(map[string]bool)
	} else {
		om = make(map[string]bool)
	}
	om[outboxID.String()] = true
	m.gameOutboxIDs.Add(gameID.String(), om)
}

// SendChat implements the flip.DealersHelper interface
func (m *FlipManager) SendChat(ctx context.Context, convID chat1.ConversationID, gameID chat1.FlipGameID,
	msg flip.GameMessageEncoded) (err error) {
	ctx = globals.ChatCtx(ctx, m.G(), keybase1.TLFIdentifyBehavior_CHAT_SKIP, nil, nil)
	defer m.Trace(ctx, func() error { return err }, "SendChat: convID: %s", convID)()
	uid, err := utils.AssertLoggedInUID(ctx, m.G())
	if err != nil {
		return err
	}
	conv, err := utils.GetVerifiedConv(ctx, m.G(), uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return err
	}
	outboxID, err := storage.NewOutboxID()
	if err != nil {
		return err
	}
	m.registerSentOutboxID(ctx, gameID, outboxID)
	return m.sendNonblock(ctx, convID, msg.String(), conv.Info.TlfName, outboxID, gameID,
		chat1.TopicType_DEV)
}

// Me implements the flip.DealersHelper interface
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

func (m *FlipManager) ShouldCommit(ctx context.Context) bool {
	if !m.G().IsMobileAppType() {
		should := m.G().DesktopAppState.AwakeAndUnlocked(m.G().MetaContext(ctx))
		if !should {
			m.Debug(ctx, "ShouldCommit -> false")
		}
		return should
	}
	return true
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
		height: height, // 40
		width:  width,  // 64
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
