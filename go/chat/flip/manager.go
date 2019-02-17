package flip

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"sort"
	"strings"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
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
	ctx := context.Background()
	st, err := activity.ActivityType()
	if err != nil {
		n.Debug(ctx, "NewChatActivity: failed to get type: %s", err)
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

type hostMessageInfo struct {
	ConvID       chat1.ConversationID
	MsgID        chat1.MessageID
	LowerBound   string
	ShuffleItems []string
}

type Manager struct {
	globals.Contextified
	utils.DebugLabeler

	dealer     *Dealer
	clock      clockwork.Clock
	shutdownMu sync.Mutex
	shutdownCh chan struct{}
	forceCh    chan struct{}

	gamesMu    sync.Mutex
	games      *lru.Cache
	dirtyGames map[string]GameID
}

func NewManager(g *globals.Context) *Manager {
	games, _ := lru.New(100)
	m := &Manager{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Flip.Manager", false),
		clock:        clockwork.NewRealClock(),
		games:        games,
		dirtyGames:   make(map[string]GameID),
		forceCh:      make(chan struct{}, 10),
	}
	dealer := NewDealer(m)
	m.dealer = dealer
	return m
}

func (m *Manager) Start(ctx context.Context, uid gregor1.UID) {
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
}

func (m *Manager) Stop(ctx context.Context) (ch chan struct{}) {
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

func (m *Manager) notifyDirtyGames(ctx context.Context) {
	m.gamesMu.Lock()
	defer m.gamesMu.Unlock()
	if len(m.dirtyGames) == 0 {
		return
	}
	defer func() {
		m.dirtyGames = make(map[string]GameID)
	}()
	ui, err := m.G().UIRouter.GetChatUI()
	if err != nil {
		m.Debug(ctx, "notifyDirtyGames: no chat UI available for notification")
		return
	}
	var updates []chat1.UICoinFlipStatus
	for _, dg := range m.dirtyGames {
		if game, ok := m.games.Get(dg.String()); ok {
			updates = append(updates, game.(chat1.UICoinFlipStatus))
		}
	}
	if err := ui.ChatCoinFlipStatus(ctx, updates); err != nil {
		m.Debug(ctx, "notifyDirtyGames: failed to notify status: %s", err)
	}
}

func (m *Manager) notificationLoop(shutdownCh chan struct{}) {
	duration := 200 * time.Millisecond
	next := m.clock.Now().Add(duration)
	ctx := context.Background()
	for {
		select {
		case <-m.clock.AfterTime(next):
			m.notifyDirtyGames(ctx)
			next = m.clock.Now().Add(duration)
		case <-m.forceCh:
			m.notifyDirtyGames(ctx)
			next = m.clock.Now().Add(duration)
		case <-shutdownCh:
			return
		}
	}
}

func (m *Manager) addParticipant(ctx context.Context, status *chat1.UICoinFlipStatus, update CommitmentUpdate) {
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

func (m *Manager) addReveal(ctx context.Context, status *chat1.UICoinFlipStatus, update RevealUpdate) {
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

func (m *Manager) addResult(ctx context.Context, status *chat1.UICoinFlipStatus, result Result,
	convID chat1.ConversationID) {
	defer func() {
		if len(status.ResultText) > 0 {
			status.ProgressText += " (complete)"
		}
	}()
	hmi, err := m.getHostMessageInfo(ctx, convID)
	if err != nil {
		m.Debug(ctx, "addResult: failed to describe result: %s", err)
		status.Phase = chat1.UICoinFlipPhase_ERROR
		status.ProgressText = "Failed to describe result"
	} else if result.Big != nil {
		lb := new(big.Int)
		res := new(big.Int)
		lb.SetString(hmi.LowerBound, 10)
		res.Add(lb, result.Big)
		status.ResultText = res.String()
	} else if result.Bool != nil {
		if *result.Bool {
			status.ResultText = "HEADS"
		} else {
			status.ResultText = "TAILS"
		}
	} else if result.Int != nil {
		status.ResultText = fmt.Sprintf("%d", *result.Int)
	} else if len(result.Shuffle) > 0 {
		if len(hmi.ShuffleItems) != len(result.Shuffle) {
			status.Phase = chat1.UICoinFlipPhase_ERROR
			status.ProgressText = "Failed to describe shuffle result"
			return
		}
		items := make([]string, len(hmi.ShuffleItems))
		for index, r := range result.Shuffle {
			items[index] = hmi.ShuffleItems[r]
		}
		status.ResultText = strings.Join(items, ",")
	}
}

func (m *Manager) handleUpdate(ctx context.Context, update GameStateUpdateMessage, force bool) (err error) {
	gameID := update.Metadata.GameID
	defer func() {
		if err == nil {
			m.gamesMu.Lock()
			m.dirtyGames[gameID.String()] = gameID
			m.gamesMu.Unlock()
			if force {
				m.forceCh <- struct{}{}
			}
		}
	}()

	if update.StartPending != nil {
		m.games.Add(gameID.String(), chat1.UICoinFlipStatus{
			GameID:       gameID.String(),
			Phase:        chat1.UICoinFlipPhase_PENDING,
			ProgressText: "Initializing flip...",
		})
		return nil
	} else if update.StartSuccess != nil {
		m.games.Add(gameID.String(), chat1.UICoinFlipStatus{
			GameID:       gameID.String(),
			Phase:        chat1.UICoinFlipPhase_COMMITMENT,
			ProgressText: "Gathering commitments...",
		})
		return nil
	}
	rawGame, ok := m.games.Get(gameID.String())
	if !ok {
		m.Debug(ctx, "handleUpdate: update received for unknown game, skipping: %s", gameID)
		return errors.New("unknown game")
	}
	status := rawGame.(chat1.UICoinFlipStatus)
	if update.Err != nil {
		status.Phase = chat1.UICoinFlipPhase_ERROR
		status.ProgressText = fmt.Sprintf("Something went wrong: %s", update.Err)
	} else if update.Commitment != nil {
		status.Phase = chat1.UICoinFlipPhase_COMMITMENT
		m.addParticipant(ctx, &status, *update.Commitment)
	} else if update.CommitmentComplete != nil {
		status.Phase = chat1.UICoinFlipPhase_REVEALS
		status.ProgressText = "Commitments complete, revealing secrets..."
	} else if update.Reveal != nil {
		m.addReveal(ctx, &status, *update.Reveal)
	} else if update.Result != nil {
		status.Phase = chat1.UICoinFlipPhase_COMPLETE
		m.addResult(ctx, &status, *update.Result, update.Metadata.ConversationID)
	}
	m.games.Add(gameID.String(), status)
	return nil
}

func (m *Manager) updateLoop(shutdownCh chan struct{}) {
	for {
		select {
		case msg := <-m.dealer.UpdateCh():
			m.handleUpdate(context.Background(), msg, false)
		case <-shutdownCh:
			return
		}
	}
}

const gameIDTopicNamePrefix = "__keybase_coinflip_game_"

func (m *Manager) isGameIDTopicName(topicName string) (res GameID, ok bool) {
	if strings.HasPrefix(topicName, gameIDTopicNamePrefix) {
		strGameID := strings.Split(topicName, gameIDTopicNamePrefix)[1]
		gameID, err := MakeGameID(strGameID)
		if err != nil {
			return res, false
		}
		return gameID, true
	}
	return res, false
}

func (m *Manager) gameTopicNameFromGameID(gameID GameID) string {
	return fmt.Sprintf("%s%s", gameIDTopicNamePrefix, gameID)
}

var errFailedToParse = errors.New("failed to parse")

func (m *Manager) parseMultiDie(arg string) (start Start, err error) {
	if strings.Contains(arg, "-") {
		return start, errFailedToParse
	}
	lb := new(big.Int)
	if _, err := fmt.Sscan(arg, lb); err != nil {
		return start, errFailedToParse
	}
	return NewStartWithBigInt(m.clock.Now(), lb), nil
}

func (m *Manager) parseShuffle(arg string) (start Start, shuffleItems []string, err error) {
	if strings.Contains(arg, ",") {
		shuffleItems = strings.Split(arg, ",")
		return NewStartWithShuffle(m.clock.Now(), int64(len(shuffleItems))), shuffleItems, nil
	}
	return start, shuffleItems, errFailedToParse
}

func (m *Manager) parseRange(arg string) (start Start, lowerBound string, err error) {
	if !strings.Contains(arg, "-") {
		return start, lowerBound, errFailedToParse
	}
	toks := strings.Split(arg, "-")
	if len(toks) != 2 {
		return start, lowerBound, errFailedToParse
	}
	lb := new(big.Int)
	ub := new(big.Int)
	if _, err := fmt.Sscan(toks[0], lb); err != nil {
		return start, lowerBound, errFailedToParse
	}
	if _, err := fmt.Sscan(toks[1], ub); err != nil {
		return start, lowerBound, errFailedToParse
	}
	diff := new(big.Int)
	diff.Sub(ub, lb)
	if diff.Sign() < 0 {
		return start, lowerBound, errFailedToParse
	}
	return NewStartWithBigInt(m.clock.Now(), diff), lb.String(), nil
}

func (m *Manager) startFromText(text string) (start Start, lowerBound string, shuffleItems []string) {
	var err error
	toks := strings.Split(strings.TrimRight(text, " "), " ")
	if len(toks) == 1 {
		return NewStartWithBool(m.clock.Now()), "", nil
	}
	// Combine into one argument if there is more than one
	arg := strings.Replace(strings.Join(toks[1:], ""), " ", "", -1)
	// Check for /flip 20
	if start, err = m.parseMultiDie(arg); err == nil {
		return start, "0", nil
	}
	// Check for /flip mikem,karenm,lisam
	if start, shuffleItems, err = m.parseShuffle(arg); err == nil {
		return start, "", shuffleItems
	}
	// Check for /flip 2-8
	if start, lowerBound, err = m.parseRange(arg); err == nil {
		return start, lowerBound, nil
	}
	// Just shuffle the one unknown thing
	return NewStartWithShuffle(m.clock.Now(), 1), "", []string{arg}
}

func (m *Manager) getHostMessageInfo(ctx context.Context, convID chat1.ConversationID) (res hostMessageInfo, err error) {
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
	if !msg.Valid().MessageBody.IsType(chat1.MessageType_TEXT) {
		return res, fmt.Errorf("invalid host message type: %v", msg.GetMessageType())
	}
	body := msg.Valid().MessageBody.Text().Body
	if err := json.Unmarshal([]byte(body), &res); err != nil {
		return res, err
	}
	return res, nil
}

// StartFlip implements the types.CoinFlipManager interface
func (m *Manager) StartFlip(ctx context.Context, uid gregor1.UID, hostConvID chat1.ConversationID,
	tlfName, text string) (err error) {
	defer m.Trace(ctx, func() error { return err }, "StartFlip: convID: %s", hostConvID)()
	gameID := GenerateGameID()
	strGameID := gameID.String()
	m.Debug(ctx, "StartFlip: using gameID: %s", gameID)

	// Get host conv using local storage, just bail out if we don't have it
	hostConv, err := utils.GetUnverifiedConv(ctx, m.G(), uid, hostConvID,
		types.InboxSourceDataSourceLocalOnly)
	if err != nil {
		return err
	}

	// First generate the message representing the flip into the host conversation. We also wait for it
	// to actually get sent before doing anything flip related.
	m.handleUpdate(ctx, GameStateUpdateMessage{
		Metadata: GameMetadata{
			GameID: gameID,
		},
		StartPending: new(bool),
	}, true)
	outboxID, err := storage.NewOutboxID()
	if err != nil {
		return err
	}
	listener := newSentMessageListener(m.G(), outboxID)
	nid := m.G().NotifyRouter.AddListener(listener)
	if _, err = m.G().ChatHelper.SendMsgByIDNonblock(ctx, hostConvID, tlfName,
		chat1.NewMessageBodyWithText(chat1.MessageText{
			Body:   text,
			GameID: &strGameID,
		}), chat1.MessageType_TEXT, &outboxID); err != nil {
		return err
	}
	sendRes := <-listener.listenCh
	if sendRes.Err != nil {
		return sendRes.Err
	}
	m.G().NotifyRouter.RemoveListener(nid)

	// Generate dev channel for game messages
	topicName := m.gameTopicNameFromGameID(gameID)
	conv, err := m.G().ChatHelper.NewConversation(ctx, uid, tlfName, &topicName, chat1.TopicType_DEV,
		hostConv.GetMembersType(), keybase1.TLFVisibility_PRIVATE)
	if err != nil {
		return err
	}

	// Record metadata of the host message into the game thread as the first message
	start, lowerBound, shuffleItems := m.startFromText(text)
	m.Debug(ctx, "start: %v", start)
	infoBody, err := json.Marshal(hostMessageInfo{
		ConvID:       hostConvID,
		MsgID:        sendRes.MsgID,
		LowerBound:   lowerBound,
		ShuffleItems: shuffleItems,
	})
	if err != nil {
		return err
	}
	if err := m.G().ChatHelper.SendTextByID(ctx, conv.GetConvID(), tlfName, string(infoBody)); err != nil {
		return err
	}

	// Start the game
	return m.dealer.StartFlipWithGameID(ctx, start, conv.GetConvID(), gameID)
}

// MaybeInjectFlipMessage implements the types.CoinFlipManager interface
func (m *Manager) MaybeInjectFlipMessage(ctx context.Context, msg chat1.MessageUnboxed,
	conv chat1.ConversationLocal) {
	// earliest of outs if this isn't a dev convo, an error, or the outbox ID message
	if conv.GetTopicType() != chat1.TopicType_DEV || !msg.IsValid() || msg.GetMessageID() == 2 {
		return
	}
	// Ignore anything from the current device
	sender := UserDevice{
		U: msg.Valid().ClientHeader.Sender,
		D: msg.Valid().ClientHeader.SenderDevice,
	}
	if sender.Eq(m.Me()) {
		return
	}
	defer m.Trace(ctx, func() error { return nil }, "MaybeInjectFlipMessage: convID: %s",
		conv.GetConvID())()
	body := msg.Valid().MessageBody
	if !body.IsType(chat1.MessageType_TEXT) {
		return
	}
	// check topic name
	gameID, ok := m.isGameIDTopicName(conv.GetTopicName())
	if !ok {
		return
	}
	if err := m.dealer.InjectIncomingChat(ctx, sender, conv.GetConvID(), gameID,
		MakeGameMessageEncoded(body.Text().Body), msg.GetMessageID() == 3); err != nil {
		m.Debug(ctx, "MaybeInjectFlipMessage: failed to inject: %s", err)
	}
}

// CLogf implements the flip.DealersHelper interface
func (m *Manager) CLogf(ctx context.Context, fmt string, args ...interface{}) {
	m.Debug(ctx, fmt, args...)
}

// Clock implements the flip.DealersHelper interface
func (m *Manager) Clock() clockwork.Clock {
	return m.clock
}

// ServerTime implements the flip.DealersHelper interface
func (m *Manager) ServerTime(ctx context.Context) (res time.Time, err error) {
	defer m.Trace(ctx, func() error { return err }, "ServerTime")()
	// TODO: implement this for real
	return m.clock.Now(), nil
}

// SendChat implements the flip.DealersHelper interface
func (m *Manager) SendChat(ctx context.Context, convID chat1.ConversationID, gameID GameID,
	msg GameMessageEncoded) (err error) {
	defer m.Trace(ctx, func() error { return err }, "SendChat: convID: %s", convID)()
	uid, err := utils.AssertLoggedInUID(ctx, m.G())
	if err != nil {
		return err
	}
	conv, err := utils.GetVerifiedConv(ctx, m.G(), uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return err
	}
	_, err = m.G().ChatHelper.SendTextByIDNonblock(ctx, convID, conv.Info.TlfName, msg.String(), nil)
	return err
}

func (m *Manager) Me() UserDevice {
	ad := m.G().ActiveDevice
	did := ad.DeviceID()
	hdid := make([]byte, libkb.DeviceIDLen)
	if err := did.ToBytes(hdid); err != nil {
		return UserDevice{}
	}
	return UserDevice{
		U: gregor1.UID(ad.UID().ToBytes()),
		D: gregor1.DeviceID(hdid),
	}
}
