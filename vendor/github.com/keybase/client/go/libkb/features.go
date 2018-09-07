package libkb

import (
	"strings"
	"sync"
	"time"
)

type Feature string
type FeatureFlags []Feature

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

// Admin returns true if the admin feature set is on
func (set FeatureFlags) Admin() bool {
	for _, f := range set {
		if f == Feature("admin") {
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
	FeatureFTL = Feature("ftl")
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

// EnabledWithError returns if the given feature is enabled, it will return true if it's
// enabled, and an error if one occurred.
func (s *FeatureFlagSet) EnabledWithError(m MetaContext, f Feature) (on bool, err error) {
	m = m.WithLogTag("FEAT")
	slot := s.getOrMakeSlot(f)
	slot.Lock()
	defer slot.Unlock()
	if m.G().Clock().Now().Before(slot.cacheUntil) {
		m.CDebugf("Feature (cached) %q -> %v", f, slot.on)
		return slot.on, nil
	}
	var raw rawFeatures
	arg := NewAPIArgWithMetaContext(m, "user/features")
	arg.SessionType = APISessionTypeREQUIRED
	arg.Args = HTTPArgs{
		"features": S{Val: string(f)},
	}
	err = m.G().API.GetDecode(arg, &raw)
	if err != nil {
		return false, err
	}
	rawFeature, ok := raw.Features[string(f)]
	if !ok {
		m.CInfof("Feature %q wasn't returned from server", f)
		return false, nil
	}
	slot.readFrom(m, rawFeature)
	m.CDebugf("Feature (fetched) %q -> %v (will cache for %ds)", f, slot.on, rawFeature.CacheSec)
	return slot.on, nil
}

// Enabled returns if the feature flag is enabled. It ignore errors and just acts
// as if the feature is off.
func (s *FeatureFlagSet) Enabled(m MetaContext, f Feature) (on bool) {
	on, err := s.EnabledWithError(m, f)
	if err != nil {
		m.CInfof("Error checking feature %q: %v", f, err)
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
