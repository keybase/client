// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	"golang.org/x/net/context"
)

// pinger is a helper type that calls a given function periodically.
type pinger struct {
	name    string
	doPing  func(ctx context.Context)
	timeout time.Duration
	log     logger.Logger

	tickerMu     sync.Mutex
	tickerCancel context.CancelFunc
}

func (p *pinger) pingOnce(ctx context.Context) {
	ctx, cancel := context.WithTimeout(ctx, p.timeout)
	defer cancel()
	p.doPing(ctx)
}

func (p *pinger) cancelTicker() {
	p.tickerMu.Lock()
	defer p.tickerMu.Unlock()

	if p.tickerCancel != nil {
		p.tickerCancel()
		p.tickerCancel = nil
	}
}

func (p *pinger) resetTicker(intervalSeconds int) {
	p.tickerMu.Lock()
	defer p.tickerMu.Unlock()

	if p.tickerCancel != nil {
		p.tickerCancel()
		p.tickerCancel = nil
	}

	p.log.CDebugf(context.TODO(),
		"%s: Starting new ping ticker with interval %d", p.name,
		intervalSeconds)

	var ctx context.Context
	ctx, p.tickerCancel = context.WithCancel(context.Background())
	go func() {
		p.pingOnce(ctx)

		if intervalSeconds <= 0 {
			return
		}

		ticker := time.NewTicker(time.Duration(intervalSeconds) * time.Second)
		for {
			select {
			case <-ticker.C:
				p.pingOnce(ctx)

			case <-ctx.Done():
				p.log.CDebugf(ctx, "%s: stopping ping ticker", p.name)
				ticker.Stop()
				return
			}
		}
	}()
}
