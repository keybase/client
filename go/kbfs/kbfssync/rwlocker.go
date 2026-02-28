// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfssync

import "sync"

// A rwLocker represents an object that can be reader-locked and
// reader-unlocked as well as locked and unlocked.
type rwLocker interface {
	sync.Locker
	RLock()
	RLocker() sync.Locker
	RUnlock()
}
