package flip

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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

func (m *Manager) gameTopicNameFromGameID(gameID GameID) string {
	return fmt.Sprintf("__keybase_coinflip_game_%s", gameID)
}

func (m *Manager) gameIDHistoryTopicName(tlfName string, topicName string) string {
	return fmt.Sprintf("__keybase_coinflip_history_%s_%s", tlfName, topicName)
}

func (m *Manager) startFromText(text string) Start {
	// TODO fix m
	return NewStartWithBool(m.clock.Now())
}

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
	historyTopicName := m.gameIDHistoryTopicName(tlfName, hostConv.GetTopicName())
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

// CLogf implements the flip.DealersHelper interface
func (m *Manager) CLogf(ctx context.Context, fmt string, args ...interface{}) {
	m.Debug(ctx, fmt, args...)
}

// Clock implements the flip.DealersHelper interface
func (m *Manager) Clock() clockwork.Clock {
	return m.clock
}

// ServerTime implements the flip.DealersHelper interface
func (m *Manager) ServerTime(ctx context.Context) (time.Time, error) {
	// TODO: implement this for real
	return m.clock.Now(), nil
}

// ReadHistory implements the flip.DealersHelper interface
func (m *Manager) ReadHistory(ctx context.Context, conversationID chat1.ConversationID, since time.Time) ([]GameID, error) {
	return nil, errors.New("not implemented")
}

// SendChat implements the flip.DealersHelper interface
func (m *Manager) SendChat(ctx context.Context, convID chat1.ConversationID, gameID GameID,
	msg GameMessageEncoded) error {
	uid, err := utils.AssertLoggedInUID(ctx, m.G())
	if err != nil {
		return err
	}
	conv, err := utils.GetVerifiedConv(ctx, m.G(), uid, convID, types.InboxSourceDataSourceLocalOnly)
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
