package flip

import (
	"context"
	"io"
	"math/big"
	"sync"
	"time"

	chat1 "github.com/keybase/client/go/protocol/chat1"
	clockwork "github.com/keybase/clockwork"
)

// GameMessageEncoded is a game message that is shipped over the chat channel. Inside, it's a base64-encoded
// msgpack object (generated via AVDL->go compiler), but it's safe to think of it just as an opaque string.
type GameMessageEncoded string

// GameMessageWrappedEncoded contains a sender, a gameID and a Body. The GameID should never be reused.
type GameMessageWrappedEncoded struct {
	Sender              UserDevice
	GameID              chat1.FlipGameID   // the game ID of this game, also specified (encoded) in GameMessageEncoded
	Body                GameMessageEncoded // base64-encoded GameMessaageBody that comes in over chat
	FirstInConversation bool               // on if this is the first message in the conversation
}

type CommitmentUpdate struct {
	User       UserDevice
	Commitment Commitment
}

type RevealUpdate struct {
	User   UserDevice
	Reveal Secret
}

// GameStateUpdateMessage is sent from the game dealer out to the calling chat client, to update him
// on changes to game state that happened. All update messages are relative to the given GameMetadata.
// For each update, only one of Err, Commitment, Reveal, CommitmentComplete or Result will be non-nil.
type GameStateUpdateMessage struct {
	Metadata GameMetadata
	// only one of the following will be non-nil
	Err                error
	Commitment         *CommitmentUpdate
	Reveal             *RevealUpdate
	CommitmentComplete *CommitmentComplete
	Result             *Result
	StartSuccess       *bool
}

// Dealer is a peristent process that runs in the chat client that deals out a game. It can have multiple
// games running at once.
type Dealer struct {
	sync.Mutex
	dh            DealersHelper
	games         map[GameKey](chan<- *GameMessageWrapped)
	shutdownMu    sync.Mutex
	shutdownCh    chan struct{}
	chatInputCh   chan *GameMessageWrapped
	gameUpdateCh  chan GameStateUpdateMessage
	previousGames map[GameIDKey]bool
}

// DealersHelper is an interface that calling chat clients need to implement.
type DealersHelper interface {
	CLogf(ctx context.Context, fmt string, args ...interface{})
	Clock() clockwork.Clock
	ServerTime(context.Context) (time.Time, error)
	SendChat(ctx context.Context, ch chat1.ConversationID, gameID chat1.FlipGameID, msg GameMessageEncoded) error
	Me() UserDevice
}

// NewDealer makes a new Dealer with a given DealersHelper
func NewDealer(dh DealersHelper) *Dealer {
	return &Dealer{
		dh:            dh,
		games:         make(map[GameKey](chan<- *GameMessageWrapped)),
		chatInputCh:   make(chan *GameMessageWrapped),
		gameUpdateCh:  make(chan GameStateUpdateMessage, 500),
		previousGames: make(map[GameIDKey]bool),
	}
}

// UpdateCh returns a channel that sends a sequence of GameStateUpdateMessages, each notifying the
// UI about changes to ongoing games.
func (d *Dealer) UpdateCh() <-chan GameStateUpdateMessage {
	return d.gameUpdateCh
}

// Run a dealer in a given context. It wil run as long as it isn't shutdown.
func (d *Dealer) Run(ctx context.Context) error {
	d.shutdownMu.Lock()
	shutdownCh := make(chan struct{})
	d.shutdownCh = shutdownCh
	d.shutdownMu.Unlock()
	for {
		select {

		case <-ctx.Done():
			return ctx.Err()

			// This channel never closes
		case msg := <-d.chatInputCh:
			err := d.handleMessage(ctx, msg)
			if err != nil {
				d.dh.CLogf(ctx, "Error reading message: %s", err.Error())
			}

			// exit the loop if we've shutdown
		case <-d.shutdownCh:
			return io.EOF

		}
	}
}

// Stop a dealer on process shutdown.
func (d *Dealer) Stop() {
	d.shutdownMu.Lock()
	if d.shutdownCh != nil {
		close(d.shutdownCh)
		d.shutdownCh = nil
	}
	d.shutdownMu.Unlock()
	d.stopGames()
}

// StartFlip starts a new flip. Pass it some start parameters as well as a chat conversationID that it
// will take place in.
func (d *Dealer) StartFlip(ctx context.Context, start Start, conversationID chat1.ConversationID) (err error) {
	_, err = d.startFlip(ctx, start, conversationID)
	return err
}

// StartFlipWithGameID starts a new flip. Pass it some start parameters as well as a chat conversationID
// that it will take place in. Also takes a GameID
func (d *Dealer) StartFlipWithGameID(ctx context.Context, start Start, conversationID chat1.ConversationID,
	gameID chat1.FlipGameID) (err error) {
	_, err = d.startFlipWithGameID(ctx, start, conversationID, gameID)
	return err
}

// InjectIncomingChat should be called whenever a new flip game comes in that's relevant for flips.
// Call this with the sender's information, the channel information, and the body data that came in.
// The last bool is true only if this is the first message in the channel. The current model is that only
// one "game" is allowed for each chat channel. So any prior messages in the channel mean it might be replay.
// This is significantly less general than an earlier model, which is why we introduced the concept of
// a gameID, so it might be changed in the future.
func (d *Dealer) InjectIncomingChat(ctx context.Context, sender UserDevice,
	conversationID chat1.ConversationID, gameID chat1.FlipGameID, body GameMessageEncoded,
	firstInConversation bool) error {
	gmwe := GameMessageWrappedEncoded{
		Sender:              sender,
		GameID:              gameID,
		Body:                body,
		FirstInConversation: firstInConversation,
	}
	msg, err := gmwe.Decode()
	if err != nil {
		return err
	}
	if !msg.Msg.Md.ConversationID.Eq(conversationID) {
		return BadChannelError{G: msg.Msg.Md, C: conversationID}
	}
	if !msg.isForwardable() {
		return UnforwardableMessageError{G: msg.Msg.Md}
	}
	if !msg.Msg.Md.GameID.Eq(gameID) {
		return BadGameIDError{G: msg.Msg.Md, I: gameID}
	}
	d.chatInputCh <- msg
	return nil
}

// NewStartWithBool makes new start parameters that yield a coinflip game.
func NewStartWithBool(now time.Time) Start {
	ret := newStart(now)
	ret.Params = NewFlipParametersWithBool()
	return ret
}

// NewStartWithInt makes new start parameters that yield a coinflip game that picks an int between
// 0 and mod.
func NewStartWithInt(now time.Time, mod int64) Start {
	ret := newStart(now)
	ret.Params = NewFlipParametersWithInt(mod)
	return ret
}

// NewStartWithBigInt makes new start parameters that yield a coinflip game that picks big int between
// 0 and mod.
func NewStartWithBigInt(now time.Time, mod *big.Int) Start {
	ret := newStart(now)
	ret.Params = NewFlipParametersWithBig(mod.Bytes())
	return ret
}

// NewStartWithShuffle makes new start parameters for a coinflip that randomly permutes the numbers
// between 0 and n, exclusive. This can be used to shuffle an array of names.
func NewStartWithShuffle(now time.Time, n int64) Start {
	ret := newStart(now)
	ret.Params = NewFlipParametersWithShuffle(n)
	return ret
}
