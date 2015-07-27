package libkbfs

import "github.com/syndtr/goleveldb/leveldb/opt"

var leveldbOptions = &opt.Options{
	Compression: opt.NoCompression,
	// Default max open file descriptors (ulimit -n) is 256 on OS
	// X, and >=1024 on (most?) Linux machines. So set to a low
	// number since we have multiple leveldb instances.
	OpenFilesCacheCapacity: 10,
}
