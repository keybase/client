package rpc

import (
	"golang.org/x/net/context"
)

// CtxRpcKey is a type defining the context key for the RPC context
type CtxRpcKey int

const (
	// CtxRpcTagsKey defines a context key that can hold a slice of context keys
	CtxRpcTagsKey CtxRpcKey = iota
)

type CtxRpcTags map[string]interface{}

// AddRpcTagsToContext adds the given log tag mappings (logTagsToAdd) to the
// given context, creating a new one if necessary. Returns the resulting
// context with the new log tag mappings.
func AddRpcTagsToContext(ctx context.Context, logTagsToAdd CtxRpcTags) context.Context {
	currTags, ok := RpcTagsFromContext(ctx)
	if !ok {
		currTags = make(CtxRpcTags)
		ctx = context.WithValue(ctx, CtxRpcTagsKey, currTags)
	}
	for key, tag := range logTagsToAdd {
		currTags[key] = tag
	}
	return ctx
}

// RpcTagsFromContext returns the tags being passed along with the given context.
func RpcTagsFromContext(ctx context.Context) (CtxRpcTags, bool) {
	logTags, ok := ctx.Value(CtxRpcTagsKey).(CtxRpcTags)
	return logTags, ok
}
