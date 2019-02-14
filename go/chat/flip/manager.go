package flip

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
)

type hostMessageInfo struct {
	OutboxID chat1.OutboxID
}

type gameIDHistoryInfo struct {
	GameID GameID
}

type Manager struct {
	globals.Contextified
	utils.DebugLabeler

	dealer *Dealer
	clock  clockwork.Clock
}

func NewManager(g *globals.Context) *Manager {
	m := &Manager{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Flip.Manager", false),
		clock:        clockwork.NewRealClock(),
	}
	dealer := NewDealer(m)
	m.dealer = dealer
	return m
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

func (m *Manager) gameIDHistoryTopicName(convID chat1.ConversationID) string {
	return fmt.Sprintf("__keybase_coinflip_history_%s", convID)
}

func (m *Manager) startFromText(text string) Start {
	// TODO fix m
	return NewStartWithBool(m.clock.Now())
}

// StartFlip implements the types.CoinFlipManager interface
func (m *Manager) StartFlip(ctx context.Context, uid gregor1.UID, hostConvID chat1.ConversationID,
	tlfName, text string) (err error) {
	defer m.Trace(ctx, func() error { return err }, "StartFlip: convID: %s", hostConvID)()
	gameID := GenerateGameID()
	strGameID := gameID.String()

	// Get host conv using local storage, just bail out if we don't have it
	hostConv, err := utils.GetUnverifiedConv(ctx, m.G(), uid, hostConvID,
		types.InboxSourceDataSourceLocalOnly)
	if err != nil {
		return err
	}

	// First generate the message representing the flip into the host conversation
	outboxID, err := m.G().ChatHelper.SendMsgByIDNonblock(ctx, hostConvID, tlfName,
		chat1.NewMessageBodyWithText(chat1.MessageText{
			Body:   text,
			GameID: &strGameID,
		}), chat1.MessageType_TEXT)
	if err != nil {
		return err
	}

	// Write down the game ID in the history conv
	historyTopicName := m.gameIDHistoryTopicName(hostConv.GetConvID())
	historyBody, err := json.Marshal(gameIDHistoryInfo{
		GameID: gameID,
	})
	if err != nil {
		return err
	}
	historyConv, err := m.G().ChatHelper.NewConversation(ctx, uid, tlfName, &historyTopicName,
		chat1.TopicType_DEV, hostConv.GetMembersType(), keybase1.TLFVisibility_PRIVATE)
	if err != nil {
		return err
	}
	if _, err := m.G().ChatHelper.SendTextByIDNonblock(ctx, historyConv.GetConvID(), tlfName,
		string(historyBody)); err != nil {
		return err
	}

	// Generate dev channel for game messages
	topicName := m.gameTopicNameFromGameID(gameID)
	conv, err := m.G().ChatHelper.NewConversation(ctx, uid, tlfName, &topicName, chat1.TopicType_DEV,
		hostConv.GetMembersType(), keybase1.TLFVisibility_PRIVATE)
	if err != nil {
		return err
	}

	// Record outboxID of the host message into the game thread as the first message
	infoBody, err := json.Marshal(hostMessageInfo{
		OutboxID: outboxID,
	})
	if err != nil {
		return err
	}
	if _, err := m.G().ChatHelper.SendTextByIDNonblock(ctx, conv.GetConvID(), tlfName, string(infoBody)); err != nil {
		return err
	}

	// Start the game
	return m.dealer.StartFlipWithGameID(ctx, m.startFromText(text), conv.GetConvID(), gameID)
}

// MaybeInjectFlipMessage implements the types.CoinFlipManager interface
func (m *Manager) MaybeInjectFlipMessage(ctx context.Context, msg chat1.MessageUnboxed,
	conv chat1.ConversationLocal) {
	if conv.GetTopicType() != chat1.TopicType_DEV || !msg.IsValid() || msg.GetMessageID() == 2 {
		// earliest of outs if this isn't a dev convo, an error, or the outbox ID message
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
	sender := UserDevice{
		U: msg.Valid().ClientHeader.Sender,
		D: msg.Valid().ClientHeader.SenderDevice,
	}
	if err := m.dealer.InjectIncomingChat(ctx, sender, conv.GetConvID(), gameID,
		MakeGameMessageEncoded(body.Text().Body)); err != nil {
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

// ReadHistory implements the flip.DealersHelper interface
func (m *Manager) ReadHistory(ctx context.Context, convID chat1.ConversationID, since time.Time) (res []GameID, err error) {
	defer m.Trace(ctx, func() error { return err }, "ReadHistory: convID: %s", convID)()
	uid, err := utils.AssertLoggedInUID(ctx, m.G())
	if err != nil {
		return res, err
	}
	gameConv, err := utils.GetVerifiedConv(ctx, m.G(), uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return res, err
	}
	topicName := m.gameIDHistoryTopicName(gameConv.GetConvID())
	histConvs, err := m.G().ChatHelper.FindConversations(ctx, gameConv.Info.TlfName, &topicName,
		chat1.TopicType_DEV, gameConv.GetMembersType(), gameConv.Info.Visibility)
	if err != nil {
		return res, err
	}
	if len(histConvs) != 1 {
		return res, fmt.Errorf("wrong number of conversations for history: %d", len(histConvs))
	}
	histConv := histConvs[0]

	after := gregor1.ToTime(since)
	tv, err := m.G().ConvSource.Pull(ctx, histConv.GetConvID(), uid, chat1.GetThreadReason_COINFLIP,
		&chat1.GetThreadQuery{
			After: &after,
		}, nil)
	if err != nil {
		return res, err
	}
	for _, msg := range tv.Messages {
		if !msg.IsValid() {
			continue
		}
		body := msg.Valid().MessageBody
		if !body.IsType(chat1.MessageType_TEXT) {
			continue
		}
		var info gameIDHistoryInfo
		if err := json.Unmarshal([]byte(body.Text().Body), &info); err != nil {
			m.Debug(ctx, "ReadHistory: failed to unmarshal message: id: %d err: %s", msg.GetMessageID(), err)
			continue
		}
		res = append(res, info.GameID)
	}
	return res, nil
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
	_, err = m.G().ChatHelper.SendTextByIDNonblock(ctx, convID, conv.Info.TlfName, msg.String())
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
