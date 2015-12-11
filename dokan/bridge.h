// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

#ifndef KBFS_DOKAN_BRIDGE_H__
#define KBFS_DOKAN_BRIDGE_H__

#if defined(_WIN32) || defined(WIN32) || defined(__CYGWIN__) || defined(__MINGW32__) || defined(__BORLANDC__)

#include <stdint.h>
#include <ntstatus.h>

#include "dokan_header/dokan.h"

typedef uint32_t error_t;
typedef uint32_t go_fs_id;

struct kbfs_libdokan_ctx {
  DOKAN_OPERATIONS dokan_operations;
  DOKAN_OPTIONS dokan_options;
  WCHAR drive_letter[4]; // e.g. `G:\`
};

struct kbfs_libdokan_ctx* kbfs_libdokan_alloc_ctx(ULONG64 fsslot);
error_t kbfs_libdokan_free(struct kbfs_libdokan_ctx* ctx);
error_t kbfs_libdokan_run(struct kbfs_libdokan_ctx* ctx);
void kbfs_libdokan_set_drive_letter(struct kbfs_libdokan_ctx* ctx, char c);

int kbfs_libdokan_fill_find(PFillFindData, PWIN32_FIND_DATAW, PDOKAN_FILE_INFO);

enum {
  kbfs_libdokan_debug = DOKAN_OPTION_DEBUG|DOKAN_OPTION_STDERR,
};

#endif /* windows check */

#endif /* KBFS_DOKAN_BRIDGE_H__ */
