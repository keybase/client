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

#ifndef DOKAN_H_
#define DOKAN_H_

#include <windows.h>

#include "fileinfo.h"
#include "public.h"

#define DOKAN_DRIVER_NAME L"dokan" DOKAN_MAJOR_API_VERSION L".sys"
#define DOKAN_NP_NAME L"Dokan" DOKAN_MAJOR_API_VERSION

#ifdef _EXPORTING
#define DOKANAPI /*__declspec(dllexport)*/                                     \
  __stdcall      // exports defined in dokan.def
#else
#define DOKANAPI __declspec(dllimport) __stdcall
#endif

#define DOKAN_CALLBACK __stdcall

#ifdef __cplusplus
extern "C" {
#endif

// The current Dokan version (ver 1.0.0). Please set this constant on
// DokanOptions->Version.
#define DOKAN_VERSION 100
#define DOKAN_MINIMUM_COMPATIBLE_VERSION 100

#define DOKAN_MAX_INSTANCES 32 // Maximum number of dokan instances

#define DOKAN_OPTION_DEBUG 1          // ouput debug message
#define DOKAN_OPTION_STDERR 2         // ouput debug message to stderr
#define DOKAN_OPTION_ALT_STREAM 4     // use alternate stream
#define DOKAN_OPTION_WRITE_PROTECT 8  // mount drive as write-protected.
#define DOKAN_OPTION_NETWORK 16       // use network drive, you need to
                                      // install Dokan network provider.
#define DOKAN_OPTION_REMOVABLE 32     // use removable drive
#define DOKAN_OPTION_MOUNT_MANAGER 64 // use mount manager
#define DOKAN_OPTION_CURRENT_SESSION 128 // mount the drive on current session only

typedef struct _DOKAN_OPTIONS {
  USHORT Version;        // Supported Dokan Version, ex. "530" (Dokan ver 0.5.3)
  USHORT ThreadCount;    // number of threads to be
                         // used internally by Dokan library
  ULONG Options;         // combination of DOKAN_OPTIONS_*
  ULONG64 GlobalContext; // FileSystem can store anything here
  LPCWSTR MountPoint; //  mount point "M:\" (drive letter) or "C:\mount\dokan"
                      //  (path in NTFS)
  LPCWSTR UNCName;    // UNC provider name
  ULONG Timeout;      // IrpTimeout in milliseconds
  ULONG AllocationUnitSize; // Device allocation size
  ULONG SectorSize;         // Device sector size
} DOKAN_OPTIONS, *PDOKAN_OPTIONS;

typedef struct _DOKAN_FILE_INFO {
  ULONG64 Context;             // FileSystem can store anything here
  ULONG64 DokanContext;        // Used internally, never modify
  PDOKAN_OPTIONS DokanOptions; // A pointer to DOKAN_OPTIONS
                               // which was passed to DokanMain.
  ULONG ProcessId;     // process id for the thread that originally requested a
                       // given I/O operation
  UCHAR IsDirectory;   // requesting a directory file
  UCHAR DeleteOnClose; // Delete on when "cleanup" is called
  UCHAR PagingIo;      // Read or write is paging IO.
  UCHAR SynchronousIo; // Read or write is synchronous IO.
  UCHAR Nocache;
  UCHAR WriteToEndOfFile; //  If true, write to the current end of file instead
                          //  of Offset parameter.

} DOKAN_FILE_INFO, *PDOKAN_FILE_INFO;

// FillFindData
//   is used to add an entry in FindFiles
//   returns 1 if buffer is full, otherwise 0
//   (currently it never returns 1)
typedef int(WINAPI *PFillFindData)(PWIN32_FIND_DATAW, PDOKAN_FILE_INFO);

// FillFindStreamData
//   is used to add an entry in FindStreams
//   returns 1 if buffer is full, otherwise 0
//   (currently it never returns 1)
typedef int(WINAPI *PFillFindStreamData)(PWIN32_FIND_STREAM_DATA,
                                         PDOKAN_FILE_INFO);

typedef struct _DOKAN_OPERATIONS {

  // When an error occurs, return NTSTATUS
  // (https://support.microsoft.com/en-us/kb/113996)

  // CreateFile
  //   In case OPEN_ALWAYS & CREATE_ALWAYS are opening successfully a already
  //   existing file,
  //   you have to SetLastError(ERROR_ALREADY_EXISTS)
  //   If file is a directory, CreateFile (not OpenDirectory) may be called.
  //   In this case, CreateFile should return STATUS_SUCCESS when that directory
  //   can be opened.
  //   You should set TRUE on DokanFileInfo->IsDirectory when file is a
  //   directory.
  //   See ZwCreateFile()
  //   https://msdn.microsoft.com/en-us/library/windows/hardware/ff566424(v=vs.85).aspx
  //   for more information about the parameters of this callback.
  NTSTATUS(DOKAN_CALLBACK *ZwCreateFile)
  (LPCWSTR,                    // FileName
   PDOKAN_IO_SECURITY_CONTEXT, // SecurityContext, see
                               // https://msdn.microsoft.com/en-us/library/windows/hardware/ff550613(v=vs.85).aspx
   ACCESS_MASK,                // DesiredAccess
   ULONG,                      // FileAttributes
   ULONG,                      // ShareAccess
   ULONG,                      // CreateDisposition
   ULONG,                      // CreateOptions
   PDOKAN_FILE_INFO);

  // When FileInfo->DeleteOnClose is true, you must delete the file in Cleanup.
  // Refer to comment at DeleteFile definition below in this file for
  // explanation.
  void(DOKAN_CALLBACK *Cleanup)(LPCWSTR, // FileName
                                PDOKAN_FILE_INFO);

  void(DOKAN_CALLBACK *CloseFile)(LPCWSTR, // FileName
                                  PDOKAN_FILE_INFO);

  // ReadFile and WriteFile can be called from multiple threads in
  // the same time with the same DOKAN_FILE_INFO.Context if a OVERLAPPED is
  // requested.
  NTSTATUS(DOKAN_CALLBACK *ReadFile)
  (LPCWSTR,  // FileName
   LPVOID,   // Buffer
   DWORD,    // NumberOfBytesToRead
   LPDWORD,  // NumberOfBytesRead
   LONGLONG, // Offset
   PDOKAN_FILE_INFO);

  NTSTATUS(DOKAN_CALLBACK *WriteFile)
  (LPCWSTR,  // FileName
   LPCVOID,  // Buffer
   DWORD,    // NumberOfBytesToWrite
   LPDWORD,  // NumberOfBytesWritten
   LONGLONG, // Offset
   PDOKAN_FILE_INFO);

  NTSTATUS(DOKAN_CALLBACK *FlushFileBuffers)
  (LPCWSTR, // FileName
   PDOKAN_FILE_INFO);

  NTSTATUS(DOKAN_CALLBACK *GetFileInformation)
  (LPCWSTR,                      // FileName
   LPBY_HANDLE_FILE_INFORMATION, // Buffer
   PDOKAN_FILE_INFO);

  // FindFilesWithPattern is checking first. If it is not implemented or
  // returns STATUS_NOT_IMPLEMENTED, then FindFiles is called, if implemented.
  NTSTATUS(DOKAN_CALLBACK *FindFiles)
  (LPCWSTR,           // PathName
   PFillFindData,     // call this function with PWIN32_FIND_DATAW
   PDOKAN_FILE_INFO); //  (see PFillFindData definition)

  NTSTATUS(DOKAN_CALLBACK *FindFilesWithPattern)
  (LPCWSTR,       // PathName
   LPCWSTR,       // SearchPattern
   PFillFindData, // call this function with PWIN32_FIND_DATAW
   PDOKAN_FILE_INFO);

  // SetFileAttributes and SetFileTime are called only if both of them
  // are implemented.
  NTSTATUS(DOKAN_CALLBACK *SetFileAttributes)
  (LPCWSTR, // FileName
   DWORD,   // FileAttributes
   PDOKAN_FILE_INFO);

  NTSTATUS(DOKAN_CALLBACK *SetFileTime)
  (LPCWSTR,          // FileName
   CONST FILETIME *, // CreationTime
   CONST FILETIME *, // LastAccessTime
   CONST FILETIME *, // LastWriteTime
   PDOKAN_FILE_INFO);

  // You should not delete the file on DeleteFile or DeleteDirectory, but
  // instead
  // you must only check whether you can delete the file or not,
  // and return STATUS_SUCCESS (when you can delete it) or appropriate error
  // codes such as
  // STATUS_ACCESS_DENIED, STATUS_OBJECT_PATH_NOT_FOUND,
  // STATUS_OBJECT_NAME_NOT_FOUND.
  // When you return STATUS_SUCCESS, you get a Cleanup call afterwards with
  // FileInfo->DeleteOnClose set to TRUE and only then you have to actually
  // delete the file being closed.
  NTSTATUS(DOKAN_CALLBACK *DeleteFile)
  (LPCWSTR, // FileName
   PDOKAN_FILE_INFO);

  NTSTATUS(DOKAN_CALLBACK *DeleteDirectory)
  (LPCWSTR, // FileName
   PDOKAN_FILE_INFO);

  NTSTATUS(DOKAN_CALLBACK *MoveFile)
  (LPCWSTR, // ExistingFileName
   LPCWSTR, // NewFileName
   BOOL,    // ReplaceExisiting
   PDOKAN_FILE_INFO);

  NTSTATUS(DOKAN_CALLBACK *SetEndOfFile)
  (LPCWSTR,  // FileName
   LONGLONG, // Length
   PDOKAN_FILE_INFO);

  NTSTATUS(DOKAN_CALLBACK *SetAllocationSize)
  (LPCWSTR,  // FileName
   LONGLONG, // Length
   PDOKAN_FILE_INFO);

  NTSTATUS(DOKAN_CALLBACK *LockFile)
  (LPCWSTR,  // FileName
   LONGLONG, // ByteOffset
   LONGLONG, // Length
   PDOKAN_FILE_INFO);

  NTSTATUS(DOKAN_CALLBACK *UnlockFile)
  (LPCWSTR,  // FileName
   LONGLONG, // ByteOffset
   LONGLONG, // Length
   PDOKAN_FILE_INFO);

  // Neither GetDiskFreeSpace nor GetVolumeInformation
  // save the DokanFileContext->Context.
  // Before these methods are called, CreateFile may not be called.
  // (ditto CloseFile and Cleanup)

  // see Win32 API GetDiskFreeSpaceEx
  NTSTATUS(DOKAN_CALLBACK *GetDiskFreeSpace)
  (PULONGLONG, // FreeBytesAvailable
   PULONGLONG, // TotalNumberOfBytes
   PULONGLONG, // TotalNumberOfFreeBytes
   PDOKAN_FILE_INFO);

  // Note:
  // FILE_READ_ONLY_VOLUME is automatically added to the
  // FileSystemFlags if DOKAN_OPTION_WRITE_PROTECT was
  // specified in DOKAN_OPTIONS when the volume was mounted.

  // see Win32 API GetVolumeInformation
  NTSTATUS(DOKAN_CALLBACK *GetVolumeInformation)
  (LPWSTR,  // VolumeNameBuffer
   DWORD,   // VolumeNameSize in num of chars
   LPDWORD, // VolumeSerialNumber
   LPDWORD, // MaximumComponentLength in num of chars
   LPDWORD, // FileSystemFlags
   LPWSTR,  // FileSystemNameBuffer
   DWORD,   // FileSystemNameSize in num of chars
   PDOKAN_FILE_INFO);

  NTSTATUS(DOKAN_CALLBACK *Mounted)(PDOKAN_FILE_INFO);

  NTSTATUS(DOKAN_CALLBACK *Unmounted)(PDOKAN_FILE_INFO);

  // Suported since 0.6.0. You must specify the version at
  // DOKAN_OPTIONS.Version.
  NTSTATUS(DOKAN_CALLBACK *GetFileSecurity)
  (LPCWSTR,               // FileName
   PSECURITY_INFORMATION, // A pointer to SECURITY_INFORMATION value being
                          // requested
   PSECURITY_DESCRIPTOR, // A pointer to SECURITY_DESCRIPTOR buffer to be filled
   ULONG,                // length of Security descriptor buffer
   PULONG,               // LengthNeeded
   PDOKAN_FILE_INFO);

  NTSTATUS(DOKAN_CALLBACK *SetFileSecurity)
  (LPCWSTR, // FileName
   PSECURITY_INFORMATION,
   PSECURITY_DESCRIPTOR, // SecurityDescriptor
   ULONG,                // SecurityDescriptor length
   PDOKAN_FILE_INFO);

  // Supported since 0.8.0. You must specify the version at
  // DOKAN_OPTIONS.Version.
  NTSTATUS(DOKAN_CALLBACK *FindStreams)
  (LPCWSTR,             // FileName
   PFillFindStreamData, // call this function with PWIN32_FIND_STREAM_DATA
   PDOKAN_FILE_INFO);   //  (see PFillFindStreamData definition)

} DOKAN_OPERATIONS, *PDOKAN_OPERATIONS;

typedef struct _DOKAN_CONTROL {
  ULONG Type;
  WCHAR MountPoint[MAX_PATH];
  WCHAR UNCName[64];
  WCHAR DeviceName[64];
  PVOID DeviceObject;
} DOKAN_CONTROL, *PDOKAN_CONTROL;

/* DokanMain returns error codes */
#define DOKAN_SUCCESS 0
#define DOKAN_ERROR -1                /* General Error */
#define DOKAN_DRIVE_LETTER_ERROR -2   /* Bad Drive letter */
#define DOKAN_DRIVER_INSTALL_ERROR -3 /* Can't install driver */
#define DOKAN_START_ERROR -4          /* Driver something wrong */
#define DOKAN_MOUNT_ERROR -5 /* Can't assign a drive letter or mount point */
#define DOKAN_MOUNT_POINT_ERROR -6 /* Mount point is invalid */
#define DOKAN_VERSION_ERROR -7     /* Requested an incompatible version */

int DOKANAPI DokanMain(PDOKAN_OPTIONS DokanOptions,
                       PDOKAN_OPERATIONS DokanOperations);

BOOL DOKANAPI DokanUnmount(WCHAR DriveLetter);

BOOL DOKANAPI DokanRemoveMountPoint(LPCWSTR MountPoint);

// DokanIsNameInExpression
//   checks whether Name can match Expression
//   Expression can contain wildcard characters (? and *)
BOOL DOKANAPI DokanIsNameInExpression(LPCWSTR Expression, // matching pattern
                                      LPCWSTR Name,       // file name
                                      BOOL IgnoreCase);

ULONG DOKANAPI DokanVersion();

ULONG DOKANAPI DokanDriverVersion();

// DokanResetTimeout
//   extends the time out of the current IO operation in driver.
BOOL DOKANAPI DokanResetTimeout(ULONG Timeout, // timeout in millisecond
                                PDOKAN_FILE_INFO DokanFileInfo);

// Get the handle to Access Token
// This method needs be called in CreateFile, OpenDirectory or CreateDirectly
// callback.
// The caller must call CloseHandle for the returned handle.
HANDLE DOKANAPI DokanOpenRequestorToken(PDOKAN_FILE_INFO DokanFileInfo);

BOOL DOKANAPI DokanGetMountPointList(PDOKAN_CONTROL list, ULONG length,
                                     BOOL uncOnly, PULONG nbRead);

void DOKANAPI DokanMapKernelToUserCreateFileFlags(
    ULONG FileAttributes, ULONG CreateOptions, ULONG CreateDisposition,
    DWORD *outFileAttributesAndFlags, DWORD *outCreationDisposition);

#ifdef __cplusplus
}
#endif

#endif // DOKAN_H_
