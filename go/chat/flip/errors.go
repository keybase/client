package flip

import (
	"errors"
	"fmt"
	"strings"
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
	return fmt.Sprintf("User %s registered more than once in game %s", d.G, d.U.ToKey())
}

type UnregisteredUserError struct {
	G GameMetadata
	U UserDevice
}

func (u UnregisteredUserError) Error() string {
	return fmt.Sprintf("Initiator announced an unexpected user %s in game %s", u.G, u.U.ToKey())
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
	G GameID
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
	C ConversationID
}

func (b BadChannelError) Error() string {
	return fmt.Sprintf("Data for game %s came in on wrong channel (%s)", b.G, b.C)
}

type UnforwardableMessageError struct {
	G GameMetadata
}

func (u UnforwardableMessageError) Error() string {
	return fmt.Sprintf("Refusing to forwarda mesasge that isn't forwardable (%s)", u.G)
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
