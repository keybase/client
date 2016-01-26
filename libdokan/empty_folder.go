package libdokan

import (
	"github.com/keybase/kbfs/dokan"
)

// EmptyFolder represents an empty, read-only KBFS TLF that has not
// been created by someone with sufficient permissions.
type EmptyFolder struct {
	emptyFile
}

// GetFileInformation for dokan.
func (*EmptyFolder) GetFileInformation(*dokan.FileInfo) (a *dokan.Stat, err error) {
	return defaultDirectoryInformation()
}

// FindFiles for dokan.
func (*EmptyFolder) FindFiles(fi *dokan.FileInfo, callback func(*dokan.NamedStat) error) (err error) {
	return nil
}
