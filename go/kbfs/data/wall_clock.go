// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import "time"

// WallClock is a wrapper around the built-in clock.
type WallClock struct {
}

// Now returns the current wall clock time.
func (wc WallClock) Now() time.Time {
	return time.Now()
}
