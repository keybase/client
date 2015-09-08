package libfuse

import (
	"os"
	"sync"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/eapache/channels"
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

	// notifications is a channel for notification functions (which
	// take no value and have no return value).
	notifications channels.Channel

	// notificationGroup can be used by tests to know when libfuse is
	// done processing asynchronous notifications.
	notificationGroup sync.WaitGroup

	// protects access to the notifications channel member (though not
	// sending/receiving)
	notificationMutex sync.RWMutex
}

// NewFS creates an FS
func NewFS(config libkbfs.Config, conn *fuse.Conn, debug bool) *FS {
	log := logger.New("kbfsfuse")
	if debug {
		// Turn on debugging.  TODO: allow a proper log file and
		// style to be specified.
		log.Configure("", true, "")
	}
	return &FS{config: config, conn: conn, log: log}
}

func (f *FS) processNotifications(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			f.notificationMutex.Lock()
			c := f.notifications
			f.notifications = nil
			f.notificationMutex.Unlock()
			c.Close()
			for range c.Out() {
				// Drain the output queue to allow the Channel close
				// Out() and shutdown any goroutines.
				f.log.CWarningf(ctx,
					"Throwing away notification after shutdown")
			}
			return
		case i := <-f.notifications.Out():
			notifyFn, ok := i.(func())
			if !ok {
				f.log.CWarningf(ctx, "Got a bad notification function: %v", i)
				continue
			}
			notifyFn()
			f.notificationGroup.Done()
		}
	}
}

func (f *FS) queueNotification(fn func()) {
	f.notificationGroup.Add(1)
	f.notificationMutex.RLock()
	if f.notifications == nil {
		f.log.Warning("Ignoring notification, no available channel")
		return
	}
	f.notificationMutex.RUnlock()
	f.notifications.In() <- fn
}

func (f *FS) launchNotificationProcessor(ctx context.Context) {
	f.notificationMutex.Lock()
	defer f.notificationMutex.Unlock()

	// The notifications channel needs to have "infinite" capacity,
	// because otherwise we risk a deadlock between libkbfs and
	// libfuse.  The notification processor sends invalidates to the
	// kernel.  In osxfuse 3.X, the kernel can call back into userland
	// during an invalidate (a GetAttr()) call, which in turn takes
	// locks within libkbfs.  So if libkbfs ever gets blocked while
	// trying to enqueue a notification (while it is holding locks),
	// we could have a deadlock.  Yes, if there are too many
	// outstanding notifications we'll run out of memory and crash,
	// but otherwise we risk deadlock.  Which is worse?
	f.notifications = channels.NewInfiniteChannel()

	// start the notification processor
	go f.processNotifications(ctx)
}

// Serve FS. Will block.
func (f *FS) Serve(ctx context.Context) error {
	srv := fs.New(f.conn, &fs.Config{
		GetContext: func() context.Context {
			return ctx
		},
	})
	f.fuse = srv

	f.launchNotificationProcessor(ctx)

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
	ctx = NewContextWithOpID(ctx, r.private.fs.log)
	r.private.fs.log.CDebugf(ctx, "FS Lookup %s", req.Name)
	defer func() { r.private.fs.reportErr(ctx, err) }()
	switch req.Name {
	case PrivateName:
		return r.private, nil
	case PublicName:
		return r.public, nil
	case libkbfs.ErrorFile:
		return NewErrorFile(r.private.fs, resp), nil
	case MetricsFileName:
		return NewMetricsFile(r.private.fs, resp), nil
	}
	return nil, fuse.ENOENT
}

var _ fs.Handle = (*Root)(nil)

var _ fs.HandleReadDirAller = (*Root)(nil)

// ReadDirAll implements the ReadDirAll interface for Root.
func (r *Root) ReadDirAll(ctx context.Context) (res []fuse.Dirent, err error) {
	ctx = NewContextWithOpID(ctx, r.private.fs.log)
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
