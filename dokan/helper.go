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
	"fmt"
	"syscall"
	"time"
)

func packTime(t time.Time) C.FILETIME {
	ft := syscall.NsecToFiletime(t.UnixNano())
	return C.FILETIME{dwLowDateTime: C.DWORD(ft.LowDateTime), dwHighDateTime: C.DWORD(ft.HighDateTime)}
}
func unpackTime(c C.FILETIME) time.Time {
	ft := syscall.Filetime{LowDateTime: uint32(c.dwLowDateTime), HighDateTime: uint32(c.dwHighDateTime)}
	// This is valid, see docs and code for package time.
	return time.Unix(0, ft.Nanoseconds())
}

func getfs(fi C.PDOKAN_FILE_INFO) FileSystem {
	return fsTableGet(uint32(fi.DokanOptions.GlobalContext))
}

func getfi(fi C.PDOKAN_FILE_INFO) File {
	return fiTableGetFile(uint32(fi.Context))
}

func fiStore(pfi C.PDOKAN_FILE_INFO, fi File, err error) C.NTSTATUS {
	debug("->", fi, err)
	if fi != nil {
		pfi.Context = C.ULONG64(fiTableStoreFile(uint32(pfi.DokanOptions.GlobalContext), fi))
	}
	return errToNT(err)
}

func errToNT(err error) C.NTSTATUS {
	// NTSTATUS constants are defined as unsigned but the type is signed
	// and the values overflow on purpose. This is horrible.
	var code uint32
	if err != nil {
		debug("ERROR:", err)
		n, ok := err.(NtError)
		if ok {
			code = uint32(n)
		} else {
			code = uint32(ErrAccessDenied)
		}
	}
	return C.NTSTATUS(code)
}

type dokanCtx struct {
	ptr  *C.struct_kbfsLibdokanCtx
	slot uint32
}

func allocCtx(slot uint32) *dokanCtx {
	return &dokanCtx{C.kbfsLibdokanAllocCtx(C.ULONG64(slot)), slot}
}

func (ctx *dokanCtx) Run(path string) error {
	if isDebug {
		ctx.ptr.dokan_options.Options |= C.kbfsLibdokanDebug
	}
	C.kbfsLibdokanSet_path(ctx.ptr, stringToUtf16Ptr(path))
	ec := C.kbfsLibdokanRun(ctx.ptr)
	if ec != 0 {
		return fmt.Errorf("Dokan failed: %d", ec)
	}
	return nil
}

func (ctx *dokanCtx) Free() {
	debug("dokanCtx.Free")
	C.kbfsLibdokanFree(ctx.ptr)
	fsTableFree(ctx.slot)
}
