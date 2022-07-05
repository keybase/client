package flip

import (
	"errors"
	"fmt"
	"strings"

	chat1 "github.com/keybase/client/go/protocol/chat1"
)

type Error struct {
	NoCommitments  []Player
	NoReveals      []Player
	BadCommitments []Player
	Duplicates     []Player
}

func (e *Error) addNoCommitment(p Player) {
	e.NoCommitments = append(e.NoCommitments, p)
}

func (e *Error) addNoReveal(p Player) {
	e.NoReveals = append(e.NoReveals, p)
}

func (e *Error) addBadCommitment(p Player) {
	e.BadCommitments = append(e.BadCommitments, p)
}

func (e *Error) addDuplicate(p Player) {
	e.Duplicates = append(e.Duplicates, p)
}

func (e Error) IsNil() bool {
	return len(e.NoCommitments)+len(e.NoReveals)+len(e.BadCommitments) == 0
}

func (e Error) format(out []string, what string, players []Player) []string {
	if len(players) == 0 {
		return out
	}
	var playerStrings []string
	for _, p := range players {
		playerStrings = append(playerStrings, string(p))
	}
	s := fmt.Sprintf("Players %s: %s", what, strings.Join(playerStrings, ","))
	return append(out, s)
}

func (e Error) Error() string {
	var parts []string
	parts = e.format(parts, "without commitments", e.NoCommitments)
	parts = e.format(parts, "without reveals", e.NoReveals)
	parts = e.format(parts, "with bad commitments", e.BadCommitments)
	parts = e.format(parts, "with duplicated IDs", e.Duplicates)
	return fmt.Sprintf("Errors in flip: %s", strings.Join(parts, ";"))
}

type GameAlreadyStartedError struct {
	G GameMetadata
}

func (g GameAlreadyStartedError) Error() string {
	return fmt.Sprintf("Game already started: %s", g.G)
}

type GameFinishedError struct {
	G GameMetadata
}

func (g GameFinishedError) Error() string {
	return fmt.Sprintf("Game is finished: %s", g.G)
}

type TimeoutError struct {
	G     GameMetadata
	Stage Stage
}

type GameAbortedError struct{}

func (g GameAbortedError) Error() string {
	return "game was aborted before it yielded a result or any reveals"
}

func (t TimeoutError) Error() string {
	return fmt.Sprintf("Game %s timed out in stage: %d", t.G, t.Stage)
}

type BadMessageForStageError struct {
	G           GameMetadata
	MessageType MessageType
	Stage       Stage
}

func (b BadMessageForStageError) Error() string {
	return fmt.Sprintf("Message received (%s) was for wrong stage (%s) for game %s", b.G, b.MessageType, b.Stage)
}

type BadVersionError Version

func (b BadVersionError) Error() string {
	return fmt.Sprintf("Bad version %d: can only handle V1", b)
}

type BadUserDeviceError struct {
	Expected UserDevice
	Actual   UserDevice
}

func (b BadUserDeviceError) Error() string {
	return "Bad user device; didn't match expectations"
}

type DuplicateRegistrationError struct {
	G GameMetadata
	U UserDevice
}

func (d DuplicateRegistrationError) Error() string {
	return fmt.Sprintf("User %s registered more than once in game %s", d.U.ToKey(), d.G)
}

type DuplicateCommitmentCompleteError struct {
	G GameMetadata
	U UserDevice
}

func (d DuplicateCommitmentCompleteError) Error() string {
	return fmt.Sprintf("Initiator announced a duplicate commitment user %s in game %s", d.U.ToKey(), d.G)
}

type WrongSenderError struct {
	G        GameMetadata
	Expected UserDevice
	Actual   UserDevice
}

func (w WrongSenderError) Error() string {
	return fmt.Sprintf("For game %s, wrong message sender; wanted %s but got %s",
		w.G, w.Expected.ToKey(), w.Actual.ToKey())
}

type BadRevealError struct {
	G GameMetadata
	U UserDevice
}

func (b BadRevealError) Error() string {
	return fmt.Sprintf("In game %s, bad reveal for %s", b.G, b.U.ToKey())
}

type DuplicateRevealError struct {
	G GameMetadata
	U UserDevice
}

func (d DuplicateRevealError) Error() string {
	return fmt.Sprintf("In game %s, duplicated reveal for %s", d.G, d.U.ToKey())
}

type NoRevealError struct {
	G GameMetadata
	U UserDevice
}

func (n NoRevealError) Error() string {
	return fmt.Sprintf("In game %s, no reveal fo %s", n.G, n.U.ToKey())
}

type BadLocalClockError struct {
	G GameMetadata
}

func (b BadLocalClockError) Error() string {
	return fmt.Sprintf("Cannot particpate in game %s due to local clock skew", b.G)
}

type BadLeaderClockError struct {
	G GameMetadata
}

func (b BadLeaderClockError) Error() string {
	return fmt.Sprintf("Cannot particpate in game %s due to leader's clock skew", b.G)
}

type GameReplayError struct {
	G chat1.FlipGameID
}

func (g GameReplayError) Error() string {
	return fmt.Sprintf("GameID was replayed: %s", g.G)
}

type AbsenteesError struct {
	Absentees []UserDevice
}

func (l AbsenteesError) Error() string {
	return fmt.Sprintf("Flip failed! Some users didn't reveal in time (%+v)", l.Absentees)
}

type GameShutdownError struct {
	G GameMetadata
}

func (g GameShutdownError) Error() string {
	return fmt.Sprintf("Game was shutdown before it completed: %s", g.G)
}

type BadChannelError struct {
	G GameMetadata
	C chat1.ConversationID
}

func (b BadChannelError) Error() string {
	return fmt.Sprintf("Data for game %s came in on wrong channel (%s)", b.G, b.C)
}

type UnforwardableMessageError struct {
	G GameMetadata
}

func (u UnforwardableMessageError) Error() string {
	return fmt.Sprintf("Refusing to forward a mesasge that isn't forwardable (%s)", u.G)
}

type BadMessageError struct {
	G GameMetadata
	T MessageType
}

func (b BadMessageError) Error() string {
	return fmt.Sprintf("Bad message of type %d received for game %s", b.T, b.G)
}

type BadFlipTypeError struct {
	G GameMetadata
	T FlipType
}

func (b BadFlipTypeError) Error() string {
	return fmt.Sprintf("Bad flip type %d for game %s", b.T, b.G)
}

var ErrBadData = errors.New("rejecting bad data, likely due to a nil field")

type BadGameIDError struct {
	G GameMetadata
	I chat1.FlipGameID
}

func (b BadGameIDError) Error() string {
	return fmt.Sprintf("Bad game ID (%s) on incoming message for %s", b.I, b.G)
}

type CommitmentMismatchError struct {
	G GameMetadata
	U UserDevice
}

func (c CommitmentMismatchError) Error() string {
	return fmt.Sprintf("Commitment wasn't correct for user %s in game %s", c.U, c.G)
}

type CommitmentCompleteSortError struct {
	G GameMetadata
}

func (c CommitmentCompleteSortError) Error() string {
	return fmt.Sprintf("Commitment list wasn't sorted properly; the leader is cheating!")
}

type BadCommitmentCompleteHashError struct {
	G GameMetadata
	U UserDevice
}

func (b BadCommitmentCompleteHashError) Error() string {
	return fmt.Sprintf("Commitment complete hash error for game %s by user %s", b.G, b.U)
}

type RevealTooLateError struct {
	G GameMetadata
	U UserDevice
}

func (b RevealTooLateError) Error() string {
	return fmt.Sprintf("Reveal from %s for get %s arrived too late", b.G, b.U)
}

type ReplayError struct {
	s string
}

func NewReplayError(s string) ReplayError {
	return ReplayError{s: s}
}

func (r ReplayError) Error() string {
	return fmt.Sprintf("")
}

type DuplicateCommitmentError struct{}

func (d DuplicateCommitmentError) Error() string {
	return "Duplicated commitment, something is fishy"
}
