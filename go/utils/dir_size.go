package utils

import (
	"os"
	"path/filepath"
)

// DirSize walks the file tree the size of the given directory
func DirSize(dirPath string) (size uint64, err error) {
	err = filepath.Walk(dirPath, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			size += uint64(info.Size())
		}
		return nil
	})
	return size, err
}
