package libkbfs

import (
	"fmt"
	"syscall"

	"bazil.org/fuse"

	keybase1 "github.com/keybase/client/protocol/go"
)

// ErrorFile is the name of the virtual file in KBFS that should
// contain the last reported error(s).
var ErrorFile = ".kbfs_error"

// WrapError simply wraps an error in a fmt.Stringer interface, so
// that it can be reported.
type WrapError struct {
	Err error
}

// String implements the fmt.Stringer interface for WrapError
func (e WrapError) String() string {
	return e.Err.Error()
}

// NameExistsError indicates that the user tried to create an entry
// for a name that already existed in a subdirectory.
type NameExistsError struct {
	Name string
}

// Error implements the error interface for NameExistsError
func (e NameExistsError) Error() string {
	return fmt.Sprintf("%s already exists", e.Name)
}

// NoSuchNameError indicates that the user tried to access a
// subdirectory entry that doesn't exist.
type NoSuchNameError struct {
	Name string
}

// Error implements the error interface for NoSuchNameError
func (e NoSuchNameError) Error() string {
	return fmt.Sprintf("%s doesn't exist", e.Name)
}

// BadTLFNameError indicates a top-level folder name that has an
// incorrect format.
type BadTLFNameError struct {
	Name string
}

// Error implements the error interface for BadTLFNameError.
func (e BadTLFNameError) Error() string {
	return fmt.Sprintf("TLF name %s is in an incorrect format", e.Name)
}

// InvalidPathError indicates an invalid (i.e., empty) path was encountered.
type InvalidPathError struct{}

// Error implements the error interface for InvalidPathError.
func (e InvalidPathError) Error() string {
	return "Invalid path"
}

// DirNotEmptyError indicates that the user tried to unlink a
// subdirectory that was not empty.
type DirNotEmptyError struct {
	Name string
}

// Error implements the error interface for DirNotEmptyError
func (e DirNotEmptyError) Error() string {
	return fmt.Sprintf("Directory %s is not empty and can't be removed", e.Name)
}

var _ fuse.ErrorNumber = DirNotEmptyError{""}

// Errno implements the fuse.ErrorNumber interface for
// DirNotEmptyError
func (e DirNotEmptyError) Errno() fuse.Errno {
	return fuse.Errno(syscall.ENOTEMPTY)
}

// TlfAccessError that the user tried to perform an unpermitted
// operation on a top-level folder.
type TlfAccessError struct {
	ID TlfID
}

// Error implements the error interface for TlfAccessError
func (e TlfAccessError) Error() string {
	return fmt.Sprintf("Operation not permitted on folder %s", e.ID)
}

// RenameAcrossDirsError indicates that the user tried to do an atomic
// rename across directories.
type RenameAcrossDirsError struct {
}

// Error implements the error interface for RenameAcrossDirsError
func (e RenameAcrossDirsError) Error() string {
	return fmt.Sprintf("Cannot rename across directories")
}

// ErrorFileAccessError indicates that the user tried to perform an
// operation on the ErrorFile that is not allowed.
type ErrorFileAccessError struct {
}

// Error implements the error interface for ErrorFileAccessError
func (e ErrorFileAccessError) Error() string {
	return fmt.Sprintf("Operation not allowed on file %s", ErrorFile)
}

// ReadAccessError indicates that the user tried to read from a
// top-level folder without read permission.
type ReadAccessError struct {
	User string
	Dir  string
}

// Error implements the error interface for ReadAccessError
func (e ReadAccessError) Error() string {
	return fmt.Sprintf("%s does not have read access to directory %s",
		e.User, e.Dir)
}

// WriteAccessError indicates that the user tried to read from a
// top-level folder without read permission.
type WriteAccessError struct {
	User string
	Dir  string
}

// Error implements the error interface for WriteAccessError
func (e WriteAccessError) Error() string {
	return fmt.Sprintf("%s does not have write access to directory %s",
		e.User, e.Dir)
}

// NewReadAccessError constructs a ReadAccessError for the given
// directory and user.
func NewReadAccessError(config Config, dir *TlfHandle, uid keybase1.UID) error {
	dirname := dir.ToString(config)
	if u, err2 := config.KBPKI().GetUser(uid); err2 == nil {
		return ReadAccessError{u.GetName(), dirname}
	}
	return ReadAccessError{uid.String(), dirname}
}

// NewWriteAccessError constructs a WriteAccessError for the given
// directory and user.
func NewWriteAccessError(config Config, dir *TlfHandle,
	uid keybase1.UID) error {
	dirname := dir.ToString(config)
	if u, err2 := config.KBPKI().GetUser(uid); err2 == nil {
		return WriteAccessError{u.GetName(), dirname}
	}
	return WriteAccessError{uid.String(), dirname}
}

// NotDirError indicates that the user tried to perform a
// directory-specific operation on something that isn't a
// subdirectory.
type NotDirError struct {
	path path
}

// Error implements the error interface for NotDirError
func (e NotDirError) Error() string {
	return fmt.Sprintf("%s is not a directory (in folder %s)",
		&e.path, e.path.Tlf)
}

// NotFileError indicates that the user tried to perform a
// file-specific operation on something that isn't a file.
type NotFileError struct {
	path path
}

// Error implements the error interface for NotFileError
func (e NotFileError) Error() string {
	return fmt.Sprintf("%s is not a file (folder %s)", e.path, e.path.Tlf)
}

// BadDataError indicates that KBFS is storing corrupt data for a block.
type BadDataError struct {
	ID BlockID
}

// Error implements the error interface for BadDataError
func (e BadDataError) Error() string {
	return fmt.Sprintf("Bad data for block %v", e.ID)
}

// NoSuchBlockError indicates that a block for the associated ID doesn't exist.
type NoSuchBlockError struct {
	ID BlockID
}

// Error implements the error interface for NoSuchBlockError
func (e NoSuchBlockError) Error() string {
	return fmt.Sprintf("Couldn't get block %v", e.ID)
}

// BadCryptoError indicates that KBFS performed a bad crypto operation.
type BadCryptoError struct {
	ID BlockID
}

// Error implements the error interface for BadCryptoError
func (e BadCryptoError) Error() string {
	return fmt.Sprintf("Bad crypto for block %v", e.ID)
}

// BadCryptoMDError indicates that KBFS performed a bad crypto
// operation, specifically on a MD object.
type BadCryptoMDError struct {
	ID TlfID
}

// Error implements the error interface for BadCryptoMDError
func (e BadCryptoMDError) Error() string {
	return fmt.Sprintf("Bad crypto for the metadata of directory %v", e.ID)
}

// BadMDError indicates that the system is storing corrupt MD object
// for the given MD ID.
type BadMDError struct {
	ID MdID
}

// Error implements the error interface for BadMDError
func (e BadMDError) Error() string {
	return fmt.Sprintf("Wrong format for metadata for directory %v", e.ID)
}

// MDMissingDataError indicates that we are trying to take get the
// metadata ID of a MD object with no serialized data field.
type MDMissingDataError struct {
	ID TlfID
}

// Error implements the error interface for MDMissingDataError
func (e MDMissingDataError) Error() string {
	return fmt.Sprintf("No serialized private data in the metadata "+
		"for directory %v", e.ID)
}

// MDMismatchError indicates an inconsistent or unverifiable MD object
// for the given top-level folder.
type MDMismatchError struct {
	Dir string
	Err string
}

// Error implements the error interface for MDMismatchError
func (e MDMismatchError) Error() string {
	return fmt.Sprintf("Could not verify metadata for directory %s: %s",
		e.Dir, e.Err)
}

// NoSuchMDError indicates that there is no MD object for the given MD ID.
type NoSuchMDError struct {
	ID MdID
}

// Error implements the error interface for NoSuchMDError
func (e NoSuchMDError) Error() string {
	return fmt.Sprintf("Couldn't get metadata for %v", e.ID)
}

// InvalidDataVersionError indicates that an invalid data version was
// used.
type InvalidDataVersionError struct {
	DataVer DataVer
}

// Error implements the error interface for InvalidDataVersionError.
func (e InvalidDataVersionError) Error() string {
	return fmt.Sprintf("Invalid data version %d", int(e.DataVer))
}

// NewDataVersionError indicates that the data at the given path has
// been written using a new data version that our client doesn't
// understand.
type NewDataVersionError struct {
	path    path
	DataVer DataVer
}

// Error implements the error interface for NewDataVersionError.
func (e NewDataVersionError) Error() string {
	return fmt.Sprintf(
		"The data at path %s is of a version (%d) that we can't read "+
			"(in folder %s)",
		e.path, e.DataVer, e.path.Tlf)
}

// InvalidKeyGenerationError indicates that an invalid key generation
// was used.
type InvalidKeyGenerationError struct {
	TlfHandle *TlfHandle
	KeyGen    KeyGen
}

// Error implements the error interface for InvalidKeyGenerationError.
func (e InvalidKeyGenerationError) Error() string {
	return fmt.Sprintf("Invalid key generation %d for %v", int(e.KeyGen), e.TlfHandle)
}

// NewKeyGenerationError indicates that the data at the given path has
// been written using keys that our client doesn't have.
type NewKeyGenerationError struct {
	TlfHandle *TlfHandle
	KeyGen    KeyGen
}

// Error implements the error interface for NewKeyGenerationError.
func (e NewKeyGenerationError) Error() string {
	return fmt.Sprintf(
		"The data for %v is keyed with a key generation (%d) that "+
			"we don't know", e.TlfHandle, e.KeyGen)
}

// BadSplitError indicates that the BlockSplitter has an error.
type BadSplitError struct {
}

// Error implements the error interface for BadSplitError
func (e BadSplitError) Error() string {
	return "Unexpected bad block split"
}

// TooLowByteCountError indicates that size of a block is smaller than
// the expected size.
type TooLowByteCountError struct {
	ExpectedMinByteCount int
	ByteCount            int
}

// Error implements the error interface for TooLowByteCountError
func (e TooLowByteCountError) Error() string {
	return fmt.Sprintf("Expected at least %d bytes, got %d bytes",
		e.ExpectedMinByteCount, e.ByteCount)
}

// InconsistentEncodedSizeError is raised when a dirty block has a
// non-zero encoded size.
type InconsistentEncodedSizeError struct {
	info BlockInfo
}

// Error implements the error interface for InconsistentEncodedSizeError
func (e InconsistentEncodedSizeError) Error() string {
	return fmt.Sprintf("Block pointer to dirty block %v with non-zero "+
		"encoded size = %d bytes", e.info.ID, e.info.EncodedSize)
}

// WriteNeededInReadRequest indicates that the system needs write
// permissions to successfully complete a read operation, so it should
// retry in write mode.
type WriteNeededInReadRequest struct {
}

// Error implements the error interface for WriteNeededInReadRequest
func (e WriteNeededInReadRequest) Error() string {
	return "This request needs exclusive access, but doesn't have it."
}

// UnknownSigVer indicates that we can't process a signature because
// it has an unknown version.
type UnknownSigVer struct {
	sigVer SigVer
}

// Error implements the error interface for UnknownSigVer
func (e UnknownSigVer) Error() string {
	return fmt.Sprintf("Unknown signature version %d", int(e.sigVer))
}

// KeyNotFoundError indicates that a key matching the given KID
// couldn't be found.
type KeyNotFoundError struct {
	kid keybase1.KID
}

// Error implements the error interface for KeyNotFoundError.
func (e KeyNotFoundError) Error() string {
	return fmt.Sprintf("Could not find key with kid=%s", e.kid)
}

// UnexpectedShortCryptoRandRead indicates that fewer bytes were read
// from crypto.rand.Read() than expected.
type UnexpectedShortCryptoRandRead struct {
}

// Error implements the error interface for UnexpectedShortRandRead.
func (e UnexpectedShortCryptoRandRead) Error() string {
	return "Unexpected short read from crypto.rand.Read()"
}

// UnknownEncryptionVer indicates that we can't decrypt an
// encryptedData object because it has an unknown version.
type UnknownEncryptionVer struct {
	ver EncryptionVer
}

// Error implements the error interface for UnknownEncryptionVer.
func (e UnknownEncryptionVer) Error() string {
	return fmt.Sprintf("Unknown encryption version %d", int(e.ver))
}

// InvalidNonceError indicates that an invalid cryptographic nonce was
// detected.
type InvalidNonceError struct {
	nonce []byte
}

// Error implements the error interface for InvalidNonceError.
func (e InvalidNonceError) Error() string {
	return fmt.Sprintf("Invalid nonce %v", e.nonce)
}

// InvalidPublicTLFOperation indicates that an invalid operation was
// attempted on a public TLF.
type InvalidPublicTLFOperation struct {
	id     TlfID
	opName string
}

// Error implements the error interface for InvalidPublicTLFOperation.
func (e InvalidPublicTLFOperation) Error() string {
	return fmt.Sprintf("Tried to do invalid operation %s on public TLF %v",
		e.opName, e.id)
}

// WrongOpsError indicates that an unexpected path got passed into a
// FolderBranchOps instance
type WrongOpsError struct {
	nodeFB FolderBranch
	opsFB  FolderBranch
}

// Error implements the error interface for WrongOpsError.
func (e WrongOpsError) Error() string {
	return fmt.Sprintf("Ops for folder %v, branch %s, was given path %s, "+
		"branch %s", e.opsFB.Tlf, e.opsFB.Branch, e.nodeFB.Tlf, e.nodeFB.Branch)
}

// ParentNodeNotFoundError indicates that we tried to update a Node's
// parent with a BlockPointer that we don't yet know about.
type ParentNodeNotFoundError struct {
	parent BlockPointer
}

// Error implements the error interface for ParentNodeNotFoundError.
func (e ParentNodeNotFoundError) Error() string {
	return fmt.Sprintf("No such parent node found for pointer %v", e.parent)
}

// EmptyNameError indicates that the user tried to use an empty name
// for the given BlockPointer.
type EmptyNameError struct {
	ptr BlockPointer
}

// Error implements the error interface for EmptyNameError.
func (e EmptyNameError) Error() string {
	return fmt.Sprintf("Cannot use empty name for pointer %v", e.ptr)
}

// OutOfDateMDError indicates that the MD server rejected our MD
// update because it is out of date with respect to the current head.
type OutOfDateMDError struct {
	PrevRoot MdID
}

// Error implements the error interface for OutOfDateError.
func (e OutOfDateMDError) Error() string {
	return fmt.Sprintf("MD rejected because its previous root was %v, "+
		"but that is not the current MD root", e.PrevRoot)
}
