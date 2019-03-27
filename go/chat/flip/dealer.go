package flip

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"math"
	"math/big"
	"strings"
	"time"

	chat1 "github.com/keybase/client/go/protocol/chat1"
	clockwork "github.com/keybase/clockwork"
)

// Excludes `Params` from being logged.
func (s Start) String() string {
	return fmt.Sprintf("{StartTime:%v CommitmentWindowMsec:%v RevealWindowMsec:%v SlackMsec:%v CommitmentCompleteWindowMsec:%v}",
		s.StartTime, s.CommitmentWindowMsec, s.RevealWindowMsec, s.SlackMsec, s.CommitmentWindowMsec)
}

type GameMessageWrapped struct {
	Sender              UserDevice
	Msg                 GameMessageV1
	Me                  *playerControl
	Forward             bool
	FirstInConversation bool
}

func (m GameMessageWrapped) isForwardable() bool {
	t, _ := m.Msg.Body.T()
	return t != MessageType_END
}

func (m GameMessageWrapped) GameMetadata() GameMetadata {
	return m.Msg.Md
}

func (g GameMetadata) ToKey() GameKey {
	return GameKey(strings.Join([]string{g.Initiator.U.String(), g.Initiator.D.String(), g.ConversationID.String(), g.GameID.String()}, ","))
}

func (g GameMetadata) String() string {
	return string(g.ToKey())
}

func (g GameMetadata) check() bool {
	return g.Initiator.check() && !g.ConversationID.IsNil() && g.GameID.Check()
}

type GameKey string
type GameIDKey string
type UserDeviceKey string

func (u UserDevice) ToKey() UserDeviceKey {
	return UserDeviceKey(strings.Join([]string{u.U.String(), u.D.String()}, ","))
}

func (u UserDevice) check() bool {
	return u.U.Bytes() != nil && u.D.Bytes() != nil
}

func GameIDToKey(g chat1.FlipGameID) GameIDKey {
	return GameIDKey(g.String())
}

type Result struct {
	Shuffle []int
	Bool    *bool
	Int     *int64
	Big     *big.Int
}

type Game struct {
	md                     GameMetadata
	msgID                  int
	clockSkew              time.Duration
	start                  time.Time
	isLeader               bool
	params                 Start
	key                    GameKey
	msgCh                  <-chan *GameMessageWrapped
	stage                  Stage
	stageForTimeout        Stage
	players                map[UserDeviceKey]*GamePlayerState
	commitments            map[string]bool
	gameUpdateCh           chan GameStateUpdateMessage
	nPlayers               int
	dealer                 *Dealer
	me                     *playerControl
	commitmentCompleteHash Hash
	clock                  func() clockwork.Clock
	clogf                  func(ctx context.Context, fmt string, args ...interface{})

	// To handle reorderings between CommitmentComplete and commitements,
	// wee need some extra bookkeeping.
	iWasIncluded          bool
	iOptedOutOfCommit     bool
	gotCommitmentComplete bool
	latecomers            map[UserDeviceKey]bool
}

type GamePlayerState struct {
	ud               UserDevice
	commitment       *Commitment
	commitmentTime   time.Time
	leaderCommitment *Commitment
	included         bool
	secret           *Secret
}

func (g *Game) GameMetadata() GameMetadata {
	return g.md
}

func MakeGameMessageEncoded(s string) GameMessageEncoded {
	return GameMessageEncoded(s)
}

func (e GameMessageEncoded) String() string {
	return string(e)
}

func (e GameMessageEncoded) Decode() (*GameMessageV1, error) {
	raw, err := base64.StdEncoding.DecodeString(string(e))
	if err != nil {
		return nil, err
	}
	var msg GameMessage
	err = msgpackDecode(&msg, raw)
	if err != nil {
		return nil, err
	}
	v, err := msg.V()
	if err != nil {
		return nil, err
	}
	if v != Version_V1 {
		return nil, BadVersionError(v)
	}
	tmp := msg.V1()
	if !tmp.Md.check() {
		return nil, ErrBadData
	}
	return &tmp, nil
}

func (e *GameMessageWrappedEncoded) Decode() (*GameMessageWrapped, error) {
	v1, err := e.Body.Decode()
	if err != nil {
		return nil, err
	}
	ret := GameMessageWrapped{Sender: e.Sender, Msg: *v1, FirstInConversation: e.FirstInConversation}
	if !e.GameID.Eq(ret.Msg.Md.GameID) {
		return nil, BadGameIDError{G: ret.Msg.Md, I: e.GameID}
	}
	return &ret, nil
}

func (m GameMessageWrapped) Encode() (GameMessageEncoded, error) {
	return m.Msg.Encode()
}

func (b GameMessageBody) Encode(md GameMetadata) (GameMessageEncoded, error) {
	v1 := GameMessageV1{Md: md, Body: b}
	return v1.Encode()
}

func (v GameMessageV1) Encode() (GameMessageEncoded, error) {
	msg := NewGameMessageWithV1(v)
	raw, err := msgpackEncode(msg)
	if err != nil {
		return GameMessageEncoded(""), err
	}
	return GameMessageEncoded(base64.StdEncoding.EncodeToString(raw)), nil
}

func (d *Dealer) run(ctx context.Context, game *Game) {
	doneCh := make(chan error)
	key := game.key
	go game.run(ctx, doneCh)
	err := <-doneCh

	if err != nil {
		d.dh.CLogf(ctx, "[%s] Error running game %s: %s", d.dh.Me(), key, err.Error())

	} else {
		d.dh.CLogf(ctx, "Game %s ended cleanly", key)
	}

	// If the game was shutdown via the Dealer#Stop call, then
	// don't close the channel (again) or remove the channel from the
	// map, it's already dead.
	if _, ok := err.(GameShutdownError); ok {
		return
	}

	d.Lock()
	if ch := d.games[key]; ch != nil {
		close(ch)
		delete(d.games, key)
		delete(d.gameIDs, GameIDToKey(game.md.GameID))
	}
	d.Unlock()
}

func (g *Game) getNextTimer() <-chan time.Time {
	dl := g.nextDeadline()
	return g.clock().AfterTime(dl)
}

func (g *Game) CommitmentEndTime() time.Time {
	// If we're the leader, then let's cut off when we say we're going to cut off
	// If we're not, then let's give extra time (a multiple of 2) to the leader.
	return g.start.Add(g.params.CommitmentWindowWithSlack(g.isLeader))
}

func (g *Game) RevealEndTime() time.Time {
	return g.start.Add(g.params.RevealWindowWithSlack())
}

func (g *Game) nextDeadline() time.Time {
	switch g.stageForTimeout {
	case Stage_ROUND1:
		return g.CommitmentEndTime()
	case Stage_ROUND2:
		return g.RevealEndTime()
	default:
		return time.Time{}
	}
}

func (g Game) commitmentPayload() CommitmentPayload {
	return CommitmentPayload{
		V: Version_V1,
		U: g.md.Initiator.U,
		D: g.md.Initiator.D,
		C: g.md.ConversationID,
		G: g.md.GameID,
		S: g.params.StartTime,
	}
}

func (g *Game) setSecret(ctx context.Context, ps *GamePlayerState, secret Secret) error {
	expected, err := secret.computeCommitment(g.commitmentPayload())
	if err != nil {
		return err
	}
	if ps.secret != nil {
		return DuplicateRevealError{G: g.md, U: ps.ud}
	}
	if !expected.Eq(*ps.commitment) {
		return BadRevealError{G: g.md, U: ps.ud}
	}
	ps.secret = &secret
	return nil
}

func (g *Game) finishGame(ctx context.Context) error {
	var xor Secret
	for _, ps := range g.players {
		if !ps.included {
			continue
		}
		if ps.secret == nil {
			return NoRevealError{G: g.md, U: ps.ud}
		}
		xor.XOR(*ps.secret)
	}
	prng := NewPRNG(xor)
	err := g.doFlip(ctx, prng)
	g.sendOutgoingChat(ctx, NewGameMessageBodyWithEnd())
	return err
}

func (g *Game) doFlip(ctx context.Context, prng *PRNG) error {
	params := g.params.Params
	t, err := params.T()
	if err != nil {
		return err
	}
	var res Result
	switch t {
	case FlipType_BOOL:
		tmp := prng.Bool()
		res.Bool = &tmp
	case FlipType_INT:
		tmp := prng.Int(params.Int())
		res.Int = &tmp
	case FlipType_BIG:
		var modulus big.Int
		modulus.SetBytes(params.Big())
		res.Big = prng.Big(&modulus)
	case FlipType_SHUFFLE:
		res.Shuffle = prng.Permutation(int(params.Shuffle()))
	default:
		return BadFlipTypeError{G: g.GameMetadata(), T: t}
	}

	g.gameUpdateCh <- GameStateUpdateMessage{
		Metadata: g.GameMetadata(),
		Result:   &res,
	}
	return nil
}

func (g *Game) playerCommitedInTime(ps *GamePlayerState, now time.Time) bool {
	diff := ps.commitmentTime.Sub(g.start)
	return diff < g.params.CommitmentWindowWithSlack(true)
}

func (g *Game) getPlayerState(ud UserDevice) *GamePlayerState {
	key := ud.ToKey()
	ret := g.players[key]
	if ret != nil {
		return ret
	}
	ret = &GamePlayerState{ud: ud}
	g.players[key] = ret
	return ret
}

func (g *Game) handleCommitment(ctx context.Context, sender UserDevice, now time.Time, com Commitment) (err error) {
	ps := g.getPlayerState(sender)
	if ps.commitment != nil {
		return DuplicateRegistrationError{g.md, sender}
	}
	if ps.leaderCommitment != nil && !ps.leaderCommitment.Eq(com) {
		return CommitmentMismatchError{G: g.GameMetadata(), U: sender}
	}
	ps.commitment = &com
	ps.commitmentTime = now

	comHex := hex.EncodeToString(com[:])
	if g.commitments[comHex] {
		return DuplicateCommitmentError{}
	}
	g.commitments[comHex] = true

	// If this user was a latecomer (we got the commitment after we got the CommitmentComplete),
	// then we mark them as being accounted for.
	delete(g.latecomers, sender.ToKey())

	g.gameUpdateCh <- GameStateUpdateMessage{
		Metadata: g.GameMetadata(),
		Commitment: &CommitmentUpdate{
			User:       sender,
			Commitment: com,
		},
	}
	return g.maybeReveal(ctx)
}

func (g *Game) maybeReveal(ctx context.Context) (err error) {

	if !g.gotCommitmentComplete {
		return nil
	}
	if len(g.latecomers) > 0 {
		return nil
	}

	g.stage = Stage_ROUND2
	g.stageForTimeout = Stage_ROUND2

	if g.me == nil {
		return nil
	}

	if !g.iWasIncluded && !g.iOptedOutOfCommit {
		g.clogf(ctx, "The leader didn't include me (%s) so not sending a reveal (%s)", g.me.me, g.md)
		return nil
	}

	reveal := Reveal{
		Secret: g.me.secret,
		Cch:    g.commitmentCompleteHash,
	}
	g.sendOutgoingChat(ctx, NewGameMessageBodyWithReveal(reveal))
	return nil
}

func (g *Game) handleCommitmentCompletePlayer(ctx context.Context, u UserDeviceCommitment) (err error) {

	ps := g.getPlayerState(u.Ud)
	if ps.leaderCommitment != nil {
		return DuplicateCommitmentCompleteError{G: g.md, U: u.Ud}
	}
	if ps.commitment != nil && !ps.commitment.Eq(u.C) {
		return CommitmentMismatchError{G: g.md, U: u.Ud}
	}
	if ps.commitment == nil {
		g.latecomers[u.Ud.ToKey()] = true
	}
	ps.leaderCommitment = &u.C
	ps.included = true
	g.nPlayers++

	if g.me != nil && g.me.me.Eq(u.Ud) {
		g.iWasIncluded = true
	}
	return nil
}

func (g *Game) handleCommitmentComplete(ctx context.Context, sender UserDevice, now time.Time, cc CommitmentComplete) (err error) {

	if !sender.Eq(g.md.Initiator) {
		return WrongSenderError{G: g.md, Expected: g.md.Initiator, Actual: sender}
	}

	if !checkUserDeviceCommitments(cc.Players) {
		return CommitmentCompleteSortError{G: g.md}
	}

	for _, u := range cc.Players {
		err = g.handleCommitmentCompletePlayer(ctx, u)
		if err != nil {
			return err
		}
	}

	cch, err := hashUserDeviceCommitments(cc.Players)
	if err != nil {
		return err
	}

	g.commitmentCompleteHash = cch
	g.gotCommitmentComplete = true

	// for now, just warn if users who made it in on time weren't included.
	for _, ps := range g.players {
		if !ps.included && g.playerCommitedInTime(ps, now) && g.clogf != nil {
			g.clogf(ctx, "User %s wasn't included, but they should have been", ps.ud)
		}
	}

	g.gameUpdateCh <- GameStateUpdateMessage{
		Metadata:           g.GameMetadata(),
		CommitmentComplete: &cc,
	}

	return g.maybeReveal(ctx)
}

func errToOk(err error) string {
	if err == nil {
		return "ok"
	}
	return "ERROR: " + err.Error()
}

func (g *Game) handleMessage(ctx context.Context, msg *GameMessageWrapped, now time.Time) (err error) {

	msgID := g.msgID
	g.msgID++

	g.clogf(ctx, "+ Game#handleMessage: %s@%d <- %+v", g.GameMetadata(), msgID, *msg)
	defer func() { g.clogf(ctx, "- Game#handleMessage: %s@%d -> %s", g.GameMetadata(), msgID, errToOk(err)) }()

	t, err := msg.Msg.Body.T()
	if err != nil {
		return err
	}
	badStage := func() error {
		return BadMessageForStageError{G: g.GameMetadata(), MessageType: t, Stage: g.stage}
	}
	switch t {

	case MessageType_START:
		return badStage()

	case MessageType_END:
		return io.EOF

	case MessageType_COMMITMENT:
		if g.stage != Stage_ROUND1 {
			g.clogf(ctx, "User %s sent a commitment too late, not included in game %s", msg.Sender, g.md)
			return nil
		}

		err = g.handleCommitment(ctx, msg.Sender, now, msg.Msg.Body.Commitment())
		if err != nil {
			return err
		}

	case MessageType_COMMITMENT_COMPLETE:
		if g.stage != Stage_ROUND1 {
			return badStage()
		}

		err = g.handleCommitmentComplete(ctx, msg.Sender, now, msg.Msg.Body.CommitmentComplete())
		if err != nil {
			return err
		}

	case MessageType_REVEAL:
		if g.stage != Stage_ROUND2 {
			return badStage()
		}
		if now.After(g.RevealEndTime()) {
			return RevealTooLateError{G: g.md, U: msg.Sender}
		}
		key := msg.Sender.ToKey()
		ps := g.players[key]

		if ps == nil {
			g.clogf(ctx, "Skipping unregistered revealer %s for game %s", msg.Sender, g.md)
			return nil
		}
		if !ps.included {
			g.clogf(ctx, "Skipping unincluded revealer %s for game %s", msg.Sender, g.md)
			return nil
		}

		reveal := msg.Msg.Body.Reveal()
		if !g.commitmentCompleteHash.Eq(reveal.Cch) {
			return BadCommitmentCompleteHashError{G: g.GameMetadata(), U: msg.Sender}
		}
		err := g.setSecret(ctx, ps, reveal.Secret)
		if err != nil {
			return err
		}
		g.gameUpdateCh <- GameStateUpdateMessage{
			Metadata: g.GameMetadata(),
			Reveal: &RevealUpdate{
				User:   msg.Sender,
				Reveal: reveal.Secret,
			},
		}

		g.nPlayers--
		if g.nPlayers == 0 {
			return g.finishGame(ctx)
		}

	default:
		return BadMessageError{G: g.GameMetadata()}
	}

	return nil
}

func (g *Game) userDeviceCommitmentList() []UserDeviceCommitment {
	var ret []UserDeviceCommitment
	for _, p := range g.players {
		if p.commitment != nil {
			ret = append(ret, UserDeviceCommitment{Ud: p.ud, C: *p.commitment})
		}
	}
	sortUserDeviceCommitments(ret)
	return ret
}

func (g *Game) completeCommitments(ctx context.Context) error {
	cc := CommitmentComplete{
		Players: g.userDeviceCommitmentList(),
	}
	body := NewGameMessageBodyWithCommitmentComplete(cc)
	g.stageForTimeout = Stage_ROUND2
	g.sendOutgoingChat(ctx, body)
	return nil
}

func (g *Game) absentees() []UserDevice {
	var bad []UserDevice
	for _, p := range g.players {
		if p.included && p.secret == nil {
			bad = append(bad, p.ud)
		}
	}
	return bad
}

func (g *Game) sendOutgoingChat(ctx context.Context, body GameMessageBody) {
	// Call back into the dealer, to reroute a message back into our
	// game, but do so in a Go routine so we don't deadlock. There could be
	// 100 incoming messages in front of us, all coming off the chat channel,
	// so we're ok to send when we can. If use the game in the context of
	// replay, the dealer will be nil, so no need to send.
	if g.dealer != nil {
		go g.dealer.sendOutgoingChat(ctx, g.GameMetadata(), nil, body)
	}
}

func (g *Game) handleTimerEvent(ctx context.Context) error {
	if g.isLeader && g.stageForTimeout == Stage_ROUND1 {
		return g.completeCommitments(ctx)
	}

	absentees := g.absentees()

	if g.stageForTimeout == Stage_ROUND2 && len(absentees) > 0 {
		return AbsenteesError{Absentees: absentees}
	}

	return TimeoutError{G: g.md, Stage: g.stageForTimeout}
}

func (g *Game) runMain(ctx context.Context) error {
	for {
		timer := g.getNextTimer()
		var err error
		select {
		case <-timer:
			err = g.handleTimerEvent(ctx)
		case msg, ok := <-g.msgCh:
			if !ok {
				return GameShutdownError{G: g.GameMetadata()}
			}
			err = g.handleMessage(ctx, msg, g.clock().Now())
		case <-ctx.Done():
			return ctx.Err()
		}
		if err == io.EOF {
			return nil
		}
		if err != nil {
			g.gameUpdateCh <- GameStateUpdateMessage{
				Metadata: g.GameMetadata(),
				Err:      err,
			}
			return err
		}
	}
}

func (g *Game) runDrain(ctx context.Context) {
	i := 0
	for range g.msgCh {
		i++
	}
	if i > 0 {
		g.clogf(ctx, "drained %d messages on shutdown in game %s", i, g.md)
	}
}

func (g *Game) run(ctx context.Context, doneCh chan error) {
	doneCh <- g.runMain(ctx)
	g.runDrain(ctx)
}

func absDuration(d time.Duration) time.Duration {
	if d < time.Duration(0) {
		return time.Duration(-1) * d
	}
	return d
}

func (d *Dealer) computeClockSkew(ctx context.Context, md GameMetadata, leaderTime time.Time, myNow time.Time) (skew time.Duration, err error) {
	serverTime, err := d.dh.ServerTime(ctx)
	if err != nil {
		return skew, err
	}
	return computeClockSkew(md, serverTime, leaderTime, myNow)
}

func computeClockSkew(md GameMetadata, serverTime time.Time, leaderTime time.Time, myNow time.Time) (skew time.Duration, err error) {
	localTime := myNow
	leaderSkew := leaderTime.Sub(serverTime)
	localSkew := localTime.Sub(serverTime)

	if absDuration(localSkew) > MaxClockSkew {
		return time.Duration(0), BadLocalClockError{G: md}
	}
	if absDuration(leaderSkew) > MaxClockSkew {
		return time.Duration(0), BadLeaderClockError{G: md}
	}
	totalSkew := localTime.Sub(leaderTime)

	return totalSkew, nil
}

func (d *Dealer) handleMessageStart(ctx context.Context, msg *GameMessageWrapped, start Start) error {
	d.Lock()
	defer d.Unlock()
	md := msg.GameMetadata()
	key := md.ToKey()
	gameIDKey := GameIDToKey(md.GameID)
	if d.games[key] != nil {
		return GameAlreadyStartedError{G: md}
	}
	if _, found := d.gameIDs[gameIDKey]; found {
		return GameReplayError{G: md.GameID}
	}
	if !msg.Sender.Eq(md.Initiator) {
		return WrongSenderError{G: md, Expected: msg.Sender, Actual: md.Initiator}
	}
	cs, err := d.computeClockSkew(ctx, md, start.StartTime.Time(), d.dh.Clock().Now())
	if err != nil {
		return err
	}

	if !msg.FirstInConversation {
		return GameReplayError{md.GameID}
	}

	isLeader := true
	me := msg.Me
	// Make a new follower player controller if one didn't already exist (since we were
	// the Leader)
	if me == nil {
		me, err = d.newPlayerControl(d.dh.Me(), md, start)
		if err != nil {
			return err
		}
		isLeader = false
	}

	optedOutOfCommit := false
	if !isLeader {
		optedOutOfCommit = !d.dh.ShouldCommit(ctx)
	}

	msgCh := make(chan *GameMessageWrapped)
	game := &Game{
		md:                msg.GameMetadata(),
		isLeader:          isLeader,
		clockSkew:         cs,
		start:             d.dh.Clock().Now(),
		key:               key,
		params:            start,
		msgCh:             msgCh,
		stage:             Stage_ROUND1,
		stageForTimeout:   Stage_ROUND1,
		gameUpdateCh:      d.gameUpdateCh,
		players:           make(map[UserDeviceKey]*GamePlayerState),
		commitments:       make(map[string]bool),
		dealer:            d,
		me:                me,
		clock:             d.dh.Clock,
		clogf:             d.dh.CLogf,
		latecomers:        make(map[UserDeviceKey]bool),
		iOptedOutOfCommit: optedOutOfCommit,
	}
	d.games[key] = msgCh
	d.gameIDs[gameIDKey] = md
	d.previousGames[GameIDToKey(md.GameID)] = true

	go d.run(ctx, game)

	// Once the game has started, we are free to send a message into the channel
	// with our commitment. We are now in the inner loop of the Dealer, so we
	// have to do this send in a Go-routine, so as not to deadlock the Dealer.
	if !isLeader && !optedOutOfCommit {
		go d.sendCommitment(ctx, md, me)
	}
	return nil
}

func (d *Dealer) handleMessageOthers(c context.Context, msg *GameMessageWrapped) error {
	d.Lock()
	defer d.Unlock()
	md := msg.GameMetadata()
	key := md.ToKey()
	game := d.games[key]
	if game == nil {
		return GameFinishedError{G: md}
	}
	game <- msg
	return nil
}

func (d *Dealer) handleMessage(ctx context.Context, msg *GameMessageWrapped) error {
	d.dh.CLogf(ctx, "flip.Dealer: Incoming: %+v", msg)

	t, err := msg.Msg.Body.T()
	if err != nil {
		return err
	}
	switch t {
	case MessageType_START:
		err = d.handleMessageStart(ctx, msg, msg.Msg.Body.Start())
		if err != nil {
			d.gameUpdateCh <- GameStateUpdateMessage{
				Metadata: msg.Msg.Md,
				Err:      err,
			}
		}
	default:
		err = d.handleMessageOthers(ctx, msg)
	}
	if err != nil {
		return err
	}
	if !(msg.Forward && msg.isForwardable()) {
		return nil
	}
	// Encode and send the message through the external server-routed chat channel
	emsg, err := msg.Encode()
	if err != nil {
		return err
	}
	err = d.dh.SendChat(ctx, msg.Msg.Md.ConversationID, msg.Msg.Md.GameID, emsg)
	if err != nil {
		return err
	}
	return nil
}

func (d *Dealer) stopGames() {
	d.Lock()
	defer d.Unlock()
	for k, ch := range d.games {
		delete(d.games, k)
		close(ch)
	}
}

type playerControl struct {
	me         UserDevice
	md         GameMetadata
	secret     Secret
	commitment Commitment
	start      Start
	dealer     *Dealer
}

func (d *Dealer) newPlayerControl(me UserDevice, md GameMetadata, start Start) (*playerControl, error) {
	secret := GenerateSecret()
	cp := CommitmentPayload{
		V: Version_V1,
		U: md.Initiator.U,
		D: md.Initiator.D,
		C: md.ConversationID,
		G: md.GameID,
		S: start.StartTime,
	}
	commitment, err := secret.computeCommitment(cp)
	if err != nil {
		return nil, err
	}
	return &playerControl{
		me:         me,
		md:         md,
		secret:     secret,
		commitment: commitment,
		start:      start,
		dealer:     d,
	}, nil
}

func (p *playerControl) GameMetadata() GameMetadata {
	return p.md
}

func (d *Dealer) startFlip(ctx context.Context, start Start, conversationID chat1.ConversationID) (pc *playerControl, err error) {
	return d.startFlipWithGameID(ctx, start, conversationID, GenerateGameID())
}

func (d *Dealer) startFlipWithGameID(ctx context.Context, start Start, conversationID chat1.ConversationID,
	gameID chat1.FlipGameID) (pc *playerControl, err error) {
	md := GameMetadata{
		Initiator:      d.dh.Me(),
		ConversationID: conversationID,
		GameID:         gameID,
	}
	pc, err = d.newPlayerControl(d.dh.Me(), md, start)
	if err != nil {
		return nil, err
	}
	err = d.sendOutgoingChatWithFirst(ctx, md, pc, NewGameMessageBodyWithStart(start), true)
	if err != nil {
		return nil, err
	}
	err = d.sendCommitment(ctx, md, pc)
	if err != nil {
		return nil, err
	}
	return pc, nil
}

func (d *Dealer) sendCommitment(ctx context.Context, md GameMetadata, pc *playerControl) error {
	return d.sendOutgoingChat(ctx, md, nil, NewGameMessageBodyWithCommitment(pc.commitment))
}

func (d *Dealer) sendOutgoingChat(ctx context.Context, md GameMetadata, me *playerControl, body GameMessageBody) error {
	return d.sendOutgoingChatWithFirst(ctx, md, me, body, false)
}

func (d *Dealer) sendOutgoingChatWithFirst(ctx context.Context, md GameMetadata, me *playerControl, body GameMessageBody, firstInConversation bool) error {

	gmw := GameMessageWrapped{
		Sender:              d.dh.Me(),
		Me:                  me,
		FirstInConversation: firstInConversation,
		Msg: GameMessageV1{
			Md:   md,
			Body: body,
		},
	}

	// Only mark the forward bit to be true on messages that we can forward.
	gmw.Forward = gmw.isForwardable()

	// Reinject the message into the state machine.
	d.chatInputCh <- &gmw

	return nil
}

var DefaultCommitmentWindowMsec int64 = 3 * 1000
var DefaultRevealWindowMsec int64 = 30 * 1000
var DefaultCommitmentCompleteWindowMsec int64 = 15 * 1000
var DefaultSlackMsec int64 = 1 * 1000

// For bigger groups, everything is slower, like the time to digest all required messages. So we're
// going to inflate our timeouts.
func inflateTimeout(timeout int64, nPlayers int) int64 {
	if nPlayers <= 5 {
		return timeout
	}
	return int64(math.Ceil(math.Log(float64(nPlayers)) * float64(timeout) / math.Log(5.0)))
}

func newStart(now time.Time, nPlayers int) Start {
	return Start{
		StartTime:                    ToTime(now),
		CommitmentWindowMsec:         inflateTimeout(DefaultCommitmentWindowMsec, nPlayers),
		RevealWindowMsec:             inflateTimeout(DefaultRevealWindowMsec, nPlayers),
		CommitmentCompleteWindowMsec: inflateTimeout(DefaultCommitmentCompleteWindowMsec, nPlayers),
		SlackMsec:                    inflateTimeout(DefaultSlackMsec, nPlayers),
	}
}
