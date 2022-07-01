// Copyright 2016-2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

#ifndef KBFS_DOKAN_BRIDGE_H__
#define KBFS_DOKAN_BRIDGE_H__

#if defined(_WIN32) || defined(WIN32) || defined(__CYGWIN__) || defined(__MINGW32__) || defined(__BORLANDC__)

#define UNICODE 1
#define _UNICODE 1

#include <stdint.h>
#include <windows.h>
#include <ntdef.h>
#include <ntstatus.h>

/* Compatibility for older toolchains */
#define PWIN32_FIND_DATAW LPWIN32_FIND_DATAW
typedef struct kbfs_WIN32_FIND_STREAM_DATA_ {
    LARGE_INTEGER StreamSize;
    WCHAR cStreamName[MAX_PATH + 36];
} kbfs_WIN32_FIND_STREAM_DATA,*kbfs_PWIN32_FIND_STREAM_DATA;
#define PWIN32_FIND_STREAM_DATA kbfs_PWIN32_FIND_STREAM_DATA


#include "dokan_header/dokan.h"

typedef int32_t error_t;
typedef uint32_t go_fs_id;

struct kbfsLibdokanCtx {
  DOKAN_OPERATIONS dokan_operations;
  DOKAN_OPTIONS dokan_options;
};

struct kbfsLibdokanCtx* kbfsLibdokanAllocCtx(ULONG64 fsslot);
error_t kbfsLibdokanFree(struct kbfsLibdokanCtx* ctx);
error_t kbfsLibdokanRun(struct kbfsLibdokanCtx* ctx);
void kbfsLibdokanSet_path(struct kbfsLibdokanCtx* ctx, void*);

int kbfsLibdokanFill_find(PFillFindData, PWIN32_FIND_DATAW, PDOKAN_FILE_INFO);

BOOL kbfsLibdokan_RemoveMountPoint(LPCWSTR MountPoint);
HANDLE kbfsLibdokan_OpenRequestorToken(PDOKAN_FILE_INFO DokanFileInfo);

enum {
  kbfsLibdokanDebug = DOKAN_OPTION_DEBUG,
  kbfsLibdokanStderr = DOKAN_OPTION_STDERR,
  kbfsLibdokanRemovable = DOKAN_OPTION_REMOVABLE,
  kbfsLibdokanMountManager = DOKAN_OPTION_MOUNT_MANAGER,
  kbfsLibdokanCurrentSession = DOKAN_OPTION_CURRENT_SESSION,
  kbfsLibdokanUseFindFilesWithPattern = 1<<24,

  kbfsLibDokan_ERROR = DOKAN_ERROR,
  kbfsLibDokan_DRIVE_LETTER_ERROR = DOKAN_DRIVE_LETTER_ERROR,
  kbfsLibDokan_DRIVER_INSTALL_ERROR = DOKAN_DRIVER_INSTALL_ERROR,
  kbfsLibDokan_START_ERROR = DOKAN_START_ERROR,
  kbfsLibDokan_MOUNT_ERROR = DOKAN_MOUNT_ERROR,
  kbfsLibDokan_MOUNT_POINT_ERROR = DOKAN_MOUNT_POINT_ERROR,
  kbfsLibDokan_VERSION_ERROR = DOKAN_VERSION_ERROR,
  kbfsLibDokan_DLL_LOAD_ERROR = -99,
};

extern uintptr_t kbfsLibdokanPtr_RemoveMountPoint;
extern uintptr_t kbfsLibdokanPtr_OpenRequestorToken;
extern uintptr_t kbfsLibdokanPtr_Main;

ULONG kbfsLibDokan_GetVersion(uintptr_t proc);

#endif /* windows check */

#endif /* KBFS_DOKAN_BRIDGE_H__ */
