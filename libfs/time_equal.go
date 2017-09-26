// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"runtime"
	"time"
)

// TimeEqual compares two filesystem-related timestamps.
//
// On platforms that don't use nanosecond-accurate timestamps in their
// filesystem APIs, it truncates the timestamps to make them
// comparable.
func TimeEqual(a, b time.Time) bool {
	if runtime.GOOS == "darwin" {
		a = a.Truncate(1 * time.Second)
		b = b.Truncate(1 * time.Second)
	}
	return a.Equal(b)
}
