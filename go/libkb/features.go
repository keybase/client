package libkb

import (
	"strings"
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
