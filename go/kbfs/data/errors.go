// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import (
	"fmt"

	"github.com/keybase/client/go/kbfs/kbfsblock"
)

// NameExistsError indicates that the user tried to create an entry
// for a name that already existed in a subdirectory.
type NameExistsError struct {
	Name string
}

// Error implements the error interface for NameExistsError
func (e NameExistsError) Error() string {
	return fmt.Sprintf("%s already exists", e.Name)
}

// BadSplitError indicates that the BlockSplitter has an error.
type BadSplitError struct {
}

// Error implements the error interface for BadSplitError
func (e BadSplitError) Error() string {
	return "Unexpected bad block split"
}

// BadDataError indicates that KBFS is storing corrupt data for a block.
type BadDataError struct {
	ID kbfsblock.ID
}

// Error implements the error interface for BadDataError
func (e BadDataError) Error() string {
	return fmt.Sprintf("Bad data for block %v", e.ID)
}

// NoSuchBlockError indicates that a block for the associated ID doesn't exist.
type NoSuchBlockError struct {
	ID kbfsblock.ID
}

// Error implements the error interface for NoSuchBlockError
func (e NoSuchBlockError) Error() string {
	return fmt.Sprintf("Couldn't get block %v", e.ID)
}

// NotDirectFileBlockError indicates that a direct file block was
// expected, but something else (e.g., an indirect file block) was
// given instead.
type NotDirectFileBlockError struct {
}

func (e NotDirectFileBlockError) Error() string {
	return fmt.Sprintf("Unexpected block type; expected a direct file block")
}

// CachePutCacheFullError indicates that a cache put failed because
// the cache was full.
type CachePutCacheFullError struct {
	BlockID kbfsblock.ID
}

func (e CachePutCacheFullError) Error() string {
	return fmt.Sprintf("failed to put block due to full cache. Block: %s",
		e.BlockID)
}

// ShutdownHappenedError indicates that shutdown has happened.
type ShutdownHappenedError struct {
}

// Error implements the error interface for ShutdownHappenedError.
func (e ShutdownHappenedError) Error() string {
	return "Shutdown happened"
}
