// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package offline

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

func TestRPCCacheBestEffort(t *testing.T) {
	tc := libkb.SetupTest(t, "RPCCache()", 1)
	defer tc.Cleanup()

	fakeClock := clockwork.NewFakeClock()
	tc.G.SetClock(fakeClock)

	rpcCache := NewRPCCache(tc.G)

	inHandlerCh := make(chan struct{}, 1)
	handlerCh := make(chan interface{}, 1)
	handler := func(mctx libkb.MetaContext) (interface{}, error) {
		inHandlerCh <- struct{}{}
		return <-handlerCh, nil
	}

	mctx := libkb.NewMetaContextBackground(tc.G)

	t.Log("Populate the cache via the handler")
	rpc := "TestRPC"
	key := 1
	value := 2
	handlerCh <- value
	var res int
	resp := &res
	servedRes, err := rpcCache.Serve(
		mctx, keybase1.OfflineAvailability_BEST_EFFORT, 1, rpc, false,
		key, resp, handler)
	require.NoError(t, err)
	require.Equal(t, 0, res) // `res` isn't filled in when the handler is used.
	require.Equal(t, value, servedRes.(int))
	<-inHandlerCh

	t.Log("Read via the handler, when the cache is populated")
	var res2 int
	resp2 := &res2
	handlerCh <- value
	servedRes2, err := rpcCache.Serve(
		mctx, keybase1.OfflineAvailability_BEST_EFFORT, 1, rpc, false,
		key, resp2, handler)
	require.NoError(t, err)
	require.Equal(t, 2, res2) // `res` is filled in by the cache, but shouldn't be used because `servedRes2` is also filled in.
	require.Equal(t, value, servedRes2.(int))
	<-inHandlerCh

	t.Log("Read via the cache, when connected but the handler is slow")
	var res3 int
	resp3 := &res3
	var servedRes3 interface{}
	errCh := make(chan error)
	go func() {
		var err error
		servedRes3, err = rpcCache.Serve(
			mctx, keybase1.OfflineAvailability_BEST_EFFORT, 1, rpc, false,
			key, resp3, handler)
		errCh <- err
	}()

	// Wait for the handler to be entered, then advance the clock.
	<-inHandlerCh
	fakeClock.Advance(bestEffortHandlerTimeout + 1)
	err = <-errCh
	require.NoError(t, err)
	require.Equal(t, 2, res3)
	require.Nil(t, servedRes3) // The filled-in cached value should be used.
}
