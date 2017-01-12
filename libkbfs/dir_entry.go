// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import "github.com/keybase/go-codec/codec"

// DirEntry is all the data info a directory know about its child.
type DirEntry struct {
	BlockInfo
	EntryInfo

	codec.UnknownFieldSetHandler
}

// IsInitialized returns true if this DirEntry has been initialized.
func (de *DirEntry) IsInitialized() bool {
	return de.BlockPointer.IsInitialized()
}

type dirEntryWithName struct {
	DirEntry
	entryName string
}

type dirEntries []dirEntryWithName
type dirEntriesBySizeAsc struct{ dirEntries }
type dirEntriesBySizeDesc struct{ dirEntries }

func (d dirEntries) Len() int                     { return len(d) }
func (d dirEntries) Swap(i, j int)                { d[i], d[j] = d[j], d[i] }
func (d dirEntriesBySizeAsc) Less(i, j int) bool  { return d.dirEntries[i].Size < d.dirEntries[j].Size }
func (d dirEntriesBySizeDesc) Less(i, j int) bool { return d.dirEntries[i].Size > d.dirEntries[j].Size }

func dirEntryMapToDirEntries(entryMap map[string]DirEntry) dirEntries {
	dirEntries := make(dirEntries, 0, len(entryMap))
	for name, entry := range entryMap {
		dirEntries = append(dirEntries, dirEntryWithName{entry, name})
	}
	return dirEntries
}
