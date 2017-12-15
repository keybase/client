package rpc

import (
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestRpcTags(t *testing.T) {
	logTags := make(CtxRpcTags)

	logTags["hello"] = "world"
	logTags["foo"] = "bar"
	ctx := AddRpcTagsToContext(context.Background(), logTags)

	logTags2 := make(CtxRpcTags)
	logTags2["hello"] = "world2"
	ctx = AddRpcTagsToContext(ctx, logTags2)

	logTags, _ = RpcTagsFromContext(ctx)
	require.Equal(t, "world2", logTags["hello"])
	require.Equal(t, "bar", logTags["foo"])

	outTags, ok := RpcTagsFromContext(ctx)

	require.Equal(t, true, ok)
	require.Equal(t, logTags, outTags)
}
