package simplefs

import (
	"archive/zip"
	"io"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/pkg/errors"
)

type zipWriterWrapper struct {
	*zip.Writer
}

// AddDir is adapted from zip.Writer.AddFS in go1.22.0 source because 1) we're
// not on a version with this function yet, and 2) Go's AddFS doesn't support
// symlinks. We can get rid of this once we move to something higher with an
// AddFS supporting symlinks (see
// https://go-review.googlesource.com/c/go/+/385534 )
func (w *zipWriterWrapper) AddDir(dirPath string) error {
	fsys := os.DirFS(dirPath)
	return fs.WalkDir(fsys, ".", func(name string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		if !(info.Mode() &^ fs.ModeSymlink).IsRegular() {
			return errors.New("zip: cannot add non-regular file except symlink")
		}
		h, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		h.Name = name
		h.Method = zip.Deflate
		fw, err := w.CreateHeader(h)
		if err != nil {
			return err
		}
		switch {
		case info.Mode()&fs.ModeSymlink != 0:
			target, err := os.Readlink(filepath.Join(dirPath, name))
			if err != nil {
				return err
			}
			_, err = fw.Write([]byte(filepath.ToSlash(target)))
			if err != nil {
				return err
			}
			return nil
		default:
			f, err := fsys.Open(name)
			if err != nil {
				return err
			}
			defer f.Close()
			_, err = io.Copy(fw, f)
			return err
		}
	})
}
