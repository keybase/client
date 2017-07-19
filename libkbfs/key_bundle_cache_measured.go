// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import metrics "github.com/rcrowley/go-metrics"

// KeyBundleCacheMeasured delegates to another KeyBundleCache instance but
// also keeps track of stats.
type KeyBundleCacheMeasured struct {
	delegate                      KeyBundleCache
	getReaderBundleTimer          metrics.Timer
	getWriterBundleTimer          metrics.Timer
	putReaderBundleTimer          metrics.Timer
	putWriterBundleTimer          metrics.Timer
	hitReaderBundleCountMeter     metrics.Meter
	hitWriterBundleCountMeter     metrics.Meter
	attemptReaderBundleCountMeter metrics.Meter
	attemptWriterBundleCountMeter metrics.Meter
}

var _ KeyBundleCache = KeyBundleCacheMeasured{}

// NewKeyBundleCacheMeasured creates and returns a new KeyBundleCacheMeasured
// instance with the given delegate and registry.
func NewKeyBundleCacheMeasured(delegate KeyBundleCache, r metrics.Registry) KeyBundleCacheMeasured {
	getReaderBundleTimer := metrics.GetOrRegisterTimer("KeyBundleCache.GetTLFReaderKeyBundle", r)
	putReaderBundleTimer := metrics.GetOrRegisterTimer("KeyBundleCache.PutTLFReaderKeyBundle", r)
	getWriterBundleTimer := metrics.GetOrRegisterTimer("KeyBundleCache.GetTLFWriterKeyBundle", r)
	putWriterBundleTimer := metrics.GetOrRegisterTimer("KeyBundleCache.PutTLFWriterKeyBundle", r)
	hitReaderBundleCountMeter := metrics.GetOrRegisterMeter("KeyBundleCache.TLFReaderKeyBundleHitCount", r)
	hitWriterBundleCountMeter := metrics.GetOrRegisterMeter("KeyBundleCache.TLFWriterKeyBundleHitCount", r)
	attemptReaderBundleCountMeter := metrics.GetOrRegisterMeter("KeyBundleCache.TLFReaderKeyBundleAttemptCount", r)
	attemptWriterBundleCountMeter := metrics.GetOrRegisterMeter("KeyBundleCache.TLFWriterKeyBundleAttemptCount", r)
	return KeyBundleCacheMeasured{
		delegate:                      delegate,
		getReaderBundleTimer:          getReaderBundleTimer,
		getWriterBundleTimer:          getWriterBundleTimer,
		putReaderBundleTimer:          putReaderBundleTimer,
		putWriterBundleTimer:          putWriterBundleTimer,
		hitReaderBundleCountMeter:     hitReaderBundleCountMeter,
		hitWriterBundleCountMeter:     hitWriterBundleCountMeter,
		attemptReaderBundleCountMeter: attemptReaderBundleCountMeter,
		attemptWriterBundleCountMeter: attemptWriterBundleCountMeter,
	}
}

// GetTLFReaderKeyBundle implements the KeyBundleCache interface for
// KeyBundleCacheMeasured.
func (b KeyBundleCacheMeasured) GetTLFReaderKeyBundle(
	bundleID TLFReaderKeyBundleID) (rkb *TLFReaderKeyBundleV3, err error) {
	b.attemptReaderBundleCountMeter.Mark(1)
	b.getReaderBundleTimer.Time(func() {
		rkb, err = b.delegate.GetTLFReaderKeyBundle(bundleID)
	})
	if err == nil && rkb != nil {
		b.hitReaderBundleCountMeter.Mark(1)
	}
	return rkb, err
}

// GetTLFWriterKeyBundle implements the KeyBundleCache interface for
// KeyBundleCacheMeasured.
func (b KeyBundleCacheMeasured) GetTLFWriterKeyBundle(
	bundleID TLFWriterKeyBundleID) (wkb *TLFWriterKeyBundleV3, err error) {
	b.attemptWriterBundleCountMeter.Mark(1)
	b.getWriterBundleTimer.Time(func() {
		wkb, err = b.delegate.GetTLFWriterKeyBundle(bundleID)
	})
	if err == nil && wkb != nil {
		b.hitWriterBundleCountMeter.Mark(1)
	}
	return wkb, err
}

// PutTLFReaderKeyBundle implements the KeyBundleCache interface for
// KeyBundleCacheMeasured.
func (b KeyBundleCacheMeasured) PutTLFReaderKeyBundle(
	bundleID TLFReaderKeyBundleID, rkb TLFReaderKeyBundleV3) {
	b.putReaderBundleTimer.Time(func() {
		b.delegate.PutTLFReaderKeyBundle(bundleID, rkb)
	})
}

// PutTLFWriterKeyBundle implements the KeyBundleCache interface for
// KeyBundleCacheMeasured.
func (b KeyBundleCacheMeasured) PutTLFWriterKeyBundle(
	bundleID TLFWriterKeyBundleID, wkb TLFWriterKeyBundleV3) {
	b.putWriterBundleTimer.Time(func() {
		b.delegate.PutTLFWriterKeyBundle(bundleID, wkb)
	})
}
