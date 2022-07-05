// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"

	"github.com/keybase/client/go/logger"
	"golang.org/x/net/context"
)

type defaultContextReplacer struct{} // nolint

func (defaultContextReplacer) maybeReplaceContext(context.Context) {}

// protectedContext is a construct that helps avoid unwanted change of context
// when the context needs to be stored.
type protectedContext struct {
	mu  sync.RWMutex
	ctx context.Context
	log logger.Logger

	// defaultContextReplacer is embeded here as a helper that includes a no-op
	// maybeReplaceContext, so that we can "override" the method in tests.
	defaultContextReplacer // nolint
}

func newProtectedContext(
	ctx context.Context, log logger.Logger) *protectedContext {
	return &protectedContext{ctx: ctx, log: log}
}

func (c *protectedContext) setLogger(log logger.Logger) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.log = log
}

// context returns the context stored in the protectedContext.
func (c *protectedContext) context() context.Context {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.ctx
}
