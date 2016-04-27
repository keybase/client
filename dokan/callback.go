// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package dokan

/*
#cgo LDFLAGS: -L${SRCDIR} -ldokan
#include "bridge.h"
*/
import "C"

import (
	"errors"
	"io"
	"time"
	"unsafe"
)

const ntstatusOk = C.NTSTATUS(0)

//export kbfsLibdokanCreateFile
func kbfsLibdokanCreateFile(
	fname C.LPCWSTR,
	psec C.PDOKAN_IO_SECURITY_CONTEXT,
	DesiredAccess C.ACCESS_MASK,
	FileAttributes C.ULONG,
	ShareAccess C.ULONG,
	CreateDisposition C.ULONG,
	CreateOptions C.ULONG,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	var cd = CreateData{
		DesiredAccess:     uint32(DesiredAccess),
		FileAttributes:    uint32(FileAttributes),
		ShareAccess:       uint32(ShareAccess),
		CreateDisposition: uint32(CreateDisposition),
		CreateOptions:     uint32(CreateOptions),
	}
	debugf("CreateFile '%v' %#v pid: %v\n",
		d16{fname}, cd, pfi.ProcessId)
	fi, isDir, err := getfs(pfi).CreateFile(makeFI(fname, pfi), &cd)
	if isDir {
		pfi.IsDirectory = 1
	}
	return fiStore(pfi, fi, err)
}

//export kbfsLibdokanCleanup
func kbfsLibdokanCleanup(fname C.LPCWSTR, pfi C.PDOKAN_FILE_INFO) {
	debugf("Cleanup '%v' %v\n", d16{fname}, *pfi)
	getfi(pfi).Cleanup(makeFI(fname, pfi))
}

//export kbfsLibdokanCloseFile
func kbfsLibdokanCloseFile(fname C.LPCWSTR, pfi C.PDOKAN_FILE_INFO) {
	debugf("CloseFile '%v' %v\n", d16{fname}, *pfi)
	getfi(pfi).CloseFile(makeFI(fname, pfi))
	fiTableFreeFile(uint32(pfi.DokanOptions.GlobalContext), uint32(pfi.Context))
	pfi.Context = 0
}

//export kbfsLibdokanReadFile
func kbfsLibdokanReadFile(
	fname C.LPCWSTR,
	Buffer C.LPVOID,
	NumberOfBytesToRead C.DWORD,
	NumberOfBytesRead C.LPDWORD,
	Offset C.LONGLONG,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("ReadFile '%v' %d bytes @ %d %v", d16{fname}, NumberOfBytesToRead, Offset, *pfi)
	n, err := getfi(pfi).ReadFile(
		makeFI(fname, pfi),
		bufToSlice(unsafe.Pointer(Buffer), uint32(NumberOfBytesToRead)),
		int64(Offset))
	*NumberOfBytesRead = C.DWORD(n)
	// EOF is success with Windows...
	if err == io.EOF {
		err = nil
	}
	debug("->", n, err)
	return errToNT(err)
}

//export kbfsLibdokanWriteFile
func kbfsLibdokanWriteFile(
	fname C.LPCWSTR,
	Buffer C.LPCVOID,
	NumberOfBytesToWrite C.DWORD,
	NumberOfBytesWritten C.LPDWORD,
	Offset C.LONGLONG,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("WriteFile '%v' %d bytes @ %d %v", d16{fname}, NumberOfBytesToWrite, Offset, *pfi)
	n, err := getfi(pfi).WriteFile(
		makeFI(fname, pfi),
		bufToSlice(unsafe.Pointer(Buffer), uint32(NumberOfBytesToWrite)),
		int64(Offset))
	*NumberOfBytesWritten = C.DWORD(n)
	debug("->", n, err)
	return errToNT(err)
}

//export kbfsLibdokanFlushFileBuffers
func kbfsLibdokanFlushFileBuffers(
	fname C.LPCWSTR,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("FlushFileBuffers '%v' %v", d16{fname}, *pfi)
	err := getfi(pfi).FlushFileBuffers(makeFI(fname, pfi))
	return errToNT(err)
}

//export kbfsLibdokanGetFileInformation
func kbfsLibdokanGetFileInformation(
	fname C.LPCWSTR,
	sbuf C.LPBY_HANDLE_FILE_INFORMATION,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("GetFileInformation '%v' %v", d16{fname}, *pfi)
	st, err := getfi(pfi).GetFileInformation(makeFI(fname, pfi))
	debug("->", st, err)
	if st != nil {
		sbuf.dwFileAttributes = C.DWORD(st.FileAttributes)
		sbuf.ftCreationTime = packTime(st.Creation)
		sbuf.ftLastAccessTime = packTime(st.LastAccess)
		sbuf.ftLastWriteTime = packTime(st.LastWrite)
		sbuf.dwVolumeSerialNumber = C.DWORD(st.VolumeSerialNumber)
		sbuf.nFileSizeHigh = C.DWORD(st.FileSize >> 32)
		sbuf.nFileSizeLow = C.DWORD(st.FileSize)
		sbuf.nNumberOfLinks = C.DWORD(st.NumberOfLinks)
		sbuf.nFileIndexHigh = C.DWORD(st.FileIndex >> 32)
		sbuf.nFileIndexLow = C.DWORD(st.FileIndex)
	}
	return errToNT(err)
}

var errFindNoSpace = errors.New("Find out of space")

//export kbfsLibdokanFindFiles
func kbfsLibdokanFindFiles(
	PathName C.LPCWSTR,
	FindData C.PFillFindData, // call this function with PWIN32_FIND_DATAW
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("FindFiles '%v' %v", d16{PathName}, *pfi)
	var fdata C.WIN32_FIND_DATAW
	fun := func(ns *NamedStat) error {
		fdata.dwFileAttributes = C.DWORD(ns.FileAttributes)
		fdata.ftCreationTime = packTime(ns.Creation)
		fdata.ftLastAccessTime = packTime(ns.LastAccess)
		fdata.ftLastWriteTime = packTime(ns.LastWrite)
		fdata.nFileSizeHigh = C.DWORD(ns.FileSize >> 32)
		fdata.nFileSizeLow = C.DWORD(ns.FileSize)
		fdata.dwReserved0 = C.DWORD(ns.ReparsePointTag)
		stringToUtf16Buffer(ns.Name,
			C.LPWSTR(unsafe.Pointer(&fdata.cFileName)),
			C.DWORD(C.MAX_PATH))
		if ns.ShortName != "" {
			stringToUtf16Buffer(ns.ShortName,
				C.LPWSTR(unsafe.Pointer(&fdata.cFileName)),
				C.DWORD(14))
		}

		v := C.kbfsLibdokanFill_find(FindData, &fdata, pfi)
		if v != 0 {
			return errFindNoSpace
		}
		return nil
	}
	err := getfi(pfi).FindFiles(makeFI(PathName, pfi), fun)
	return errToNT(err)
}

/* This is disabled from the C side currently.
//export kbfsLibdokanFindFilesWithPattern
func kbfsLibdokanFindFilesWithPattern (
	PathName C.LPCWSTR,
	SearchPattern C.LPCWSTR,
	PFillFindData uintptr, // call this function with PWIN32_FIND_DATAW
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {


}
*/

//export kbfsLibdokanSetFileAttributes
func kbfsLibdokanSetFileAttributes(
	fname C.LPCWSTR,
	fileAttributes C.DWORD,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("SetFileAttributes '%v' %X %v", d16{fname}, fileAttributes, pfi)
	err := getfi(pfi).SetFileAttributes(makeFI(fname, pfi), uint32(fileAttributes))
	return errToNT(err)
}

//export kbfsLibdokanSetFileTime
func kbfsLibdokanSetFileTime(
	fname C.LPCWSTR,
	creation *C.FILETIME,
	lastAccess *C.FILETIME,
	lastWrite *C.FILETIME,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("SetFileTime '%v' %v", d16{fname}, *pfi)
	var t0, t1, t2 time.Time
	if creation != nil {
		t0 = unpackTime(*creation)
	}
	if lastAccess != nil {
		t1 = unpackTime(*lastAccess)
	}
	if lastWrite != nil {
		t2 = unpackTime(*lastWrite)
	}
	err := getfi(pfi).SetFileTime(makeFI(fname, pfi), t0, t1, t2)
	return errToNT(err)
}

//export kbfsLibdokanDeleteFile
func kbfsLibdokanDeleteFile(
	fname C.LPCWSTR,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("DeleteFile '%v' %v", d16{fname}, *pfi)
	err := getfi(pfi).CanDeleteFile(makeFI(fname, pfi))
	return errToNT(err)
}

//export kbfsLibdokanDeleteDirectory
func kbfsLibdokanDeleteDirectory(
	fname C.LPCWSTR,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("DeleteDirectory '%v' %v", d16{fname}, *pfi)
	err := getfi(pfi).CanDeleteDirectory(makeFI(fname, pfi))
	return errToNT(err)
}

//export kbfsLibdokanMoveFile
func kbfsLibdokanMoveFile(
	oldFName C.LPCWSTR,
	newFName C.LPCWSTR,
	replaceExisiting C.BOOL,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	newPath := lpcwstrToString(newFName)
	debugf("MoveFile '%v' %v target %v", d16{oldFName}, *pfi, newPath)
	err := getfs(pfi).MoveFile(makeFI(oldFName, pfi), newPath, bool(replaceExisiting != 0))
	return errToNT(err)
}

//export kbfsLibdokanSetEndOfFile
func kbfsLibdokanSetEndOfFile(
	fname C.LPCWSTR,
	length C.LONGLONG,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("SetEndOfFile '%v' %d %v", d16{fname}, length, *pfi)
	err := getfi(pfi).SetEndOfFile(makeFI(fname, pfi), int64(length))
	return errToNT(err)
}

//export kbfsLibdokanSetAllocationSize
func kbfsLibdokanSetAllocationSize(
	fname C.LPCWSTR,
	length C.LONGLONG,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("SetAllocationSize '%v' %d %v", d16{fname}, length, *pfi)
	err := getfi(pfi).SetAllocationSize(makeFI(fname, pfi), int64(length))
	return errToNT(err)
}

//export kbfsLibdokanLockFile
func kbfsLibdokanLockFile(
	fname C.LPCWSTR,
	offset C.LONGLONG,
	length C.LONGLONG,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("LockFile '%v' %v", d16{fname}, *pfi)
	err := getfi(pfi).LockFile(makeFI(fname, pfi), int64(offset), int64(length))
	return errToNT(err)
}

//export kbfsLibdokanUnlockFile
func kbfsLibdokanUnlockFile(
	fname C.LPCWSTR,
	offset C.LONGLONG,
	length C.LONGLONG,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("UnlockFile '%v' %v", d16{fname}, *pfi)
	err := getfi(pfi).UnlockFile(makeFI(fname, pfi), int64(offset), int64(length))
	return errToNT(err)
}

//export kbfsLibdokanGetDiskFreeSpace
func kbfsLibdokanGetDiskFreeSpace(
	FreeBytesAvailable *C.ULONGLONG,
	TotalNumberOfBytes *C.ULONGLONG,
	TotalNumberOfFreeBytes *C.ULONGLONG,
	FileInfo C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debug("GetDiskFreeSpace", *FileInfo)
	fs, err := getfs(FileInfo).GetDiskFreeSpace()
	debug("->", fs, err)
	if err != nil {
		return errToNT(err)
	}
	if FreeBytesAvailable != nil {
		*FreeBytesAvailable = C.ULONGLONG(fs.FreeBytesAvailable)
	}
	if TotalNumberOfBytes != nil {
		*TotalNumberOfBytes = C.ULONGLONG(fs.TotalNumberOfBytes)
	}
	if TotalNumberOfFreeBytes != nil {
		*TotalNumberOfFreeBytes = C.ULONGLONG(fs.TotalNumberOfFreeBytes)
	}
	return ntstatusOk
}

//export kbfsLibdokanGetVolumeInformation
func kbfsLibdokanGetVolumeInformation(
	VolumeNameBuffer C.LPWSTR,
	VolumeNameSize C.DWORD, // in num of chars
	VolumeSerialNumber C.LPDWORD,
	MaximumComponentLength C.LPDWORD, // in num of chars
	FileSystemFlags C.LPDWORD,
	FileSystemNameBuffer C.LPWSTR,
	FileSystemNameSize C.DWORD, // in num of chars
	FileInfo C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debug("GetVolumeInformation", VolumeNameSize, MaximumComponentLength, FileSystemNameSize, *FileInfo)
	vi, err := getfs(FileInfo).GetVolumeInformation()
	debug("->", vi, err)
	if err != nil {
		return errToNT(err)
	}
	if VolumeNameBuffer != nil {
		stringToUtf16Buffer(vi.VolumeName, VolumeNameBuffer, VolumeNameSize)
	}
	if VolumeSerialNumber != nil {
		*VolumeSerialNumber = C.DWORD(vi.VolumeSerialNumber)
	}
	if MaximumComponentLength != nil {
		*MaximumComponentLength = C.DWORD(vi.MaximumComponentLength)
	}
	if FileSystemFlags != nil {
		*FileSystemFlags = C.DWORD(vi.FileSystemFlags)
	}
	if FileSystemNameBuffer != nil {
		stringToUtf16Buffer(vi.FileSystemName, FileSystemNameBuffer, FileSystemNameSize)
	}

	return ntstatusOk
}

//export kbfsLibdokanMounted
func kbfsLibdokanMounted(pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debug("Mounted")
	// Signal that the filesystem is mounted and can be used.
	fsTableGetErrChan(uint32(pfi.DokanOptions.GlobalContext)) <- nil
	// Dokan wants a NTSTATUS here, but is discarding it.
	err := getfs(pfi).Mounted()
	return errToNT(err)
}

//export kbfsLibdokanGetFileSecurity
func kbfsLibdokanGetFileSecurity(
	fname C.LPCWSTR,
	//A pointer to SECURITY_INFORMATION value being requested
	input C.PSECURITY_INFORMATION,
	// A pointer to SECURITY_DESCRIPTOR buffer to be filled
	output C.PSECURITY_DESCRIPTOR,
	outlen C.ULONG, // length of Security descriptor buffer
	LengthNeeded C.PULONG,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debug("GetFileSecurity TODO")
	return ntstatusOk
}

//export kbfsLibdokanSetFileSecurity
func kbfsLibdokanSetFileSecurity(
	fname C.LPCWSTR,
	SecurityInformation C.PSECURITY_INFORMATION,
	SecurityDescriptor C.PSECURITY_DESCRIPTOR,
	SecurityDescriptorLength C.ULONG,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debug("SetFileSecurity TODO")
	return ntstatusOk
}

/* FIXME add support for multiple streams per file?
//export kbfsLibdokanFindStreams
func kbfsLibdokanFindStreams (
	fname C.LPCWSTR,
	// call this function with PWIN32_FIND_STREAM_DATA
	FindStreamData uintptr,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {


}
*/
