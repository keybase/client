package unzip

import (
	"archive/zip"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
)

func Unzip(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer func() {
		if err := r.Close(); err != nil {
			panic(err)
		}
	}()

	if err := os.MkdirAll(dest, 0755); err != nil {
		return err
	}

	// Closure to address file descriptors issue with all the deferred .Close() methods
	extractAndWriteFile := func(f *zip.File) error {
		rc, err := f.Open()
		if err != nil {
			return err
		}
		defer func() {
			if err := rc.Close(); err != nil {
				panic(err)
			}
		}()

		filePath := filepath.Join(dest, f.Name)
		fileInfo := f.FileInfo()

		if fileInfo.IsDir() {
			err := os.MkdirAll(filePath, fileInfo.Mode())
			if err != nil {
				return err
			}
		} else {
			err := os.MkdirAll(filepath.Dir(filePath), 0755)
			if err != nil {
				return err
			}

			if fileInfo.Mode()&os.ModeSymlink != 0 {
				linkName, err := ioutil.ReadAll(rc)
				if err != nil {
					return err
				}
				return os.Symlink(string(linkName), filePath)
			}

			fileCopy, err := os.OpenFile(filePath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, fileInfo.Mode())
			if err != nil {
				return err
			}
			defer fileCopy.Close()

			_, err = io.Copy(fileCopy, rc)
			if err != nil {
				return err
			}
		}

		return nil
	}

	for _, f := range r.File {
		err := extractAndWriteFile(f)
		if err != nil {
			return err
		}
	}

	return nil
}
