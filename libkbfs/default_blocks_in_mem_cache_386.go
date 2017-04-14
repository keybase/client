// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build 386

package libkbfs

// DefaultBlocksInMemCache is the number of blocks we should keep in
// the cache.  We turn this way down for 32-bit builds to avoid
// overflowing the low memory limits.
const DefaultBlocksInMemCache = 128
