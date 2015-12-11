// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

#if defined(_WIN32) || defined(WIN32) || defined(__CYGWIN__) || defined(__MINGW32__) || defined(__BORLANDC__)

#include "bridge.h"

extern NTSTATUS kbfs_libdokan_CreateFile(LPCWSTR FileName,
					 PDOKAN_IO_SECURITY_CONTEXT psec,
					 ACCESS_MASK DesiredAccess,
					 ULONG FileAttributes,
					 ULONG ShareAccess,
					 ULONG CreateDisposition,
					 ULONG CreateOptions,
					 PDOKAN_FILE_INFO pfi);

extern DOKAN_CALLBACK NTSTATUS kbfs_libdokan_c_CreateFile(LPCWSTR FileName,
							  PDOKAN_IO_SECURITY_CONTEXT psec,
							  ACCESS_MASK DesiredAccess,
							  ULONG FileAttributes,
							  ULONG ShareAccess,
							  ULONG CreateDisposition,
							  ULONG CreateOptions,
							  PDOKAN_FILE_INFO pfi) {
  return kbfs_libdokan_CreateFile(FileName,psec,DesiredAccess,FileAttributes,ShareAccess,CreateDisposition,CreateOptions,pfi);
}

extern void kbfs_libdokan_Cleanup(LPCWSTR FileName, PDOKAN_FILE_INFO FileInfo);

static DOKAN_CALLBACK void kbfs_libdokan_c_Cleanup(LPCWSTR FileName, PDOKAN_FILE_INFO FileInfo) {
  kbfs_libdokan_Cleanup(FileName,FileInfo);
}

extern void kbfs_libdokan_CloseFile(LPCWSTR FileName, PDOKAN_FILE_INFO FileInfo);

static DOKAN_CALLBACK void kbfs_libdokan_c_CloseFile(LPCWSTR FileName, PDOKAN_FILE_INFO FileInfo) {
  kbfs_libdokan_CloseFile(FileName,FileInfo);
}

extern NTSTATUS kbfs_libdokan_ReadFile(LPCWSTR FileName,
					LPVOID Buffer,
					DWORD NumberOfBytesToRead,
					LPDWORD NumberOfBytesRead,
					LONGLONG Offset,
					PDOKAN_FILE_INFO FileInfo);

static DOKAN_CALLBACK NTSTATUS kbfs_libdokan_c_ReadFile(LPCWSTR FileName,
						      LPVOID Buffer,
						      DWORD NumberOfBytesToRead,
						      LPDWORD NumberOfBytesRead,
						      LONGLONG Offset,
						      PDOKAN_FILE_INFO FileInfo) {
  return kbfs_libdokan_ReadFile(FileName, Buffer, NumberOfBytesToRead, NumberOfBytesRead, Offset, FileInfo);
}

extern NTSTATUS kbfs_libdokan_WriteFile(LPCWSTR FileName,
					LPCVOID Buffer,
					DWORD NumberOfBytesToWrite,
					LPDWORD NumberOfBytesWritten,
					LONGLONG Offset,
					PDOKAN_FILE_INFO FileInfo);

static DOKAN_CALLBACK NTSTATUS kbfs_libdokan_c_WriteFile(LPCWSTR FileName,
							 LPCVOID Buffer,
							 DWORD NumberOfBytesToWrite,
							 LPDWORD NumberOfBytesWritten,
							 LONGLONG Offset,
							 PDOKAN_FILE_INFO FileInfo) {
  return kbfs_libdokan_WriteFile(FileName, Buffer, NumberOfBytesToWrite, NumberOfBytesWritten, Offset, FileInfo);
}

extern NTSTATUS kbfs_libdokan_FlushFileBuffers(LPCWSTR FileName, PDOKAN_FILE_INFO FileInfo);

static DOKAN_CALLBACK NTSTATUS kbfs_libdokan_c_FlushFileBuffers(LPCWSTR FileName, PDOKAN_FILE_INFO FileInfo) {
  return kbfs_libdokan_FlushFileBuffers(FileName, FileInfo);
}

extern NTSTATUS kbfs_libdokan_GetFileInformation(LPCWSTR FileName,
						 LPBY_HANDLE_FILE_INFORMATION Buffer,
						 PDOKAN_FILE_INFO FileInfo);

static DOKAN_CALLBACK NTSTATUS kbfs_libdokan_c_GetFileInformation(LPCWSTR FileName,
								LPBY_HANDLE_FILE_INFORMATION Buffer,
								PDOKAN_FILE_INFO FileInfo) {
  return kbfs_libdokan_GetFileInformation(FileName, Buffer, FileInfo);
}

extern  NTSTATUS kbfs_libdokan_FindFiles(LPCWSTR PathName,
					 PFillFindData FindData,	// call this function with PWIN32_FIND_DATAW
					 PDOKAN_FILE_INFO FileInfo);

static DOKAN_CALLBACK  NTSTATUS kbfs_libdokan_c_FindFiles(LPCWSTR PathName,
							  PFillFindData FindData,	// call this function with PWIN32_FIND_DATAW
							  PDOKAN_FILE_INFO FileInfo) {
  return kbfs_libdokan_FindFiles(PathName, FindData, FileInfo);
}

/*
extern NTSTATUS kbfs_libdokan_FindFilesWithPattern(LPCWSTR PathName,
						   LPCWSTR SearchPattern,
						   PFillFindData FindData, // call this function with PWIN32_FIND_DATAW
						   PDOKAN_FILE_INFO FileInfo);
*/
extern NTSTATUS kbfs_libdokan_SetFileAttributes(LPCWSTR FileName,
						DWORD FileAttributes,
						PDOKAN_FILE_INFO FileInfo);
static DOKAN_CALLBACK NTSTATUS kbfs_libdokan_c_SetFileAttributes(LPCWSTR FileName,
								 DWORD FileAttributes,
								 PDOKAN_FILE_INFO FileInfo) {
  return kbfs_libdokan_SetFileAttributes(FileName, FileAttributes, FileInfo);
}

extern NTSTATUS kbfs_libdokan_SetFileTime(LPCWSTR FileName,
										   CONST FILETIME* CreationTime,
										   CONST FILETIME* LastAccessTime,
										   CONST FILETIME* LastWriteTime,
										   PDOKAN_FILE_INFO FileInfo);
static DOKAN_CALLBACK NTSTATUS kbfs_libdokan_c_SetFileTime(LPCWSTR FileName,
							   CONST FILETIME* CreationTime,
							   CONST FILETIME* LastAccessTime,
							   CONST FILETIME* LastWriteTime,
							   PDOKAN_FILE_INFO FileInfo) {
  return kbfs_libdokan_SetFileTime(FileName, CreationTime, LastAccessTime, LastWriteTime, FileInfo);
}

extern NTSTATUS kbfs_libdokan_DeleteFile(LPCWSTR FileName, PDOKAN_FILE_INFO FileInfo);

static DOKAN_CALLBACK NTSTATUS kbfs_libdokan_c_DeleteFile(LPCWSTR FileName, PDOKAN_FILE_INFO FileInfo) {
  return kbfs_libdokan_DeleteFile(FileName, FileInfo);
}

extern NTSTATUS kbfs_libdokan_DeleteDirectory(LPCWSTR FileName, PDOKAN_FILE_INFO FileInfo);

static DOKAN_CALLBACK NTSTATUS kbfs_libdokan_c_DeleteDirectory(LPCWSTR FileName, PDOKAN_FILE_INFO FileInfo) {
  return kbfs_libdokan_DeleteDirectory(FileName, FileInfo);
}

extern NTSTATUS kbfs_libdokan_MoveFile(LPCWSTR ExistingFileName,
				       LPCWSTR NewFileName,
				       BOOL ReplaceExisiting,
				       PDOKAN_FILE_INFO FileInfo);
static DOKAN_CALLBACK NTSTATUS kbfs_libdokan_c_MoveFile(LPCWSTR ExistingFileName,
							LPCWSTR NewFileName,
							BOOL ReplaceExisiting,
							PDOKAN_FILE_INFO FileInfo) {
  return kbfs_libdokan_MoveFile(ExistingFileName, NewFileName, ReplaceExisiting, FileInfo);
}

extern NTSTATUS kbfs_libdokan_SetEndOfFile(LPCWSTR FileName,
					   LONGLONG Length,
					   PDOKAN_FILE_INFO FileInfo);
static DOKAN_CALLBACK NTSTATUS kbfs_libdokan_c_SetEndOfFile(LPCWSTR FileName,
							    LONGLONG Length,
							    PDOKAN_FILE_INFO FileInfo) {
  return kbfs_libdokan_SetEndOfFile(FileName, Length, FileInfo);
}

//extern NTSTATUS kbfs_libdokan_SetAllocationSize(LPCWSTR FileName,
//												LONGLONG Length,
//												PDOKAN_FILE_INFO FileInfo);

extern NTSTATUS kbfs_libdokan_LockFile(LPCWSTR FileName,
				       LONGLONG ByteOffset,
				       LONGLONG Length,
				       PDOKAN_FILE_INFO FileInfo);

static DOKAN_CALLBACK NTSTATUS kbfs_libdokan_c_LockFile(LPCWSTR FileName,
							LONGLONG ByteOffset,
							LONGLONG Length,
							PDOKAN_FILE_INFO FileInfo) {
  return kbfs_libdokan_LockFile(FileName, ByteOffset, Length, FileInfo);
}

extern NTSTATUS kbfs_libdokan_UnlockFile(LPCWSTR FileName,
					 LONGLONG ByteOffset,
					 LONGLONG Length,
					 PDOKAN_FILE_INFO FileInfo);
static DOKAN_CALLBACK NTSTATUS kbfs_libdokan_c_UnlockFile(LPCWSTR FileName,
							LONGLONG ByteOffset,
							LONGLONG Length,
							PDOKAN_FILE_INFO FileInfo) {
  return kbfs_libdokan_UnlockFile(FileName, ByteOffset, Length, FileInfo);
}


// see Win32 API GetDiskFreeSpaceEx
extern NTSTATUS kbfs_libdokan_GetDiskFreeSpace(PULONGLONG FreeBytesAvailable,
					       PULONGLONG TotalNumberOfBytes,
					       PULONGLONG TotalNumberOfFreeBytes,
					       PDOKAN_FILE_INFO FileInfo);
static DOKAN_CALLBACK NTSTATUS kbfs_libdokan_c_GetDiskFreeSpace(PULONGLONG FreeBytesAvailable,
								PULONGLONG TotalNumberOfBytes,
								PULONGLONG TotalNumberOfFreeBytes,
								PDOKAN_FILE_INFO FileInfo) {
  return kbfs_libdokan_GetDiskFreeSpace(FreeBytesAvailable, TotalNumberOfBytes, TotalNumberOfFreeBytes, FileInfo);
}

// see Win32 API GetVolumeInformation
extern NTSTATUS kbfs_libdokan_GetVolumeInformation(LPWSTR VolumeNameBuffer,
						   DWORD VolumeNameSize, // in num of chars
						   LPDWORD VolumeSerialNumber,
						   LPDWORD MaximumComponentLength, // in num of chars
						   LPDWORD FileSystemFlags,
						   LPWSTR FileSystemNameBuffer,
						   DWORD FileSystemNameSize, // in num of chars
						   PDOKAN_FILE_INFO FileInfo);
static DOKAN_CALLBACK NTSTATUS kbfs_libdokan_c_GetVolumeInformation(LPWSTR VolumeNameBuffer,
								    DWORD VolumeNameSize, // in num of chars
								    LPDWORD VolumeSerialNumber,
								    LPDWORD MaximumComponentLength, // in num of chars
								    LPDWORD FileSystemFlags,
								    LPWSTR FileSystemNameBuffer,
								    DWORD FileSystemNameSize, // in num of chars
								    PDOKAN_FILE_INFO FileInfo) {
  return kbfs_libdokan_GetVolumeInformation(VolumeNameBuffer, VolumeNameSize, VolumeSerialNumber, MaximumComponentLength, FileSystemFlags, FileSystemNameBuffer, FileSystemNameSize, FileInfo);
}

extern NTSTATUS kbfs_libdokan_Mounted(PDOKAN_FILE_INFO FileInfo);
static DOKAN_CALLBACK NTSTATUS kbfs_libdokan_c_Mounted(PDOKAN_FILE_INFO FileInfo) {
  return kbfs_libdokan_Mounted(FileInfo);
}

/*
extern NTSTATUS kbfs_libdokan_GetFileSecurity(LPCWSTR FileName,
											  //A pointer to SECURITY_INFORMATION value being requested
											  PSECURITY_INFORMATION input,
											  // A pointer to SECURITY_DESCRIPTOR buffer to be filled
											  PSECURITY_DESCRIPTOR output,
											  ULONG outlen,// length of Security descriptor buffer
											  PULONG LengthNeeded,
											  PDOKAN_FILE_INFO FileInfo);

extern NTSTATUS kbfs_libdokan_SetFileSecurity(LPCWSTR FileName,
											  PSECURITY_INFORMATION SecurityInformation,
											  PSECURITY_DESCRIPTOR SecurityDescriptor,
											  ULONG SecurityDescriptorLength,
											  PDOKAN_FILE_INFO FileInfo);

extern NTSTATUS kbfs_libdokan_FindStreams(LPCWSTR FileName,
										  // call this function with PWIN32_FIND_STREAM_DATA
										  PFillFindStreamData FindStreamData, 
										  PDOKAN_FILE_INFO FileInfo);
*/



struct kbfs_libdokan_ctx* kbfs_libdokan_alloc_ctx(ULONG64 slot) {
  struct kbfs_libdokan_ctx *ctx = malloc(sizeof(struct kbfs_libdokan_ctx));
  if(!ctx)
    return ctx;
  memset(ctx, 0, sizeof(struct kbfs_libdokan_ctx));
  ctx->dokan_options.Version = DOKAN_VERSION;
  ctx->dokan_options.GlobalContext = slot;

  ctx->dokan_options.Options = DOKAN_OPTION_REMOVABLE;
  ctx->dokan_operations.ZwCreateFile = kbfs_libdokan_c_CreateFile;
  ctx->dokan_operations.Cleanup = kbfs_libdokan_c_Cleanup;
  ctx->dokan_operations.CloseFile = kbfs_libdokan_c_CloseFile;
  ctx->dokan_operations.ReadFile = kbfs_libdokan_c_ReadFile;
  ctx->dokan_operations.WriteFile = kbfs_libdokan_c_WriteFile;
  ctx->dokan_operations.FlushFileBuffers = kbfs_libdokan_c_FlushFileBuffers;
  ctx->dokan_operations.GetFileInformation = kbfs_libdokan_c_GetFileInformation;
  ctx->dokan_operations.FindFiles = kbfs_libdokan_c_FindFiles;
  //FIXME: perhaps switch to FindFilesWithPattern later?
  //  ctx->dokan_operations.FindFilesWithPattern = kbfs_libdokan_c_FindFilesWithPattern;
  ctx->dokan_operations.SetFileAttributes = kbfs_libdokan_c_SetFileAttributes;
  ctx->dokan_operations.SetFileTime = kbfs_libdokan_c_SetFileTime;
  ctx->dokan_operations.DeleteFile = kbfs_libdokan_c_DeleteFile;
  ctx->dokan_operations.DeleteDirectory = kbfs_libdokan_c_DeleteDirectory;
  ctx->dokan_operations.MoveFile = kbfs_libdokan_c_MoveFile;
  ctx->dokan_operations.SetEndOfFile = kbfs_libdokan_c_SetEndOfFile;
  //FIXME: this is disabled as per Dokan-Fuse
  //ctx->dokan_operations.SetAllocationSize = kbfs_libdokan_c_SetAllocationSize;
  ctx->dokan_operations.LockFile = kbfs_libdokan_c_LockFile;
  ctx->dokan_operations.UnlockFile = kbfs_libdokan_c_UnlockFile;
  ctx->dokan_operations.GetDiskFreeSpace = kbfs_libdokan_c_GetDiskFreeSpace;
  ctx->dokan_operations.GetVolumeInformation = kbfs_libdokan_c_GetVolumeInformation;
  ctx->dokan_operations.Mounted = kbfs_libdokan_c_Mounted;
  // FIXME: Handling ACLs not implemented currently
  //  ctx->dokan_operations.GetFileSecurity = kbfs_libdokan_c_GetFileSecurity;
  //  ctx->dokan_operations.SetFileSecurity = kbfs_libdokan_c_SetFileSecurity;
  // FIXME: Multiple streams per file for e.g. resource forks
  //   ctx->dokan_operations.FindStreams = kbfs_libdokan_c_FindStreams;
  return ctx;
}
void kbfs_libdokan_set_drive_letter(struct kbfs_libdokan_ctx* ctx, char c) {
  ctx->drive_letter[0] = (WCHAR)c;
  ctx->drive_letter[1] = L':';
  ctx->drive_letter[2] = L'\\';
  ctx->drive_letter[3] = 0;
  ctx->dokan_options.MountPoint = ctx->drive_letter;
}
error_t kbfs_libdokan_free(struct kbfs_libdokan_ctx* ctx) {
  if(ctx)
    free(ctx);
  return 0;
}

error_t kbfs_libdokan_run(struct kbfs_libdokan_ctx* ctx) {
	int status = DokanMain(&ctx->dokan_options, &ctx->dokan_operations);
	return status;
}

int kbfs_libdokan_fill_find(PFillFindData fptr, PWIN32_FIND_DATAW a1, PDOKAN_FILE_INFO a2) {
  return fptr(a1, a2);
}

#endif /* windows check */
