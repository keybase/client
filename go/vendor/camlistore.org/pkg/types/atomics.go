/*
Copyright 2013 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package types

import (
	"sync/atomic"
)

// AtomicBool is an atomic boolean.
// It can be accessed from concurrent goroutines.
type AtomicBool struct {
	v uint32 // 0 or 1, atomically
}

func (b *AtomicBool) Get() bool {
	return atomic.LoadUint32(&b.v) != 0
}

func (b *AtomicBool) Set(v bool) {
	if v {
		atomic.StoreUint32(&b.v, 1)
		return
	}
	atomic.StoreUint32(&b.v, 0)
}

type AtomicInt64 struct {
	v int64
}

func (a *AtomicInt64) Get() int64 {
	return atomic.LoadInt64(&a.v)
}

func (a *AtomicInt64) Set(v int64) {
	atomic.StoreInt64(&a.v, v)
}

func (a *AtomicInt64) Add(delta int64) int64 {
	return atomic.AddInt64(&a.v, delta)
}
