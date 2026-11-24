// Copyright 2026 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAuthRefresherWaiterReturnsWhenCanceled(t *testing.T) {
	var r authRefresher
	running := make(chan struct{})
	release := make(chan struct{})
	done := make(chan struct{})
	go func() {
		defer close(done)
		r.refresh(context.Background(), func(context.Context) {
			close(running)
			<-release
		})
	}()
	<-running

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	ran := false
	r.refresh(ctx, func(context.Context) { ran = true })
	require.False(t, ran)

	close(release)
	<-done
}
