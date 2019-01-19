// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"reflect"
	"strings"
	"syscall"
	"unicode/utf16"
	"unicode/utf8"
	"unsafe"

	"golang.org/x/sys/windows"
)

func isNewFolderName(name string) bool {
	return name == newFolderName || name == newFolderAltName
}

var newFolderName, newFolderNameErr = getNewFolderName()
var newFolderAltName = altCase(newFolderName)

func altCase(s string) string {
	_, idx := utf8.DecodeRuneInString(s)
	return s[:idx] + strings.ToLower(s[idx:])
}

// The resourse IDs are not considered stable by Microsoft.
// Luckily for us this happens to be the same for our
// targeted Windows versions where kbfsdokan works.
// Tested for Windows 7, 8, 8.1 and 10.
// TODO test this for new Windows versions!
const newFolderWindws7to10ResourceID = 16888

func getNewFolderName() (string, error) {
	var u16ptr *uint16
	// The following id is valid for at least Windows 7, 8.1 and 10.
	res, _, err := syscall.Syscall6(procLoadStringW.Addr(), 4, shell32DLL.Handle(),
		newFolderWindws7to10ResourceID, uintptr(unsafe.Pointer(&u16ptr)), 0, 0, 0)
	if res == 0 {
		return "New Folder", err
	}
	return lpcwstrToString(u16ptr), nil
}

var (
	shell32DLL      = windows.NewLazySystemDLL("shell32.dll")
	user32DLL       = windows.NewLazySystemDLL("user32.dll")
	procLoadStringW = user32DLL.NewProc("LoadStringW")
)

// lpcwstrToString converts a nul-terminated Windows wide string to a Go string,
func lpcwstrToString(ptr *uint16) string {
	if ptr == nil {
		return ""
	}
	var len = 0
	for tmp := ptr; *tmp != 0; tmp = (*uint16)(unsafe.Pointer((uintptr(unsafe.Pointer(tmp)) + 2))) {
		len++
	}
	raw := ptrUcs2Slice(ptr, len)
	return string(utf16.Decode(raw))
}

// ptrUcs2Slice takes a C Windows wide string and length in UCS2
// and returns it aliased as a uint16 slice.
func ptrUcs2Slice(ptr *uint16, lenUcs2 int) []uint16 {
	return *(*[]uint16)(unsafe.Pointer(&reflect.SliceHeader{
		Data: uintptr(unsafe.Pointer(ptr)),
		Len:  lenUcs2,
		Cap:  lenUcs2}))
}
