// Copyright 2016 Keybase Inc. All rights reserved.
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

var fsTableLock sync.Mutex
var fsTable = make([]fsTableEntry, 0, 2)
var fiTableLock sync.Mutex      // nolint
var fiTable = map[uint32]File{} // nolint
var fiIdx uint32                // nolint

type fsTableEntry struct {
	fs        FileSystem
	errChan   chan error
	fileCount uint32
}

func fsTableStore(fs FileSystem, ec chan error) uint32 {
	fsTableLock.Lock()
	defer fsTableLock.Unlock()

	for i, c := range fsTable {
		if c.fs == nil {
			fsTable[i] = fsTableEntry{fs: fs, errChan: ec}
			return uint32(i)
		}
	}

	fsTable = append(fsTable, fsTableEntry{fs: fs, errChan: ec})
	return uint32(len(fsTable) - 1)
}

func fsTableFree(slot uint32) { // nolint
	fsTableLock.Lock()
	defer fsTableLock.Unlock()
	if int(slot) < len(fsTable) {
		fsTable[slot] = fsTableEntry{}
	}
}

func fsTableGet(slot uint32) FileSystem { // nolint
	fsTableLock.Lock()
	defer fsTableLock.Unlock()
	return fsTable[slot].fs
}

func fsTableGetErrChan(slot uint32) chan error { // nolint
	fsTableLock.Lock()
	defer fsTableLock.Unlock()
	return fsTable[slot].errChan
}

func fsTableGetFileCount(slot uint32) uint32 {
	fsTableLock.Lock()
	defer fsTableLock.Unlock()
	return fsTable[slot].fileCount
}

func fiTableStoreFile(global uint32, fi File) uint32 { // nolint
	fsTableLock.Lock()
	fsTable[global].fileCount++
	fsTableLock.Unlock()
	fiTableLock.Lock()
	defer fiTableLock.Unlock()
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
			debug("FID alloc", fiIdx, fi)
			fiTable[fiIdx] = fi
			return fiIdx
		}
	}
}

func fiTableGetFile(file uint32) File { // nolint
	fiTableLock.Lock()
	var fi = fiTable[file]
	fiTableLock.Unlock()
	debug("FID get", file, fi)
	return fi
}

func fiTableFreeFile(global uint32, file uint32) { // nolint
	fsTableLock.Lock()
	fsTable[global].fileCount--
	fsTableLock.Unlock()
	fiTableLock.Lock()
	defer fiTableLock.Unlock()
	debug("FID free", global, file, "=>", fiTable[file], "# of open files:", len(fiTable)-1)
	delete(fiTable, file)
}
