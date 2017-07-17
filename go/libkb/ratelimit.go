// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"sync"
	"time"
)

type RateLimitCategory string

const (
	CheckTrackingRateLimit RateLimitCategory = "CheckTrackingRateLimit"
	TestEventRateLimit                       = "TestEventRateLimit"
)

type RateLimits struct {
	Contextified
	sync.Mutex
	lastActionTimes map[RateLimitCategory]time.Time
}

func NewRateLimits(g *GlobalContext) *RateLimits {
	return &RateLimits{
		lastActionTimes: make(map[RateLimitCategory]time.Time),
		Contextified:    NewContextified(g),
	}
}

func (r *RateLimits) GetPermission(category RateLimitCategory, interval time.Duration) bool {
	r.Lock()
	defer r.Unlock()
	now := time.Now()
	last, exists := r.lastActionTimes[category]
	if !exists {
		r.G().Log.Debug("Rate limit %s checked for the first time.", category)
		r.lastActionTimes[category] = now
		return true
	}
	timeSince := now.Sub(last)
	if timeSince >= interval {
		r.G().Log.Debug("Rate limit %s passed.", category)
		r.lastActionTimes[category] = now
		return true
	}
	r.G().Log.Debug("Rate limit %s too recent.", category)
	return false
}
