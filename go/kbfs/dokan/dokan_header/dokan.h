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

#ifndef DOKAN_H_
#define DOKAN_H_

/** Do not include NTSTATUS. Fix  duplicate preprocessor definitions */
#define WIN32_NO_STATUS
#include <windows.h>
#undef WIN32_NO_STATUS
#include <ntstatus.h>

#include "fileinfo.h"
#include "public.h"

#ifdef _EXPORTING
/** Export dokan API see also dokan.def for export */
#define DOKANAPI __stdcall
#else
/** Import dokan API */
#define DOKANAPI __declspec(dllimport) __stdcall
#endif

/** Change calling convention to standard call */
#define DOKAN_CALLBACK __stdcall

#ifdef __cplusplus
extern "C" {
#endif

/** @file */

/**
 * \defgroup Dokan Dokan
 * \brief Dokan Library const and methods
 */
/** @{ */

/** The current Dokan version (ver 1.2.0). \ref DOKAN_OPTIONS.Version */
#define DOKAN_VERSION 120
/** Minimum Dokan version (ver 1.1.0) accepted. */
#define DOKAN_MINIMUM_COMPATIBLE_VERSION 110
/** Maximum number of dokan instances.*/
#define DOKAN_MAX_INSTANCES 32
/** Driver file name including the DOKAN_MAJOR_API_VERSION */
#define DOKAN_DRIVER_NAME L"dokan" DOKAN_MAJOR_API_VERSION L".sys"
/** Network provider name including the DOKAN_MAJOR_API_VERSION */
#define DOKAN_NP_NAME L"Dokan" DOKAN_MAJOR_API_VERSION

/** @} */

/**
 * \defgroup DOKAN_OPTION DOKAN_OPTION
 * \brief All DOKAN_OPTION flags used in DOKAN_OPTIONS.Options
 * \see DOKAN_FILE_INFO
 */
/** @{ */

/** Enable ouput debug message */
#define DOKAN_OPTION_DEBUG 1
/** Enable ouput debug message to stderr */
#define DOKAN_OPTION_STDERR 2
/** Use alternate stream */
#define DOKAN_OPTION_ALT_STREAM 4
/** Enable mount drive as write-protected */
#define DOKAN_OPTION_WRITE_PROTECT 8
/** Use network drive - Dokan network provider needs to be installed */
#define DOKAN_OPTION_NETWORK 16
/** Use removable drive */
#define DOKAN_OPTION_REMOVABLE 32
/** Use mount manager */
#define DOKAN_OPTION_MOUNT_MANAGER 64
/** Mount the drive on current session only */
#define DOKAN_OPTION_CURRENT_SESSION 128
/** Enable Lockfile/Unlockfile operations. Otherwise Dokan will take care of it */
#define DOKAN_OPTION_FILELOCK_USER_MODE 256

/** @} */

/**
 * \struct DOKAN_OPTIONS
 * \brief Dokan mount options used to describe Dokan device behavior.
 * \see DokanMain
 */
typedef struct _DOKAN_OPTIONS {
  /** Version of the Dokan features requested (version "123" is equal to Dokan version 1.2.3). */
  USHORT Version;
  /** Number of threads to be used internally by Dokan library. More threads will handle more events at the same time. */
  USHORT ThreadCount;
  /** Features enabled for the mount. See \ref DOKAN_OPTION. */
  ULONG Options;
  /** FileSystem can store anything here. */
  ULONG64 GlobalContext;
  /** Mount point. Can be "M:\" (drive letter) or "C:\mount\dokan" (path in NTFS). */
  LPCWSTR MountPoint;
  /**
  * UNC Name for the Network Redirector
  * \see <a href="https://msdn.microsoft.com/en-us/library/windows/hardware/ff556761(v=vs.85).aspx">Support for UNC Naming</a>
  */
  LPCWSTR UNCName;
  /** Max timeout in milliseconds of each request before Dokan gives up. */
  ULONG Timeout;
  /** Allocation Unit Size of the volume. This will affect the file size. */
  ULONG AllocationUnitSize;
  /** Sector Size of the volume. This will affect the file size. */
  ULONG SectorSize;
} DOKAN_OPTIONS, *PDOKAN_OPTIONS;

/**
 * \struct DOKAN_FILE_INFO
 * \brief Dokan file information on the current operation.
 */
typedef struct _DOKAN_FILE_INFO {
  /**
   * Context that can be used to carry information between operations.
   * The context can carry whatever type like \c HANDLE, struct, int,
   * internal reference that will help the implementation understand the request context of the event.
   */
  ULONG64 Context;
  /** Reserved. Used internally by Dokan library. Never modify. */
  ULONG64 DokanContext;
  /** A pointer to DOKAN_OPTIONS which was passed to DokanMain. */
  PDOKAN_OPTIONS DokanOptions;
  /**
   * Process ID for the thread that originally requested a given I/O operation.
   */
  ULONG ProcessId;
  /**
   * Requesting a directory file.
   * Must be set in \ref DOKAN_OPERATIONS.ZwCreateFile if the file appears to be a folder.
   */
  UCHAR IsDirectory;
  /** Flag if the file has to be deleted during DOKAN_OPERATIONS. Cleanup event. */
  UCHAR DeleteOnClose;
  /** Read or write is paging IO. */
  UCHAR PagingIo;
  /** Read or write is synchronous IO. */
  UCHAR SynchronousIo;
  /** Read or write directly from data source without cache */
  UCHAR Nocache;
  /**  If \c TRUE, write to the current end of file instead of using the Offset parameter. */
  UCHAR WriteToEndOfFile;
} DOKAN_FILE_INFO, *PDOKAN_FILE_INFO;

/**
 * \brief FillFindData Used to add an entry in FindFiles operation
 * \return 1 if buffer is full, otherwise 0 (currently it never returns 1)
 */
typedef int(WINAPI *PFillFindData)(PWIN32_FIND_DATAW, PDOKAN_FILE_INFO);

/**
 * \brief FillFindStreamData Used to add an entry in FindStreams
 * \return 1 if buffer is full, otherwise 0 (currently it never returns 1)
 */
typedef int(WINAPI *PFillFindStreamData)(PWIN32_FIND_STREAM_DATA,
                                         PDOKAN_FILE_INFO);

// clang-format off

/**
 * \struct DOKAN_OPERATIONS
 * \brief Dokan API callbacks interface
 *
 * DOKAN_OPERATIONS is a struct of callbacks that describe all Dokan API operations
 * that will be called when Windows access to the filesystem.
 *
 * If an error occurs, return NTSTATUS (https://support.microsoft.com/en-us/kb/113996).
 * Win32 Error can be converted to \c NTSTATUS with \ref DokanNtStatusFromWin32
 *
 * All callbacks can be set to \c NULL or return \c STATUS_NOT_IMPLEMENTED
 * if supporting one of them is not desired. Be aware that returning such values to important callbacks
 * such as DOKAN_OPERATIONS.ZwCreateFile / DOKAN_OPERATIONS.ReadFile / ... would make the filesystem not work or become unstable.
 */
typedef struct _DOKAN_OPERATIONS {
  /**
  * \brief CreateFile Dokan API callback
  *
  * CreateFile is called each time a request is made on a file system object.
  *
  * In case \c OPEN_ALWAYS & \c CREATE_ALWAYS are successfully opening an
  * existing file, \c STATUS_OBJECT_NAME_COLLISION should be returned instead of \c STATUS_SUCCESS .
  * This will inform Dokan that the file has been opened and not created during the request.
  *
  * If the file is a directory, CreateFile is also called.
  * In this case, CreateFile should return \c STATUS_SUCCESS when that directory
  * can be opened and DOKAN_FILE_INFO.IsDirectory has to be set to \c TRUE.
  * On the other hand, if DOKAN_FILE_INFO.IsDirectory is set to \c TRUE
  * but the path targets a file, \c STATUS_NOT_A_DIRECTORY must be returned.
  *
  * DOKAN_FILE_INFO.Context can be used to store Data (like \c HANDLE)
  * that can be retrieved in all other requests related to the Context.
  * To avoid memory leak, Context needs to be released in DOKAN_OPERATIONS.Cleanup.
  *
  * \param FileName File path requested by the Kernel on the FileSystem.
  * \param SecurityContext SecurityContext, see https://msdn.microsoft.com/en-us/library/windows/hardware/ff550613(v=vs.85).aspx
  * \param DesiredAccess Specifies an <a href="https://msdn.microsoft.com/en-us/library/windows/hardware/ff540466(v=vs.85).aspx">ACCESS_MASK</a> value that determines the requested access to the object.
  * \param FileAttributes Specifies one or more FILE_ATTRIBUTE_XXX flags, which represent the file attributes to set if a file is created or overwritten.
  * \param ShareAccess Type of share access, which is specified as zero or any combination of FILE_SHARE_* flags.
  * \param CreateDisposition Specifies the action to perform if the file does or does not exist.
  * \param CreateOptions Specifies the options to apply when the driver creates or opens the file.
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or NTSTATUS appropriate to the request result.
  * \see <a href="https://msdn.microsoft.com/en-us/library/windows/hardware/ff566424(v=vs.85).aspx">See ZwCreateFile for more information about the parameters of this callback (MSDN).</a>
  * \see DokanMapKernelToUserCreateFileFlags
  */
  NTSTATUS(DOKAN_CALLBACK *ZwCreateFile)(LPCWSTR FileName,
      PDOKAN_IO_SECURITY_CONTEXT SecurityContext,
      ACCESS_MASK DesiredAccess,
      ULONG FileAttributes,
      ULONG ShareAccess,
      ULONG CreateDisposition,
      ULONG CreateOptions,
      PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief Cleanup Dokan API callback
  *
  * Cleanup request before \ref CloseFile is called.
  *
  * When DOKAN_FILE_INFO.DeleteOnClose is \c TRUE, the file in Cleanup must be deleted.
  * See DeleteFile documentation for explanation.
  *
  * \param FileName File path requested by the Kernel on the FileSystem.
  * \param DokanFileInfo Information about the file or directory.
  * \see DeleteFile
  * \see DeleteDirectory
  */
  void(DOKAN_CALLBACK *Cleanup)(LPCWSTR FileName,
                                PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief CloseFile Dokan API callback
  *
  * Clean remaining Context
  *
  * CloseFile is called at the end of the life of the context.
  * Anything remaining in \ref DOKAN_FILE_INFO.Context must be cleared before returning.
  *
  * \param FileName File path requested by the Kernel on the FileSystem.
  * \param DokanFileInfo Information about the file or directory.
  */
  void(DOKAN_CALLBACK *CloseFile)(LPCWSTR FileName,
    PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief ReadFile Dokan API callback
  *
  * ReadFile callback on the file previously opened in DOKAN_OPERATIONS.ZwCreateFile.
  * It can be called by different threads at the same time, so the read/context has to be thread safe.
  *
  * \param FileName File path requested by the Kernel on the FileSystem.
  * \param Buffer Read buffer that has to be filled with the read result.
  * \param BufferLength Buffer length and read size to continue with.
  * \param ReadLength Total data size that has been read.
  * \param Offset Offset from where the read has to be continued.
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or NTSTATUS appropriate to the request result.
  * \see WriteFile
  */
  NTSTATUS(DOKAN_CALLBACK *ReadFile)(LPCWSTR FileName,
    LPVOID Buffer,
    DWORD BufferLength,
    LPDWORD ReadLength,
    LONGLONG Offset,
    PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief WriteFile Dokan API callback
  *
  * WriteFile callback on the file previously opened in DOKAN_OPERATIONS.ZwCreateFile
  * It can be called by different threads at the same time, sp the write/context has to be thread safe.
  *
  * \param FileName File path requested by the Kernel on the FileSystem.
  * \param Buffer Data that has to be written.
  * \param NumberOfBytesToWrite Buffer length and write size to continue with.
  * \param NumberOfBytesWritten Total number of bytes that have been written.
  * \param Offset Offset from where the write has to be continued.
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or NTSTATUS appropriate to the request result.
  * \see ReadFile
  */
  NTSTATUS(DOKAN_CALLBACK *WriteFile)(LPCWSTR FileName,
    LPCVOID Buffer,
    DWORD NumberOfBytesToWrite,
    LPDWORD NumberOfBytesWritten,
    LONGLONG Offset,
    PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief FlushFileBuffers Dokan API callback
  *
  * Clears buffers for this context and causes any buffered data to be written to the file.
  *
  * \param FileName File path requested by the Kernel on the FileSystem.
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or NTSTATUS appropriate to the request result.
  */
  NTSTATUS(DOKAN_CALLBACK *FlushFileBuffers)(LPCWSTR FileName,
    PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief GetFileInformation Dokan API callback
  *
  * Get specific information on a file.
  *
  * \param FileName File path requested by the Kernel on the FileSystem.
  * \param Buffer BY_HANDLE_FILE_INFORMATION struct to fill.
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or NTSTATUS appropriate to the request result.
  */
  NTSTATUS(DOKAN_CALLBACK *GetFileInformation)(LPCWSTR FileName,
    LPBY_HANDLE_FILE_INFORMATION Buffer,
    PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief FindFiles Dokan API callback
  *
  * List all files in the requested path
  * \ref DOKAN_OPERATIONS.FindFilesWithPattern is checked first. If it is not implemented or
  * returns \c STATUS_NOT_IMPLEMENTED, then FindFiles is called, if implemented.
  *
  * \param FileName File path requested by the Kernel on the FileSystem.
  * \param FillFindData Callback that has to be called with PWIN32_FIND_DATAW that contain file information.
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or NTSTATUS appropriate to the request result.
  * \see FindFilesWithPattern
  */
  NTSTATUS(DOKAN_CALLBACK *FindFiles)(LPCWSTR FileName,
    PFillFindData FillFindData,
    PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief FindFilesWithPattern Dokan API callback
  *
  * Same as \ref DOKAN_OPERATIONS.FindFiles but with a search pattern.
  *
  * \param PathName Path requested by the Kernel on the FileSystem.
  * \param SearchPattern Search pattern.
  * \param FillFindData Callback that has to be called with PWIN32_FIND_DATAW that contains file information.
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or NTSTATUS appropriate to the request result.
  * \see FindFiles
  */
  NTSTATUS(DOKAN_CALLBACK *FindFilesWithPattern)(LPCWSTR PathName,
    LPCWSTR SearchPattern,
    PFillFindData FillFindData,
    PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief SetFileAttributes Dokan API callback
  *
  * Set file attributes on a specific file
  *
  * \param FileName File path requested by the Kernel on the FileSystem.
  * \param FileAttributes FileAttributes to set on file.
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or NTSTATUS appropriate to the request result.
  */
  NTSTATUS(DOKAN_CALLBACK *SetFileAttributes)(LPCWSTR FileName,
    DWORD FileAttributes,
    PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief SetFileTime Dokan API callback
  *
  * Set file attributes on a specific file
  *
  * \param FileName File path requested by the Kernel on the FileSystem.
  * \param CreationTime Creation FILETIME.
  * \param LastAccessTime LastAccess FILETIME.
  * \param LastWriteTime LastWrite FILETIME.
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or NTSTATUS appropriate to the request result.
  */
  NTSTATUS(DOKAN_CALLBACK *SetFileTime)(LPCWSTR FileName,
    CONST FILETIME *CreationTime,
    CONST FILETIME *LastAccessTime,
    CONST FILETIME *LastWriteTime,
    PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief DeleteFile Dokan API callback
  *
  * Check if it is possible to delete a file.
  *
  * DeleteFile will also be called with DOKAN_FILE_INFO.DeleteOnClose set to \c FALSE
  * to notify the driver when the file is no longer requested to be deleted.
  *
  * The file in DeleteFile should not be deleted, but instead the file
  * must be checked as to whether or not it can be deleted,
  * and \c STATUS_SUCCESS should be returned (when it can be deleted) or
  * appropriate error codes, such as \c STATUS_ACCESS_DENIED or
  * \c STATUS_OBJECT_NAME_NOT_FOUND, should be returned.
  *
  * When \c STATUS_SUCCESS is returned, a Cleanup call is received afterwards with
  * DOKAN_FILE_INFO.DeleteOnClose set to \c TRUE. Only then must the closing file
  * be deleted.
  *
  * \param FileName File path requested by the Kernel on the FileSystem.
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or NTSTATUS appropriate to the request result.
  * \see DeleteDirectory
  * \see Cleanup
  */
  NTSTATUS(DOKAN_CALLBACK *DeleteFile)(LPCWSTR FileName,
    PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief DeleteDirectory Dokan API callback
  *
  * Check if it is possible to delete a directory.
  *
  * DeleteDirectory will also be called with DOKAN_FILE_INFO.DeleteOnClose set to \c FALSE
  * to notify the driver when the file is no longer requested to be deleted.
  *
  * The Directory in DeleteDirectory should not be deleted, but instead
  * must be checked as to whether or not it can be deleted,
  * and \c STATUS_SUCCESS should be returned (when it can be deleted) or
  * appropriate error codes, such as \c STATUS_ACCESS_DENIED,
  * \c STATUS_OBJECT_PATH_NOT_FOUND, or \c STATUS_DIRECTORY_NOT_EMPTY, should
  * be returned.
  *
  * When \c STATUS_SUCCESS is returned, a Cleanup call is received afterwards with
  * DOKAN_FILE_INFO.DeleteOnClose set to \c TRUE. Only then must the closing file
  * be deleted.
  *
  * \param FileName File path requested by the Kernel on the FileSystem.
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or \c NTSTATUS appropriate to the request result.
  * \ref DeleteFile
  * \ref Cleanup
  */
  NTSTATUS(DOKAN_CALLBACK *DeleteDirectory)(LPCWSTR FileName,
    PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief MoveFile Dokan API callback
  *
  * Move a file or directory to a new destination
  *
  * \param FileName Path for the file to be moved.
  * \param NewFileName Path for the new location of the file.
  * \param ReplaceIfExisting If destination already exists, can it be replaced?
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or NTSTATUS appropriate to the request result.
  */
  NTSTATUS(DOKAN_CALLBACK *MoveFile)(LPCWSTR FileName,
    LPCWSTR NewFileName,
    BOOL ReplaceIfExisting,
    PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief SetEndOfFile Dokan API callback
  *
  * SetEndOfFile is used to truncate or extend a file (physical file size).
  *
  * \param FileName File path requested by the Kernel on the FileSystem.
  * \param ByteOffset File length to set.
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or NTSTATUS appropriate to the request result.
  */
  NTSTATUS(DOKAN_CALLBACK *SetEndOfFile)(LPCWSTR FileName,
    LONGLONG ByteOffset,
    PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief SetAllocationSize Dokan API callback
  *
  * SetAllocationSize is used to truncate or extend a file.
  *
  * \param FileName File path requested by the Kernel on the FileSystem.
  * \param AllocSize File length to set.
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or NTSTATUS appropriate to the request result.
  */
  NTSTATUS(DOKAN_CALLBACK *SetAllocationSize)(LPCWSTR FileName,
    LONGLONG AllocSize,
    PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief LockFile Dokan API callback
  *
  * Lock file at a specific offset and data length.
  * This is only used if \ref DOKAN_OPTION_FILELOCK_USER_MODE is enabled.
  *
  * \param FileName File path requested by the Kernel on the FileSystem.
  * \param ByteOffset Offset from where the lock has to be continued.
  * \param Length Data length to lock.
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or NTSTATUS appropriate to the request result.
  * \see UnlockFile
  */
  NTSTATUS(DOKAN_CALLBACK *LockFile)(LPCWSTR FileName,
    LONGLONG ByteOffset,
    LONGLONG Length,
    PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief UnlockFile Dokan API callback
  *
  * Unlock file at a specific offset and data length.
  * This is only used if \ref DOKAN_OPTION_FILELOCK_USER_MODE is enabled.
  *
  * \param FileName File path requested by the Kernel on the FileSystem.
  * \param ByteOffset Offset from where the lock has to be continued.
  * \param Length Data length to lock.
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or NTSTATUS appropriate to the request result.
  * \see LockFile
  */
  NTSTATUS(DOKAN_CALLBACK *UnlockFile)(LPCWSTR FileName,
    LONGLONG ByteOffset,
    LONGLONG Length,
    PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief GetDiskFreeSpace Dokan API callback
  *
  * Retrieves information about the amount of space that is available on a disk volume.
  * It consits of the total amount of space, the total amount of free space, and
  * the total amount of free space available to the user that is associated with the calling thread.
  *
  * Neither GetDiskFreeSpace nor \ref GetVolumeInformation
  * save the  DOKAN_FILE_INFO.Context.
  * Before these methods are called, \ref ZwCreateFile may not be called.
  * (ditto \ref CloseFile and \ref Cleanup)
  *
  * \param FreeBytesAvailable Amount of available space.
  * \param TotalNumberOfBytes Total size of storage space
  * \param TotalNumberOfFreeBytes Amount of free space
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or \c NTSTATUS appropriate to the request result.
  * \see <a href="https://msdn.microsoft.com/en-us/library/windows/desktop/aa364937(v=vs.85).aspx"> GetDiskFreeSpaceEx function (MSDN)</a>
  * \see GetVolumeInformation
  */
  NTSTATUS(DOKAN_CALLBACK *GetDiskFreeSpace)(PULONGLONG FreeBytesAvailable,
    PULONGLONG TotalNumberOfBytes,
    PULONGLONG TotalNumberOfFreeBytes,
    PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief GetVolumeInformation Dokan API callback
  *
  * Retrieves information about the file system and volume associated with the specified root directory.
  *
  * Neither GetVolumeInformation nor GetDiskFreeSpace
  * save the \ref DOKAN_FILE_INFO#Context.
  * Before these methods are called, \ref ZwCreateFile may not be called.
  * (ditto \ref CloseFile and \ref Cleanup)
  *
  * FileSystemName could be anything up to 10 characters.
  * But Windows check few feature availability based on file system name.
  * For this, it is recommended to set NTFS or FAT here.
  *
  * \c FILE_READ_ONLY_VOLUME is automatically added to the
  * FileSystemFlags if \ref DOKAN_OPTION_WRITE_PROTECT was
  * specified in DOKAN_OPTIONS when the volume was mounted.
  *
  * \param VolumeNameBuffer A pointer to a buffer that receives the name of a specified volume.
  * \param VolumeNameSize The length of a volume name buffer.
  * \param VolumeSerialNumber A pointer to a variable that receives the volume serial number.
  * \param MaximumComponentLength A pointer to a variable that receives the maximum length.
  * \param FileSystemFlags A pointer to a variable that receives flags associated with the specified file system.
  * \param FileSystemNameBuffer A pointer to a buffer that receives the name of the file system.
  * \param FileSystemNameSize The length of the file system name buffer.
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or NTSTATUS appropriate to the request result.
  * \see <a href="https://msdn.microsoft.com/en-us/library/windows/desktop/aa364993(v=vs.85).aspx"> GetVolumeInformation function (MSDN)</a>
  * \see GetDiskFreeSpace
  */
  NTSTATUS(DOKAN_CALLBACK *GetVolumeInformation)(LPWSTR VolumeNameBuffer,
    DWORD VolumeNameSize,
    LPDWORD VolumeSerialNumber,
    LPDWORD MaximumComponentLength,
    LPDWORD FileSystemFlags,
    LPWSTR FileSystemNameBuffer,
    DWORD FileSystemNameSize,
    PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief Mounted Dokan API callback
  *
  * Called when Dokan successfully mounts the volume.
  *
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or NTSTATUS appropriate to the request result.
  * \see Unmounted
  */
  NTSTATUS(DOKAN_CALLBACK *Mounted)(PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief Unmounted Dokan API callback
  *
  * Called when Dokan is unmounting the volume.
  *
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or \c NTSTATUS appropriate to the request result.
  * \see Unmounted
  */
  NTSTATUS(DOKAN_CALLBACK *Unmounted)(PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief GetFileSecurity Dokan API callback
  *
  * Get specified information about the security of a file or directory.
  *
  * Return \c STATUS_NOT_IMPLEMENTED to let dokan library build a sddl of the current process user with authenticate user rights for context menu.
  * Return \c STATUS_BUFFER_OVERFLOW if buffer size is too small.
  *
  * \since Supported since version 0.6.0. The version must be specified in \ref DOKAN_OPTIONS.Version.
  * \param FileName File path requested by the Kernel on the FileSystem.
  * \param SecurityInformation A SECURITY_INFORMATION value that identifies the security information being requested.
  * \param SecurityDescriptor A pointer to a buffer that receives a copy of the security descriptor of the requested file.
  * \param BufferLength Specifies the size, in bytes, of the buffer.
  * \param LengthNeeded A pointer to the variable that receives the number of bytes necessary to store the complete security descriptor.
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or NTSTATUS appropriate to the request result.
  * \see SetFileSecurity
  * \see <a href="https://msdn.microsoft.com/en-us/library/windows/desktop/aa446639(v=vs.85).aspx">GetFileSecurity function (MSDN)</a>
  */
  NTSTATUS(DOKAN_CALLBACK *GetFileSecurity)(LPCWSTR FileName,
    PSECURITY_INFORMATION SecurityInformation,
    PSECURITY_DESCRIPTOR SecurityDescriptor,
    ULONG BufferLength,
    PULONG LengthNeeded,
    PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief SetFileSecurity Dokan API callback
  *
  * Sets the security of a file or directory object.
  *
  * \since Supported since version 0.6.0. The version must be specified in \ref DOKAN_OPTIONS.Version.
  * \param FileName File path requested by the Kernel on the FileSystem.
  * \param SecurityInformation Structure that identifies the contents of the security descriptor pointed by \a SecurityDescriptor param.
  * \param SecurityDescriptor A pointer to a SECURITY_DESCRIPTOR structure.
  * \param BufferLength Specifies the size, in bytes, of the buffer.
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or NTSTATUS appropriate to the request result.
  * \see GetFileSecurity
  * \see <a href="https://msdn.microsoft.com/en-us/library/windows/desktop/aa379577(v=vs.85).aspx">SetFileSecurity function (MSDN)</a>
  */
  NTSTATUS(DOKAN_CALLBACK *SetFileSecurity)(LPCWSTR FileName,
    PSECURITY_INFORMATION SecurityInformation,
    PSECURITY_DESCRIPTOR SecurityDescriptor,
    ULONG BufferLength,
    PDOKAN_FILE_INFO DokanFileInfo);

  /**
  * \brief FindStreams Dokan API callback
  *
  * Retrieve all NTFS Streams informations on the file.
  * This is only called if \ref DOKAN_OPTION_ALT_STREAM is enabled.
  *
  * \since Supported since version 0.8.0. The version must be specified in \ref DOKAN_OPTIONS.Version.
  * \param FileName File path requested by the Kernel on the FileSystem.
  * \param FillFindStreamData Callback that has to be called with PWIN32_FIND_STREAM_DATA that contain stream information.
  * \param DokanFileInfo Information about the file or directory.
  * \return \c STATUS_SUCCESS on success or NTSTATUS appropriate to the request result.
  */
  NTSTATUS(DOKAN_CALLBACK *FindStreams)(LPCWSTR FileName,
    PFillFindStreamData FillFindStreamData,
    PDOKAN_FILE_INFO DokanFileInfo);

} DOKAN_OPERATIONS, *PDOKAN_OPERATIONS;

// clang-format on

/**
 * \defgroup DokanMainResult DokanMainResult
 * \brief \ref DokanMain returns error codes
 */
/** @{ */

/** Dokan mount succeed. */
#define DOKAN_SUCCESS 0
/** Dokan mount error. */
#define DOKAN_ERROR -1
/** Dokan mount failed - Bad drive letter. */
#define DOKAN_DRIVE_LETTER_ERROR -2
/** Dokan mount failed - Can't install driver.  */
#define DOKAN_DRIVER_INSTALL_ERROR -3
/** Dokan mount failed - Driver answer that something is wrong. */
#define DOKAN_START_ERROR -4
/**
 * Dokan mount failed.
 * Can't assign a drive letter or mount point.
 * Probably already used by another volume.
 */
#define DOKAN_MOUNT_ERROR -5
/**
 * Dokan mount failed.
 * Mount point is invalid.
 */
#define DOKAN_MOUNT_POINT_ERROR -6
/**
 * Dokan mount failed.
 * Requested an incompatible version.
 */
#define DOKAN_VERSION_ERROR -7

/** @} */

/**
 * \defgroup Dokan Dokan
 */
/** @{ */

/**
 * \brief Mount a new Dokan Volume.
 *
 * This function block until the device is unmounted.
 * If the mount fails, it will directly return a \ref DokanMainResult error.
 *
 * \param DokanOptions a \ref DOKAN_OPTIONS that describe the mount.
 * \param DokanOperations Instance of \ref DOKAN_OPERATIONS that will be called for each request made by the kernel.
 * \return \ref DokanMainResult status.
 */
int DOKANAPI DokanMain(PDOKAN_OPTIONS DokanOptions,
                       PDOKAN_OPERATIONS DokanOperations);

/**
 * \brief Unmount a Dokan device from a driver letter.
 *
 * \param DriveLetter Dokan driver letter to unmount.
 * \return \c TRUE if device was unmounted or False in case of failure or device not found.
 */
BOOL DOKANAPI DokanUnmount(WCHAR DriveLetter);

/**
 * \brief Unmount a Dokan device from a mount point
 *
 * \param MountPoint Mount point to unmount ("Z", "Z:", "Z:\", "Z:\MyMountPoint").
 * \return \c TRUE if device was unmounted or False in case of failure or device not found.
 */
BOOL DOKANAPI DokanRemoveMountPoint(LPCWSTR MountPoint);

/**
 * \brief Unmount a Dokan device from a mount point
 *
 * Same as \ref DokanRemoveMountPoint
 * If Safe is \c TRUE, it will broadcast to all desktops and Shells
 * Safe should not be used during DLL_PROCESS_DETACH
 *
 * \see DokanRemoveMountPoint
 *
 * \param MountPoint Mount point to unmount ("Z", "Z:", "Z:\", "Z:\MyMountPoint").
 * \param Safe Process is not in DLL_PROCESS_DETACH state.
 * \return True if device was unmounted or False in case of failure or device not found.
 */
BOOL DOKANAPI DokanRemoveMountPointEx(LPCWSTR MountPoint, BOOL Safe);

/**
 * \brief Checks whether Name matches Expression
 *
 * \param Expression Expression can contain wildcard characters (? and *)
 * \param Name Name to check
 * \param IgnoreCase Case sensitive or not
 * \return result if name matches the expression
 */
BOOL DOKANAPI DokanIsNameInExpression(LPCWSTR Expression, LPCWSTR Name,
                                      BOOL IgnoreCase);

/**
 * \brief Get the version of Dokan.
 * The returned ULONG is the version number without the dots.
 * \return The version of Dokan
 */
ULONG DOKANAPI DokanVersion();

/**
 * \brief Get the version of the Dokan driver.
 * The returned ULONG is the version number without the dots.
 * \return The version of Dokan driver.
 */
ULONG DOKANAPI DokanDriverVersion();

/**
 * \brief Extends the timeout of the current IO operation in driver.
 *
 * \param Timeout Extended time in milliseconds requested.
 * \param DokanFileInfo \ref DOKAN_FILE_INFO of the operation to extend.
 * \return If the operation was successful.
 */
BOOL DOKANAPI DokanResetTimeout(ULONG Timeout, PDOKAN_FILE_INFO DokanFileInfo);

/**
 * \brief Get the handle to Access Token.
 *
 * This method needs be called in <a href="https://msdn.microsoft.com/en-us/library/windows/desktop/aa363858(v=vs.85).aspx">CreateFile</a> callback.
 * The caller must call <a href="https://msdn.microsoft.com/en-us/library/windows/desktop/ms724211(v=vs.85).aspx">CloseHandle</a>
 * for the returned handle.
 *
 * \param DokanFileInfo \ref DOKAN_FILE_INFO of the operation to extend.
 * \return A handle to the account token for the user on whose behalf the code is running.
 */
HANDLE DOKANAPI DokanOpenRequestorToken(PDOKAN_FILE_INFO DokanFileInfo);

/**
 * \brief Get active Dokan mount points.
 *
 * \param list Allocate array of DOKAN_CONTROL.
 * \param length Number of \ref DOKAN_CONTROL instances in list.
 * \param uncOnly Get only instances that have UNC Name.
 * \param nbRead Number of instances successfully retrieved.
 * \return List retrieved or not.
 */
//BOOL DOKANAPI DokanGetMountPointList(PDOKAN_CONTROL list, ULONG length,
//                                     BOOL uncOnly, PULONG nbRead);

/**
 * \brief Convert \ref DOKAN_OPERATIONS.ZwCreateFile parameters to <a href="https://msdn.microsoft.com/en-us/library/windows/desktop/aa363858(v=vs.85).aspx">CreateFile</a> parameters.
 *
 * Dokan Kernel forward the DesiredAccess directly from the IRP_MJ_CREATE.
 * This DesiredAccess has been converted from generic rights (user CreateFile request) to standard rights and will be converted back here.
 * https://msdn.microsoft.com/windows/hardware/drivers/ifs/access-mask
 *
 * \param DesiredAccess DesiredAccess from \ref DOKAN_OPERATIONS.ZwCreateFile.
 * \param FileAttributes FileAttributes from \ref DOKAN_OPERATIONS.ZwCreateFile.
 * \param CreateOptions CreateOptions from \ref DOKAN_OPERATIONS.ZwCreateFile.
 * \param CreateDisposition CreateDisposition from \ref DOKAN_OPERATIONS.ZwCreateFile.
 * \param outDesiredAccess New <a href="https://msdn.microsoft.com/en-us/library/windows/desktop/aa363858(v=vs.85).aspx">CreateFile</a> dwDesiredAccess.
 * \param outFileAttributesAndFlags New <a href="https://msdn.microsoft.com/en-us/library/windows/desktop/aa363858(v=vs.85).aspx">CreateFile</a> dwFlagsAndAttributes.
 * \param outCreationDisposition New <a href="https://msdn.microsoft.com/en-us/library/windows/desktop/aa363858(v=vs.85).aspx">CreateFile</a> dwCreationDisposition.
 * \see <a href="https://msdn.microsoft.com/en-us/library/windows/desktop/aa363858(v=vs.85).aspx">CreateFile function (MSDN)</a>
 */
void DOKANAPI DokanMapKernelToUserCreateFileFlags(
	ACCESS_MASK DesiredAccess, ULONG FileAttributes, ULONG CreateOptions, ULONG CreateDisposition,
	ACCESS_MASK* outDesiredAccess, DWORD *outFileAttributesAndFlags, DWORD *outCreationDisposition);

/**
 * \brief Convert WIN32 error to NTSTATUS
 *
 * https://support.microsoft.com/en-us/kb/113996
 *
 * \param Error Win32 Error to convert
 * \return NTSTATUS associate to the ERROR.
 */
NTSTATUS DOKANAPI DokanNtStatusFromWin32(DWORD Error);

/** @} */

#ifdef __cplusplus
}
#endif

#endif // DOKAN_H_
