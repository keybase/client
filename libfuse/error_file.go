package libfuse

import (
	"encoding/json"
	"sync"
	"time"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// ErrorFile represents a file containing the text of the most recent
// KBFS error.  Each instance saves exactly one immutable version of
// the set of errors.  This is because on OSX, we get an Attr call
// after the Open call (before the Read, which doesn't come here), and
// if Attr returns more bytes than Open put into the DataHandle, it
// will return a bunch of garbage after the error text.
type ErrorFile struct {
	fs   *FS
	once sync.Once
	data []byte
	time time.Time
}

var _ fs.Node = (*ErrorFile)(nil)

// jsonReportedEror stringifies the reported error before marshalling
type jsonReportedError struct {
	Level libkbfs.ReportingLevel
	Time  time.Time
	Error string
}

func (f *ErrorFile) saveEncodedErrors() error {
	var err error
	f.once.Do(func() {
		errors := f.fs.config.Reporter().AllKnownErrors()
		jsonErrors := make([]jsonReportedError, len(errors))
		for i, e := range errors {
			jsonErrors[i].Level = e.Level
			jsonErrors[i].Time = e.Time
			jsonErrors[i].Error = e.Error.String()
		}
		var mErrors []byte
		mErrors, err = json.MarshalIndent(jsonErrors, "", "  ")
		if err != nil {
			return
		}
		f.data = append(mErrors, '\n')

		// cache the more recent error time
		if len(errors) > 0 {
			f.time = errors[len(errors)-1].Time
		}
	})
	return err
}

// Attr implements the fs.Node interface for ErrorFile.
func (f *ErrorFile) Attr(ctx context.Context, a *fuse.Attr) error {
	if err := f.saveEncodedErrors(); err != nil {
		return err
	}
	a.Size = uint64(len(f.data))
	a.Mtime = f.time
	a.Ctime = f.time
	a.Mode = 0444
	return nil
}

var _ fs.Handle = (*ErrorFile)(nil)

var _ fs.NodeOpener = (*ErrorFile)(nil)

// Open implements the fs.NodeOpener interface for ErrorFile.
func (f *ErrorFile) Open(ctx context.Context, req *fuse.OpenRequest,
	resp *fuse.OpenResponse) (fs.Handle, error) {
	if err := f.saveEncodedErrors(); err != nil {
		return nil, err
	}

	return fs.DataHandle(f.data), nil
}
