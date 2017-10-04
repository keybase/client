// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package dokan

import (
	"strconv"
	"time"

	"github.com/keybase/kbfs/dokan/winacl"
	"golang.org/x/net/context"
)

// Config is the configuration used for a mount.
type Config struct {
	// Path is the path to mount, e.g. `L:`. Must be set.
	Path string
	// FileSystem is the filesystem implementation. Must be set.
	FileSystem FileSystem
	// MountFlags for this filesystem instance. Is optional.
	MountFlags MountFlag
	// DllPath is the optional full path to dokan1.dll.
	// Empty causes dokan1.dll to be loaded from the system directory.
	// Only the first load of a dll determines the path -
	// further instances in the same process will use
	// the same instance regardless of path.
	DllPath string
}

// FileSystem is the inteface for filesystems in Dokan.
type FileSystem interface {
	// WithContext returns a context for a new request. If the CancelFunc
	// is not null, it is called after the request is done. The most minimal
	// implementation is
	// `func (*T)WithContext(c context.Context) { return c, nil }`.
	WithContext(context.Context) (context.Context, context.CancelFunc)

	// CreateFile is called to open and create files.
	CreateFile(ctx context.Context, fi *FileInfo, data *CreateData) (file File, isDirectory bool, err error)

	// GetDiskFreeSpace returns information about disk free space.
	// Called quite often by Explorer.
	GetDiskFreeSpace(ctx context.Context) (FreeSpace, error)

	// GetVolumeInformation returns information about the volume.
	GetVolumeInformation(ctx context.Context) (VolumeInformation, error)

	// MoveFile corresponds to rename.
	MoveFile(ctx context.Context, sourceHandle File, sourceFileInfo *FileInfo, targetPath string, replaceExisting bool) error

	// ErrorPrint is called when dokan needs notify the program of an error message.
	// A sensible approach is to print the error.
	ErrorPrint(error)
}

// MountFlag is the type for Dokan mount flags.
type MountFlag uint32

// Flags for mounting the filesystem. See Dokan documentation for these.
const (
	CDebug         = MountFlag(kbfsLibdokanDebug)
	CStderr        = MountFlag(kbfsLibdokanStderr)
	Removable      = MountFlag(kbfsLibdokanRemovable)
	MountManager   = MountFlag(kbfsLibdokanMountManager)
	CurrentSession = MountFlag(kbfsLibdokanCurrentSession)
	// UseFindFilesWithPattern enables FindFiles calls to be with a search
	// pattern string. Otherwise the string will be empty in all calls.
	UseFindFilesWithPattern = MountFlag(kbfsLibdokanUseFindFilesWithPattern)
)

// CreateData contains all the info needed to create a file.
type CreateData struct {
	DesiredAccess     uint32
	FileAttributes    FileAttribute
	ShareAccess       uint32
	CreateDisposition CreateDisposition
	CreateOptions     uint32
}

// ReturningFileAllowed answers whether returning a file is allowed by
// CreateOptions.
func (cd *CreateData) ReturningFileAllowed() error {
	if cd.CreateOptions&FileDirectoryFile != 0 {
		return ErrNotADirectory
	}
	return nil
}

// ReturningDirAllowed answers whether returning a directory is allowed by
// CreateOptions.
func (cd *CreateData) ReturningDirAllowed() error {
	if cd.CreateOptions&FileNonDirectoryFile != 0 {
		return ErrFileIsADirectory
	}
	return nil
}

// CreateDisposition marks whether to create or open a file. Not a bitmask.
type CreateDisposition uint32

// File creation flags for CreateFile. This is not a bitmask.
const (
	FileSupersede   = CreateDisposition(0)
	FileOpen        = CreateDisposition(1)
	FileCreate      = CreateDisposition(2)
	FileOpenIf      = CreateDisposition(3)
	FileOverwrite   = CreateDisposition(4)
	FileOverwriteIf = CreateDisposition(5)
)

// CreateOptions flags. These are bitmask flags.
const (
	FileDirectoryFile    = 0x1
	FileNonDirectoryFile = 0x40
	FileOpenReparsePoint = 0x00200000
)

// FileAttribute is the type of a directory entry in Stat.
type FileAttribute uint32

// File attribute bit masks - same as syscall but provided for all platforms.
const (
	FileAttributeReadonly     = FileAttribute(0x00000001)
	FileAttributeHidden       = FileAttribute(0x00000002)
	FileAttributeSystem       = FileAttribute(0x00000004)
	FileAttributeDirectory    = FileAttribute(0x00000010)
	FileAttributeArchive      = FileAttribute(0x00000020)
	FileAttributeNormal       = FileAttribute(0x00000080)
	FileAttributeReparsePoint = FileAttribute(0x00000400)
	IOReparseTagSymlink       = 0xA000000C
)

// File is the interface for files and directories.
type File interface {
	// ReadFile implements read for dokan.
	ReadFile(ctx context.Context, fi *FileInfo, bs []byte, offset int64) (int, error)
	// WriteFile implements write for dokan.
	WriteFile(ctx context.Context, fi *FileInfo, bs []byte, offset int64) (int, error)
	// FlushFileBuffers corresponds to fsync.
	FlushFileBuffers(ctx context.Context, fi *FileInfo) error

	// GetFileInformation - corresponds to stat.
	GetFileInformation(ctx context.Context, fi *FileInfo) (*Stat, error)

	// FindFiles is the readdir. The function is a callback that should be called
	// with each file. The same NamedStat may be reused for subsequent calls.
	//
	// Pattern will be an empty string unless UseFindFilesWithPattern is enabled - then
	// it may be a pattern like `*.png` to match. All implementations must be prepared
	// to handle empty strings as patterns.
	FindFiles(ctx context.Context, fi *FileInfo, pattern string, fillStatCallback func(*NamedStat) error) error

	// SetFileTime sets the file time. Test times with .IsZero
	// whether they should be set.
	SetFileTime(ctx context.Context, fi *FileInfo, creation time.Time, lastAccess time.Time, lastWrite time.Time) error
	// SetFileAttributes is for setting file attributes.
	SetFileAttributes(ctx context.Context, fi *FileInfo, fileAttributes FileAttribute) error

	// SetEndOfFile truncates the file. May be used to extend a file with zeros.
	SetEndOfFile(ctx context.Context, fi *FileInfo, length int64) error
	// SetAllocationSize see FILE_ALLOCATION_INFORMATION on MSDN.
	// For simple semantics if length > filesize then ignore else truncate(length).
	SetAllocationSize(ctx context.Context, fi *FileInfo, length int64) error

	LockFile(ctx context.Context, fi *FileInfo, offset int64, length int64) error
	UnlockFile(ctx context.Context, fi *FileInfo, offset int64, length int64) error

	GetFileSecurity(ctx context.Context, fi *FileInfo, si winacl.SecurityInformation, sd *winacl.SecurityDescriptor) error
	SetFileSecurity(ctx context.Context, fi *FileInfo, si winacl.SecurityInformation, sd *winacl.SecurityDescriptor) error

	// CanDeleteFile and CanDeleteDirectory should check whether the file/directory
	// can be deleted. The actual deletion should be done by checking
	// FileInfo.IsDeleteOnClose in Cleanup.
	CanDeleteFile(ctx context.Context, fi *FileInfo) error
	CanDeleteDirectory(ctx context.Context, fi *FileInfo) error
	// Cleanup is called after the last handle from userspace is closed.
	// Cleanup must perform actual deletions marked from CanDelete*
	// by checking FileInfo.IsDeleteOnClose if the filesystem supports
	// deletions.
	Cleanup(ctx context.Context, fi *FileInfo)
	// CloseFile is called when closing a handle to the file.
	CloseFile(ctx context.Context, fi *FileInfo)
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
	// Timestamps for the file
	Creation, LastAccess, LastWrite time.Time
	// FileSize is the size of the file in bytes
	FileSize int64
	// FileIndex is a 64 bit (nearly) unique ID of the file
	FileIndex uint64
	// FileAttributes bitmask holds the file attributes.
	FileAttributes FileAttribute
	// VolumeSerialNumber is the serial number of the volume (0 is fine)
	VolumeSerialNumber uint32
	// NumberOfLinks can be omitted, if zero set to 1.
	NumberOfLinks uint32
	// ReparsePointTag is for WIN32_FIND_DATA dwReserved0 for reparse point tags, typically it can be omitted.
	ReparsePointTag uint32
}

// NamedStat is used to for stat responses that require file names.
// If the name is longer than a DOS-name, insert the corresponding
// DOS-name to ShortName.
type NamedStat struct {
	Name      string
	ShortName string
	Stat
}

// NtStatus is a type implementing error interface that corresponds
// to NTSTATUS. It can be used to set the exact error/status code
// from the filesystem.
type NtStatus uint32

func (n NtStatus) Error() string {
	return "NTSTATUS=" + strconv.FormatUint(uint64(n), 16)
}

const (
	// ErrAccessDenied - access denied (EPERM)
	ErrAccessDenied = NtStatus(0xC0000022)
	// ErrObjectNameNotFound - filename does not exist (ENOENT)
	ErrObjectNameNotFound = NtStatus(0xC0000034)
	// ErrObjectNameCollision - a pathname already exists (EEXIST)
	ErrObjectNameCollision = NtStatus(0xC0000035)
	// ErrObjectPathNotFound - a pathname does not exist (ENOENT)
	ErrObjectPathNotFound = NtStatus(0xC000003A)
	// ErrNotSupported - not supported.
	ErrNotSupported = NtStatus(0xC00000BB)
	// ErrFileIsADirectory - file is a directory.
	ErrFileIsADirectory = NtStatus(0xC00000BA)
	// ErrDirectoryNotEmpty - wanted an empty dir - it is not empty.
	ErrDirectoryNotEmpty = NtStatus(0xC0000101)
	// ErrNotADirectory - wanted a directory - it is not a directory.
	ErrNotADirectory = NtStatus(0xC0000103)
	// ErrFileAlreadyExists - file already exists - fatal.
	ErrFileAlreadyExists = NtStatus(0xC0000035)
	// ErrNotSameDevice - MoveFile is denied, please use copy+delete.
	ErrNotSameDevice = NtStatus(0xC00000D4)
	// StatusBufferOverflow - buffer space too short for return value.
	StatusBufferOverflow = NtStatus(0x80000005)
	// StatusObjectNameExists - already exists, may be non-fatal...
	StatusObjectNameExists = NtStatus(0x40000000)
)
