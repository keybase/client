package unzip

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
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

	if err := os.MkdirAll(dest, 0o755); err != nil {
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

		filePath := filepath.Join(dest, f.Name) //nolint:gosec // G305: Path traversal check on line 42

		// Prevent path traversal attacks (G305)
		if !strings.HasPrefix(filepath.Clean(filePath), filepath.Clean(dest)+string(os.PathSeparator)) {
			return fmt.Errorf("illegal file path: %s", f.Name)
		}

		fileInfo := f.FileInfo()

		if fileInfo.IsDir() {
			err := os.MkdirAll(filePath, fileInfo.Mode())
			if err != nil {
				return err
			}
		} else {
			err := os.MkdirAll(filepath.Dir(filePath), 0o755)
			if err != nil {
				return err
			}

			if fileInfo.Mode()&os.ModeSymlink != 0 {
				linkName, err := io.ReadAll(rc)
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

			// Limit decompression to prevent bombs (G110)
			const maxDecompressedSize = 500 * 1024 * 1024 // 500MB
			written, err := io.Copy(fileCopy, io.LimitReader(rc, maxDecompressedSize+1))
			if err != nil {
				return err
			}
			if written > maxDecompressedSize {
				return fmt.Errorf("file too large (>100MB): %s", f.Name)
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
