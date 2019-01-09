// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"fmt"

	"github.com/keybase/client/go/kbfs/tlf"
)

// MissingDataError indicates that we are trying to take get the
// metadata ID of a MD object with no serialized data field.
type MissingDataError struct {
	tlfID tlf.ID
}

// Error implements the error interface for MissingDataError
func (e MissingDataError) Error() string {
	return fmt.Sprintf("No serialized private data in the metadata "+
		"for directory %v", e.tlfID)
}

// InvalidBranchID indicates whether the branch ID string is not
// parseable or invalid.
type InvalidBranchID struct {
	id string
}

func (e InvalidBranchID) Error() string {
	return fmt.Sprintf("Invalid branch ID %q", e.id)
}

// MetadataIsFinalError indicates that we tried to make or set a
// successor to a finalized folder.
type MetadataIsFinalError struct {
}

// Error implements the error interface for MetadataIsFinalError.
func (e MetadataIsFinalError) Error() string {
	return "Metadata is final"
}

// MDTlfIDMismatch indicates that the ID field of a successor MD
// doesn't match the ID field of its predecessor.
type MDTlfIDMismatch struct {
	CurrID tlf.ID
	NextID tlf.ID
}

func (e MDTlfIDMismatch) Error() string {
	return fmt.Sprintf("TLF ID %s doesn't match successor TLF ID %s",
		e.CurrID, e.NextID)
}

// MDRevisionMismatch indicates that we tried to apply a revision that
// was not the next in line.
type MDRevisionMismatch struct {
	Rev  Revision
	Curr Revision
}

// Error implements the error interface for MDRevisionMismatch.
func (e MDRevisionMismatch) Error() string {
	return fmt.Sprintf("MD revision %d isn't next in line for our "+
		"current revision %d", e.Rev, e.Curr)
}

// MDPrevRootMismatch indicates that the PrevRoot field of a successor
// MD doesn't match the metadata ID of its predecessor.
type MDPrevRootMismatch struct {
	prevRoot         ID
	expectedPrevRoot ID
}

func (e MDPrevRootMismatch) Error() string {
	return fmt.Sprintf("PrevRoot %s doesn't match expected %s",
		e.prevRoot, e.expectedPrevRoot)
}

// MDDiskUsageMismatch indicates an inconsistency in the DiskUsage
// field of a RootMetadata object.
type MDDiskUsageMismatch struct {
	expectedDiskUsage uint64
	actualDiskUsage   uint64
}

func (e MDDiskUsageMismatch) Error() string {
	return fmt.Sprintf("Disk usage %d doesn't match expected %d",
		e.actualDiskUsage, e.expectedDiskUsage)
}

// InvalidNonPrivateTLFOperation indicates that an invalid operation was
// attempted on a public or team TLF.
type InvalidNonPrivateTLFOperation struct {
	id     tlf.ID
	opName string
	ver    MetadataVer
}

// Error implements the error interface for InvalidNonPrivateTLFOperation.
func (e InvalidNonPrivateTLFOperation) Error() string {
	return fmt.Sprintf(
		"Tried to do invalid operation %s on non-private TLF %v (ver=%v)",
		e.opName, e.id, e.ver)
}

// InvalidKeyGenerationError indicates that an invalid key generation
// was used.
type InvalidKeyGenerationError struct {
	TlfID  tlf.ID
	KeyGen KeyGen
}

// Error implements the error interface for InvalidKeyGenerationError.
func (e InvalidKeyGenerationError) Error() string {
	return fmt.Sprintf("Invalid key generation %d for %s", int(e.KeyGen), e.TlfID)
}

// NewKeyGenerationError indicates that the data at the given path has
// been written using keys that our client doesn't have.
type NewKeyGenerationError struct {
	TlfID  tlf.ID
	KeyGen KeyGen
}

// Error implements the error interface for NewKeyGenerationError.
func (e NewKeyGenerationError) Error() string {
	return fmt.Sprintf(
		"The data for %v is keyed with a key generation (%d) that "+
			"we don't know", e.TlfID, e.KeyGen)
}

// TLFCryptKeyNotPerDeviceEncrypted is returned when a given TLFCryptKey is not
// encrypted per-device but rather symmetrically encrypted with the current
// generation of the TLFCryptKey.
type TLFCryptKeyNotPerDeviceEncrypted struct {
	tlf    tlf.ID
	keyGen KeyGen
}

// // Error implements the error interface for TLFCryptKeyNotPerDeviceEncrypted
func (e TLFCryptKeyNotPerDeviceEncrypted) Error() string {
	return fmt.Sprintf("TLF crypt key for %s at generation %d is not per-device encrypted",
		e.tlf, e.keyGen)
}

// InvalidMetadataVersionError indicates that an invalid metadata version was
// used.
type InvalidMetadataVersionError struct {
	TlfID       tlf.ID
	MetadataVer MetadataVer
}

// Error implements the error interface for InvalidMetadataVersionError.
func (e InvalidMetadataVersionError) Error() string {
	return fmt.Sprintf("Invalid metadata version %d for folder %s",
		int(e.MetadataVer), e.TlfID)
}

// NewMetadataVersionError indicates that the metadata for the given
// folder has been written using a new metadata version that our
// client doesn't understand.
type NewMetadataVersionError struct {
	Tlf         tlf.ID
	MetadataVer MetadataVer
}

// Error implements the error interface for NewMetadataVersionError.
func (e NewMetadataVersionError) Error() string {
	return fmt.Sprintf(
		"The metadata for folder %s is of a version (%d) that we can't read",
		e.Tlf, e.MetadataVer)
}

// MutableRootMetadataNoImplError is returned when an interface expected
// to implement MutableRootMetadata does not do so.
type MutableRootMetadataNoImplError struct {
}

// Error implements the error interface for MutableRootMetadataNoImplError
func (e MutableRootMetadataNoImplError) Error() string {
	return "Does not implement MutableRootMetadata"
}

// InvalidIDError indicates that a metadata ID string is not parseable
// or invalid.
type InvalidIDError struct {
	id string
}

func (e InvalidIDError) Error() string {
	return fmt.Sprintf("Invalid metadata ID %q", e.id)
}

// NewMerkleVersionError indicates that the merkle tree on the server
// is using a new metadata version that our client doesn't understand.
type NewMerkleVersionError struct {
	Version int
}

// Error implements the error interface for NewMerkleVersionError.
func (e NewMerkleVersionError) Error() string {
	return fmt.Sprintf(
		"The merkle tree is of a version (%d) that we can't read", e.Version)
}
