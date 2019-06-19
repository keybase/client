package libfs

import (
	"net/http"
	"os"
	"strings"

	"github.com/pkg/errors"
	billy "gopkg.in/src-d/go-billy.v4"
)

type httpRootFileSystem struct {
	rfs *RootFS
}

var _ http.FileSystem = httpRootFileSystem{}

type fileOnly struct {
	billy.File
	rfs *RootFS
}

// Readdir implements the http.File interface.
func (fo fileOnly) Readdir(count int) ([]os.FileInfo, error) {
	return nil, errors.New("not supported")
}

// Stat implements the http.File interface.
func (fo fileOnly) Stat() (os.FileInfo, error) {
	return fo.rfs.Stat(fo.File.Name())
}

func (hrfs httpRootFileSystem) Open(filename string) (entry http.File, err error) {
	hrfs.rfs.log.CDebugf(hrfs.rfs.ctx, "hfs.Open %s", filename)
	defer func() {
		hrfs.rfs.log.CDebugf(hrfs.rfs.ctx, "hfs.Open done: %+v", err)
		if err != nil {
			err = translateErr(err)
		}
	}()

	if strings.HasPrefix(filename, "/") {
		filename = filename[1:]
	}

	f, err := hrfs.rfs.Open(filename)
	if err != nil {
		return nil, err
	}

	return fileOnly{File: f, rfs: hrfs.rfs}, nil
}
