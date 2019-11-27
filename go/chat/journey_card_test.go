package chat

import (
	"context"
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

func TestJourneycardStorage(t *testing.T) {
	ctx, world, ri, _, sender, _ := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	uid := u.User.GetUID().ToBytes()
	tc := world.Tcs[u.Username]
	conv := newBlankConv(ctx, t, tc, uid, ri, sender, u.Username)
	mkctx := func() context.Context { return libkb.WithLogTag(context.Background(), "TST") }

	t.Logf("setup complete")
	tc.ChatG.JourneyCardManager.SentMessage(mkctx(), uid, conv.GetConvID())
	t.Logf("sent message")
	js, err := tc.ChatG.JourneyCardManager.(*JourneyCardManager).get(mkctx(), uid)
	require.NoError(t, err)
	jcd, err := js.getConvData(mkctx(), conv.GetConvID())
	require.NoError(t, err)
	require.True(t, jcd.SentMessage)

	t.Logf("switch users")
	uid2kb, err := keybase1.UIDFromString("295a7eea607af32040647123732bc819")
	require.NoError(t, err)
	uid2 := gregor1.UID(uid2kb.ToBytes())
	js, err = tc.ChatG.JourneyCardManager.(*JourneyCardManager).get(mkctx(), uid2)
	require.NoError(t, err)
	jcd, err = js.getConvData(mkctx(), conv.GetConvID())
	require.NoError(t, err)
	require.False(t, jcd.SentMessage)

	t.Logf("switch back")
	js, err = tc.ChatG.JourneyCardManager.(*JourneyCardManager).get(mkctx(), uid)
	require.NoError(t, err)
	jcd, err = js.getConvData(mkctx(), conv.GetConvID())
	require.NoError(t, err)
	require.True(t, jcd.SentMessage)
}
