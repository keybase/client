package libfuse

import (
	"os"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// FS implements the newfuse FS interface for KBFS.
type FS struct {
	config libkbfs.Config
	fuse   *fs.Server
	conn   *fuse.Conn
	log    logger.Logger
}

// NewFS creates an FS
func NewFS(config libkbfs.Config, conn *fuse.Conn, debug bool) FS {
	log := logger.New("kbfsfuse")
	if debug {
		// Turn on debugging.  TODO: allow a proper log file and
		// style to be specified.
		log.Configure("", true, "")
	}
	return FS{config: config, conn: conn, log: log}
}

// Serve FS. Will block.
func (f *FS) Serve(ctx context.Context) error {
	srv := fs.New(f.conn, &fs.Config{
		GetContext: func() context.Context {
			return ctx
		},
	})
	f.fuse = srv

	// Blocks forever, unless an interrupt signal is received
	// (handled by libkbfs.Init).
	return srv.Serve(f)
}

var _ fs.FS = (*FS)(nil)

func (f *FS) reportErr(ctx context.Context, err error) {
	if err == nil {
		f.log.CDebugf(ctx, "Request complete")
		return
	}

	f.config.Reporter().Report(libkbfs.RptE, libkbfs.WrapError{Err: err})
	// We just log the error as debug, rather than error, because it
	// might just indicate an expected error such as an ENOENT.
	//
	// TODO: Classify errors and escalate the logging level of the
	// important ones.
	f.log.CDebugf(ctx, err.Error())
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
	ctx = NewContextWithOpID(ctx)
	r.private.fs.log.CDebugf(ctx, "FS Lookup %s", req.Name)
	defer func() { r.private.fs.reportErr(ctx, err) }()
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
	ctx = NewContextWithOpID(ctx)
	r.private.fs.log.CDebugf(ctx, "FS ReadDirAll")
	defer func() { r.private.fs.reportErr(ctx, err) }()
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
