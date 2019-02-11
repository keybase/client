package flip

import (
	"context"
	"crypto/rand"
	"fmt"
	clockwork "github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
	"math/big"
	"testing"
	"time"
)

type testDealersHelper struct {
	clock clockwork.FakeClock
	me    UserDevice
	ch    chan GameMessageWrappedEncoded
}

func newTestDealersHelper(me UserDevice) *testDealersHelper {
	return &testDealersHelper{
		clock: clockwork.NewFakeClock(),
		me:    me,
		ch:    make(chan GameMessageWrappedEncoded, 10),
	}
}

func (t *testDealersHelper) Clock() clockwork.Clock {
	return t.clock
}

func (t *testDealersHelper) ServerTime(context.Context) (time.Time, error) {
	return t.clock.Now(), nil
}

func (t *testDealersHelper) CLogf(ctx context.Context, fmtString string, args ...interface{}) {
	fmt.Printf(fmtString+"\n", args...)
}

func (t *testDealersHelper) ReadHistory(ctx context.Context, since time.Time) ([]GameMessageWrappedEncoded, error) {
	return nil, nil
}

func (t *testDealersHelper) Me() UserDevice {
	return t.me
}

func (t *testDealersHelper) SendChat(ctx context.Context, conversationID ConversationID, msg GameMessageEncoded) error {
	t.ch <- GameMessageWrappedEncoded{Body: msg, Sender: t.me}
	return nil
}

func randBytes(i int) []byte {
	ret := make([]byte, i)
	rand.Read(ret[:])
	return ret
}

type testUser struct {
	ud     UserDevice
	secret Secret
}

func newTestUser() UserDevice {
	return UserDevice{
		U: randBytes(6),
		D: randBytes(6),
	}
}

func newGameMessageEncoded(t *testing.T, md GameMetadata, b GameMessageBody) GameMessageEncoded {
	ret, err := b.Encode(md)
	require.NoError(t, err)
	return ret
}

type testBundle struct {
	me        UserDevice
	dh        *testDealersHelper
	dealer    *Dealer
	channelID ConversationID
	start     Start
	leader    *playerControl
	followers []*playerControl
}

func (b *testBundle) run(ctx context.Context) {
	go b.dealer.Run(ctx)
}

func setupTestBundleWithParams(ctx context.Context, t *testing.T, params FlipParameters) *testBundle {
	me := newTestUser()
	dh := newTestDealersHelper(me)
	dealer := NewDealer(dh)
	start := Start{
		StartTime:            ToTime(dh.clock.Now()),
		CommitmentWindowMsec: 5 * 1000,
		RevealWindowMsec:     5 * 1000,
		SlackMsec:            1 * 1000,
		Params:               params,
	}
	channelID := ConversationID(randBytes(6))

	return &testBundle{
		me:        me,
		dh:        dh,
		dealer:    dealer,
		channelID: channelID,
		start:     start,
	}
}

func setupTestBundle(ctx context.Context, t *testing.T) *testBundle {
	return setupTestBundleWithParams(ctx, t, NewFlipParametersWithBool())
}

func (b *testBundle) makeFollowers(t *testing.T, n int) {
	for i := 0; i < n; i++ {
		b.makeFollower(t)
	}
}

func (b *testBundle) runFollowersCommit(ctx context.Context, t *testing.T) {
	for _, f := range b.followers {
		b.sendCommitment(ctx, t, f)
	}
}

func (b *testBundle) runFollowersReveal(ctx context.Context, t *testing.T) {
	for _, f := range b.followers {
		b.sendReveal(ctx, t, f)
	}
}

func (b *testBundle) sendReveal(ctx context.Context, t *testing.T, p *playerControl) {
	msg, err := NewGameMessageBodyWithReveal(p.secret).Encode(p.md)
	require.NoError(t, err)
	b.dealer.InjectIncomingChat(ctx, p.me, p.md.ConversationID, msg)
	b.receiveRevealFrom(t, p)
}

func (b *testBundle) sendCommitment(ctx context.Context, t *testing.T, p *playerControl) {
	msg, err := NewGameMessageBodyWithCommitment(p.commitment).Encode(p.md)
	require.NoError(t, err)
	b.dealer.InjectIncomingChat(ctx, p.me, p.md.ConversationID, msg)
	b.receiveCommitmentFrom(t, p)
}

func (b *testBundle) receiveCommitmentFrom(t *testing.T, p *playerControl) {
	res := <-b.dealer.UpdateCh()
	require.NotNil(t, res.Commitment)
	require.Equal(t, p.me, *res.Commitment)
}

func (b *testBundle) receiveRevealFrom(t *testing.T, p *playerControl) {
	res := <-b.dealer.UpdateCh()
	require.NotNil(t, res.Reveal)
	require.Equal(t, p.me, *res.Reveal)
}

func (b *testBundle) makeFollower(t *testing.T) {
	f, err := b.dealer.newPlayerControl(newTestUser(), b.leader.GameMetadata(), b.start)
	require.NoError(t, err)
	b.followers = append(b.followers, f)
}

func (b *testBundle) stop() {
	b.dealer.Stop()
}

func (b *testBundle) assertOutgoingChatSent(t *testing.T, typ MessageType) GameMessageWrappedEncoded {
	msg := <-b.dh.ch
	v1, err := msg.Decode()
	require.NoError(t, err)
	imt, err := v1.Msg.Body.T()
	require.NoError(t, err)
	require.Equal(t, imt, typ)
	return msg
}

func TestLeader3Followers(t *testing.T) {
	testLeader(t, 3)
}

func TestLeader10Followers(t *testing.T) {
	testLeader(t, 10)
}

func TestLeader100Followers(t *testing.T) {
	testLeader(t, 100)
}

func TestLeader1000Followers(t *testing.T) {
	testLeader(t, 1000)
}

func testLeader(t *testing.T, nFollowers int) {
	ctx := context.Background()
	b := setupTestBundle(ctx, t)
	b.run(ctx)
	defer b.stop()
	leader, err := b.dealer.startFlip(ctx, b.start, b.channelID)
	require.NoError(t, err)
	b.leader = leader
	b.assertOutgoingChatSent(t, MessageType_START)
	b.receiveCommitmentFrom(t, leader)
	b.assertOutgoingChatSent(t, MessageType_COMMITMENT)
	b.makeFollowers(t, nFollowers)
	b.runFollowersCommit(ctx, t)
	b.dh.clock.Advance(time.Duration(6001) * time.Millisecond)
	msg := <-b.dealer.UpdateCh()
	require.NotNil(t, msg.CommitmentComplete)
	require.Equal(t, (nFollowers + 1), len(msg.CommitmentComplete.Players))
	b.assertOutgoingChatSent(t, MessageType_COMMITMENT_COMPLETE)
	b.assertOutgoingChatSent(t, MessageType_REVEAL)
	b.receiveRevealFrom(t, leader)
	b.runFollowersReveal(ctx, t)
	msg = <-b.dealer.UpdateCh()
	require.NotNil(t, msg.Result)
	require.NotNil(t, msg.Result.Bool)
}

type breakpoint func(t *testing.T, b *testBundle, c *testBundle) bool

type testController struct {
	b1 breakpoint
	b2 breakpoint
}

func pi() *big.Int {
	var m big.Int
	m.SetString("3141592653589793238462643383279502884197169399375", 10)
	return &m
}

func testLeaderFollowerPair(t *testing.T, testController testController) {
	ctx := context.Background()

	// The leader's state machine
	mb := pi().Bytes()

	b := setupTestBundleWithParams(ctx, t, NewFlipParametersWithBig(mb))
	b.run(ctx)
	defer b.stop()
	err := b.dealer.StartFlip(ctx, b.start, b.channelID)
	require.NoError(t, err)

	// The follower's state machine
	c := setupTestBundle(ctx, t)
	c.run(ctx)
	defer c.stop()

	verifyMyCommitment := func(who *testBundle) {
		msg := <-who.dealer.UpdateCh()
		require.NotNil(t, msg.Commitment)
		require.Equal(t, *msg.Commitment, who.dh.Me())
	}

	verifyTheirCommitment := func(me *testBundle, them *testBundle) {
		msg := <-me.dealer.UpdateCh()
		require.NotNil(t, msg.Commitment)
		require.Equal(t, *msg.Commitment, them.dh.Me())
	}

	verifyCommitmentComplete := func() {
		msg := <-b.dealer.UpdateCh()
		require.NotNil(t, msg.CommitmentComplete)
		checkPlayers := func(v []UserDevice) {
			require.Equal(t, 2, len(v))
			find := func(p UserDevice) {
				require.True(t, v[0].Eq(p) || v[1].Eq(p))
			}
			find(b.dh.Me())
			find(c.dh.Me())
		}
		checkPlayers(msg.CommitmentComplete.Players)
		msg = <-c.dealer.UpdateCh()
		require.NotNil(t, msg.CommitmentComplete)
		checkPlayers(msg.CommitmentComplete.Players)
	}

	verifyMyReveal := func(who *testBundle) {
		msg := <-who.dealer.UpdateCh()
		require.NotNil(t, msg.Reveal)
		require.Equal(t, *msg.Reveal, who.dh.Me())
	}

	verifyTheirReveal := func(me *testBundle, them *testBundle) {
		msg := <-me.dealer.UpdateCh()
		require.NotNil(t, msg.Reveal)
		require.Equal(t, *msg.Reveal, them.dh.Me())
	}

	getResult := func(who *testBundle) *big.Int {
		msg := <-who.dealer.UpdateCh()
		require.NotNil(t, msg.Result)
		require.NotNil(t, msg.Result.Big)
		return msg.Result.Big
	}

	chatMsg := b.assertOutgoingChatSent(t, MessageType_START)
	err = c.dealer.InjectIncomingChat(ctx, chatMsg.Sender, b.channelID, chatMsg.Body)
	require.NoError(t, err)

	cB := b.assertOutgoingChatSent(t, MessageType_COMMITMENT)
	cC := c.assertOutgoingChatSent(t, MessageType_COMMITMENT)
	verifyMyCommitment(b)
	verifyMyCommitment(c)

	err = c.dealer.InjectIncomingChat(ctx, cB.Sender, b.channelID, cB.Body)
	require.NoError(t, err)
	err = b.dealer.InjectIncomingChat(ctx, cC.Sender, b.channelID, cC.Body)
	require.NoError(t, err)
	verifyTheirCommitment(b, c)
	verifyTheirCommitment(c, b)

	if testController.b1 != nil {
		ret := testController.b1(t, b, c)
		if !ret {
			return
		}
	}

	b.dh.clock.Advance(time.Duration(6001) * time.Millisecond)
	chatMsg = b.assertOutgoingChatSent(t, MessageType_COMMITMENT_COMPLETE)
	err = c.dealer.InjectIncomingChat(ctx, chatMsg.Sender, b.channelID, chatMsg.Body)
	require.NoError(t, err)
	verifyCommitmentComplete()

	// Both B & C reveal their messages
	rB := b.assertOutgoingChatSent(t, MessageType_REVEAL)
	rC := c.assertOutgoingChatSent(t, MessageType_REVEAL)
	verifyMyReveal(b)
	verifyMyReveal(c)

	err = c.dealer.InjectIncomingChat(ctx, rB.Sender, b.channelID, rB.Body)
	require.NoError(t, err)

	err = b.dealer.InjectIncomingChat(ctx, rC.Sender, b.channelID, rC.Body)
	require.NoError(t, err)

	verifyTheirReveal(b, c)
	verifyTheirReveal(c, b)

	if testController.b2 != nil {
		ret := testController.b2(t, b, c)
		if !ret {
			return
		}
	}

	resB := getResult(b)
	resC := getResult(c)
	require.Equal(t, 0, resB.Cmp(resC))
}

func TestLeaderFollowerPair(t *testing.T) {
	testLeaderFollowerPair(t, testController{})
}
