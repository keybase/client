// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package dokan

/*
#include "bridge.h"
*/
import "C"

import (
	"bytes"
	"fmt"
	"path/filepath"
	"runtime"
	"unsafe"

	"golang.org/x/sys/windows"
)

const shortPath = `DOKAN1.DLL`
const syswow64 = `C:\WINDOWS\SYSWOW64\`
const system32 = `C:\WINDOWS\SYSTEM32\`

type errorPrinter struct {
	buf bytes.Buffer
}

func (ep *errorPrinter) Printf(s string, os ...interface{}) {
	fmt.Fprintf(&ep.buf, s, os...)
}

// loadLibrary calls win32 LoadLibrary and logs the result.
func loadLibrary(epc *errorPrinter, path string) (windows.Handle, error) {
	hdl, err := windows.LoadLibrary(path)
	epc.Printf("LoadLibrary(%q) -> %v,%v\n", path, hdl, err)
	return hdl, err
}

// doLoadDLL tries to load the dokan DLL from various locations.
func doLoadDLL(epc *errorPrinter, path string) (windows.Handle, error) {
	var guessPath bool
	epc.Printf("loadDokanDLL %q\n", path)
	if path == "" {
		path = shortPath
		guessPath = true
	} else {
		path = filepath.FromSlash(path)
	}
	const loadLibrarySearchSystem32 = 0x800
	const flags = loadLibrarySearchSystem32
	hdl, err := windows.LoadLibraryEx(path, 0, flags)
	epc.Printf("loadDokanDLL LoadLibraryEx(%q,0,%x) -> %v,%v\n", path, flags, hdl, err)
	if err == nil || !guessPath {
		return hdl, err
	}
	// User probably has not installed KB2533623 which is a security update
	// from 2011. Without this Windows security update loading libraries
	// is unsafe on Windows.
	// Continue to try to load the DLL regardless.

	if runtime.GOARCH == `386` {
		hdl, err = loadLibrary(epc, syswow64+shortPath)
		if err == nil {
			return hdl, nil
		}
	}
	hdl, err = loadLibrary(epc, system32+shortPath)
	if err == nil {
		return hdl, nil
	}
	hdl, err = loadLibrary(epc, shortPath)
	if err == nil {
		return hdl, nil
	}
	err = fmt.Errorf("loadDokanDLL: cannot load Dokan DLL: %v", err)
	epc.Printf("ERROR: %v\n", err)
	return 0, err
}

func doLoadDokanAndGetSymbols(epc *errorPrinter, path string) error {
	hdl, err := doLoadDLL(epc, path)
	if err != nil {
		return err
	}
	for _, v := range []struct {
		name string
		ptr  *unsafe.Pointer
	}{{`DokanRemoveMountPoint`, &C.kbfsLibdokanPtr_RemoveMountPoint},
		{`DokanOpenRequestorToken`, &C.kbfsLibdokanPtr_OpenRequestorToken},
		{`DokanMain`, &C.kbfsLibdokanPtr_Main}} {
		uptr, err := windows.GetProcAddress(hdl, v.name)
		if err != nil {
			return fmt.Errorf(`GetProcAddress(%q) -> %v,%v`, v.name, uptr, err)
		}
		*v.ptr = unsafe.Pointer(uptr)
	}
	return nil
}

// loadDokanDLL tries to load the dokan DLL from
// the given path. Empty path is allowed and will
// result in the location being guessed.
func loadDokanDLL(path string) error {
	var epc errorPrinter
	err := doLoadDokanAndGetSymbols(&epc, path)
	if err != nil {
		return fmt.Errorf("Error: %v\nContext:\n%s", err, epc.buf.Bytes())
	}
	return nil
}
