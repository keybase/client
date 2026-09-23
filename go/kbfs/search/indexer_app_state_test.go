// Copyright 2026 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/env"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// backgroundKbCtx reports a BACKGROUND app state that never changes, and
// sends every state it is asked to wait on to waits.
type backgroundKbCtx struct {
	env.Context
	waits chan keybase1.MobileAppState
}

func (c backgroundKbCtx) NextAppStateUpdate(
	lastState keybase1.MobileAppState,
) <-chan struct{} {
	select {
	case c.waits <- lastState:
	default:
	}
	if lastState != keybase1.MobileAppState_BACKGROUND {
		ch := make(chan struct{})
		close(ch)
		return ch
	}
	return nil
}

func (c backgroundKbCtx) AppState() keybase1.MobileAppState {
	return keybase1.MobileAppState_BACKGROUND
}

type backgroundConfig struct {
	libkbfs.Config
	kbCtx backgroundKbCtx
}

func (c backgroundConfig) KbContext() libkbfs.Context {
	return c.kbCtx
}

func TestIndexerPausedLoopExitsOnShutdown(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	config := libkbfs.MakeTestConfigOrBust(t, "user1")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	bgConfig := backgroundConfig{
		Config: config,
		kbCtx: backgroundKbCtx{
			Context: config.KbContext(),
			waits:   make(chan keybase1.MobileAppState, 100),
		},
	}
	noIndex := func(
		context.Context, libkbfs.Config, idutil.SessionInfo, logger.Logger,
	) (context.Context, libkbfs.Config, func(context.Context) error, error) {
		return nil, nil, nil, errors.New("no index in this test")
	}
	i, err := newIndexerWithConfigInit(
		bgConfig, noIndex, testKVStoreName("TestIndexerPausedLoopExitsOnShutdown"))
	require.NoError(t, err)

	timeout := time.After(30 * time.Second)
	for paused := false; !paused; {
		select {
		case state := <-bgConfig.kbCtx.waits:
			paused = state == keybase1.MobileAppState_BACKGROUND
		case <-timeout:
			t.Fatal("indexer loop did not pause")
		}
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(ctx, 10*time.Second)
	defer shutdownCancel()
	require.NoError(t, i.Shutdown(shutdownCtx), "paused indexer loop did not exit on shutdown")
}
