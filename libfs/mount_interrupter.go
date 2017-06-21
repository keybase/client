// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"sync"
)

// MountInterrupter is for managing mounts with cancelation.
type MountInterrupter struct {
	// can be locked from external code too.
	sync.Mutex
	once sync.Once
	done chan struct{}
	fun  func()
}

// NewMountInterrupter creates a new MountInterrupter.
func NewMountInterrupter() *MountInterrupter {
	return &MountInterrupter{done: make(chan struct{})}
}

// SetOnceFun sets the function that is run once upon done.
func (mi *MountInterrupter) SetOnceFun(fun func()) {
	mi.Lock()
	defer mi.Unlock()
	mi.fun = fun
}

// Done signals Wait and runs a function if set by SetOnceFun.
// It can be called multiple times with no harm.
func (mi *MountInterrupter) Done() {
	mi.once.Do(func() {
		mi.Lock()
		f := mi.fun
		mi.Unlock()
		if f != nil {
			f()
		}
		close(mi.done)
	})
}

// Wait waits till Done is called.
func (mi *MountInterrupter) Wait() {
	<-mi.done
}
