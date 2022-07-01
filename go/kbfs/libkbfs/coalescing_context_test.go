package libkbfs

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type testCtxKey struct{ string }

func TestCoalescingContext(t *testing.T) {
	t.Parallel()
	t.Log("Test basic CoalescingContext with 2 parent contexts.")
	ctx1, cf1 := context.WithCancel(context.WithValue(context.Background(), testCtxKey{"hello"}, "world"))
	ctx2, cf2 := context.WithCancel(context.Background())

	cc, _ := NewCoalescingContext(ctx1)
	err := cc.AddContext(ctx2)
	require.NoError(t, err)
	require.Equal(t, "world", cc.Value(testCtxKey{"hello"}).(string))

	select {
	case <-cc.Done():
		t.Fatalf("Expected CoalescingContext to be blocked")
	default:
	}
	cf1()
	t.Log("Ensure that the CoalescingContext's CancelFunc is idempotent")
	cf1()

	require.NoError(t, cc.Err())

	select {
	case <-cc.Done():
		t.Fatalf("Expected CoalescingContext to still be blocked")
	default:
	}
	cf2()

	t.Log("Verify that the CoalescingContext is Done() only after its parent contexts have both been canceled.")
	select {
	case <-time.After(time.Second):
		t.Fatalf("Expected CoalescingContext to complete after its parent contexts were canceled")
	case <-cc.Done():
	}

	require.EqualError(t, cc.Err(), context.Canceled.Error())

	ctx3, _ := context.WithCancel(context.Background())
	err = cc.AddContext(ctx3)
	require.EqualError(t, err, context.Canceled.Error())
}
