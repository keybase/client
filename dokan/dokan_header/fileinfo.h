/*
  Dokan : user-mode file system library for Windows

  Copyright (C) 2015 - 2016 Adrien J. <liryna.stark@gmail.com> and Maxime C. <maxime@islog.com>
  Copyright (C) 2007 - 2011 Hiroki Asakawa <info@dokan-dev.net>

  http://dokan-dev.github.io

This program is free software; you can redistribute it and/or modify it under
the terms of the GNU Lesser General Public License as published by the Free
Software Foundation; either version 3 of the License, or (at your option) any
later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU Lesser General Public License along
with this program. If not, see <http://www.gnu.org/licenses/>.
*/

#ifndef FILEINFO_H_
#define FILEINFO_H_

#define IRP_MJ_CREATE 0x00
#define IRP_MJ_CREATE_NAMED_PIPE 0x01
#define IRP_MJ_CLOSE 0x02
#define IRP_MJ_READ 0x03
#define IRP_MJ_WRITE 0x04
#define IRP_MJ_QUERY_INFORMATION 0x05
#define IRP_MJ_SET_INFORMATION 0x06
#define IRP_MJ_QUERY_EA 0x07
#define IRP_MJ_SET_EA 0x08
#define IRP_MJ_FLUSH_BUFFERS 0x09
#define IRP_MJ_QUERY_VOLUME_INFORMATION 0x0a
#define IRP_MJ_SET_VOLUME_INFORMATION 0x0b
#define IRP_MJ_DIRECTORY_CONTROL 0x0c
#define IRP_MJ_FILE_SYSTEM_CONTROL 0x0d
#define IRP_MJ_DEVICE_CONTROL 0x0e
#define IRP_MJ_INTERNAL_DEVICE_CONTROL 0x0f
#define IRP_MJ_SHUTDOWN 0x10
#define IRP_MJ_LOCK_CONTROL 0x11
#define IRP_MJ_CLEANUP 0x12
#define IRP_MJ_CREATE_MAILSLOT 0x13
#define IRP_MJ_QUERY_SECURITY 0x14
#define IRP_MJ_SET_SECURITY 0x15
#define IRP_MJ_POWER 0x16
#define IRP_MJ_SYSTEM_CONTROL 0x17
#define IRP_MJ_DEVICE_CHANGE 0x18
#define IRP_MJ_QUERY_QUOTA 0x19
#define IRP_MJ_SET_QUOTA 0x1a
#define IRP_MJ_PNP 0x1b
#define IRP_MJ_PNP_POWER IRP_MJ_PNP
#define IRP_MJ_MAXIMUM_FUNCTION 0x1b

#define IRP_MN_LOCK 0x01
#define IRP_MN_UNLOCK_SINGLE 0x02
#define IRP_MN_UNLOCK_ALL 0x03
#define IRP_MN_UNLOCK_ALL_BY_KEY 0x04

typedef enum _FILE_INFORMATION_CLASS {
  FileDirectoryInformation = 1,
  FileFullDirectoryInformation,            // 2
  FileBothDirectoryInformation,            // 3
  FileBasicInformation,                    // 4
  FileStandardInformation,                 // 5
  FileInternalInformation,                 // 6
  FileEaInformation,                       // 7
  FileAccessInformation,                   // 8
  FileNameInformation,                     // 9
  FileRenameInformation,                   // 10
  FileLinkInformation,                     // 11
  FileNamesInformation,                    // 12
  FileDispositionInformation,              // 13
  FilePositionInformation,                 // 14
  FileFullEaInformation,                   // 15
  FileModeInformation,                     // 16
  FileAlignmentInformation,                // 17
  FileAllInformation,                      // 18
  FileAllocationInformation,               // 19
  FileEndOfFileInformation,                // 20
  FileAlternateNameInformation,            // 21
  FileStreamInformation,                   // 22
  FilePipeInformation,                     // 23
  FilePipeLocalInformation,                // 24
  FilePipeRemoteInformation,               // 25
  FileMailslotQueryInformation,            // 26
  FileMailslotSetInformation,              // 27
  FileCompressionInformation,              // 28
  FileObjectIdInformation,                 // 29
  FileCompletionInformation,               // 30
  FileMoveClusterInformation,              // 31
  FileQuotaInformation,                    // 32
  FileReparsePointInformation,             // 33
  FileNetworkOpenInformation,              // 34
  FileAttributeTagInformation,             // 35
  FileTrackingInformation,                 // 36
  FileIdBothDirectoryInformation,          // 37
  FileIdFullDirectoryInformation,          // 38
  FileValidDataLengthInformation,          // 39
  FileShortNameInformation,                // 40
  FileIoCompletionNotificationInformation, // 41
  FileIoStatusBlockRangeInformation,       // 42
  FileIoPriorityHintInformation,           // 43
  FileSfioReserveInformation,              // 44
  FileSfioVolumeInformation,               // 45
  FileHardLinkInformation,                 // 46
  FileProcessIdsUsingFileInformation,      // 47
  FileNormalizedNameInformation,           // 48
  FileNetworkPhysicalNameInformation,      // 49
  FileIdGlobalTxDirectoryInformation,      // 50
  FileIsRemoteDeviceInformation,           // 51
  FileUnusedInformation,                   // 52
  FileNumaNodeInformation,                 // 53
  FileStandardLinkInformation,             // 54
  FileRemoteProtocolInformation,           // 55

  //
  //  These are special versions of these operations (defined earlier)
  //  which can be used by kernel mode drivers only to bypass security
  //  access checks for Rename and HardLink operations.  These operations
  //  are only recognized by the IOManager, a file system should never
  //  receive these.
  //
  FileRenameInformationBypassAccessCheck, // 56
  FileLinkInformationBypassAccessCheck,   // 57
  FileVolumeNameInformation,              // 58
  FileIdInformation,                      // 59
  FileIdExtdDirectoryInformation,         // 60
  FileReplaceCompletionInformation,       // 61
  FileHardLinkFullIdInformation,          // 62
  FileIdExtdBothDirectoryInformation,     // 63

  FileMaximumInformation
} FILE_INFORMATION_CLASS,
    *PFILE_INFORMATION_CLASS;

typedef enum _FSINFOCLASS {
  FileFsVolumeInformation = 1,
  FileFsLabelInformation,       // 2
  FileFsSizeInformation,        // 3
  FileFsDeviceInformation,      // 4
  FileFsAttributeInformation,   // 5
  FileFsControlInformation,     // 6
  FileFsFullSizeInformation,    // 7
  FileFsObjectIdInformation,    // 8
  FileFsDriverPathInformation,  // 9
  FileFsVolumeFlagsInformation, // 10
  FileFsMaximumInformation
} FS_INFORMATION_CLASS,
    *PFS_INFORMATION_CLASS;

typedef struct _FILE_ALIGNMENT_INFORMATION {
  ULONG AlignmentRequirement;
} FILE_ALIGNMENT_INFORMATION, *PFILE_ALIGNMENT_INFORMATION;

typedef struct _FILE_NAME_INFORMATION {
  ULONG FileNameLength;
  WCHAR FileName[1];
} FILE_NAME_INFORMATION, *PFILE_NAME_INFORMATION;

typedef struct _FILE_ATTRIBUTE_TAG_INFORMATION {
  ULONG FileAttributes;
  ULONG ReparseTag;
} FILE_ATTRIBUTE_TAG_INFORMATION, *PFILE_ATTRIBUTE_TAG_INFORMATION;

typedef struct _FILE_DISPOSITION_INFORMATION {
  BOOLEAN DeleteFile;
} FILE_DISPOSITION_INFORMATION, *PFILE_DISPOSITION_INFORMATION;

typedef struct _FILE_END_OF_FILE_INFORMATION {
  LARGE_INTEGER EndOfFile;
} FILE_END_OF_FILE_INFORMATION, *PFILE_END_OF_FILE_INFORMATION;

typedef struct _FILE_VALID_DATA_LENGTH_INFORMATION {
  LARGE_INTEGER ValidDataLength;
} FILE_VALID_DATA_LENGTH_INFORMATION, *PFILE_VALID_DATA_LENGTH_INFORMATION;

typedef struct _FILE_BASIC_INFORMATION {
  LARGE_INTEGER CreationTime;
  LARGE_INTEGER LastAccessTime;
  LARGE_INTEGER LastWriteTime;
  LARGE_INTEGER ChangeTime;
  ULONG FileAttributes;
} FILE_BASIC_INFORMATION, *PFILE_BASIC_INFORMATION;

typedef struct _FILE_STANDARD_INFORMATION {
  LARGE_INTEGER AllocationSize;
  LARGE_INTEGER EndOfFile;
  ULONG NumberOfLinks;
  BOOLEAN DeletePending;
  BOOLEAN Directory;
} FILE_STANDARD_INFORMATION, *PFILE_STANDARD_INFORMATION;

typedef struct _FILE_POSITION_INFORMATION {
  LARGE_INTEGER CurrentByteOffset;
} FILE_POSITION_INFORMATION, *PFILE_POSITION_INFORMATION;

typedef struct _FILE_DIRECTORY_INFORMATION {
  ULONG NextEntryOffset;
  ULONG FileIndex;
  LARGE_INTEGER CreationTime;
  LARGE_INTEGER LastAccessTime;
  LARGE_INTEGER LastWriteTime;
  LARGE_INTEGER ChangeTime;
  LARGE_INTEGER EndOfFile;
  LARGE_INTEGER AllocationSize;
  ULONG FileAttributes;
  ULONG FileNameLength;
  WCHAR FileName[1];
} FILE_DIRECTORY_INFORMATION, *PFILE_DIRECTORY_INFORMATION;

typedef struct _FILE_FULL_DIR_INFORMATION {
  ULONG NextEntryOffset;
  ULONG FileIndex;
  LARGE_INTEGER CreationTime;
  LARGE_INTEGER LastAccessTime;
  LARGE_INTEGER LastWriteTime;
  LARGE_INTEGER ChangeTime;
  LARGE_INTEGER EndOfFile;
  LARGE_INTEGER AllocationSize;
  ULONG FileAttributes;
  ULONG FileNameLength;
  ULONG EaSize;
  WCHAR FileName[1];
} FILE_FULL_DIR_INFORMATION, *PFILE_FULL_DIR_INFORMATION;

typedef struct _FILE_ID_FULL_DIR_INFORMATION {
  ULONG NextEntryOffset;
  ULONG FileIndex;
  LARGE_INTEGER CreationTime;
  LARGE_INTEGER LastAccessTime;
  LARGE_INTEGER LastWriteTime;
  LARGE_INTEGER ChangeTime;
  LARGE_INTEGER EndOfFile;
  LARGE_INTEGER AllocationSize;
  ULONG FileAttributes;
  ULONG FileNameLength;
  ULONG EaSize;
  LARGE_INTEGER FileId;
  WCHAR FileName[1];
} FILE_ID_FULL_DIR_INFORMATION, *PFILE_ID_FULL_DIR_INFORMATION;

typedef struct _FILE_BOTH_DIR_INFORMATION {
  ULONG NextEntryOffset;
  ULONG FileIndex;
  LARGE_INTEGER CreationTime;
  LARGE_INTEGER LastAccessTime;
  LARGE_INTEGER LastWriteTime;
  LARGE_INTEGER ChangeTime;
  LARGE_INTEGER EndOfFile;
  LARGE_INTEGER AllocationSize;
  ULONG FileAttributes;
  ULONG FileNameLength;
  ULONG EaSize;
  CCHAR ShortNameLength;
  WCHAR ShortName[12];
  WCHAR FileName[1];
} FILE_BOTH_DIR_INFORMATION, *PFILE_BOTH_DIR_INFORMATION;

typedef struct _FILE_ID_BOTH_DIR_INFORMATION {
  ULONG NextEntryOffset;
  ULONG FileIndex;
  LARGE_INTEGER CreationTime;
  LARGE_INTEGER LastAccessTime;
  LARGE_INTEGER LastWriteTime;
  LARGE_INTEGER ChangeTime;
  LARGE_INTEGER EndOfFile;
  LARGE_INTEGER AllocationSize;
  ULONG FileAttributes;
  ULONG FileNameLength;
  ULONG EaSize;
  CCHAR ShortNameLength;
  WCHAR ShortName[12];
  LARGE_INTEGER FileId;
  WCHAR FileName[1];
} FILE_ID_BOTH_DIR_INFORMATION, *PFILE_ID_BOTH_DIR_INFORMATION;

typedef struct _FILE_NAMES_INFORMATION {
  ULONG NextEntryOffset;
  ULONG FileIndex;
  ULONG FileNameLength;
  WCHAR FileName[1];
} FILE_NAMES_INFORMATION, *PFILE_NAMES_INFORMATION;

#define ANSI_DOS_STAR ('<')
#define ANSI_DOS_QM ('>')
#define ANSI_DOS_DOT ('"')

#define DOS_STAR (L'<')
#define DOS_QM (L'>')
#define DOS_DOT (L'"')

typedef struct _FILE_INTERNAL_INFORMATION {
  LARGE_INTEGER IndexNumber;
} FILE_INTERNAL_INFORMATION, *PFILE_INTERNAL_INFORMATION;

typedef struct _FILE_EA_INFORMATION {
  ULONG EaSize;
} FILE_EA_INFORMATION, *PFILE_EA_INFORMATION;

typedef struct _FILE_ACCESS_INFORMATION {
  ACCESS_MASK AccessFlags;
} FILE_ACCESS_INFORMATION, *PFILE_ACCESS_INFORMATION;

typedef struct _FILE_MODE_INFORMATION {
  ULONG Mode;
} FILE_MODE_INFORMATION, *PFILE_MODE_INFORMATION;

typedef struct _FILE_ALL_INFORMATION {
  FILE_BASIC_INFORMATION BasicInformation;
  FILE_STANDARD_INFORMATION StandardInformation;
  FILE_INTERNAL_INFORMATION InternalInformation;
  FILE_EA_INFORMATION EaInformation;
  FILE_ACCESS_INFORMATION AccessInformation;
  FILE_POSITION_INFORMATION PositionInformation;
  FILE_MODE_INFORMATION ModeInformation;
  FILE_ALIGNMENT_INFORMATION AlignmentInformation;
  FILE_NAME_INFORMATION NameInformation;
} FILE_ALL_INFORMATION, *PFILE_ALL_INFORMATION;

typedef struct _FILE_ALLOCATION_INFORMATION {
  LARGE_INTEGER AllocationSize;
} FILE_ALLOCATION_INFORMATION, *PFILE_ALLOCATION_INFORMATION;

typedef struct _FILE_COMPRESSION_INFORMATION {
  LARGE_INTEGER CompressedFileSize;
  USHORT CompressionFormat;
  UCHAR CompressionUnitShift;
  UCHAR ChunkShift;
  UCHAR ClusterShift;
  UCHAR Reserved[3];
} FILE_COMPRESSION_INFORMATION, *PFILE_COMPRESSION_INFORMATION;

typedef struct _FILE_LINK_INFORMATION {
  BOOLEAN ReplaceIfExists;
  HANDLE RootDirectory;
  ULONG FileNameLength;
  WCHAR FileName[1];
} FILE_LINK_INFORMATION, *PFILE_LINK_INFORMATION;

typedef struct _FILE_RENAME_INFORMATION {
  BOOLEAN ReplaceIfExists;
  HANDLE RootDirectory;
  ULONG FileNameLength;
  WCHAR FileName[1];
} FILE_RENAME_INFORMATION, *PFILE_RENAME_INFORMATION;

typedef struct _FILE_STREAM_INFORMATION {
  ULONG NextEntryOffset;
  ULONG StreamNameLength;
  LARGE_INTEGER StreamSize;
  LARGE_INTEGER StreamAllocationSize;
  WCHAR StreamName[1];
} FILE_STREAM_INFORMATION, *PFILE_STREAM_INFORMATION;

typedef struct _FILE_FS_LABEL_INFORMATION {
  ULONG VolumeLabelLength;
  WCHAR VolumeLabel[1];
} FILE_FS_LABEL_INFORMATION, *PFILE_FS_LABEL_INFORMATION;

typedef struct _FILE_FS_VOLUME_INFORMATION {
  LARGE_INTEGER VolumeCreationTime;
  ULONG VolumeSerialNumber;
  ULONG VolumeLabelLength;
  BOOLEAN SupportsObjects;
  WCHAR VolumeLabel[1];
} FILE_FS_VOLUME_INFORMATION, *PFILE_FS_VOLUME_INFORMATION;

typedef struct _FILE_FS_SIZE_INFORMATION {
  LARGE_INTEGER TotalAllocationUnits;
  LARGE_INTEGER AvailableAllocationUnits;
  ULONG SectorsPerAllocationUnit;
  ULONG BytesPerSector;
} FILE_FS_SIZE_INFORMATION, *PFILE_FS_SIZE_INFORMATION;

typedef struct _FILE_FS_FULL_SIZE_INFORMATION {
  LARGE_INTEGER TotalAllocationUnits;
  LARGE_INTEGER CallerAvailableAllocationUnits;
  LARGE_INTEGER ActualAvailableAllocationUnits;
  ULONG SectorsPerAllocationUnit;
  ULONG BytesPerSector;
} FILE_FS_FULL_SIZE_INFORMATION, *PFILE_FS_FULL_SIZE_INFORMATION;

typedef struct _FILE_FS_OBJECTID_INFORMATION {
  UCHAR ObjectId[16];
  UCHAR ExtendedInfo[48];
} FILE_FS_OBJECTID_INFORMATION, *PFILE_FS_OBJECTID_INFORMATION;

typedef struct _FILE_FS_ATTRIBUTE_INFORMATION {
  ULONG FileSystemAttributes;
  LONG MaximumComponentNameLength;
  ULONG FileSystemNameLength;
  WCHAR FileSystemName[1];
} FILE_FS_ATTRIBUTE_INFORMATION, *PFILE_FS_ATTRIBUTE_INFORMATION;

typedef struct _FILE_NETWORK_OPEN_INFORMATION {
  LARGE_INTEGER CreationTime;
  LARGE_INTEGER LastAccessTime;
  LARGE_INTEGER LastWriteTime;
  LARGE_INTEGER ChangeTime;
  LARGE_INTEGER AllocationSize;
  LARGE_INTEGER EndOfFile;
  ULONG FileAttributes;
} FILE_NETWORK_OPEN_INFORMATION, *PFILE_NETWORK_OPEN_INFORMATION;

typedef struct _FILE_NETWORK_PHYSICAL_NAME_INFORMATION {
  ULONG FileNameLength;
  WCHAR FileName[1];
} FILE_NETWORK_PHYSICAL_NAME_INFORMATION,
    *PFILE_NETWORK_PHYSICAL_NAME_INFORMATION;

#define SL_RESTART_SCAN 0x01
#define SL_RETURN_SINGLE_ENTRY 0x02
#define SL_INDEX_SPECIFIED 0x04
#define SL_FORCE_ACCESS_CHECK 0x01

#define SL_OPEN_PAGING_FILE 0x02
#define SL_OPEN_TARGET_DIRECTORY 0x04
#define SL_CASE_SENSITIVE 0x80

#define ALIGN_DOWN(length, type) ((ULONG)(length) & ~(sizeof(type) - 1))

#define ALIGN_UP(length, type)                                                 \
  (ALIGN_DOWN(((ULONG)(length) + sizeof(type) - 1), type))

#define ALIGN_DOWN_POINTER(address, type)                                      \
  ((PVOID)((ULONG_PTR)(address) & ~((ULONG_PTR)sizeof(type) - 1)))

#define ALIGN_UP_POINTER(address, type)                                        \
  (ALIGN_DOWN_POINTER(((ULONG_PTR)(address) + sizeof(type) - 1), type))

#define WordAlign(Val) (ALIGN_UP(Val, WORD))

#define WordAlignPtr(Ptr) (ALIGN_UP_POINTER(Ptr, WORD))

#define LongAlign(Val) (ALIGN_UP(Val, LONG))

#define LongAlignPtr(Ptr) (ALIGN_UP_POINTER(Ptr, LONG))

#define QuadAlign(Val) (ALIGN_UP(Val, ULONGLONG))

#define QuadAlignPtr(Ptr) (ALIGN_UP_POINTER(Ptr, ULONGLONG))

#define IsPtrQuadAligned(Ptr) (QuadAlignPtr(Ptr) == (PVOID)(Ptr))

// from wdm.h
#define FILE_SUPERSEDE 0x00000000
#define FILE_OPEN 0x00000001
#define FILE_CREATE 0x00000002
#define FILE_OPEN_IF 0x00000003
#define FILE_OVERWRITE 0x00000004
#define FILE_OVERWRITE_IF 0x00000005
#define FILE_MAXIMUM_DISPOSITION 0x00000005

#define FILE_DIRECTORY_FILE 0x00000001
#define FILE_WRITE_THROUGH 0x00000002
#define FILE_SEQUENTIAL_ONLY 0x00000004
#define FILE_NO_INTERMEDIATE_BUFFERING 0x00000008

#define FILE_SYNCHRONOUS_IO_ALERT 0x00000010
#define FILE_SYNCHRONOUS_IO_NONALERT 0x00000020
#define FILE_NON_DIRECTORY_FILE 0x00000040
#define FILE_CREATE_TREE_CONNECTION 0x00000080

#define FILE_COMPLETE_IF_OPLOCKED 0x00000100
#define FILE_NO_EA_KNOWLEDGE 0x00000200
#define FILE_OPEN_REMOTE_INSTANCE 0x00000400
#define FILE_RANDOM_ACCESS 0x00000800

#define FILE_DELETE_ON_CLOSE 0x00001000
#define FILE_OPEN_BY_FILE_ID 0x00002000
#define FILE_OPEN_FOR_BACKUP_INTENT 0x00004000
#define FILE_NO_COMPRESSION 0x00008000

#if (_WIN32_WINNT >= _WIN32_WINNT_WIN7)
#define FILE_OPEN_REQUIRING_OPLOCK 0x00010000
#define FILE_DISALLOW_EXCLUSIVE 0x00020000
#endif /* _WIN32_WINNT >= _WIN32_WINNT_WIN7 */
#if (_WIN32_WINNT >= _WIN32_WINNT_WIN8)
#define FILE_SESSION_AWARE 0x00040000
#endif /* _WIN32_WINNT >= _WIN32_WINNT_WIN7 */

#define FILE_RESERVE_OPFILTER 0x00100000
#define FILE_OPEN_REPARSE_POINT 0x00200000
#define FILE_OPEN_NO_RECALL 0x00400000
#define FILE_OPEN_FOR_FREE_SPACE_QUERY 0x00800000

#define FILE_VALID_OPTION_FLAGS 0x00ffffff

#define FILE_SUPERSEDED 0x00000000
#define FILE_OPENED 0x00000001
#define FILE_CREATED 0x00000002
#define FILE_OVERWRITTEN 0x00000003
#define FILE_EXISTS 0x00000004
#define FILE_DOES_NOT_EXIST 0x00000005

#define FILE_WRITE_TO_END_OF_FILE 0xffffffff
#define FILE_USE_FILE_POINTER_POSITION 0xfffffffe

/* Commented out because old mingw defines NTSTATUS in
   ntdef.h and that also defines _UNICODE_STRING thus
   creating a conflict.
// https://msdn.microsoft.com/en-us/library/windows/hardware/ff564879(v=vs.85).aspx
typedef struct _UNICODE_STRING {
  USHORT Length;
  USHORT MaximumLength;
  PWSTR Buffer;
} UNICODE_STRING, *PUNICODE_STRING;
*/

#endif // FILEINFO_H_
