// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import "time"

type wallClock struct {
}

// Now implements the Clock interface for wallClock.
func (wc wallClock) Now() time.Time {
	return time.Now()
}
