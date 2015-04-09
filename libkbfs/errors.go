package libkbfs

import (
	"fmt"

	libkb "github.com/keybase/client/go/libkb"
)

var ErrorFile string = ".kbfs_error"

type WrapError struct {
	Err error
}

func (e *WrapError) String() string {
	return e.Err.Error()
}

type NameExistsError struct {
	Name string
}

func (e *NameExistsError) Error() string {
	return fmt.Sprintf("%s already exists", e.Name)
}

type NoSuchNameError struct {
	Name string
}

func (e *NoSuchNameError) Error() string {
	return fmt.Sprintf("%s doesn't exist", e.Name)
}

type BadPathError struct {
	Name string
}

func (e *BadPathError) Error() string {
	return fmt.Sprintf("%s is in an incorrect format", e.Name)
}

type DirNotEmptyError struct {
	Name string
}

func (e *DirNotEmptyError) Error() string {
	return fmt.Sprintf("Directory %s is not empty and can't be removed", e.Name)
}

type TopDirAccessError struct {
	Name string
}

func (e *TopDirAccessError) Error() string {
	return fmt.Sprintf("Operation not permitted on folder %s", e.Name)
}

type RenameAcrossDirsError struct {
}

func (e *RenameAcrossDirsError) Error() string {
	return fmt.Sprintf("Cannot rename across directories")
}

type ErrorFileAccessError struct {
}

func (e *ErrorFileAccessError) Error() string {
	return fmt.Sprintf("Operation not allowed on file %s", ErrorFile)
}

type ReadAccessError struct {
	User string
	Dir  string
}

func (e *ReadAccessError) Error() string {
	return fmt.Sprintf("%s does not have read access to directory %s",
		e.User, e.Dir)
}

type WriteAccessError struct {
	User string
	Dir  string
}

func (e *WriteAccessError) Error() string {
	return fmt.Sprintf("%s does not have write access to directory %s",
		e.User, e.Dir)
}

func readAccessError(config Config, md *RootMetadata, uid libkb.UID) error {
	dirname := md.GetDirHandle().ToString(config)
	if u, err2 := config.KBPKI().GetUser(uid); err2 == nil {
		return &ReadAccessError{u.GetName(), dirname}
	} else {
		return &ReadAccessError{uid.String(), dirname}
	}
}

func writeAccessError(config Config, md *RootMetadata, uid libkb.UID) error {
	dirname := md.GetDirHandle().ToString(config)
	if u, err2 := config.KBPKI().GetUser(uid); err2 == nil {
		return &WriteAccessError{u.GetName(), dirname}
	} else {
		return &WriteAccessError{uid.String(), dirname}
	}
}

type NotDirError struct {
	Path string
}

func (e *NotDirError) Error() string {
	return fmt.Sprintf("%s is not a directory", e.Path)
}

type NotFileError struct {
	Path string
}

func (e *NotFileError) Error() string {
	return fmt.Sprintf("%s is not a file", e.Path)
}

type BadDataError struct {
	Id BlockId
}

func (e *BadDataError) Error() string {
	return fmt.Sprintf("Bad data for block %v", e.Id)
}

type NoSuchBlockError struct {
	Id BlockId
}

func (e *NoSuchBlockError) Error() string {
	return fmt.Sprintf("Couldn't get block %v", e.Id)
}

type FinalizeError struct {
	Id BlockId
}

func (e *FinalizeError) Error() string {
	return fmt.Sprintf("No need to finalize block %v; not dirty", e.Id)
}

type BadCryptoError struct {
	Id BlockId
}

func (e *BadCryptoError) Error() string {
	return fmt.Sprintf("Bad crypto for block %v", e.Id)
}

type BadMDError struct {
	Dir string
}

func (e *BadMDError) Error() string {
	return fmt.Sprintf("Wrong format for metadata for directory %s", e.Dir)
}

type MDMismatchError struct {
	Dir string
	Err string
}

func (e *MDMismatchError) Error() string {
	return fmt.Sprintf("Could not verify metadata for directory %s: %s",
		e.Dir, e.Err)
}

type NoSuchMDError struct {
	Dir string
}

func (e *NoSuchMDError) Error() string {
	return fmt.Sprintf("Couldn't get metadata for %s", e.Dir)
}

type NewVersionError struct {
	Path string
	Ver  int
}

func (e *NewVersionError) Error() string {
	return fmt.Sprintf(
		"The data at path %s is of a version (%d) that we can't read",
		e.Path, e.Ver)
}

type NewKeyError struct {
	Path string
	Ver  int
}

func (e *NewKeyError) Error() string {
	return fmt.Sprintf(
		"The data at path %s is keyed with a key version (%d) that "+
			"we don't know", e.Path, e.Ver)
}

type BadSplitError struct {
}

func (e *BadSplitError) Error() string {
	return "Unexpected bad block split"
}

type LoggedInUserError struct {
}

func (e *LoggedInUserError) Error() string {
	return "No UID for logged-in user"
}
