// Copyright 2015-2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package dokan

/*
#include "bridge.h"
*/
import "C"

import (
	"errors"
	"fmt"
	"io"
	"reflect"
	"runtime"
	"syscall"
	"time"
	"unicode/utf16"
	"unsafe"

	"github.com/keybase/kbfs/dokan/winacl"
	"golang.org/x/net/context"
	"golang.org/x/sys/windows"
)

// Wrap SID for users.
type SID syscall.SID

const (
	kbfsLibdokanDebug                   = MountFlag(C.kbfsLibdokanDebug)
	kbfsLibdokanStderr                  = MountFlag(C.kbfsLibdokanStderr)
	kbfsLibdokanRemovable               = MountFlag(C.kbfsLibdokanRemovable)
	kbfsLibdokanMountManager            = MountFlag(C.kbfsLibdokanMountManager)
	kbfsLibdokanCurrentSession          = MountFlag(C.kbfsLibdokanCurrentSession)
	kbfsLibdokanUseFindFilesWithPattern = MountFlag(C.kbfsLibdokanUseFindFilesWithPattern)
)

// loadDokanDLL can be called to init the system with custom Dokan location,
// e.g. LoadDokanDLL(`C:\mypath\dokan1.dll`).
func loadDokanDLL(fullpath string) error {
	if fullpath == "" {
		return nil
	}
	dw := syscall.Errno(C.kbfsLibdokanLoadLibrary((*C.WCHAR)(stringToUtf16Ptr(fullpath))))
	if dw != 0 {
		return dw
	}
	return nil
}

const ntstatusOk = C.NTSTATUS(0)

func checkFileDirectoryFile(err error, isDir bool, createOptions uint32) {
	if createOptions&createOptions&FileDirectoryFile != 0 && createOptions&FileNonDirectoryFile != 0 {
		debugf("checkFileDirectoryFile both FileDirectoryFile FileNonDirectoryFile set")
	}
	if err == nil {
		if (!isDir && createOptions&FileDirectoryFile != 0) ||
			(isDir && createOptions&FileNonDirectoryFile != 0) {
			debugf("checkFileDirectoryFile INCONSISTENCY %v %08X", isDir, createOptions)
		}
	} else if err == ErrNotADirectory {
		if createOptions&FileDirectoryFile == 0 {
			debugf("checkFileDirectoryFile ErrNotADirectory but no createOptions&FileDirectoryFile")
		}
	} else if err == ErrFileIsADirectory {
		if createOptions&FileNonDirectoryFile == 0 {
			debugf("checkFileDirectoryFile ErrFileIsADirectory but no createOptions&FileNonDirectoryFile")
		}
	}
}

//export kbfsLibdokanCreateFile
func kbfsLibdokanCreateFile(
	fname C.LPCWSTR,
	psec C.PDOKAN_IO_SECURITY_CONTEXT,
	DesiredAccess C.ACCESS_MASK,
	FileAttributes C.ULONG,
	ShareAccess C.ULONG,
	cCreateDisposition C.ULONG,
	CreateOptions C.ULONG,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	var cd = CreateData{
		DesiredAccess:     uint32(DesiredAccess),
		FileAttributes:    FileAttribute(FileAttributes),
		ShareAccess:       uint32(ShareAccess),
		CreateDisposition: CreateDisposition(cCreateDisposition),
		CreateOptions:     uint32(CreateOptions),
	}
	debugf("CreateFile '%v' %#v pid: %v\n",
		d16{fname}, cd, pfi.ProcessId)
	fs := getfs(pfi)
	ctx, cancel := fs.WithContext(globalContext())
	if cancel != nil {
		defer cancel()
	}
	fi, isDir, err := fs.CreateFile(ctx, makeFI(fname, pfi), &cd)
	if isDebug {
		checkFileDirectoryFile(err, isDir, uint32(CreateOptions))
	}
	if isDir {
		pfi.IsDirectory = 1
	}
	return fiStore(pfi, fi, err)
}

func globalContext() context.Context {
	return context.Background()
}
func getContext(pfi C.PDOKAN_FILE_INFO) (context.Context, context.CancelFunc) {
	return getfs(pfi).WithContext(globalContext())
}

//export kbfsLibdokanCleanup
func kbfsLibdokanCleanup(fname C.LPCWSTR, pfi C.PDOKAN_FILE_INFO) {
	debugf("Cleanup '%v' %v\n", d16{fname}, *pfi)
	ctx, cancel := getContext(pfi)
	if cancel != nil {
		defer cancel()
	}
	getfi(pfi).Cleanup(ctx, makeFI(fname, pfi))
}

//export kbfsLibdokanCloseFile
func kbfsLibdokanCloseFile(fname C.LPCWSTR, pfi C.PDOKAN_FILE_INFO) {
	debugf("CloseFile '%v' %v\n", d16{fname}, *pfi)
	ctx, cancel := getContext(pfi)
	if cancel != nil {
		defer cancel()
	}
	getfi(pfi).CloseFile(ctx, makeFI(fname, pfi))
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
	ctx, cancel := getContext(pfi)
	if cancel != nil {
		defer cancel()
	}
	n, err := getfi(pfi).ReadFile(
		ctx,
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
	ctx, cancel := getContext(pfi)
	if cancel != nil {
		defer cancel()
	}
	n, err := getfi(pfi).WriteFile(
		ctx,
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
	ctx, cancel := getContext(pfi)
	if cancel != nil {
		defer cancel()
	}
	err := getfi(pfi).FlushFileBuffers(ctx, makeFI(fname, pfi))
	return errToNT(err)
}

func u32zeroToOne(u uint32) uint32 {
	if u == 0 {
		return 1
	}
	return u
}

//export kbfsLibdokanGetFileInformation
func kbfsLibdokanGetFileInformation(
	fname C.LPCWSTR,
	sbuf C.LPBY_HANDLE_FILE_INFORMATION,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("GetFileInformation '%v' %v", d16{fname}, *pfi)
	ctx, cancel := getContext(pfi)
	if cancel != nil {
		defer cancel()
	}
	st, err := getfi(pfi).GetFileInformation(ctx, makeFI(fname, pfi))
	debug("->", st, err)
	if st != nil {
		sbuf.dwFileAttributes = C.DWORD(st.FileAttributes)
		sbuf.ftCreationTime = packTime(st.Creation)
		sbuf.ftLastAccessTime = packTime(st.LastAccess)
		sbuf.ftLastWriteTime = packTime(st.LastWrite)
		sbuf.dwVolumeSerialNumber = C.DWORD(st.VolumeSerialNumber)
		sbuf.nFileSizeHigh = C.DWORD(st.FileSize >> 32)
		sbuf.nFileSizeLow = C.DWORD(st.FileSize)
		sbuf.nNumberOfLinks = C.DWORD(u32zeroToOne(st.NumberOfLinks))
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
	return kbfsLibdokanFindFilesImpl(PathName, "", FindData, pfi)
}

//export kbfsLibdokanFindFilesWithPattern
func kbfsLibdokanFindFilesWithPattern(
	PathName C.LPCWSTR,
	SearchPattern C.LPCWSTR,
	FindData C.PFillFindData, // call this function with PWIN32_FIND_DATAW
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	pattern := lpcwstrToString(SearchPattern)
	debugf("FindFilesWithPattern '%v' %v %q", d16{PathName}, *pfi, pattern)
	return kbfsLibdokanFindFilesImpl(PathName, pattern, FindData, pfi)
}

func kbfsLibdokanFindFilesImpl(
	PathName C.LPCWSTR,
	pattern string,
	FindData C.PFillFindData,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("FindFiles '%v' %v", d16{PathName}, *pfi)
	ctx, cancel := getContext(pfi)
	if cancel != nil {
		defer cancel()
	}
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
	err := getfi(pfi).FindFiles(ctx, makeFI(PathName, pfi), pattern, fun)
	return errToNT(err)
}

//export kbfsLibdokanSetFileAttributes
func kbfsLibdokanSetFileAttributes(
	fname C.LPCWSTR,
	fileAttributes C.DWORD,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("SetFileAttributes '%v' %X %v", d16{fname}, fileAttributes, pfi)
	ctx, cancel := getContext(pfi)
	if cancel != nil {
		defer cancel()
	}
	err := getfi(pfi).SetFileAttributes(ctx, makeFI(fname, pfi), FileAttribute(fileAttributes))
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
	ctx, cancel := getContext(pfi)
	if cancel != nil {
		defer cancel()
	}
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
	err := getfi(pfi).SetFileTime(ctx, makeFI(fname, pfi), t0, t1, t2)
	return errToNT(err)
}

//export kbfsLibdokanDeleteFile
func kbfsLibdokanDeleteFile(
	fname C.LPCWSTR,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("DeleteFile '%v' %v", d16{fname}, *pfi)
	ctx, cancel := getContext(pfi)
	if cancel != nil {
		defer cancel()
	}
	err := getfi(pfi).CanDeleteFile(ctx, makeFI(fname, pfi))
	return errToNT(err)
}

//export kbfsLibdokanDeleteDirectory
func kbfsLibdokanDeleteDirectory(
	fname C.LPCWSTR,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("DeleteDirectory '%v' %v", d16{fname}, *pfi)
	ctx, cancel := getContext(pfi)
	if cancel != nil {
		defer cancel()
	}
	err := getfi(pfi).CanDeleteDirectory(ctx, makeFI(fname, pfi))
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
	ctx, cancel := getContext(pfi)
	if cancel != nil {
		defer cancel()
	}
	// On error nil, not a dummy file like in getfi.
	file := fiTableGetFile(uint32(pfi.Context))
	err := getfs(pfi).MoveFile(ctx, file, makeFI(oldFName, pfi), newPath, bool(replaceExisiting != 0))
	return errToNT(err)
}

//export kbfsLibdokanSetEndOfFile
func kbfsLibdokanSetEndOfFile(
	fname C.LPCWSTR,
	length C.LONGLONG,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("SetEndOfFile '%v' %d %v", d16{fname}, length, *pfi)
	ctx, cancel := getContext(pfi)
	if cancel != nil {
		defer cancel()
	}
	err := getfi(pfi).SetEndOfFile(ctx, makeFI(fname, pfi), int64(length))
	return errToNT(err)
}

//export kbfsLibdokanSetAllocationSize
func kbfsLibdokanSetAllocationSize(
	fname C.LPCWSTR,
	length C.LONGLONG,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("SetAllocationSize '%v' %d %v", d16{fname}, length, *pfi)
	ctx, cancel := getContext(pfi)
	if cancel != nil {
		defer cancel()
	}
	err := getfi(pfi).SetAllocationSize(ctx, makeFI(fname, pfi), int64(length))
	return errToNT(err)
}

//export kbfsLibdokanLockFile
func kbfsLibdokanLockFile(
	fname C.LPCWSTR,
	offset C.LONGLONG,
	length C.LONGLONG,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("LockFile '%v' %v", d16{fname}, *pfi)
	ctx, cancel := getContext(pfi)
	if cancel != nil {
		defer cancel()
	}

	err := getfi(pfi).LockFile(ctx, makeFI(fname, pfi), int64(offset), int64(length))
	return errToNT(err)
}

//export kbfsLibdokanUnlockFile
func kbfsLibdokanUnlockFile(
	fname C.LPCWSTR,
	offset C.LONGLONG,
	length C.LONGLONG,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debugf("UnlockFile '%v' %v", d16{fname}, *pfi)
	ctx, cancel := getContext(pfi)
	if cancel != nil {
		defer cancel()
	}
	err := getfi(pfi).UnlockFile(ctx, makeFI(fname, pfi), int64(offset), int64(length))
	return errToNT(err)
}

//export kbfsLibdokanGetDiskFreeSpace
func kbfsLibdokanGetDiskFreeSpace(
	FreeBytesAvailable *C.ULONGLONG,
	TotalNumberOfBytes *C.ULONGLONG,
	TotalNumberOfFreeBytes *C.ULONGLONG,
	FileInfo C.PDOKAN_FILE_INFO) C.NTSTATUS {
	debug("GetDiskFreeSpace", *FileInfo)
	fs := getfs(FileInfo)
	ctx, cancel := fs.WithContext(globalContext())
	if cancel != nil {
		defer cancel()
	}
	space, err := fs.GetDiskFreeSpace(ctx)
	debug("->", space, err)
	if err != nil {
		return errToNT(err)
	}
	if FreeBytesAvailable != nil {
		*FreeBytesAvailable = C.ULONGLONG(space.FreeBytesAvailable)
	}
	if TotalNumberOfBytes != nil {
		*TotalNumberOfBytes = C.ULONGLONG(space.TotalNumberOfBytes)
	}
	if TotalNumberOfFreeBytes != nil {
		*TotalNumberOfFreeBytes = C.ULONGLONG(space.TotalNumberOfFreeBytes)
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
	fs := getfs(FileInfo)
	ctx, cancel := fs.WithContext(globalContext())
	if cancel != nil {
		defer cancel()
	}
	vi, err := fs.GetVolumeInformation(ctx)
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
	return ntstatusOk
}

//export kbfsLibdokanGetFileSecurity
func kbfsLibdokanGetFileSecurity(
	fname C.LPCWSTR,
	//A pointer to SECURITY_INFORMATION value being requested
	input C.PSECURITY_INFORMATION,
	// A pointer to SECURITY_DESCRIPTOR buffer to be filled
	output C.PSECURITY_DESCRIPTOR,
	outlen C.ULONG, // length of Security descriptor buffer
	LengthNeeded *C.ULONG,
	pfi C.PDOKAN_FILE_INFO) C.NTSTATUS {
	var si winacl.SecurityInformation
	if input != nil {
		si = winacl.SecurityInformation(*input)
	}
	debug("GetFileSecurity", si)
	ctx, cancel := getContext(pfi)
	if cancel != nil {
		defer cancel()
	}
	buf := bufToSlice(unsafe.Pointer(output), uint32(outlen))
	sd := winacl.NewSecurityDescriptorWithBuffer(
		buf)
	err := getfi(pfi).GetFileSecurity(ctx, makeFI(fname, pfi), si, sd)
	if err != nil {
		return errToNT(err)
	}
	if LengthNeeded != nil {
		*LengthNeeded = C.ULONG(sd.Size())
	}
	if sd.HasOverflowed() {
		debug("Too small buffer", outlen, "would have needed", sd.Size())
		return errToNT(StatusBufferOverflow)
	}
	debugf("%X", buf)
	debug("-> ok,", sd.Size(), "bytes")
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

// FileInfo contains information about a file including the path.
type FileInfo struct {
	ptr     C.PDOKAN_FILE_INFO
	rawPath C.LPCWSTR
}

func makeFI(fname C.LPCWSTR, pfi C.PDOKAN_FILE_INFO) *FileInfo {
	return &FileInfo{pfi, fname}
}

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
	file := fiTableGetFile(uint32(fi.Context))
	if file == nil {
		file = &errorFile{getfs(fi)}
	}
	return file
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
		n, ok := err.(NtStatus)
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

func (ctx *dokanCtx) Run(path string, flags MountFlag) error {
	ctx.ptr.dokan_options.Options = C.ULONG(flags)
	if isDebug {
		ctx.ptr.dokan_options.Options |= C.kbfsLibdokanDebug | C.kbfsLibdokanStderr
	}
	C.kbfsLibdokanSet_path(ctx.ptr, stringToUtf16Ptr(path))
	ec := C.kbfsLibdokanRun(ctx.ptr)
	if ec != 0 {
		return fmt.Errorf("Dokan failed: code=%d %q", ec, dokanErrString(int32(ec)))
	}
	return nil
}

func dokanErrString(code int32) string {
	switch code {
	case C.kbfsLibDokan_ERROR:
		return "General error"
	case C.kbfsLibDokan_DRIVE_LETTER_ERROR:
		return "Drive letter error"
	case C.kbfsLibDokan_DRIVER_INSTALL_ERROR:
		return "Driver install error"
	case C.kbfsLibDokan_START_ERROR:
		return "Start error"
	case C.kbfsLibDokan_MOUNT_ERROR:
		return "Mount error"
	case C.kbfsLibDokan_MOUNT_POINT_ERROR:
		return "Mount point error"
	case C.kbfsLibDokan_VERSION_ERROR:
		return "Version error"
	case C.kbfsLibDokan_DLL_LOAD_ERROR:
		return "Error loading Dokan DLL"
	default:
		return "UNKNOWN"
	}
}

func (ctx *dokanCtx) Free() {
	debug("dokanCtx.Free")
	C.kbfsLibdokanFree(ctx.ptr)
	fsTableFree(ctx.slot)
}

// getRequestorToken returns the syscall.Token associated with
// the requestor of this file system operation. Remember to
// call Close on the Token.
func (fi *FileInfo) getRequestorToken() (syscall.Token, error) {
	hdl := syscall.Handle(C.kbfsLibdokan_OpenRequestorToken(fi.ptr))
	var err error
	if hdl == syscall.InvalidHandle {
		// Tokens are value types, so returning nil is impossible,
		// returning an InvalidHandle is the best way.
		err = errors.New("Invalid handle from DokanOpenRequestorHandle")
	}
	return syscall.Token(hdl), err
}

// isRequestorUserSidEqualTo returns true if the sid passed as
// the argument is equal to the sid of the user associated with
// the filesystem request.
func (fi *FileInfo) isRequestorUserSidEqualTo(sid *winacl.SID) bool {
	tok, err := fi.getRequestorToken()
	if err != nil {
		debug("IsRequestorUserSidEqualTo:", err)
		return false
	}
	defer tok.Close()
	tokUser, err := tok.GetTokenUser()
	if err != nil {
		debug("IsRequestorUserSidEqualTo: GetTokenUser:", err)
		return false
	}
	res, _, _ := syscall.Syscall(procEqualSid.Addr(), 2,
		uintptr(unsafe.Pointer(sid)),
		uintptr(unsafe.Pointer(tokUser.User.Sid)),
		0)
	if isDebug {
		u1, _ := (*syscall.SID)(sid).String()
		u2, _ := tokUser.User.Sid.String()
		debugf("IsRequestorUserSidEqualTo: EqualSID(%q,%q) => %v (expecting non-zero)\n", u1, u2, res)
	}
	runtime.KeepAlive(sid)
	runtime.KeepAlive(tokUser.User.Sid)
	return res != 0
}

var (
	modadvapi32  = windows.NewLazySystemDLL("advapi32.dll")
	procEqualSid = modadvapi32.NewProc("EqualSid")
)

// unmount a drive mounted by dokan.
func unmount(path string) error {
	debug("Unmount: Calling Dokan.Unmount")
	res := C.kbfsLibdokan_RemoveMountPoint((*C.WCHAR)(stringToUtf16Ptr(path)))
	if res == C.FALSE {
		debug("Unmount: Failed!")
		return errors.New("DokanRemoveMountPoint failed!")
	}
	debug("Unmount: Success!")
	return nil
}

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
		tgt[0] = 0
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
