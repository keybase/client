package flip

import (
	"context"
	clockwork "github.com/keybase/clockwork"
	"io"
	"math/big"
	"sync"
	"time"
)

// GameMessageEncoded is a game message that is shipped over the chat channel. Inside, it's a base64-encoded
// msgpack object (generated via AVDL->go compiler), but it's safe to think of it just as an opaque string.
type GameMessageEncoded string

// GameMessageWrappedEncoded contains a sender and a Body. When dealer starts up, it will ask for the
// chat client to play back recent chats about games, via the ReadHistory interface. That will return a bunch
// of `GameMessageWrappedEncoded` for previous game chats that are being replayed.
type GameMessageWrappedEncoded struct {
	Sender UserDevice
	Body   GameMessageEncoded // base64-encoded GameMessaageBody that comes in over chat
}

// GameStateUpdateMessage is sent from the game dealer out to the calling chat client, to update him
// on changes to game state that happened. All update messages are relative to the given GameMetadata.
// For each update, only one of Err, Commitment, Reveal, CommitmentComplete or Result will be non-nil.
type GameStateUpdateMessage struct {
	Metadata GameMetadata
	// only one of the following will be non-nil
	Err                error
	Commitment         *UserDevice
	Reveal             *UserDevice
	CommitmentComplete *CommitmentComplete
	Result             *Result
}

// Dealer is a peristent process that runs in the chat client that deals out a game. It can have multiple
// games running at once.
type Dealer struct {
	sync.Mutex
	dh            DealersHelper
	games         map[GameKey](chan<- *GameMessageWrapped)
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
	ReadHistory(ctx context.Context, since time.Time) ([]GameMessageWrappedEncoded, error)
	SendChat(ctx context.Context, ch ConversationID, msg GameMessageEncoded) error
	Me() UserDevice
}

// NewDealer makes a new Dealer with a given DealersHelper
func NewDealer(dh DealersHelper) *Dealer {
	return &Dealer{
		dh:           dh,
		games:        make(map[GameKey](chan<- *GameMessageWrapped)),
		shutdownCh:   make(chan struct{}),
		chatInputCh:  make(chan *GameMessageWrapped),
		gameUpdateCh: make(chan GameStateUpdateMessage, 500),
	}
}

// UpdateCh returns a channel that sends a sequence of GameStateUpdateMessages, each notifying the
// UI about changes to ongoing games.
func (d *Dealer) UpdateCh() <-chan GameStateUpdateMessage {
	return d.gameUpdateCh
}

// Run a dealer in a given context. It wil run as long as it isn't shutdown.
func (d *Dealer) Run(ctx context.Context) error {
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
	close(d.shutdownCh)
	d.stopGames()
}

// StartFlip starts a new flip. Pass it some start parameters as well as a chat conversationID that it
// will take place in.
func (d *Dealer) StartFlip(ctx context.Context, start Start, conversationID ConversationID) (err error) {
	_, err = d.startFlip(ctx, start, conversationID)
	return err
}

// InjectIncomingChat should be called whenever a new flip game comes in that's relevant for flips. Call this with
// the sender's information, the channel informatino, and the body data that came in.
func (d *Dealer) InjectIncomingChat(ctx context.Context, sender UserDevice, conversationID ConversationID, body GameMessageEncoded) error {
	gmwe := GameMessageWrappedEncoded{
		Sender: sender,
		Body:   body,
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
