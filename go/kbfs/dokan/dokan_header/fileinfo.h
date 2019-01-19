/*
  Dokan : user-mode file system library for Windows

  Copyright (C) 2015 - 2018 Adrien J. <liryna.stark@gmail.com> and Maxime C. <maxime@islog.com>
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

	FileRenameInformationBypassAccessCheck,  // 56
	FileLinkInformationBypassAccessCheck,    // 57

	//
	// End of special information classes reserved for IOManager.
	//

	FileVolumeNameInformation,               // 58
	FileIdInformation,                       // 59
	FileIdExtdDirectoryInformation,          // 60
	FileReplaceCompletionInformation,        // 61
	FileHardLinkFullIdInformation,           // 62
	FileIdExtdBothDirectoryInformation,      // 63
	FileDispositionInformationEx,            // 64
	FileRenameInformationEx,                 // 65
	FileRenameInformationExBypassAccessCheck, // 66
	FileDesiredStorageClassInformation,      // 67
	FileStatInformation,                     // 68
	FileMemoryPartitionInformation,          // 69

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

/**
 * \struct FILE_ALIGNMENT_INFORMATION
 * \brief Used as an argument to the ZwQueryInformationFile routine.
 *
 * The struct is requested during IRP_MJ_QUERY_INFORMATION with query FileAllInformation
 */
typedef struct _FILE_ALIGNMENT_INFORMATION {
  /**
  * The buffer alignment required by the underlying device. For a list of system-defined values, see DEVICE_OBJECT.
  * The value must be one of the FILE_XXX_ALIGNMENT values defined in Wdm.h.
  * For more information, see DEVICE_OBJECT and Initializing a Device Object.
  */
  ULONG AlignmentRequirement;
} FILE_ALIGNMENT_INFORMATION, *PFILE_ALIGNMENT_INFORMATION;

/**
 * \struct FILE_NAME_INFORMATION
 * \brief Used as argument to the ZwQueryInformationFile and ZwSetInformationFile routines.
 *
 * The struct is requested during IRP_MJ_QUERY_INFORMATION with query FileNameInformation
 */
typedef struct _FILE_NAME_INFORMATION {
  /**
  * Specifies the length, in bytes, of the file name string.
  */
  ULONG FileNameLength;
  /**
  * Specifies the first character of the file name string. This is followed in memory by the remainder of the string.
  */
  WCHAR FileName[1];
} FILE_NAME_INFORMATION, *PFILE_NAME_INFORMATION;

/**
 * \struct FILE_ATTRIBUTE_TAG_INFORMATION
 * \brief Used as an argument to ZwQueryInformationFile.
 *
 * The struct is requested during IRP_MJ_QUERY_INFORMATION with query FileAttributeTagInformation
 */
typedef struct _FILE_ATTRIBUTE_TAG_INFORMATION {
  /**
  * Specifies one or more FILE_ATTRIBUTE_XXX flags.
  * For descriptions of these flags, see the documentation of the GetFileAttributes function in the Microsoft Windows SDK.
  */
  ULONG FileAttributes;
  /**
  * Specifies the reparse point tag. If the FileAttributes member includes the FILE_ATTRIBUTE_REPARSE_POINT attribute flag,
  * this member specifies the reparse tag. Otherwise, this member is unused.
  */
  ULONG ReparseTag;
} FILE_ATTRIBUTE_TAG_INFORMATION, *PFILE_ATTRIBUTE_TAG_INFORMATION;

/**
 * \struct FILE_DISPOSITION_INFORMATION
 * \brief Used as an argument to the ZwSetInformationFile routine.
 *
 * The struct is requested during IRP_MJ_QUERY_INFORMATION with query FileDispositionInformation
 */
typedef struct _FILE_DISPOSITION_INFORMATION {
  /**
  * Indicates whether the operating system file should delete the file when the file is closed.
  * Set this member to TRUE to delete the file when it is closed.
  * Otherwise, set to FALSE. Setting this member to FALSE has no effect if the handle was opened with FILE_FLAG_DELETE_ON_CLOSE.
  */
  BOOLEAN DeleteFile;
} FILE_DISPOSITION_INFORMATION, *PFILE_DISPOSITION_INFORMATION;

/**
 * \struct FILE_END_OF_FILE_INFORMATION
 * \brief Used as an argument to the ZwSetInformationFile routine.
 *
 * The struct is requested during IRP_MJ_QUERY_INFORMATION with query FileEndOfFileInformation
 */
typedef struct _FILE_END_OF_FILE_INFORMATION {
  /**
  * The absolute new end of file position as a byte offset from the start of the file. 
  */
  LARGE_INTEGER EndOfFile;
} FILE_END_OF_FILE_INFORMATION, *PFILE_END_OF_FILE_INFORMATION;

/**
 * \struct FILE_VALID_DATA_LENGTH_INFORMATION
 * \brief Used as an argument to ZwSetInformationFile.
 *
 * The struct is requested during IRP_MJ_QUERY_INFORMATION with query FileValidDataLengthInformation
 */
typedef struct _FILE_VALID_DATA_LENGTH_INFORMATION {
  /**
  * Specifies the new valid data length for the file.
  * This parameter must be a positive value that is greater than the current valid data length, but less than or equal to the current file size. 
  */
  LARGE_INTEGER ValidDataLength;
} FILE_VALID_DATA_LENGTH_INFORMATION, *PFILE_VALID_DATA_LENGTH_INFORMATION;

/**
 * \struct FILE_BASIC_INFORMATION
 * \brief Used as an argument to routines that query or set file information.
 *
 * The struct is requested during IRP_MJ_QUERY_INFORMATION with query FileBasicInformation and FileAllInformation
 */
typedef struct _FILE_BASIC_INFORMATION {
  /**
  * Specifies the time that the file was created. 
  */
  LARGE_INTEGER CreationTime;
  /**
  * Specifies the time that the file was last accessed. 
  */
  LARGE_INTEGER LastAccessTime;
  /**
  * Specifies the time that the file was last written to. 
  */
  LARGE_INTEGER LastWriteTime;
  /**
  * Specifies the last time the file was changed. 
  */
  LARGE_INTEGER ChangeTime;
  /**
  * Specifies one or more FILE_ATTRIBUTE_XXX flags. For descriptions of these flags,
  * see the documentation for the GetFileAttributes function in the Microsoft Windows SDK.
  */
  ULONG FileAttributes;
} FILE_BASIC_INFORMATION, *PFILE_BASIC_INFORMATION;

/**
 * \struct FILE_STANDARD_INFORMATION
 * \brief Used as an argument to routines that query or set file information.
 *
 * The struct is requested during IRP_MJ_QUERY_INFORMATION with query FileStandardInformation and FileAllInformation
 */
typedef struct _FILE_STANDARD_INFORMATION {
  /**
  * The file allocation size in bytes. Usually, this value is a multiple of the sector or cluster size of the underlying physical device. 
  */
  LARGE_INTEGER AllocationSize;
  /**
  * The end of file location as a byte offset.
  */
  LARGE_INTEGER EndOfFile;
  /**
  * The number of hard links to the file.
  */
  ULONG NumberOfLinks;
  /**
  * The delete pending status. TRUE indicates that a file deletion has been requested.
  */
  BOOLEAN DeletePending;
  /**
  * The file directory status. TRUE indicates the file object represents a directory. 
  */
  BOOLEAN Directory;
} FILE_STANDARD_INFORMATION, *PFILE_STANDARD_INFORMATION;

/**
 * \struct FILE_POSITION_INFORMATION
 * \brief Used as an argument to routines that query or set file information.
 *
 * The struct is requested during IRP_MJ_QUERY_INFORMATION with query FilePositionInformation and FileAllInformation
 */
typedef struct _FILE_POSITION_INFORMATION {
  /**
  * The byte offset of the current file pointer.
  */
  LARGE_INTEGER CurrentByteOffset;
} FILE_POSITION_INFORMATION, *PFILE_POSITION_INFORMATION;

/**
 * \struct FILE_DIRECTORY_INFORMATION
 * \brief Used to query detailed information for the files in a directory. 
 */
typedef struct _FILE_DIRECTORY_INFORMATION {
  /**
  * Byte offset of the next FILE_DIRECTORY_INFORMATION entry, if multiple entries are present in a buffer.
  * This member is zero if no other entries follow this one. 
  */
  ULONG NextEntryOffset;
  /**
  * Byte offset of the file within the parent directory. This member is undefined for file systems, such as NTFS,
  * in which the position of a file within the parent directory is not fixed and can be changed at any time to maintain sort order. 
  */
  ULONG FileIndex;
  /**
  * Time when the file was created.
  */
  LARGE_INTEGER CreationTime;
  /**
  * Last time the file was accessed. 
  */
  LARGE_INTEGER LastAccessTime;
  /**
  * Last time information was written to the file.
  */
  LARGE_INTEGER LastWriteTime;
  /**
  * Last time the file was changed. 
  */
  LARGE_INTEGER ChangeTime;
  /**
  * Absolute new end-of-file position as a byte offset from the start of the file.
  * EndOfFile specifies the byte offset to the end of the file.
  * Because this value is zero-based, it actually refers to the first free byte in the file. In other words,
  * EndOfFile is the offset to the byte immediately following the last valid byte in the file.
  */
  LARGE_INTEGER EndOfFile;
  /**
  * File allocation size, in bytes. Usually, this value is a multiple of the sector or cluster size of the underlying physical device. 
  */
  LARGE_INTEGER AllocationSize;
  /**
  *  File attributes, which can be any valid combination of the following:
  *
  *    \li \c FILE_ATTRIBUTE_READONLY
  *    \li \c FILE_ATTRIBUTE_HIDDEN
  *    \li \c FILE_ATTRIBUTE_SYSTEM
  *    \li \c FILE_ATTRIBUTE_DIRECTORY
  *    \li \c FILE_ATTRIBUTE_ARCHIVE
  *    \li \c FILE_ATTRIBUTE_NORMAL
  *    \li \c FILE_ATTRIBUTE_TEMPORARY
  *    \li \c FILE_ATTRIBUTE_COMPRESSED
  */
  ULONG FileAttributes;
  /**
  * Specifies the length of the file name string. 
  */
  ULONG FileNameLength;
  /**
  * Specifies the first character of the file name string.
  * This is followed in memory by the remainder of the string. 
  */
  WCHAR FileName[1];
} FILE_DIRECTORY_INFORMATION, *PFILE_DIRECTORY_INFORMATION;

/**
 * \struct FILE_FULL_DIR_INFORMATION
 * \brief Used to query detailed information for the files in a directory. 
 */
typedef struct _FILE_FULL_DIR_INFORMATION {
  /**
  * Byte offset of the next FILE_DIRECTORY_INFORMATION entry, if multiple entries are present in a buffer.
  * This member is zero if no other entries follow this one.
  */
  ULONG NextEntryOffset;
  /**
  * Byte offset of the file within the parent directory. This member is undefined for file systems, such as NTFS,
  * in which the position of a file within the parent directory is not fixed and can be changed at any time to maintain sort order.
  */
  ULONG FileIndex;
  /**
  * Time when the file was created.
  */
  LARGE_INTEGER CreationTime;
  /**
  * Last time the file was accessed.
  */
  LARGE_INTEGER LastAccessTime;
  /**
  * Last time information was written to the file.
  */
  LARGE_INTEGER LastWriteTime;
  /**
  * Last time the file was changed.
  */
  LARGE_INTEGER ChangeTime;
  /**
  * Absolute new end-of-file position as a byte offset from the start of the file.
  * EndOfFile specifies the byte offset to the end of the file.
  * Because this value is zero-based, it actually refers to the first free byte in the file. In other words,
  * EndOfFile is the offset to the byte immediately following the last valid byte in the file.
  */
  LARGE_INTEGER EndOfFile;
  /**
  * File allocation size, in bytes. Usually, this value is a multiple of the sector or cluster size of the underlying physical device.
  */
  LARGE_INTEGER AllocationSize;
  /**
  *  File attributes, which can be any valid combination of the following:
  *
  *   \li \c FILE_ATTRIBUTE_READONLY
  *   \li \c FILE_ATTRIBUTE_HIDDEN
  *   \li \c FILE_ATTRIBUTE_SYSTEM
  *   \li \c FILE_ATTRIBUTE_DIRECTORY
  *   \li \c FILE_ATTRIBUTE_ARCHIVE
  *   \li \c FILE_ATTRIBUTE_NORMAL
  *   \li \c FILE_ATTRIBUTE_TEMPORARY
  *   \li \c FILE_ATTRIBUTE_COMPRESSED
  */
  ULONG FileAttributes;
  /**
  * Specifies the length of the file name string.
  */
  ULONG FileNameLength;
  /**
  * Combined length, in bytes, of the extended attributes (EA) for the file. 
  */
  ULONG EaSize;
  /**
  * Specifies the first character of the file name string.
  * This is followed in memory by the remainder of the string.
  */
  WCHAR FileName[1];
} FILE_FULL_DIR_INFORMATION, *PFILE_FULL_DIR_INFORMATION;

/**
 * \struct FILE_ID_FULL_DIR_INFORMATION
 * \brief Used to query detailed information for the files in a directory.
 */
typedef struct _FILE_ID_FULL_DIR_INFORMATION {
  /**
  * Byte offset of the next FILE_DIRECTORY_INFORMATION entry, if multiple entries are present in a buffer.
  * This member is zero if no other entries follow this one.
  */
  ULONG NextEntryOffset;
  /**
  * Byte offset of the file within the parent directory. This member is undefined for file systems, such as NTFS,
  * in which the position of a file within the parent directory is not fixed and can be changed at any time to maintain sort order.
  */
  ULONG FileIndex;
  /**
  * Time when the file was created.
  */
  LARGE_INTEGER CreationTime;
  /**
  * Last time the file was accessed.
  */
  LARGE_INTEGER LastAccessTime;
  /**
  * Last time information was written to the file.
  */
  LARGE_INTEGER LastWriteTime;
  /**
  * Last time the file was changed.
  */
  LARGE_INTEGER ChangeTime;
  /**
  * Absolute new end-of-file position as a byte offset from the start of the file.
  * EndOfFile specifies the byte offset to the end of the file.
  * Because this value is zero-based, it actually refers to the first free byte in the file. In other words,
  * EndOfFile is the offset to the byte immediately following the last valid byte in the file.
  */
  LARGE_INTEGER EndOfFile;
  /**
  * File allocation size, in bytes. Usually, this value is a multiple of the sector or cluster size of the underlying physical device.
  */
  LARGE_INTEGER AllocationSize;
  /**
  *  File attributes, which can be any valid combination of the following:
  *
  *   \li \c FILE_ATTRIBUTE_READONLY
  *   \li \c FILE_ATTRIBUTE_HIDDEN
  *   \li \c FILE_ATTRIBUTE_SYSTEM
  *   \li \c FILE_ATTRIBUTE_DIRECTORY
  *   \li \c FILE_ATTRIBUTE_ARCHIVE
  *   \li \c FILE_ATTRIBUTE_NORMAL
  *   \li \c FILE_ATTRIBUTE_TEMPORARY
  *   \li \c FILE_ATTRIBUTE_COMPRESSED
  */
  ULONG FileAttributes;
  /**
  * Specifies the length of the file name string.
  */
  ULONG FileNameLength;
  /**
  * Combined length, in bytes, of the extended attributes (EA) for the file.
  */
  ULONG EaSize;
  /**
  * The 8-byte file reference number for the file. (Note that this is not the same as the 16-byte
  * "file object ID" that was added to NTFS for Microsoft Windows 2000.) 
  */
  LARGE_INTEGER FileId;
  /**
  * Specifies the first character of the file name string.
  * This is followed in memory by the remainder of the string.
  */
  WCHAR FileName[1];
} FILE_ID_FULL_DIR_INFORMATION, *PFILE_ID_FULL_DIR_INFORMATION;

/**
 * \struct FILE_BOTH_DIR_INFORMATION
 * \brief Used to query detailed information for the files in a directory.
 */
typedef struct _FILE_BOTH_DIR_INFORMATION {
  /**
  * Byte offset of the next FILE_DIRECTORY_INFORMATION entry, if multiple entries are present in a buffer.
  * This member is zero if no other entries follow this one.
  */
  ULONG NextEntryOffset;
  /**
  * Byte offset of the file within the parent directory. This member is undefined for file systems, such as NTFS,
  * in which the position of a file within the parent directory is not fixed and can be changed at any time to maintain sort order.
  */
  ULONG FileIndex;
  /**
  * Time when the file was created.
  */
  LARGE_INTEGER CreationTime;
  /**
  * Last time the file was accessed.
  */
  LARGE_INTEGER LastAccessTime;
  /**
  * Last time information was written to the file.
  */
  LARGE_INTEGER LastWriteTime;
  /**
  * Last time the file was changed.
  */
  LARGE_INTEGER ChangeTime;
  /**
  * Absolute new end-of-file position as a byte offset from the start of the file.
  * EndOfFile specifies the byte offset to the end of the file.
  * Because this value is zero-based, it actually refers to the first free byte in the file. In other words,
  * EndOfFile is the offset to the byte immediately following the last valid byte in the file.
  */
  LARGE_INTEGER EndOfFile;
  /**
  * File allocation size, in bytes. Usually, this value is a multiple of the sector or cluster size of the underlying physical device.
  */
  LARGE_INTEGER AllocationSize;
  /**
  *  File attributes, which can be any valid combination of the following:
  *
  *   \li \c FILE_ATTRIBUTE_READONLY
  *   \li \c FILE_ATTRIBUTE_HIDDEN
  *   \li \c FILE_ATTRIBUTE_SYSTEM
  *   \li \c FILE_ATTRIBUTE_DIRECTORY
  *   \li \c FILE_ATTRIBUTE_ARCHIVE
  *   \li \c FILE_ATTRIBUTE_NORMAL
  *   \li \c FILE_ATTRIBUTE_TEMPORARY
  *   \li \c FILE_ATTRIBUTE_COMPRESSED
  */
  ULONG FileAttributes;
  /**
  * Specifies the length of the file name string.
  */
  ULONG FileNameLength;
  /**
  * Combined length, in bytes, of the extended attributes (EA) for the file.
  */
  ULONG EaSize;
  /**
  * Specifies the length, in bytes, of the short file name string. 
  */
  CCHAR ShortNameLength;
  /**
  * Unicode string containing the short (8.3) name for the file. 
  */
  WCHAR ShortName[12];
  /**
  * Specifies the first character of the file name string. This is followed in memory by the remainder of the string. 
  */
  WCHAR FileName[1];
} FILE_BOTH_DIR_INFORMATION, *PFILE_BOTH_DIR_INFORMATION;

/**
 * \struct FILE_ID_BOTH_DIR_INFORMATION
 * \brief Used to query detailed information for the files in a directory.
 */
typedef struct _FILE_ID_BOTH_DIR_INFORMATION {
  /**
  * Byte offset of the next FILE_DIRECTORY_INFORMATION entry, if multiple entries are present in a buffer.
  * This member is zero if no other entries follow this one.
  */
  ULONG NextEntryOffset;
  /**
  * Byte offset of the file within the parent directory. This member is undefined for file systems, such as NTFS,
  * in which the position of a file within the parent directory is not fixed and can be changed at any time to maintain sort order.
  */
  ULONG FileIndex;
  /**
  * Time when the file was created.
  */
  LARGE_INTEGER CreationTime;
  /**
  * Last time the file was accessed.
  */
  LARGE_INTEGER LastAccessTime;
  /**
  * Last time information was written to the file.
  */
  LARGE_INTEGER LastWriteTime;
  /**
  * Last time the file was changed.
  */
  LARGE_INTEGER ChangeTime;
  /**
  * Absolute new end-of-file position as a byte offset from the start of the file.
  * EndOfFile specifies the byte offset to the end of the file.
  * Because this value is zero-based, it actually refers to the first free byte in the file. In other words,
  * EndOfFile is the offset to the byte immediately following the last valid byte in the file.
  */
  LARGE_INTEGER EndOfFile;
  /**
  * File allocation size, in bytes. Usually, this value is a multiple of the sector or cluster size of the underlying physical device.
  */
  LARGE_INTEGER AllocationSize;
  /**
  *  File attributes, which can be any valid combination of the following:
  *
  *   \li \c FILE_ATTRIBUTE_READONLY
  *   \li \c FILE_ATTRIBUTE_HIDDEN
  *   \li \c FILE_ATTRIBUTE_SYSTEM
  *   \li \c FILE_ATTRIBUTE_DIRECTORY
  *   \li \c FILE_ATTRIBUTE_ARCHIVE
  *   \li \c FILE_ATTRIBUTE_NORMAL
  *   \li \c FILE_ATTRIBUTE_TEMPORARY
  *   \li \c FILE_ATTRIBUTE_COMPRESSED
  */
  ULONG FileAttributes;
  /**
  * Specifies the length of the file name string.
  */
  ULONG FileNameLength;
  /**
  * Combined length, in bytes, of the extended attributes (EA) for the file.
  */
  ULONG EaSize;
  /**
  * Specifies the length, in bytes, of the short file name string.
  */
  CCHAR ShortNameLength;
  /**
  * Unicode string containing the short (8.3) name for the file.
  */
  WCHAR ShortName[12];
  /**
  * The 8-byte file reference number for the file. This number is generated and assigned to the file by the file system. 
  * (Note that the FileId is not the same as the 16-byte "file object ID" that was added to NTFS for Microsoft Windows 2000.) 
  */
  LARGE_INTEGER FileId;
  /**
  * Specifies the first character of the file name string. This is followed in memory by the remainder of the string. 
  */
  WCHAR FileName[1];
} FILE_ID_BOTH_DIR_INFORMATION, *PFILE_ID_BOTH_DIR_INFORMATION;

/**
 * \struct FILE_NAMES_INFORMATION
 * \brief Used to query detailed information about the names of files in a directory.
 */
typedef struct _FILE_NAMES_INFORMATION {
  /**
  * Byte offset for the next FILE_NAMES_INFORMATION entry, if multiple entries are present in a buffer.
  * This member is zero if no other entries follow this one. 
  */
  ULONG NextEntryOffset;
  /**
  * Byte offset of the file within the parent directory. This member is undefined for file systems, such as NTFS,
  * in which the position of a file within the parent directory is not fixed and can be changed at any time to maintain sort order. 
  */
  ULONG FileIndex;
  /**
  * Specifies the length of the file name string. 
  */
  ULONG FileNameLength;
  /**
  * Specifies the first character of the file name string. This is followed in memory by the remainder of the string. 
  */
  WCHAR FileName[1];
} FILE_NAMES_INFORMATION, *PFILE_NAMES_INFORMATION;

#define ANSI_DOS_STAR ('<')
#define ANSI_DOS_QM ('>')
#define ANSI_DOS_DOT ('"')

#define DOS_STAR (L'<')
#define DOS_QM (L'>')
#define DOS_DOT (L'"')

/**
 * \struct FILE_INTERNAL_INFORMATION
 * \brief Used to query for the file system's 8-byte file reference number for a file. 
 *
 * The struct is requested during IRP_MJ_QUERY_INFORMATION with query FileInternalInformation
 */
typedef struct _FILE_INTERNAL_INFORMATION {
  /**
  * The 8-byte file reference number for the file. This number is assigned by the file system and is file-system-specific.
  * (Note that this is not the same as the 16-byte "file object ID" that was added to NTFS for Microsoft Windows 2000.) 
  */
  LARGE_INTEGER IndexNumber;
} FILE_INTERNAL_INFORMATION, *PFILE_INTERNAL_INFORMATION;

/**
 * \struct FILE_ID_INFORMATION
 * \brief Contains identification information for a file.
 *
 * This structure is returned from the GetFileInformationByHandleEx function when FileIdInfo is passed in the FileInformationClass parameter.
 *
 * The struct is requested during IRP_MJ_QUERY_INFORMATION with query FileIdInformation
 */
typedef struct _FILE_ID_INFORMATION {
  /**
  * The serial number of the volume that contains a file.
  */
  ULONGLONG VolumeSerialNumber;
  /**
  * The 128-bit file identifier for the file. The file identifier and the volume serial number uniquely identify a file on a single computer.
  * To determine whether two open handles represent the same file, combine the identifier and the volume serial number for each file and compare them.
  */
  FILE_ID_128 FileId;
} FILE_ID_INFORMATION, *PFILE_ID_INFORMATION;

/**
 * \struct FILE_EA_INFORMATION
 * \brief Used to query for the size of the extended attributes (EA) for a file.
 *
 * The struct is requested during IRP_MJ_QUERY_INFORMATION with query FileEaInformation and FileAllInformation
 */
typedef struct _FILE_EA_INFORMATION {
  /**
  * Specifies the combined length, in bytes, of the extended attributes for the file.
  */
  ULONG EaSize;
} FILE_EA_INFORMATION, *PFILE_EA_INFORMATION;

/**
 * \struct FILE_ACCESS_INFORMATION
 * \brief Used to query for or set the access rights of a file.
 *
 * The struct is requested during IRP_MJ_QUERY_INFORMATION with query FileAllInformation
 */
typedef struct _FILE_ACCESS_INFORMATION {
  /**
  * Flags that specify a set of access rights in the access mask of an access control entry.
  * This member is a value of type ACCESS_MASK.
  */
  ACCESS_MASK AccessFlags;
} FILE_ACCESS_INFORMATION, *PFILE_ACCESS_INFORMATION;

/**
 * \struct FILE_MODE_INFORMATION
 * \brief Used to query or set the access mode of a file.
 *
 * The struct is requested during IRP_MJ_QUERY_INFORMATION with query FileAllInformation
 */
typedef struct _FILE_MODE_INFORMATION {
  /**
  *  Specifies the mode in which the file will be accessed following a create-file or open-file operation.
  *  This parameter is either zero or the bitwise OR of one or more of the following file option flags:
  *
  *  \li \c FILE_WRITE_THROUGH
  *  \li \c FILE_SEQUENTIAL_ONLY
  *  \li \c FILE_NO_INTERMEDIATE_BUFFERING
  *  \li \c FILE_SYNCHRONOUS_IO_ALERT
  *  \li \c FILE_SYNCHRONOUS_IO_NONALERT
  *  \li \c FILE_DELETE_ON_CLOSE
  */
  ULONG Mode;
} FILE_MODE_INFORMATION, *PFILE_MODE_INFORMATION;

/**
 * \struct FILE_ALL_INFORMATION
 * \brief Structure is a container for several FILE_XXX_INFORMATION structures.
 *
 * The struct is requested during IRP_MJ_QUERY_INFORMATION with query FileAllInformation
 */
typedef struct _FILE_ALL_INFORMATION {
  /** \see FILE_BASIC_INFORMATION */
  FILE_BASIC_INFORMATION BasicInformation;
  /** \see FILE_STANDARD_INFORMATION */
  FILE_STANDARD_INFORMATION StandardInformation;
  /** \see FILE_INTERNAL_INFORMATION */
  FILE_INTERNAL_INFORMATION InternalInformation;
  /** \see FILE_EA_INFORMATION */
  FILE_EA_INFORMATION EaInformation;
  /** \see FILE_ACCESS_INFORMATION */
  FILE_ACCESS_INFORMATION AccessInformation;
  /** \see FILE_POSITION_INFORMATION */
  FILE_POSITION_INFORMATION PositionInformation;
  /** \see FILE_MODE_INFORMATION */
  FILE_MODE_INFORMATION ModeInformation;
  /** \see FILE_ALIGNMENT_INFORMATION */
  FILE_ALIGNMENT_INFORMATION AlignmentInformation;
  /** \see FILE_NAME_INFORMATION */
  FILE_NAME_INFORMATION NameInformation;
} FILE_ALL_INFORMATION, *PFILE_ALL_INFORMATION;

/**
 * \struct FILE_ALLOCATION_INFORMATION
 * \brief Used to set the allocation size for a file. 
 *
 * The struct is requested during IRP_MJ_SET_INFORMATION with query FileAllocationInformation
 */
typedef struct _FILE_ALLOCATION_INFORMATION {
  /**
  * File allocation size, in bytes. Usually this value is a multiple
  * of the sector or cluster size of the underlying physical device. 
  */
  LARGE_INTEGER AllocationSize;
} FILE_ALLOCATION_INFORMATION, *PFILE_ALLOCATION_INFORMATION;

/**
 * \struct FILE_LINK_INFORMATION
 * \brief Used to create an NTFS hard link to an existing file.
 *
 * The struct is requested during IRP_MJ_SET_INFORMATION with query FileLinkInformation
 */
typedef struct _FILE_LINK_INFORMATION {
  /**
  * Set to TRUE to specify that if the link already exists, it should be replaced with the new link.
  * Set to FALSE if the link creation operation should fail if the link already exists. 
  */
  BOOLEAN ReplaceIfExists;
  /**
  * If the link is to be created in the same directory as the file that is being linked to,
  * or if the FileName member contains the full pathname for the link to be created, this is NULL.
  * Otherwise it is a handle for the directory where the link is to be created.
  */
  HANDLE RootDirectory;
  /**
  * Length, in bytes, of the file name string. 
  */
  ULONG FileNameLength;
  /**
  * The first character of the name to be assigned to the newly created link.
  * This is followed in memory by the remainder of the string.
  * If the RootDirectory member is NULL and the link is to be created in a different directory from the file that is being linked to,
  * this member specifies the full pathname for the link to be created. Otherwise, it specifies only the file name.
  * (See the Remarks section for ZwQueryInformationFile for details on the syntax of this file name string.) 
  */
  WCHAR FileName[1];
} FILE_LINK_INFORMATION, *PFILE_LINK_INFORMATION;

/**
 * \struct FILE_RENAME_INFORMATION
 * \brief Used to rename a file.
 *
 * The struct is requested during IRP_MJ_SET_INFORMATION with query FileRenameInformation
 */
typedef struct _FILE_RENAME_INFORMATION {
  /**
  * Set to TRUE to specify that if a file with the given name already exists, it should be replaced with the given file.
  * Set to FALSE if the rename operation should fail if a file with the given name already exists. 
  */
  BOOLEAN ReplaceIfExists;
  /**
  * If the file is not being moved to a different directory,
  * or if the FileName member contains the full pathname, this member is NULL. Otherwise,
  * it is a handle for the root directory under which the file will reside after it is renamed. 
  */
  HANDLE RootDirectory;
  /**
  * Length, in bytes, of the new name for the file. 
  */
  ULONG FileNameLength;
  /**
  * The first character of a wide-character string containing the new name for the file.
  * This is followed in memory by the remainder of the string. If the RootDirectory member is NULL,
  * and the file is being moved to a different directory, this member specifies the full pathname to be assigned to the file.
  * Otherwise, it specifies only the file name or a relative pathname. 
  */
  WCHAR FileName[1];
} FILE_RENAME_INFORMATION, *PFILE_RENAME_INFORMATION;

/**
 * \struct FILE_STREAM_INFORMATION
 * \brief Used to enumerate the streams for a file. 
 *
 * The struct is requested during IRP_MJ_SET_INFORMATION query FileStreamInformation
 */
typedef struct _FILE_STREAM_INFORMATION {
  /**
  * The offset of the next FILE_STREAM_INFORMATION entry.
  * This member is zero if no other entries follow this one. 
  */
  ULONG NextEntryOffset;
  /**
  * Length, in bytes, of the StreamName string. 
  */
  ULONG StreamNameLength;
  /**
  * Size, in bytes, of the stream. 
  */
  LARGE_INTEGER StreamSize;
  /**
  * File stream allocation size, in bytes. Usually this value is a multiple of the sector
  * or cluster size of the underlying physical device. 
  */
  LARGE_INTEGER StreamAllocationSize;
  /**
  * Unicode string that contains the name of the stream. 
  */
  WCHAR StreamName[1];
} FILE_STREAM_INFORMATION, *PFILE_STREAM_INFORMATION;

/**
 * \struct FILE_FS_LABEL_INFORMATION
 * \brief Used to set the label for a file system volume. 
 *
 * The struct is requested during IRP_MJ_SET_VOLUME_INFORMATION query FileFsLabelInformation
 */
typedef struct _FILE_FS_LABEL_INFORMATION {
  /**
  * Length, in bytes, of the name for the volume. 
  */
  ULONG VolumeLabelLength;
  /**
  * Name for the volume. 
  */
  WCHAR VolumeLabel[1];
} FILE_FS_LABEL_INFORMATION, *PFILE_FS_LABEL_INFORMATION;

/**
 * \struct FILE_FS_VOLUME_INFORMATION
 * \brief Used to query information about a volume on which a file system is mounted. 
 *
 * The struct is requested during IRP_MJ_QUERY_VOLUME_INFORMATION query FileFsVolumeInformation
 */
typedef struct _FILE_FS_VOLUME_INFORMATION {
  /**
  * Time when the volume was created. 
  */
  LARGE_INTEGER VolumeCreationTime;
  /**
  * Serial number of the volume. 
  */
  ULONG VolumeSerialNumber;
  /**
  * Length, in bytes, of the name of the volume. 
  */
  ULONG VolumeLabelLength;
  /**
  * TRUE if the file system supports object-oriented file system objects, FALSE otherwise. 
  */
  BOOLEAN SupportsObjects;
  /**
  * Name of the volume. 
  */
  WCHAR VolumeLabel[1];
} FILE_FS_VOLUME_INFORMATION, *PFILE_FS_VOLUME_INFORMATION;

/**
 * \struct FILE_FS_SIZE_INFORMATION
 * \brief Used to query sector size information for a file system volume. 
 *
 * The struct is requested during IRP_MJ_QUERY_VOLUME_INFORMATION query FileFsSizeInformation
 */
typedef struct _FILE_FS_SIZE_INFORMATION {
  /**
  * Total number of allocation units on the volume that are available to the user associated with the calling thread. 
  * If per-user quotas are in use, this value may be less than the total number of allocation units on the disk. 
  */
  LARGE_INTEGER TotalAllocationUnits;
  /**
  * Total number of free allocation units on the volume that are available to the user associated with the calling thread.
  * If per-user quotas are in use, this value may be less than the total number of free allocation units on the disk.
  */
  LARGE_INTEGER AvailableAllocationUnits;
  /**
  * Number of sectors in each allocation unit.
  */
  ULONG SectorsPerAllocationUnit;
  /**
  * Number of bytes in each sector.
  */
  ULONG BytesPerSector;
} FILE_FS_SIZE_INFORMATION, *PFILE_FS_SIZE_INFORMATION;

/**
 * \struct FILE_FS_FULL_SIZE_INFORMATION
 * \brief Used to query sector size information for a file system volume. 
 *
 * The struct is requested during IRP_MJ_QUERY_VOLUME_INFORMATION query FileFsFullSizeInformation
 */
typedef struct _FILE_FS_FULL_SIZE_INFORMATION {
  /**
  * Total number of allocation units on the volume that are available to the user associated with the calling thread.
  * If per-user quotas are in use, this value may be less than the total number of allocation units on the disk.
  */
  LARGE_INTEGER TotalAllocationUnits;
  /**
  * Total number of free allocation units on the volume that are available to the user associated with the calling thread.
  * If per-user quotas are in use, this value may be less than the total number of free allocation units on the disk.
  */
  LARGE_INTEGER CallerAvailableAllocationUnits;
  /**
  * Total number of free allocation units on the volume. 
  */
  LARGE_INTEGER ActualAvailableAllocationUnits;
  /**
  * Number of sectors in each allocation unit. 
  */
  ULONG SectorsPerAllocationUnit;
  /**
  * Number of bytes in each sector. 
  */
  ULONG BytesPerSector;
} FILE_FS_FULL_SIZE_INFORMATION, *PFILE_FS_FULL_SIZE_INFORMATION;

/**
 * \struct FILE_FS_ATTRIBUTE_INFORMATION
 * \brief Used to query attribute information for a file system.
 *
 * The struct is requested during IRP_MJ_QUERY_VOLUME_INFORMATION query FileFsAttributeInformation
 */
typedef struct _FILE_FS_ATTRIBUTE_INFORMATION {
  /**
  * Bitmask of flags specifying attributes of the specified file system.
  * \see https://msdn.microsoft.com/en-us/library/windows/hardware/ff540251(v=vs.85).aspx
  */
  ULONG FileSystemAttributes;
  /**
  * Maximum file name component length, in bytes, supported by the specified file system.
  * A file name component is that portion of a file name between backslashes.
  */
  LONG MaximumComponentNameLength;
  /**
  * Length, in bytes, of the file system name.
  */
  ULONG FileSystemNameLength;
  /**
  * File system name.
  */
  WCHAR FileSystemName[1];
} FILE_FS_ATTRIBUTE_INFORMATION, *PFILE_FS_ATTRIBUTE_INFORMATION;

/**
 * \struct FILE_NETWORK_OPEN_INFORMATION
 * \brief Used as an argument to ZwQueryInformationFile.
 *
 * The struct is requested during IRP_MJ_QUERY_VOLUME_INFORMATION query FileNetworkOpenInformation
 */
typedef struct _FILE_NETWORK_OPEN_INFORMATION {
  /**
  * Specifies the time that the file was created.
  */
  LARGE_INTEGER CreationTime;
  /**
  * Specifies the time that the file was last accessed.
  */
  LARGE_INTEGER LastAccessTime;
  /**
  * Specifies he time that the file was last written to.
  */
  LARGE_INTEGER LastWriteTime;
  /**
  * Specifies the time that the file was last changed.
  */
  LARGE_INTEGER ChangeTime;
  /**
  * Specifies the file allocation size, in bytes. Usually,
  * this value is a multiple of the sector or cluster size of the underlying physical device.
  */
  LARGE_INTEGER AllocationSize;
  /**
  * Specifies the absolute end-of-file position as a byte offset from the start of the file.
  * EndOfFile specifies the byte offset to the end of the file. Because this value is zero-based,
  * it actually refers to the first free byte in the file. In other words,
  * EndOfFile is the offset to the byte immediately following the last valid byte in the file.
  */
  LARGE_INTEGER EndOfFile;
  /**
  * Specifies one or more FILE_ATTRIBUTE_XXX flags. For descriptions of these flags,
  * see the documentation of the GetFileAttributes function in the Microsoft Windows SDK.
  */
  ULONG FileAttributes;
} FILE_NETWORK_OPEN_INFORMATION, *PFILE_NETWORK_OPEN_INFORMATION;

/**
 * \struct FILE_NETWORK_PHYSICAL_NAME_INFORMATION
 * \brief Contains the full UNC physical pathname for a file or directory on a remote file share.
 *
 * The struct is requested during IRP_MJ_QUERY_VOLUME_INFORMATION query FileNetworkPhysicalNameInformation
 */
typedef struct _FILE_NETWORK_PHYSICAL_NAME_INFORMATION {
  /**
  * The length, in bytes, of the physical name in FileName.
  */
  ULONG FileNameLength;
  /**
  * The full UNC path of the network file share of the target.
  */
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

/**
 * \struct UNICODE_STRING
 * \brief Structure is used to define Unicode strings.
 */
// Already defined in mingw ntdef.h
//typedef struct _UNICODE_STRING {
//  /**
//  * The length, in bytes, of the string stored in Buffer.
//  */
//  USHORT Length;
//  /**
//  * The length, in bytes, of Buffer.
//  */
//  USHORT MaximumLength;
//  /**
//  * Pointer to a buffer used to contain a string of wide characters.
//  */
//  PWSTR Buffer;
//} UNICODE_STRING, *PUNICODE_STRING;


#endif // FILEINFO_H_
