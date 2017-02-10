// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import "github.com/syndtr/goleveldb/leveldb/opt"

var leveldbOptions = &opt.Options{
	Compression: opt.NoCompression,
	BlockSize:   1 << 16,
	// Default max open file descriptors (ulimit -n) is 256 on OS
	// X, and >=1024 on (most?) Linux machines. So set to a low
	// number since we have multiple leveldb instances.
	OpenFilesCacheCapacity: 10,
}
