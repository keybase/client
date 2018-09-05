package libkb

import (
	"sync"
	"time"
)

// FeatureFlagGate allows the server to disable certain features by replying with a
// FEATURE_FLAG API status code, which is then translated into a FeatureFlagError.
// We cache these errors for a given amount of time, so we're not spamming the
// same attempt over and over again.
type FeatureFlagGate struct {
	sync.Mutex
	lastCheck time.Time
	lastError error
	feature   Feature
	cacheFor  time.Duration
}

const (
	FeatureFTL = Feature("ftl")
)

func NewFeatureFlagGate(f Feature, d time.Duration) *FeatureFlagGate {
	return &FeatureFlagGate{
		feature:  f,
		cacheFor: d,
	}
}

func (f *FeatureFlagGate) DigestError(m MetaContext, err error) {
	if err == nil {
		return
	}
	ffe, ok := err.(FeatureFlagError)
	if !ok {
		return
	}
	if ffe.Feature() != f.feature {
		m.CDebugf("Got feature flag error for wrong feature: %v", err)
		return
	}

	m.CDebugf("Server reports feature %q is flagged off", f.feature)

	f.Lock()
	defer f.Unlock()
	f.lastCheck = m.G().Clock().Now()
	f.lastError = err
}

func (f *FeatureFlagGate) ErrorIfFlagged(m MetaContext) (err error) {
	f.Lock()
	defer f.Unlock()
	if f.lastError == nil {
		return nil
	}
	diff := m.G().Clock().Now().Sub(f.lastCheck)
	if diff > f.cacheFor {
		m.CDebugf("Feature flag %q expired %d ago, let's give it another try", f.feature, diff)
		f.lastError = nil
		f.lastCheck = time.Time{}
	}
	return f.lastError
}
