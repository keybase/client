package main

import (
	"log"
	"os"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

func logMsg(msg interface{}) {
	log.Printf("FUSE: %s\n", msg)
}

func runNewFUSE(ctx context.Context, config libkbfs.Config, debug bool,
	mountpoint string) error {
	if debug {
		fuse.Debug = logMsg
	}

	c, err := fuse.Mount(mountpoint)
	if err != nil {
		return err
	}
	defer c.Close()

	filesys := &FS{
		config: config,
		conn:   c,
	}
	ctx = context.WithValue(ctx, ctxAppIDKey, filesys)

	srv := fs.New(c, &fs.Config{
		GetContext: func() context.Context {
			return ctx
		},
	})
	filesys.fuse = srv

	if err := srv.Serve(filesys); err != nil {
		return err
	}

	// check if the mount process has an error to report
	<-c.Ready
	if err := c.MountError; err != nil {
		return err
	}

	return nil
}

// FS implements the newfuse FS interface for KBFS.
type FS struct {
	config libkbfs.Config
	fuse   *fs.Server
	conn   *fuse.Conn
}

var _ fs.FS = (*FS)(nil)

func (f *FS) reportErr(err error) {
	if err == nil {
		return
	}

	f.config.Reporter().Report(libkbfs.RptE, libkbfs.WrapError{Err: err})
}

// Root implements the fs.FS interface for FS.
func (f *FS) Root() (fs.Node, error) {
	n := &Root{
		private: &FolderList{
			fs:      f,
			folders: make(map[string]*Dir),
		},
		public: &FolderList{
			fs:      f,
			public:  true,
			folders: make(map[string]*Dir),
		},
	}
	return n, nil
}

// Root represents the root of the KBFS file system.
type Root struct {
	private *FolderList
	public  *FolderList
}

var _ fs.Node = (*Root)(nil)

// Attr implements the fs.Node interface for Root.
func (*Root) Attr(ctx context.Context, a *fuse.Attr) error {
	a.Mode = os.ModeDir | 0755
	return nil
}

var _ fs.NodeRequestLookuper = (*Root)(nil)

// Lookup implements the fs.NodeRequestLookuper interface for Root.
func (r *Root) Lookup(ctx context.Context, req *fuse.LookupRequest, resp *fuse.LookupResponse) (node fs.Node, err error) {
	defer func() { r.private.fs.reportErr(err) }()
	switch req.Name {
	case PrivateName:
		return r.private, nil
	case PublicName:
		return r.public, nil
	case libkbfs.ErrorFile:
		resp.EntryValid = 0
		n := &ErrorFile{
			fs: r.private.fs,
		}
		return n, nil
	}
	return nil, fuse.ENOENT
}

var _ fs.Handle = (*Root)(nil)

var _ fs.HandleReadDirAller = (*Root)(nil)

// ReadDirAll implements the ReadDirAll interface for Root.
func (r *Root) ReadDirAll(ctx context.Context) (res []fuse.Dirent, err error) {
	defer func() { r.private.fs.reportErr(err) }()
	res = []fuse.Dirent{
		{
			Type: fuse.DT_Dir,
			Name: PrivateName,
		},
		{
			Type: fuse.DT_Dir,
			Name: PublicName,
		},
	}
	return res, nil
}
