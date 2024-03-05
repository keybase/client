package simplefs

import (
	"archive/zip"
	"io"
	"io/fs"

	"github.com/pkg/errors"
)

type zipWriterWrapper struct {
	*zip.Writer
}

// AddFS is copied from go1.22.0 source. We can get rid of this once we move
// upgrade to higher than go1.22.0.
func (w *zipWriterWrapper) AddFS(fsys fs.FS) error {
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
		if !info.Mode().IsRegular() {
			return errors.New("zip: cannot add non-regular file")
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
		f, err := fsys.Open(name)
		if err != nil {
			return err
		}
		defer f.Close()
		_, err = io.Copy(fw, f)
		return err
	})
}
