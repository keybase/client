// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

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

// DirEntryWithName combines a DirEntry with the name pointing to that
// entry within a directory.
type DirEntryWithName struct {
	DirEntry
	entryName string
}

// DirEntries is a slice of `DirEntryWithName` instances.
type DirEntries []DirEntryWithName

// DirEntriesBySizeAsc sorts entries in order of ascending name.
type DirEntriesBySizeAsc struct{ DirEntries }

// DirEntriesBySizeDesc sorts entries in order of descending name.
type DirEntriesBySizeDesc struct{ DirEntries }

// Swap implements the sort.Interface interface for DirEntries.
func (d DirEntries) Swap(i, j int) { d[i], d[j] = d[j], d[i] }

// Len implements the sort.Interface interface for DirEntries.
func (d DirEntries) Len() int { return len(d) }

// Less implements the sort.Interface interface for DirEntriesBySizeAsc.
func (d DirEntriesBySizeAsc) Less(i, j int) bool { return d.DirEntries[i].Size < d.DirEntries[j].Size }

// Less implements the sort.Interface interface for DirEntriesBySizeDesc.
func (d DirEntriesBySizeDesc) Less(i, j int) bool { return d.DirEntries[i].Size > d.DirEntries[j].Size }

// DirEntryMapToDirEntries returns a `DirEntries` slice of all the
// entries in the given map.
func DirEntryMapToDirEntries(entryMap map[string]DirEntry) DirEntries {
	dirEntries := make(DirEntries, 0, len(entryMap))
	for name, entry := range entryMap {
		dirEntries = append(dirEntries, DirEntryWithName{entry, name})
	}
	return dirEntries
}
