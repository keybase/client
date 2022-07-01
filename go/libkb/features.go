package libkb

import (
	"strings"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type Feature string
type FeatureFlags []Feature

const (
	EnvironmentFeatureAllowHighSkips   = Feature("env_allow_high_skips")
	EnvironmentFeatureMerkleCheckpoint = Feature("merkle_checkpoint")
)

// StringToFeatureFlags returns a set of feature flags
func StringToFeatureFlags(s string) (ret FeatureFlags) {
	s = strings.TrimSpace(s)
	if len(s) == 0 {
		return ret
	}
	v := strings.Split(s, ",")
	for _, f := range v {
		ret = append(ret, Feature(strings.TrimSpace(f)))
	}
	return ret
}

// Admin returns true if the admin feature set is on or the user is a keybase
// admin.
func (set FeatureFlags) Admin(uid keybase1.UID) bool {
	for _, f := range set {
		if f == Feature("admin") {
			return true
		}
	}
	return IsKeybaseAdmin(uid)
}

func (set FeatureFlags) HasFeature(feature Feature) bool {
	for _, f := range set {
		if f == feature {
			return true
		}
	}
	return false
}

func (set FeatureFlags) Empty() bool {
	return len(set) == 0
}

type featureSlot struct {
	on         bool
	cacheUntil time.Time
}

// FeatureFlagSet is a set of feature flags for a given user. It will keep track
// of whether a feature is on or off, and how long until we should check to
// update
type FeatureFlagSet struct {
	sync.RWMutex
	features map[Feature]*featureSlot
}

const (
	FeatureBoxAuditor                 = Feature("box_auditor3")
	ExperimentalGenericProofs         = Feature("experimental_generic_proofs")
	FeatureCheckForHiddenChainSupport = Feature("check_for_hidden_chain_support")

	// Show journeycards. This 'preview' flag is for development and admin testing.
	// This 'preview' flag is known to clients with old buggy journeycard code. For that reason, don't enable it for external users.
	FeatureJourneycardPreview = Feature("journeycard_preview")
	FeatureJourneycard        = Feature("journeycard")
)

// getInitialFeatures returns the features which a new FeatureFlagSet should
// contain so that they are prefetched the first time the set is used.
func getInitialFeatures() []Feature {
	return []Feature{
		FeatureBoxAuditor,
		ExperimentalGenericProofs,
		FeatureCheckForHiddenChainSupport,
		FeatureJourneycardPreview,
		FeatureJourneycard}
}

// NewFeatureFlagSet makes a new set of feature flags.
func NewFeatureFlagSet() *FeatureFlagSet {
	features := make(map[Feature]*featureSlot)
	for _, f := range getInitialFeatures() {
		features[f] = &featureSlot{}
	}
	return &FeatureFlagSet{features: features}
}

type rawFeatureSlot struct {
	Value    bool `json:"value"`
	CacheSec int  `json:"cache_sec"`
}

type rawFeatures struct {
	Status   AppStatus                 `json:"status"`
	Features map[string]rawFeatureSlot `json:"features"`
}

func (r *rawFeatures) GetAppStatus() *AppStatus {
	return &r.Status
}

func (f *featureSlot) readFrom(m MetaContext, r rawFeatureSlot) {
	f.on = r.Value
	f.cacheUntil = m.G().Clock().Now().Add(time.Duration(r.CacheSec) * time.Second)
}

func (s *FeatureFlagSet) InvalidateCache(m MetaContext, f Feature) {
	s.Lock()
	defer s.Unlock()
	slot, found := s.features[f]
	if !found {
		return
	}
	slot.cacheUntil = m.G().Clock().Now().Add(time.Duration(-1) * time.Second)
}

func (s *FeatureFlagSet) refreshAllLocked(m MetaContext) (err error) {
	// collect all feature names in the set, regardless of state
	var features []string
	for f := range s.features {
		features = append(features, string(f))
	}

	var raw rawFeatures
	arg := NewAPIArg("user/features")
	arg.SessionType = APISessionTypeREQUIRED
	arg.Args = HTTPArgs{
		"features": S{Val: strings.Join(features, ",")},
	}
	err = m.G().API.GetDecode(m, arg, &raw)
	switch err.(type) {
	case nil:
	case LoginRequiredError:
		// No features for logged-out users
		return nil
	default:
		return err
	}

	for f, slot := range s.features {
		rawFeature, ok := raw.Features[string(f)]
		if !ok {
			m.Debug("Feature %q wasn't returned from server, not updating", f)
			continue
		}
		slot.readFrom(m, rawFeature)
		m.Debug("Feature (fetched) %q -> %v (will cache for %ds)", f, slot.on, rawFeature.CacheSec)
	}
	return nil
}

// enabledInCacheRLocked must be called while holding (at least) the read lock on s
func (s *FeatureFlagSet) enabledInCacheRLocked(m MetaContext, f Feature) (on bool, found bool) {
	slot, found := s.features[f]
	if !found {
		return false, false
	}
	if m.G().Clock().Now().Before(slot.cacheUntil) {
		m.G().GetVDebugLog().CLogf(m.Ctx(), VLog1, "Feature (cached) %q -> %v", f, slot.on)
		return slot.on, true
	}
	return false, false
}

// EnabledWithError returns if the given feature is enabled, it will return true if it's
// enabled, and an error if one occurred.
func (s *FeatureFlagSet) EnabledWithError(m MetaContext, f Feature) (on bool, err error) {
	m = m.WithLogTag("FEAT")

	s.RLock()
	if on, found := s.enabledInCacheRLocked(m, f); found {
		s.RUnlock()
		return on, nil
	}
	s.RUnlock()

	// cache did not help, we need to lock for writing and update
	s.Lock()
	defer s.Unlock()
	// while we were waiting for the write lock, other threads might have already
	// updated this, check again
	if on, found := s.enabledInCacheRLocked(m, f); found {
		return on, nil
	}

	if _, found := s.features[f]; !found {
		s.features[f] = &featureSlot{}
	}
	err = s.refreshAllLocked(m)
	if err != nil {
		return false, err
	}
	return s.features[f].on, nil
}

// Enabled returns if the feature flag is enabled. It ignore errors and just acts
// as if the feature is off.
func (s *FeatureFlagSet) Enabled(m MetaContext, f Feature) (on bool) {
	on, err := s.EnabledWithError(m, f)
	if err != nil {
		m.Debug("Error checking feature %q: %v", f, err)
		return false
	}
	return on
}

// Clear clears out the cached feature flags, for instance if the user
// is going to logout.
func (s *FeatureFlagSet) Clear() {
	s.Lock()
	defer s.Unlock()
	s.features = make(map[Feature]*featureSlot)
}

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

// NewFeatureFlagGate makes a gate for the given feature that will cache for the given
// duration.
func NewFeatureFlagGate(f Feature, d time.Duration) *FeatureFlagGate {
	return &FeatureFlagGate{
		feature:  f,
		cacheFor: d,
	}
}

// DigestError should be called on the result of an API call. It will allow this gate
// to digest the error and maybe set up its internal caching for when to retry this
// feature.
func (f *FeatureFlagGate) DigestError(m MetaContext, err error) {
	if err == nil {
		return
	}
	ffe, ok := err.(FeatureFlagError)
	if !ok {
		return
	}
	if ffe.Feature() != f.feature {
		m.Debug("Got feature flag error for wrong feature: %v", err)
		return
	}

	m.Debug("Server reports feature %q is flagged off", f.feature)

	f.Lock()
	defer f.Unlock()
	f.lastCheck = m.G().Clock().Now()
	f.lastError = err
}

// ErrorIfFlagged should be called to avoid a feature if it's recently
// been feature-flagged "off" by the server.  In that case, it will return
// the error that was originally returned by the server.
func (f *FeatureFlagGate) ErrorIfFlagged(m MetaContext) (err error) {
	f.Lock()
	defer f.Unlock()
	if f.lastError == nil {
		return nil
	}
	diff := m.G().Clock().Now().Sub(f.lastCheck)
	if diff > f.cacheFor {
		m.Debug("Feature flag %q expired %d ago, let's give it another try", f.feature, diff)
		f.lastError = nil
		f.lastCheck = time.Time{}
	}
	return f.lastError
}

func (f *FeatureFlagGate) Clear() {
	f.Lock()
	defer f.Unlock()
	f.lastError = nil
}
