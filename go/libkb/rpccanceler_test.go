package libkb

import (
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestRPCCanceler(t *testing.T) {
	ctx := context.Background()
	r := NewRPCCanceler()
	r.RegisterContext(ctx, RPCCancelerReasonBackground)
	r.CancelLiveContexts(RPCCancelerReasonLogout)
	select {
	case <-ctx.Done():
		require.Fail(t, "should not be done")
	default:
	}
	r.CancelLiveContexts(RPCCancelerReasonBackground)
	select {
	case err := <-ctx.Done():
		require.Equal(t, err, context.Canceled)
	default:
	}
	ctx = context.Background()
	r.RegisterContext(ctx, RPCCancelerReasonAll)
	r.CancelLiveContexts(RPCCancelerReasonBackground)
	select {
	case err := <-ctx.Done():
		require.Equal(t, err, context.Canceled)
	default:
	}
}
