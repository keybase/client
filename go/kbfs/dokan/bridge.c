// Copyright 2016-2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

#if defined(_WIN32) || defined(WIN32) || defined(__CYGWIN__) || defined(__MINGW32__) || defined(__BORLANDC__)

#include "bridge.h"

uintptr_t kbfsLibdokanPtr_RemoveMountPoint;
uintptr_t kbfsLibdokanPtr_OpenRequestorToken;
uintptr_t kbfsLibdokanPtr_Main;

extern NTSTATUS kbfsLibdokanCreateFile(LPCWSTR FileName,
					 PDOKAN_IO_SECURITY_CONTEXT psec,
					 ACCESS_MASK DesiredAccess,
					 ULONG FileAttributes,
					 ULONG ShareAccess,
					 ULONG CreateDisposition,
					 ULONG CreateOptions,
					 PDOKAN_FILE_INFO pfi);

extern DOKAN_CALLBACK NTSTATUS kbfsLibdokanC_CreateFile(LPCWSTR FileName,
							  PDOKAN_IO_SECURITY_CONTEXT psec,
							  ACCESS_MASK DesiredAccess,
							  ULONG FileAttributes,
							  ULONG ShareAccess,
							  ULONG CreateDisposition,
							  ULONG CreateOptions,
							  PDOKAN_FILE_INFO pfi) {
  return kbfsLibdokanCreateFile(FileName,psec,DesiredAccess,FileAttributes,ShareAccess,CreateDisposition,CreateOptions,pfi);
}

extern void kbfsLibdokanCleanup(LPCWSTR FileName, PDOKAN_FILE_INFO FileInfo);

static DOKAN_CALLBACK void kbfsLibdokanC_Cleanup(LPCWSTR FileName, PDOKAN_FILE_INFO FileInfo) {
  kbfsLibdokanCleanup(FileName,FileInfo);
}

extern void kbfsLibdokanCloseFile(LPCWSTR FileName, PDOKAN_FILE_INFO FileInfo);

static DOKAN_CALLBACK void kbfsLibdokanC_CloseFile(LPCWSTR FileName, PDOKAN_FILE_INFO FileInfo) {
  kbfsLibdokanCloseFile(FileName,FileInfo);
}

extern NTSTATUS kbfsLibdokanReadFile(LPCWSTR FileName,
					LPVOID Buffer,
					DWORD NumberOfBytesToRead,
					LPDWORD NumberOfBytesRead,
					LONGLONG Offset,
					PDOKAN_FILE_INFO FileInfo);

static DOKAN_CALLBACK NTSTATUS kbfsLibdokanC_ReadFile(LPCWSTR FileName,
						      LPVOID Buffer,
						      DWORD NumberOfBytesToRead,
						      LPDWORD NumberOfBytesRead,
						      LONGLONG Offset,
						      PDOKAN_FILE_INFO FileInfo) {
  return kbfsLibdokanReadFile(FileName, Buffer, NumberOfBytesToRead, NumberOfBytesRead, Offset, FileInfo);
}

extern NTSTATUS kbfsLibdokanWriteFile(LPCWSTR FileName,
					LPCVOID Buffer,
					DWORD NumberOfBytesToWrite,
					LPDWORD NumberOfBytesWritten,
					LONGLONG Offset,
					PDOKAN_FILE_INFO FileInfo);

static DOKAN_CALLBACK NTSTATUS kbfsLibdokanC_WriteFile(LPCWSTR FileName,
							 LPCVOID Buffer,
							 DWORD NumberOfBytesToWrite,
							 LPDWORD NumberOfBytesWritten,
							 LONGLONG Offset,
							 PDOKAN_FILE_INFO FileInfo) {
  return kbfsLibdokanWriteFile(FileName, Buffer, NumberOfBytesToWrite, NumberOfBytesWritten, Offset, FileInfo);
}

extern NTSTATUS kbfsLibdokanFlushFileBuffers(LPCWSTR FileName, PDOKAN_FILE_INFO FileInfo);

static DOKAN_CALLBACK NTSTATUS kbfsLibdokanC_FlushFileBuffers(LPCWSTR FileName, PDOKAN_FILE_INFO FileInfo) {
  return kbfsLibdokanFlushFileBuffers(FileName, FileInfo);
}

extern NTSTATUS kbfsLibdokanGetFileInformation(LPCWSTR FileName,
						 LPBY_HANDLE_FILE_INFORMATION Buffer,
						 PDOKAN_FILE_INFO FileInfo);

static DOKAN_CALLBACK NTSTATUS kbfsLibdokanC_GetFileInformation(LPCWSTR FileName,
								LPBY_HANDLE_FILE_INFORMATION Buffer,
								PDOKAN_FILE_INFO FileInfo) {
  return kbfsLibdokanGetFileInformation(FileName, Buffer, FileInfo);
}

extern  NTSTATUS kbfsLibdokanFindFiles(LPCWSTR PathName,
					 PFillFindData FindData,	// call this function with PWIN32_FIND_DATAW
					 PDOKAN_FILE_INFO FileInfo);

static DOKAN_CALLBACK  NTSTATUS kbfsLibdokanC_FindFiles(LPCWSTR PathName,
							  PFillFindData FindData,	// call this function with PWIN32_FIND_DATAW
							  PDOKAN_FILE_INFO FileInfo) {
  return kbfsLibdokanFindFiles(PathName, FindData, FileInfo);
}

extern NTSTATUS kbfsLibdokanFindFilesWithPattern(LPCWSTR PathName,
						   LPCWSTR SearchPattern,
						   PFillFindData FindData, // call this function with PWIN32_FIND_DATAW
						   PDOKAN_FILE_INFO FileInfo);
static DOKAN_CALLBACK  NTSTATUS kbfsLibdokanC_FindFilesWithPattern(LPCWSTR PathName,
								   LPCWSTR SearchPattern,
								   PFillFindData FindData,	// call this function with PWIN32_FIND_DATAW
								   PDOKAN_FILE_INFO FileInfo) {
  return kbfsLibdokanFindFilesWithPattern(PathName, SearchPattern, FindData, FileInfo);
}

extern NTSTATUS kbfsLibdokanSetFileAttributes(LPCWSTR FileName,
						DWORD FileAttributes,
						PDOKAN_FILE_INFO FileInfo);
static DOKAN_CALLBACK NTSTATUS kbfsLibdokanC_SetFileAttributes(LPCWSTR FileName,
								 DWORD FileAttributes,
								 PDOKAN_FILE_INFO FileInfo) {
  return kbfsLibdokanSetFileAttributes(FileName, FileAttributes, FileInfo);
}

extern NTSTATUS kbfsLibdokanSetFileTime(LPCWSTR FileName,
										   CONST FILETIME* CreationTime,
										   CONST FILETIME* LastAccessTime,
										   CONST FILETIME* LastWriteTime,
										   PDOKAN_FILE_INFO FileInfo);
static DOKAN_CALLBACK NTSTATUS kbfsLibdokanC_SetFileTime(LPCWSTR FileName,
							   CONST FILETIME* CreationTime,
							   CONST FILETIME* LastAccessTime,
							   CONST FILETIME* LastWriteTime,
							   PDOKAN_FILE_INFO FileInfo) {
  return kbfsLibdokanSetFileTime(FileName, CreationTime, LastAccessTime, LastWriteTime, FileInfo);
}

extern NTSTATUS kbfsLibdokanDeleteFile(LPCWSTR FileName, PDOKAN_FILE_INFO FileInfo);

static DOKAN_CALLBACK NTSTATUS kbfsLibdokanC_DeleteFile(LPCWSTR FileName, PDOKAN_FILE_INFO FileInfo) {
  return kbfsLibdokanDeleteFile(FileName, FileInfo);
}

extern NTSTATUS kbfsLibdokanDeleteDirectory(LPCWSTR FileName, PDOKAN_FILE_INFO FileInfo);

static DOKAN_CALLBACK NTSTATUS kbfsLibdokanC_DeleteDirectory(LPCWSTR FileName, PDOKAN_FILE_INFO FileInfo) {
  return kbfsLibdokanDeleteDirectory(FileName, FileInfo);
}

extern NTSTATUS kbfsLibdokanMoveFile(LPCWSTR ExistingFileName,
				       LPCWSTR NewFileName,
				       BOOL ReplaceExisiting,
				       PDOKAN_FILE_INFO FileInfo);
static DOKAN_CALLBACK NTSTATUS kbfsLibdokanC_MoveFile(LPCWSTR ExistingFileName,
							LPCWSTR NewFileName,
							BOOL ReplaceExisiting,
							PDOKAN_FILE_INFO FileInfo) {
  return kbfsLibdokanMoveFile(ExistingFileName, NewFileName, ReplaceExisiting, FileInfo);
}

extern NTSTATUS kbfsLibdokanSetEndOfFile(LPCWSTR FileName,
					   LONGLONG Length,
					   PDOKAN_FILE_INFO FileInfo);
static DOKAN_CALLBACK NTSTATUS kbfsLibdokanC_SetEndOfFile(LPCWSTR FileName,
							    LONGLONG Length,
							    PDOKAN_FILE_INFO FileInfo) {
  return kbfsLibdokanSetEndOfFile(FileName, Length, FileInfo);
}

extern NTSTATUS kbfsLibdokanSetAllocationSize(LPCWSTR FileName,
												LONGLONG Length,
												PDOKAN_FILE_INFO FileInfo);
static DOKAN_CALLBACK NTSTATUS kbfsLibdokanC_SetAllocationSize(LPCWSTR FileName,
												LONGLONG Length,
												PDOKAN_FILE_INFO FileInfo) {
  return kbfsLibdokanSetAllocationSize(FileName, Length, FileInfo);
}

extern NTSTATUS kbfsLibdokanLockFile(LPCWSTR FileName,
				       LONGLONG ByteOffset,
				       LONGLONG Length,
				       PDOKAN_FILE_INFO FileInfo);

static DOKAN_CALLBACK NTSTATUS kbfsLibdokanC_LockFile(LPCWSTR FileName,
							LONGLONG ByteOffset,
							LONGLONG Length,
							PDOKAN_FILE_INFO FileInfo) {
  return kbfsLibdokanLockFile(FileName, ByteOffset, Length, FileInfo);
}

extern NTSTATUS kbfsLibdokanUnlockFile(LPCWSTR FileName,
					 LONGLONG ByteOffset,
					 LONGLONG Length,
					 PDOKAN_FILE_INFO FileInfo);
static DOKAN_CALLBACK NTSTATUS kbfsLibdokanC_UnlockFile(LPCWSTR FileName,
							LONGLONG ByteOffset,
							LONGLONG Length,
							PDOKAN_FILE_INFO FileInfo) {
  return kbfsLibdokanUnlockFile(FileName, ByteOffset, Length, FileInfo);
}


// see Win32 API GetDiskFreeSpaceEx
extern NTSTATUS kbfsLibdokanGetDiskFreeSpace(ULONGLONG* FreeBytesAvailable,
					       ULONGLONG* TotalNumberOfBytes,
					       ULONGLONG* TotalNumberOfFreeBytes,
					       PDOKAN_FILE_INFO FileInfo);
static DOKAN_CALLBACK NTSTATUS kbfsLibdokanC_GetDiskFreeSpace(PULONGLONG FreeBytesAvailable,
								PULONGLONG TotalNumberOfBytes,
								PULONGLONG TotalNumberOfFreeBytes,
								PDOKAN_FILE_INFO FileInfo) {
  return kbfsLibdokanGetDiskFreeSpace((ULONGLONG*)FreeBytesAvailable, (ULONGLONG*)TotalNumberOfBytes, (ULONGLONG*)TotalNumberOfFreeBytes, FileInfo);
}

// see Win32 API GetVolumeInformation
extern NTSTATUS kbfsLibdokanGetVolumeInformation(LPWSTR VolumeNameBuffer,
						   DWORD VolumeNameSize, // in num of chars
						   LPDWORD VolumeSerialNumber,
						   LPDWORD MaximumComponentLength, // in num of chars
						   LPDWORD FileSystemFlags,
						   LPWSTR FileSystemNameBuffer,
						   DWORD FileSystemNameSize, // in num of chars
						   PDOKAN_FILE_INFO FileInfo);
static DOKAN_CALLBACK NTSTATUS kbfsLibdokanC_GetVolumeInformation(LPWSTR VolumeNameBuffer,
								    DWORD VolumeNameSize, // in num of chars
								    LPDWORD VolumeSerialNumber,
								    LPDWORD MaximumComponentLength, // in num of chars
								    LPDWORD FileSystemFlags,
								    LPWSTR FileSystemNameBuffer,
								    DWORD FileSystemNameSize, // in num of chars
								    PDOKAN_FILE_INFO FileInfo) {
  return kbfsLibdokanGetVolumeInformation(VolumeNameBuffer, VolumeNameSize, VolumeSerialNumber, MaximumComponentLength, FileSystemFlags, FileSystemNameBuffer, FileSystemNameSize, FileInfo);
}

extern NTSTATUS kbfsLibdokanMounted(PDOKAN_FILE_INFO FileInfo);
static DOKAN_CALLBACK NTSTATUS kbfsLibdokanC_Mounted(PDOKAN_FILE_INFO FileInfo) {
  return kbfsLibdokanMounted(FileInfo);
}

extern NTSTATUS kbfsLibdokanGetFileSecurity(LPCWSTR FileName,
											  //A pointer to SECURITY_INFORMATION value being requested
											  PSECURITY_INFORMATION input,
											  // A pointer to SECURITY_DESCRIPTOR buffer to be filled
											  PSECURITY_DESCRIPTOR output,
											  ULONG outlen,// length of Security descriptor buffer
											  PULONG LengthNeeded,
											  PDOKAN_FILE_INFO FileInfo);
static DOKAN_CALLBACK NTSTATUS kbfsLibdokanC_GetFileSecurity(LPCWSTR FileName,
											  //A pointer to SECURITY_INFORMATION value being requested
											  PSECURITY_INFORMATION input,
											  // A pointer to SECURITY_DESCRIPTOR buffer to be filled
											  PSECURITY_DESCRIPTOR output,
											  ULONG outlen,// length of Security descriptor buffer
											  PULONG LengthNeeded,
											  PDOKAN_FILE_INFO FileInfo) {
	return kbfsLibdokanGetFileSecurity(FileName, input, output, outlen, LengthNeeded, FileInfo);
}

extern NTSTATUS kbfsLibdokanSetFileSecurity(LPCWSTR FileName,
											  PSECURITY_INFORMATION SecurityInformation,
											  PSECURITY_DESCRIPTOR SecurityDescriptor,
											  ULONG SecurityDescriptorLength,
											  PDOKAN_FILE_INFO FileInfo);
static DOKAN_CALLBACK NTSTATUS kbfsLibdokanC_SetFileSecurity(LPCWSTR FileName,
											  PSECURITY_INFORMATION SecurityInformation,
											  PSECURITY_DESCRIPTOR SecurityDescriptor,
											  ULONG SecurityDescriptorLength,
											  PDOKAN_FILE_INFO FileInfo) {
	return kbfsLibdokanSetFileSecurity(FileName, SecurityInformation, SecurityDescriptor, SecurityDescriptorLength, FileInfo);
}

/*
extern NTSTATUS kbfsLibdokanFindStreams(LPCWSTR FileName,
										  // call this function with PWIN32_FIND_STREAM_DATA
										  PFillFindStreamData FindStreamData, 
										  PDOKAN_FILE_INFO FileInfo);
*/



struct kbfsLibdokanCtx* kbfsLibdokanAllocCtx(ULONG64 slot) {
  struct kbfsLibdokanCtx *ctx = malloc(sizeof(struct kbfsLibdokanCtx));
  if(!ctx)
    return ctx;
  memset(ctx, 0, sizeof(struct kbfsLibdokanCtx));
  ctx->dokan_options.Version = DOKAN_VERSION;
  // Dokan timeout 10 minutes... Disables - was related to dokan crashes!
  //  ctx->dokan_options.Timeout = 600 * 1000;
  ctx->dokan_options.GlobalContext = slot;

  ctx->dokan_operations.ZwCreateFile = kbfsLibdokanC_CreateFile;
  ctx->dokan_operations.Cleanup = kbfsLibdokanC_Cleanup;
  ctx->dokan_operations.CloseFile = kbfsLibdokanC_CloseFile;
  ctx->dokan_operations.ReadFile = kbfsLibdokanC_ReadFile;
  ctx->dokan_operations.WriteFile = kbfsLibdokanC_WriteFile;
  ctx->dokan_operations.FlushFileBuffers = kbfsLibdokanC_FlushFileBuffers;
  ctx->dokan_operations.GetFileInformation = kbfsLibdokanC_GetFileInformation;
  ctx->dokan_operations.FindFiles = kbfsLibdokanC_FindFiles;
  ctx->dokan_operations.SetFileAttributes = kbfsLibdokanC_SetFileAttributes;
  ctx->dokan_operations.SetFileTime = kbfsLibdokanC_SetFileTime;
  ctx->dokan_operations.DeleteFile = kbfsLibdokanC_DeleteFile;
  ctx->dokan_operations.DeleteDirectory = kbfsLibdokanC_DeleteDirectory;
  ctx->dokan_operations.MoveFile = kbfsLibdokanC_MoveFile;
  ctx->dokan_operations.SetEndOfFile = kbfsLibdokanC_SetEndOfFile;
  ctx->dokan_operations.SetAllocationSize = kbfsLibdokanC_SetAllocationSize;
  ctx->dokan_operations.LockFile = kbfsLibdokanC_LockFile;
  ctx->dokan_operations.UnlockFile = kbfsLibdokanC_UnlockFile;
  ctx->dokan_operations.GetDiskFreeSpace = kbfsLibdokanC_GetDiskFreeSpace;
  ctx->dokan_operations.GetVolumeInformation = kbfsLibdokanC_GetVolumeInformation;
  ctx->dokan_operations.Mounted = kbfsLibdokanC_Mounted;
  ctx->dokan_operations.GetFileSecurity = kbfsLibdokanC_GetFileSecurity;
  ctx->dokan_operations.SetFileSecurity = kbfsLibdokanC_SetFileSecurity;
  // FIXME: Multiple streams per file for e.g. resource forks
  //   ctx->dokan_operations.FindStreams = kbfsLibdokanC_FindStreams;
  return ctx;
}

void kbfsLibdokanSet_path(struct kbfsLibdokanCtx* ctx, void* ptr) {
	if(ctx->dokan_options.MountPoint)
		free((void*)ctx->dokan_options.MountPoint);
	ctx->dokan_options.MountPoint = wcsdup(ptr);
}

error_t kbfsLibdokanFree(struct kbfsLibdokanCtx* ctx) {
	if(ctx) {
		if(ctx->dokan_options.MountPoint)
			free((void*)ctx->dokan_options.MountPoint);
	   free(ctx);
	}
	return 0;
}

error_t kbfsLibdokanRun(struct kbfsLibdokanCtx* ctx) {
	int __stdcall (*dokanMain)(PDOKAN_OPTIONS DokanOptions, PDOKAN_OPERATIONS DokanOperations) = (void*)kbfsLibdokanPtr_Main;
	if(!dokanMain)
		return kbfsLibDokan_DLL_LOAD_ERROR;
	if((ctx->dokan_options.Options & kbfsLibdokanUseFindFilesWithPattern) != 0) {
	  ctx->dokan_options.Options &= ~kbfsLibdokanUseFindFilesWithPattern;
	  ctx->dokan_operations.FindFilesWithPattern = kbfsLibdokanC_FindFilesWithPattern;
	}
	int status = (*dokanMain)(&ctx->dokan_options, &ctx->dokan_operations);
	return status;
}

int kbfsLibdokanFill_find(PFillFindData fptr, PWIN32_FIND_DATAW a1, PDOKAN_FILE_INFO a2) {
  return fptr(a1, a2);
}

BOOL kbfsLibdokan_RemoveMountPoint(LPCWSTR MountPoint) {
	BOOL __stdcall (*removeMountPoint)(LPCWSTR MountPoint) = (void*)kbfsLibdokanPtr_RemoveMountPoint;
	if(!removeMountPoint)
		return 0;
	return (*removeMountPoint)(MountPoint);
}


HANDLE kbfsLibdokan_OpenRequestorToken(PDOKAN_FILE_INFO DokanFileInfo) {
	HANDLE __stdcall (*openRequestorToken)(PDOKAN_FILE_INFO DokanFileInfo) = (void*)kbfsLibdokanPtr_OpenRequestorToken;
	if(!openRequestorToken)
		return INVALID_HANDLE_VALUE;
	return (*openRequestorToken)(DokanFileInfo);
}

ULONG kbfsLibDokan_GetVersion(uintptr_t proc) {
	if(!proc)
		return 0;
	ULONG __stdcall (*fun)() = (void*)proc;
	return fun();
}


#endif /* windows check */
