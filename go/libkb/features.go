package libkb

import (
	"errors"
	"strings"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type Feature string
type FeatureFlags []Feature

const (
	EnvironmentFeatureAllowHighSkips    = Feature("env_allow_high_skips")
	EnvironmentFeatureAutoresetPipeline = Feature("env_autoreset")
	EnvironmentFeatureMerkleCheckpoint  = Feature("merkle_checkpoint")
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
	sync.Mutex
	on         bool
	cacheUntil time.Time
}

// FeatureFlagSet is a set of feature flags for a given user. It will keep track
// of whether a feature is on or off, and how long until we should check to
// update
type FeatureFlagSet struct {
	sync.Mutex
	features map[Feature]*featureSlot
}

const (
	FeatureFTL                        = Feature("ftl")
	FeatureIMPTOFU                    = Feature("imptofu")
	FeatureBoxAuditor                 = Feature("box_auditor2")
	ExperimentalGenericProofs         = Feature("experimental_generic_proofs")
	FeatureCheckForHiddenChainSupport = Feature("check_for_hidden_chain_support")
)

// NewFeatureFlagSet makes a new set of feature flags.
func NewFeatureFlagSet() *FeatureFlagSet {
	return &FeatureFlagSet{
		features: make(map[Feature]*featureSlot),
	}
}

func (s *FeatureFlagSet) getOrMakeSlot(f Feature) *featureSlot {
	s.Lock()
	defer s.Unlock()
	ret := s.features[f]
	if ret != nil {
		return ret
	}
	ret = &featureSlot{}
	s.features[f] = ret
	return ret
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
	featureSlot := s.getOrMakeSlot(f)
	featureSlot.Lock()
	defer featureSlot.Unlock()
	featureSlot.cacheUntil = m.G().Clock().Now().Add(time.Duration(-1) * time.Second)
}

func (s *FeatureFlagSet) EnableImmediately(m MetaContext, f Feature) error {
	if m.G().Env.GetRunMode() == ProductionRunMode {
		return errors.New("EnableImmediately is a dev/test-only path")
	}
	s.InvalidateCache(m, f)
	_, err := m.G().API.Post(m, APIArg{
		Endpoint:    "test/feature",
		SessionType: APISessionTypeREQUIRED,
		Args: HTTPArgs{
			"feature":   S{Val: string(f)},
			"value":     I{Val: 1},
			"cache_sec": I{Val: 100},
		},
	})
	return err
}

// EnabledWithError returns if the given feature is enabled, it will return true if it's
// enabled, and an error if one occurred.
func (s *FeatureFlagSet) EnabledWithError(m MetaContext, f Feature) (on bool, err error) {
	m = m.WithLogTag("FEAT")
	slot := s.getOrMakeSlot(f)
	slot.Lock()
	defer slot.Unlock()
	if m.G().Clock().Now().Before(slot.cacheUntil) {
		m.Debug("Feature (cached) %q -> %v", f, slot.on)
		return slot.on, nil
	}
	var raw rawFeatures
	arg := NewAPIArg("user/features")
	arg.SessionType = APISessionTypeREQUIRED
	arg.Args = HTTPArgs{
		"features": S{Val: string(f)},
	}
	err = m.G().API.GetDecode(m, arg, &raw)
	switch err.(type) {
	case nil:
	case LoginRequiredError:
		// No features for logged-out users
		return false, nil
	default:
		return false, err
	}
	if err != nil {
		return false, err
	}
	rawFeature, ok := raw.Features[string(f)]
	if !ok {
		m.Info("Feature %q wasn't returned from server", f)
		return false, nil
	}
	slot.readFrom(m, rawFeature)
	m.Debug("Feature (fetched) %q -> %v (will cache for %ds)", f, slot.on, rawFeature.CacheSec)
	return slot.on, nil
}

// Enabled returns if the feature flag is enabled. It ignore errors and just acts
// as if the feature is off.
func (s *FeatureFlagSet) Enabled(m MetaContext, f Feature) (on bool) {
	on, err := s.EnabledWithError(m, f)
	if err != nil {
		m.Info("Error checking feature %q: %v", f, err)
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
