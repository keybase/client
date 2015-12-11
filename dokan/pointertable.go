// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package dokan

import (
	"sync"
)

/* Keep Go pointers while passing integers to the C heap.
 *
 * These tables should only be used through the functions
 * defined in this file.
 */

var fsTable = make([]FileSystem, 0, 2)
var fiTable = map[uint32]File{}
var fiIdx uint32
var fsTableLock sync.Mutex

func fsTableStore(fs FileSystem) uint32 {
	fsTableLock.Lock()
	defer fsTableLock.Unlock()

	for i, c := range fsTable {
		if c == nil {
			fsTable[i] = fs
			return uint32(i)
		}
	}

	fsTable = append(fsTable, fs)
	return uint32(len(fsTable) - 1)
}

func fsTableFree(slot uint32) {
	fsTableLock.Lock()
	if int(slot) < len(fsTable) {
		fsTable[slot] = nil
	}
	fsTableLock.Unlock()
}

func fsTableGet(slot uint32) FileSystem {
	fsTableLock.Lock()
	var fs = fsTable[slot]
	fsTableLock.Unlock()
	return fs
}

func fsTableStoreFile(global uint32, fi File) uint32 {
	fsTableLock.Lock()
	defer fsTableLock.Unlock()
	for {
		// Just use a simple counter (inside the lock)
		// to look for potential free file handles.
		// Overflowing the counter is ok, but skip
		// counter value zero (for better error detection).
		fiIdx++
		if fiIdx == 0 {
			fiIdx++
		}
		_, exist := fiTable[fiIdx]
		if !exist {
			fiTable[fiIdx] = fi
			return fiIdx
		}
	}
}

func fsTableGetFile(file uint32) File {
	fsTableLock.Lock()
	var fi = fiTable[file]
	fsTableLock.Unlock()
	return fi
}

func fsTableFreeFile(global uint32, file uint32) {
	fsTableLock.Lock()
	debug("fsTableFreeFile", global, file, "=>", fiTable[file], "# of open files:", len(fiTable))
	delete(fiTable, file)
	fsTableLock.Unlock()
}
