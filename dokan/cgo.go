// Copyright 2015-2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package dokan

/*
#cgo LDFLAGS: -L${SRCDIR} -ldokan1
#include "bridge.h"
*/
import "C"

import (
	"errors"
	"fmt"
	"io"
	"reflect"
	"syscall"
	"time"
	"unicode/utf16"
	"unsafe"

	"golang.org/x/sys/windows"
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

// FileInfo contains information about a file including the path.
type FileInfo struct {
	ptr     C.PDOKAN_FILE_INFO
	rawPath C.LPCWSTR
}

// Path converts the path to UTF-8 running in O(n).
func (fi *FileInfo) Path() string {
	return lpcwstrToString(fi.rawPath)
}

// DeleteOnClose should be checked from Cleanup.
func (fi *FileInfo) DeleteOnClose() bool {
	return fi.ptr.DeleteOnClose != 0
}

func makeFI(fname C.LPCWSTR, pfi C.PDOKAN_FILE_INFO) *FileInfo {
	return &FileInfo{pfi, fname}
}

// File replacement flags for CreateFile
const (
	FileSupersede   = C.FILE_SUPERSEDE
	FileCreate      = C.FILE_CREATE
	FileOpen        = C.FILE_OPEN
	FileOpenIf      = C.FILE_OPEN_IF
	FileOverwrite   = C.FILE_OVERWRITE
	FileOverwriteIf = C.FILE_OVERWRITE_IF
)

// CreateOptions stuff
const (
	FileDirectoryFile    = C.FILE_DIRECTORY_FILE
	FileNonDirectoryFile = C.FILE_NON_DIRECTORY_FILE
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

// GetRequestorToken returns the syscall.Token associated with
// the requestor of this file system operation. Remember to
// call Close on the Token.
func (fi *FileInfo) GetRequestorToken() (syscall.Token, error) {
	hdl := syscall.Handle(C.DokanOpenRequestorToken(fi.ptr))
	var err error
	if hdl == syscall.InvalidHandle {
		// Tokens are value types, so returning nil is impossible,
		// returning an InvalidHandle is the best way.
		err = errors.New("Invalid handle from DokanOpenRequestorHandle")
	}
	return syscall.Token(hdl), err
}

// IsRequestorUserSidEqualTo returns true if the sid passed as
// the argument is equal to the sid of the user associated with
// the filesystem request.
func (fi *FileInfo) IsRequestorUserSidEqualTo(sid *syscall.SID) bool {
	tok, err := fi.GetRequestorToken()
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
		u1, _ := sid.String()
		u2, _ := tokUser.User.Sid.String()
		debugf("IsRequestorUserSidEqualTo: EqualSID(%q,%q) => %v (expecting non-zero)\n", u1, u2, res)
	}
	return res != 0
}

// CurrentProcessUserSid is a utility to get the
// SID of the current user running the process.
func CurrentProcessUserSid() (*syscall.SID, error) {
	tok, err := syscall.OpenCurrentProcessToken()
	if err != nil {
		return nil, err
	}
	defer tok.Close()
	tokUser, err := tok.GetTokenUser()
	if err != nil {
		return nil, err
	}
	return tokUser.User.Sid, nil
}

var (
	modadvapi32  = windows.NewLazySystemDLL("advapi32.dll")
	procEqualSid = modadvapi32.NewProc("EqualSid")
)

// Unmount a drive mounted by dokan.
func Unmount(path string) error {
	debug("Unmount: Calling Dokan.Unmount")
	res := C.DokanRemoveMountPoint((*C.WCHAR)(stringToUtf16Ptr(path)))
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
