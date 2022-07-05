// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package dokan

import (
	"reflect"
	"unsafe"
)

// bufToSlice returns a byte slice aliasing the pointer and length given as arguments.
func bufToSlice(ptr unsafe.Pointer, nbytes uint32) []byte { // nolint
	if ptr == nil || nbytes == 0 {
		return nil
	}
	return *(*[]byte)(unsafe.Pointer(&reflect.SliceHeader{
		Data: uintptr(ptr),
		Len:  int(nbytes),
		Cap:  int(nbytes)}))
}
