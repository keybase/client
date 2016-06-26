// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package dokan

import (
	"strconv"
	"time"
)

// FileSystem is the inteface for filesystems in Dokan.
type FileSystem interface {
	CreateFile(fi *FileInfo, data *CreateData) (file File, isDirectory bool, err error)
	GetDiskFreeSpace() (FreeSpace, error)

	MoveFile(source *FileInfo, targetPath string, replaceExisting bool) error

	GetVolumeInformation() (VolumeInformation, error)
	Mounted() error
}

// CreateData contains all the info needed to create a file.
type CreateData struct {
	DesiredAccess     uint32
	FileAttributes    uint32
	ShareAccess       uint32
	CreateDisposition uint32
	CreateOptions     uint32
}

// File is the interface for files and directories.
type File interface {
	// Cleanup is called after the last handle from userspace is closed.
	// Cleanup must perform actual deletions marked from CanDelete*
	// by checking FileInfo.DeleteOnClose if the filesystem supports
	// deletions.
	Cleanup(fi *FileInfo)
	// CloseFile is called when closing a handle to the file
	CloseFile(fi *FileInfo)

	ReadFile(fi *FileInfo, bs []byte, offset int64) (int, error)
	WriteFile(fi *FileInfo, bs []byte, offset int64) (int, error)
	FlushFileBuffers(fi *FileInfo) error

	GetFileInformation(*FileInfo) (*Stat, error)
	FindFiles(*FileInfo, func(*NamedStat) error) error

	//FindFilesWithPattern

	// SetFileTime sets the file time. Test times with .IsZero
	// whether they should be set.
	SetFileTime(fi *FileInfo, creation time.Time, lastAccess time.Time, lastWrite time.Time) error
	SetFileAttributes(fi *FileInfo, fileAttributes uint32) error

	SetEndOfFile(fi *FileInfo, length int64) error
	// SetAllocationSize see FILE_ALLOCATION_INFORMATION on msdn.
	// For simple semantics if length > filesize then ignore else truncate(length).
	SetAllocationSize(fi *FileInfo, length int64) error

	LockFile(fi *FileInfo, offset int64, length int64) error
	UnlockFile(fi *FileInfo, offset int64, length int64) error

	// CanDeleteFile and CanDeleteDirectory should check whether the file/directory
	// can be deleted. The actual deletion should be done by checking
	// FileInfo.DeleteOnClose in Cleanup.
	CanDeleteFile(*FileInfo) error
	CanDeleteDirectory(*FileInfo) error
}

// FreeSpace - semantics as with WINAPI GetDiskFreeSpaceEx
type FreeSpace struct {
	FreeBytesAvailable, TotalNumberOfBytes, TotalNumberOfFreeBytes uint64
}

// VolumeInformation - see WINAPI GetVolumeInformation for hints
type VolumeInformation struct {
	VolumeName             string
	VolumeSerialNumber     uint32
	MaximumComponentLength uint32
	FileSystemFlags        FileSystemFlags
	FileSystemName         string
}

// FileSystemFlags holds flags for filesystem features.
type FileSystemFlags uint32

// Various FileSystemFlags constants, see winapi documentation for details.
const (
	FileCasePreservedNames         = FileSystemFlags(0x2)
	FileCaseSensitiveSearch        = FileSystemFlags(0x1)
	FileFileCompression            = FileSystemFlags(0x10)
	FileNamedStreams               = FileSystemFlags(0x40000)
	FilePersistentAcls             = FileSystemFlags(0x8)
	FileReadOnlyVolume             = FileSystemFlags(0x80000)
	FileSequentalWriteOnce         = FileSystemFlags(0x100000)
	FileSupportsEncryption         = FileSystemFlags(0x20000)
	FileSupportsExtendedAttributes = FileSystemFlags(0x800000)
	FileSupportsHardLinks          = FileSystemFlags(0x400000)
	FileSupportObjectIDs           = FileSystemFlags(0x10000)
	FileSupportsOpenByFileID       = FileSystemFlags(0x1000000)
	FileSupportsRemoteStorage      = FileSystemFlags(0x100)
	FileSupportsReparsePoints      = FileSystemFlags(0x80)
	FileSupportsSparseFiles        = FileSystemFlags(0x40)
	FileSupportsTransactions       = FileSystemFlags(0x200000)
	FileSupportsUsnJournal         = FileSystemFlags(0x2000000)
	FileUnicodeOnDisk              = FileSystemFlags(0x4)
	FileVolumeIsCompressed         = FileSystemFlags(0x8000)
	FileVolumeQuotas               = FileSystemFlags(0x20)
)

// Stat is for GetFileInformation and friends.
type Stat struct {
	// FileAttributes holds the file attributes (see package syscall).
	FileAttributes uint32
	// Timestamps for the file
	Creation, LastAccess, LastWrite time.Time
	// VolumeSerialNumber is the serial number of the volume (0 is fine)
	VolumeSerialNumber uint32
	// FileSize is the size of the file in bytes
	FileSize int64
	// NumberOfLinks should typically be 1
	NumberOfLinks uint32
	// FileIndex is a 64 bit (nearly) unique ID of the file
	FileIndex uint64
	// ReparsePointTag is for WIN32_FIND_DATA dwReserved0 for reparse point tags, typically it can be omitted.
	ReparsePointTag uint32
}

// NamedStat is used to for stat responses that require file names.
// If the name is longer than a dos-name insert the corresponding
// dos-name to ShortName.
type NamedStat struct {
	Name      string
	ShortName string
	Stat
}

// NtError is a type of errors for NTSTATUS values
type NtError uint32

func (n NtError) Error() string {
	return "NTSTATUS=" + strconv.FormatUint(uint64(n), 16)
}

const (
	// ErrAccessDenied - access denied (EPERM)
	ErrAccessDenied = NtError(0xC0000022)
	// ErrObjectNameNotFound - filename does not exist (ENOENT)
	ErrObjectNameNotFound = NtError(0xC0000034)
	// ErrObjectNameCollision - a pathname already exists (EEXIST)
	ErrObjectNameCollision = NtError(0xC0000035)
	// ErrObjectPathNotFound - a pathname does not exist (ENOENT)
	ErrObjectPathNotFound = NtError(0xC000003A)
	// ErrNotSupported - not supported.
	ErrNotSupported = NtError(0xC00000BB)
	// ErrFileIsADirectory - file is a directory.
	ErrFileIsADirectory = NtError(0xC00000BA)
	// ErrDirectoryNotEmpty - wanted an empty dir - it is not empty.
	ErrDirectoryNotEmpty = NtError(0xC0000101)
	// ErrFileAlreadyExists - file already exists - fatal.
	ErrFileAlreadyExists = NtError(0xC0000035)
	// ErrNotSameDevice - MoveFile is denied, please use copy+delete.
	ErrNotSameDevice = NtError(0xC00000D4)
	// StatusObjectNameExists - already exists, may be non-fatal...
	StatusObjectNameExists = NtError(0x40000000)
)
