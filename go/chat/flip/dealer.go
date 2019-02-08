package flip

import (
	"context"
	"encoding/base64"
	"io"
	"math/big"
	"strings"
	"time"
)

type GameMessageWrapped struct {
	Sender  UserDevice
	Msg     GameMessageV1
	Me      *playerControl
	Forward bool
}

func (m GameMessageWrapped) isForwardable() bool {
	t, _ := m.Msg.Body.T()
	return t != MessageType_END
}

func (g GameMetadata) ToKey() GameKey {
	return GameKey(strings.Join([]string{g.Initiator.U.String(), g.Initiator.D.String(), g.ConversationID.String(), g.GameID.String()}, ","))
}

func (g GameMetadata) String() string {
	return string(g.ToKey())
}

func (g GameMetadata) check() bool {
	return g.Initiator.check() && g.ConversationID.check() && g.GameID.check()
}

func (m GameMessageWrapped) GameMetadata() GameMetadata {
	return m.Msg.Md
}

type GameKey string
type GameIDKey string
type UserDeviceKey string

func (u UserDevice) ToKey() UserDeviceKey {
	return UserDeviceKey(strings.Join([]string{u.U.String(), u.D.String()}, ","))
}

func (u UserDevice) check() bool {
	return u.U.check() && u.D.check()
}

func (g GameID) ToKey() GameIDKey {
	return GameIDKey(g.String())
}

type Result struct {
	Shuffle []int
	Bool    *bool
	Int     *int64
	Big     *big.Int
}

type Game struct {
	md              GameMetadata
	clockSkew       time.Duration
	start           time.Time
	isLeader        bool
	params          Start
	key             GameKey
	msgCh           <-chan *GameMessageWrapped
	stage           Stage
	stageForTimeout Stage
	dh              DealersHelper
	players         map[UserDeviceKey]*GamePlayerState
	gameUpdateCh    chan GameStateUpdateMessage
	nPlayers        int
	dealer          *Dealer
	me              *playerControl
}

type GamePlayerState struct {
	ud             UserDevice
	commitment     Commitment
	commitmentTime time.Time
	included       bool
	secret         *Secret
}

func (g *Game) GameMetadata() GameMetadata {
	return g.md
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
	ret := GameMessageWrapped{Sender: e.Sender, Msg: *v1}
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
	go func() {
		doneCh <- game.run(ctx)
	}()
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
	}
	d.Unlock()
}

func (g *Game) getNextTimer() <-chan time.Time {
	return g.dh.Clock().AfterTime(g.nextDeadline())
}

func (g *Game) CommitmentEndTime() time.Time {
	// If we're the leader, then let's cut off when we say we're going to cut off
	// If we're not, then let's give extra time (a multiple of 2) to the leader.
	mul := time.Duration(1)
	if !g.isLeader {
		mul = time.Duration(2)
	}
	return g.start.Add(mul * g.params.CommitmentWindowWithSlack())
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
	case Stage_ROUND_CLEANUP:
		return g.start.Add(time.Hour * time.Duration(1000))
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
	if !expected.Eq(ps.commitment) {
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
	return diff < g.params.CommitmentWindowWithSlack()
}

func (g *Game) handleMessage(ctx context.Context, msg *GameMessageWrapped) error {
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
			return badStage()
		}
		key := msg.Sender.ToKey()
		if g.players[key] != nil {
			return DuplicateRegistrationError{g.md, msg.Sender}
		}
		g.players[key] = &GamePlayerState{
			ud:             msg.Sender,
			commitment:     msg.Msg.Body.Commitment(),
			commitmentTime: g.dh.Clock().Now(),
		}
		g.gameUpdateCh <- GameStateUpdateMessage{
			Metadata:   g.GameMetadata(),
			Commitment: &msg.Sender,
		}

	case MessageType_COMMITMENT_COMPLETE:
		if g.stage != Stage_ROUND1 {
			return badStage()
		}
		if !msg.Sender.Eq(g.md.Initiator) {
			return WrongSenderError{G: g.md, Expected: g.md.Initiator, Actual: msg.Sender}
		}
		now := g.dh.Clock().Now()
		cc := msg.Msg.Body.CommitmentComplete()
		for _, u := range cc.Players {
			key := u.ToKey()
			ps := g.players[key]
			if ps == nil {
				return UnregisteredUserError{G: g.md, U: u}
			}
			ps.included = true
			g.nPlayers++
		}

		// for now, just warn if users who made it in on time weren't included.
		for _, ps := range g.players {
			if !ps.included && g.playerCommitedInTime(ps, now) {
				g.dh.CLogf(ctx, "User %s wasn't included, but they should have been", ps.ud)
			}
		}
		g.stage = Stage_ROUND2
		g.stageForTimeout = Stage_ROUND2
		g.gameUpdateCh <- GameStateUpdateMessage{
			Metadata:           g.GameMetadata(),
			CommitmentComplete: &cc,
		}

		if g.me != nil {
			g.sendOutgoingChat(ctx, NewGameMessageBodyWithReveal(g.me.secret))
		}

	case MessageType_REVEAL:
		if g.stage != Stage_ROUND2 {
			return badStage()
		}
		key := msg.Sender.ToKey()
		ps := g.players[key]
		if ps == nil {
			return UnregisteredUserError{G: g.md, U: msg.Sender}
		}
		if !ps.included {
			g.dh.CLogf(ctx, "Skipping unincluded sender: %s", key)
			return nil
		}
		err := g.setSecret(ctx, ps, msg.Msg.Body.Reveal())
		if err != nil {
			return err
		}
		g.gameUpdateCh <- GameStateUpdateMessage{
			Metadata: g.GameMetadata(),
			Reveal:   &msg.Sender,
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

func (g *Game) completeCommitments(ctx context.Context) error {
	var cc CommitmentComplete
	for _, p := range g.players {
		cc.Players = append(cc.Players, p.ud)
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
	// so we're ok to send when we can.
	go g.dealer.sendOutgoingChat(ctx, g.GameMetadata(), nil, body)
}

func (g *Game) handleTimerEvent(ctx context.Context) error {
	if g.isLeader && g.stageForTimeout == Stage_ROUND1 {
		return g.completeCommitments(ctx)
	}

	if g.stageForTimeout == Stage_ROUND2 {
		return AbsenteesError{Absentees: g.absentees()}
	}

	return TimeoutError{G: g.md, Stage: g.stageForTimeout}
}

func (g *Game) run(ctx context.Context) error {
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
			err = g.handleMessage(ctx, msg)
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

func absDuration(d time.Duration) time.Duration {
	if d < time.Duration(0) {
		return time.Duration(-1) * d
	}
	return d
}

func (d *Dealer) computeClockSkew(ctx context.Context, md GameMetadata, leaderTime time.Time) (skew time.Duration, err error) {
	serverTime, err := d.dh.ServerTime(ctx)
	localTime := d.dh.Clock().Now()

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

func (d *Dealer) primeHistory(ctx context.Context) (err error) {
	if d.previousGames != nil {
		return nil
	}

	tmp := make(map[GameIDKey]bool)
	prevs, err := d.dh.ReadHistory(ctx, d.dh.Clock().Now().Add(time.Duration(-2)*MaxClockSkew))
	if err != nil {
		return err
	}
	for _, m := range prevs {
		gmw, err := m.Decode()
		if err != nil {
			return err
		}
		tmp[gmw.Msg.Md.GameID.ToKey()] = true
	}
	d.previousGames = tmp
	return nil
}

func (d *Dealer) handleMessageStart(ctx context.Context, msg *GameMessageWrapped, start Start) error {
	d.Lock()
	defer d.Unlock()
	md := msg.GameMetadata()
	key := md.ToKey()
	if d.games[key] != nil {
		return GameAlreadyStartedError{G: md}
	}
	if !msg.Sender.Eq(md.Initiator) {
		return WrongSenderError{G: md, Expected: msg.Sender, Actual: md.Initiator}
	}
	cs, err := d.computeClockSkew(ctx, md, start.StartTime.Time())
	if err != nil {
		return err
	}

	err = d.primeHistory(ctx)
	if err != nil {
		return err
	}

	if d.previousGames[md.GameID.ToKey()] {
		return GameReplayError{md.GameID}
	}

	isLeader := true
	me := msg.Me
	// Make a new follower player controller if one didn't already exit (since we were
	// the Leader)
	if me == nil {
		me, err = d.newPlayerControl(d.dh.Me(), md, start)
		if err != nil {
			return err
		}
		isLeader = false
	}

	msgCh := make(chan *GameMessageWrapped)
	game := &Game{
		md:              msg.GameMetadata(),
		isLeader:        isLeader,
		clockSkew:       cs,
		start:           d.dh.Clock().Now(),
		key:             key,
		params:          start,
		msgCh:           msgCh,
		stage:           Stage_ROUND1,
		stageForTimeout: Stage_ROUND1,
		dh:              d.dh,
		gameUpdateCh:    d.gameUpdateCh,
		players:         make(map[UserDeviceKey]*GamePlayerState),
		dealer:          d,
		me:              me,
	}
	d.games[key] = msgCh
	d.previousGames[md.GameID.ToKey()] = true

	go d.run(ctx, game)

	// Once the game has started, we are free to send a message into the channel
	// with our commitment. We are now in the inner loop of the Dealer, so we
	// have to do this send in a Go-routine, so as not to deadlock the Dealer.
	if !isLeader {
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
	if !msg.Forward && msg.isForwardable() {
		return nil
	}
	// Encode and send the message through the external server-routed chat channel
	emsg, err := msg.Encode()
	if err != nil {
		return err
	}
	err = d.dh.SendChat(ctx, msg.Msg.Md.ConversationID, emsg)
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

func (d *Dealer) startFlip(ctx context.Context, start Start, conversationID ConversationID) (pc *playerControl, err error) {
	return d.startFlipWithGameID(ctx, start, conversationID, GenerateGameID())
}

func (d *Dealer) startFlipWithGameID(ctx context.Context, start Start, conversationID ConversationID, gameID GameID) (pc *playerControl, err error) {
	md := GameMetadata{
		Initiator:      d.dh.Me(),
		ConversationID: conversationID,
		GameID:         gameID,
	}
	pc, err = d.newPlayerControl(d.dh.Me(), md, start)
	if err != nil {
		return nil, err
	}
	err = d.sendOutgoingChat(ctx, md, pc, NewGameMessageBodyWithStart(start))
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

	gmw := GameMessageWrapped{
		Sender:  d.dh.Me(),
		Me:      me,
		Forward: true,
		Msg: GameMessageV1{
			Md:   md,
			Body: body,
		},
	}

	// Reinject the message into the state machine.
	d.chatInputCh <- &gmw

	return nil
}

func newStart(now time.Time) Start {
	return Start{
		StartTime:            ToTime(now),
		CommitmentWindowMsec: 3 * 1000,
		RevealWindowMsec:     30 * 1000,
		SlackMsec:            1 * 1000,
	}
}
