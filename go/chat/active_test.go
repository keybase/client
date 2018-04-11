package chat

import (
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/stretchr/testify/require"
)

func TestChatActive(t *testing.T) {
	ctx, world, _, _, _, _ := setupTest(t, 1)

	u := world.GetUsers()[0]
	tc := world.Tcs[u.Username]
	defer tc.Cleanup()
	g := globals.NewContext(tc.G, tc.ChatG)
	log := utils.NewDebugLabeler(g.GetLog(), "TestChatActive", false)

	// The first chat active query should store the current time. Use Unix
	// times, because truncating seconds on only one half of the comparison
	// throws everything off.
	beforeTouch := time.Now().Unix()
	touch := TouchFirstChatActiveQueryTime(ctx, g, log).Unix()
	afterTouch := time.Now().Unix()
	if touch < beforeTouch {
		t.Fatalf("touch unexpectedly early: %d < %d", touch, beforeTouch)
	}
	if touch > afterTouch {
		t.Fatalf("touch unexpectedly late: %d > %d", touch, afterTouch)
	}

	// Subsequent queries shouldn't change the first query time.
	touchAgain := TouchFirstChatActiveQueryTime(ctx, g, log).Unix()
	require.Equal(t, touch, touchAgain)

	// Initially the last send time should be zero.
	zeroLastSend := GetLastSendTime(ctx, g, log)
	require.True(t, zeroLastSend.IsZero())

	// Now do the same exercise with the last send time as we did with the
	// first query time above.
	beforeSend := time.Now().Unix()
	RecordChatSend(ctx, g, log)
	lastSend := GetLastSendTime(ctx, g, log).Unix()
	afterSend := time.Now().Unix()
	if lastSend < beforeSend {
		t.Fatalf("send unexpectedly early: %d < %d", lastSend, beforeSend)
	}
	if lastSend > afterSend {
		t.Fatalf("send unexpectedly late: %d > %d", lastSend, afterSend)
	}
}
