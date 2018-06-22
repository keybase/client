package libkb

import "testing"

func TestTrackCacheShutdown(t *testing.T) {
	tc := NewTrackCache()
	tc.Shutdown()
	tc.Shutdown()
}
