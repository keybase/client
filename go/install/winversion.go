// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
// Adapted mainly from github.com/gonutz/w32

// +build windows

package install

import (
	"errors"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	version                = windows.NewLazySystemDLL("version.dll")
	getFileVersionInfoSize = version.NewProc("GetFileVersionInfoSizeW")
	getFileVersionInfo     = version.NewProc("GetFileVersionInfoW")
	verQueryValue          = version.NewProc("VerQueryValueW")
)

type VS_FIXEDFILEINFO struct {
	Signature        uint32
	StrucVersion     uint32
	FileVersionMS    uint32
	FileVersionLS    uint32
	ProductVersionMS uint32
	ProductVersionLS uint32
	FileFlagsMask    uint32
	FileFlags        uint32
	FileOS           uint32
	FileType         uint32
	FileSubtype      uint32
	FileDateMS       uint32
	FileDateLS       uint32
}

type WinVersion struct {
	Major uint32
	Minor uint32
	Patch uint32
	Build uint32
}

// FileVersion concatenates FileVersionMS and FileVersionLS to a uint64 value.
func (fi VS_FIXEDFILEINFO) FileVersion() uint64 {
	return uint64(fi.FileVersionMS)<<32 | uint64(fi.FileVersionLS)
}

func GetFileVersionInfoSize(path string) uint32 {
	ret, _, _ := getFileVersionInfoSize.Call(
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(path))),
		0,
	)
	return uint32(ret)
}

func GetFileVersionInfo(path string, data []byte) bool {
	ret, _, _ := getFileVersionInfo.Call(
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(path))),
		0,
		uintptr(len(data)),
		uintptr(unsafe.Pointer(&data[0])),
	)
	return ret != 0
}

// VerQueryValueRoot calls VerQueryValue
// (https://msdn.microsoft.com/en-us/library/windows/desktop/ms647464(v=vs.85).aspx)
// with `\` (root) to retieve the VS_FIXEDFILEINFO.
func VerQueryValueRoot(block []byte) (VS_FIXEDFILEINFO, error) {
	var offset uintptr
	var length uint
	blockStart := unsafe.Pointer(&block[0])
	ret, _, _ := verQueryValue.Call(
		uintptr(blockStart),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(`\`))),
		uintptr(unsafe.Pointer(&offset)),
		uintptr(unsafe.Pointer(&length)),
	)
	if ret == 0 {
		return VS_FIXEDFILEINFO{}, errors.New("VerQueryValueRoot: verQueryValue failed")
	}
	start := int(offset) - int(uintptr(blockStart))
	end := start + int(length)
	if start < 0 || start >= len(block) || end < start || end > len(block) {
		return VS_FIXEDFILEINFO{}, errors.New("VerQueryValueRoot: find failed")
	}
	data := block[start:end]
	info := *((*VS_FIXEDFILEINFO)(unsafe.Pointer(&data[0])))
	return info, nil
}

func GetFileVersion(path string) (WinVersion, error) {
	var result WinVersion
	size := GetFileVersionInfoSize(path)
	if size <= 0 {
		return result, errors.New("GetFileVersionInfoSize failed")
	}

	info := make([]byte, size)
	ok := GetFileVersionInfo(path, info)
	if !ok {
		return result, errors.New("GetFileVersionInfo failed")
	}

	fixed, err := VerQueryValueRoot(info)
	if err != nil {
		return result, err
	}
	version := fixed.FileVersion()

	result.Major = uint32(version & 0xFFFF000000000000 >> 48)
	result.Minor = uint32(version & 0x0000FFFF00000000 >> 32)
	result.Patch = uint32(version & 0x00000000FFFF0000 >> 16)
	result.Build = uint32(version & 0x000000000000FFFF)

	return result, nil
}
