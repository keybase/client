package libkbfs

import metrics "github.com/rcrowley/go-metrics"

// KeyCacheMeasured delegates to another KeyCache instance but
// also keeps track of stats.
type KeyCacheMeasured struct {
	delegate      KeyCache
	getTimer      metrics.Timer
	putTimer      metrics.Timer
	hitCountMeter metrics.Meter
}

var _ KeyCache = KeyCacheMeasured{}

// NewKeyCacheMeasured creates and returns a new KeyCacheMeasured
// instance with the given delegate and registry.
func NewKeyCacheMeasured(delegate KeyCache, r metrics.Registry) KeyCacheMeasured {
	getTimer := metrics.GetOrRegisterTimer("KeyCache.GetTLFCryptKey", r)
	putTimer := metrics.GetOrRegisterTimer("KeyCache.PutTLFCryptKey", r)
	// TODO: Implement RatioGauge (
	// http://metrics.dropwizard.io/3.1.0/manual/core/#ratio-gauges
	// ) so we can actually display a hit ratio.
	hitCountMeter := metrics.GetOrRegisterMeter("KeyCache.HitCount", r)
	return KeyCacheMeasured{
		delegate:      delegate,
		getTimer:      getTimer,
		putTimer:      putTimer,
		hitCountMeter: hitCountMeter,
	}
}

// GetTLFCryptKey implements the KeyCache interface for
// KeyCacheMeasured.
func (b KeyCacheMeasured) GetTLFCryptKey(tlfID TlfID, keyGen KeyGen) (key TLFCryptKey, err error) {
	b.getTimer.Time(func() {
		key, err = b.delegate.GetTLFCryptKey(tlfID, keyGen)
	})
	if err == nil {
		b.hitCountMeter.Mark(1)
	}
	return key, err
}

// PutTLFCryptKey implements the KeyCache interface for
// KeyCacheMeasured.
func (b KeyCacheMeasured) PutTLFCryptKey(tlfID TlfID, keyGen KeyGen, key TLFCryptKey) (err error) {
	b.putTimer.Time(func() {
		err = b.delegate.PutTLFCryptKey(tlfID, keyGen, key)
	})
	return err
}
