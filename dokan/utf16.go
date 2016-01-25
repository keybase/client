// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package dokan

/*
#include "bridge.h"
*/
import "C"

import (
	"reflect"
	"unicode/utf16"
	"unsafe"
)

// lpcwstrToString converts a nul-terminated Windows wide string to a Go string,
func lpcwstrToString(ptr C.LPCWSTR) string {
	if ptr == nil {
		return ""
	}
	var len = 0
	for tmp := ptr; *tmp != 0; tmp = (C.LPCWSTR)(unsafe.Pointer((uintptr(unsafe.Pointer(tmp)) + 2))) {
		len++
	}
	raw := ptrUcs2Slice(ptr, len)
	return string(utf16.Decode(raw))
}

// stringToUtf16Buffer pokes a string into a Windows wide string buffer.
// On overflow does not poke anything and returns false.
func stringToUtf16Buffer(s string, ptr C.LPWSTR, blenUcs2 C.DWORD) bool {
	if ptr == nil || blenUcs2 == 0 {
		return false
	}
	src := utf16.Encode([]rune(s))
	tgt := ptrUcs2Slice(C.LPCWSTR(unsafe.Pointer(ptr)), int(blenUcs2))
	if len(src)+1 >= len(tgt) {
		return false
	}
	copy(tgt, src)
	tgt[len(src)] = 0
	return true
}

// stringToUtf16Ptr return a pointer to the string as utf16 with zero
// termination.
func stringToUtf16Ptr(s string) unsafe.Pointer {
	tmp := utf16.Encode([]rune(s + "\000"))
	return unsafe.Pointer(&tmp[0])
}

// ptrUcs2Slice takes a C Windows wide string and length in UCS2
// and returns it aliased as a uint16 slice.
func ptrUcs2Slice(ptr C.LPCWSTR, lenUcs2 int) []uint16 {
	return *(*[]uint16)(unsafe.Pointer(&reflect.SliceHeader{
		Data: uintptr(unsafe.Pointer(ptr)),
		Len:  lenUcs2,
		Cap:  lenUcs2}))
}

// d16 wraps C wide string pointers to a struct with nice printing
// with zero cost when not debugging and pretty prints when debugging.
type d16 struct{ ptr C.LPCWSTR }

func (s d16) String() string {
	return lpcwstrToString(s.ptr)
}
