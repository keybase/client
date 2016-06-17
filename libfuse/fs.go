// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfuse

import (
	"os"
	"runtime"
	"strings"
	"sync"
	"time"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/eapache/channels"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// FS implements the newfuse FS interface for KBFS.
type FS struct {
	config libkbfs.Config
	fuse   *fs.Server
	conn   *fuse.Conn
	log    logger.Logger
	errLog logger.Logger

	// notifications is a channel for notification functions (which
	// take no value and have no return value).
	notifications channels.Channel

	// notificationGroup can be used by tests to know when libfuse is
	// done processing asynchronous notifications.
	notificationGroup sync.WaitGroup

	// protects access to the notifications channel member (though not
	// sending/receiving)
	notificationMutex sync.RWMutex

	// remoteStatus is the current status of remote connections.
	remoteStatus libfs.RemoteStatus
}

// NewFS creates an FS
func NewFS(config libkbfs.Config, conn *fuse.Conn, debug bool) *FS {
	log := config.MakeLogger("kbfsfuse")
	// We need extra depth for errors, so that we can report the line
	// number for the caller of reportErr, not reportErr itself.
	errLog := log.CloneWithAddedDepth(1)
	if debug {
		// Turn on debugging.  TODO: allow a proper log file and
		// style to be specified.
		log.Configure("", true, "")
		errLog.Configure("", true, "")
	}
	fs := &FS{config: config, conn: conn, log: log, errLog: errLog}
	return fs
}

// SetFuseConn sets fuse connection for this FS.
func (f *FS) SetFuseConn(fuse *fs.Server, conn *fuse.Conn) {
	f.fuse = fuse
	f.conn = conn
}

// NotificationGroupWait - wait on the notification group.
func (f *FS) NotificationGroupWait() {
	f.notificationGroup.Wait()
}

func (f *FS) processNotifications(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			f.notificationMutex.Lock()
			c := f.notifications
			f.log.CDebugf(ctx, "Nilling notifications channel")
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
			func() {
				defer f.notificationGroup.Done()
				notifyFn, ok := i.(func())
				if !ok {
					f.log.CWarningf(ctx, "Got a bad notification function: %v", i)
					return
				}
				notifyFn()
			}()
		}
	}
}

func (f *FS) queueNotification(fn func()) {
	channel := func() channels.Channel {
		f.notificationMutex.RLock()
		defer f.notificationMutex.RUnlock()
		return f.notifications
	}()
	if channel == nil {
		f.log.Warning("Ignoring notification, no available channel")
		return
	}
	f.notificationGroup.Add(1)
	channel.In() <- fn
}

// LaunchNotificationProcessor launches the  notification  processor.
func (f *FS) LaunchNotificationProcessor(ctx context.Context) {
	f.notificationMutex.Lock()
	defer f.notificationMutex.Unlock()

	f.log.CDebugf(ctx, "Launching notifications channel")
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

// WithContext adds app- and request-specific values to the context.
// It is called by FUSE for normal runs, but may be called explicitly
// in other settings, such as tests.
func (f *FS) WithContext(ctx context.Context) context.Context {
	ctx = context.WithValue(ctx, CtxAppIDKey, f)
	logTags := make(logger.CtxLogTags)
	logTags[CtxIDKey] = CtxOpID
	ctx = logger.NewContextWithLogTags(ctx, logTags)

	// Add a unique ID to this context, identifying a particular
	// request.
	id, err := libkbfs.MakeRandomRequestID()
	if err != nil {
		f.log.Errorf("Couldn't make request ID: %v", err)
	} else {
		ctx = context.WithValue(ctx, CtxIDKey, id)
	}

	if runtime.GOOS == "darwin" {
		// Timeout operations before they hit the osxfuse time limit,
		// so we don't hose the entire mount (Fixed in OSXFUSE 3.2.0).
		// The timeout is 60 seconds, but it looks like sometimes it
		// tries multiple attempts within that 60 seconds, so let's go
		// a little under 60/3 to be safe.
		//
		// It should be safe to ignore the CancelFunc here because our
		// parent context will be canceled by the FUSE serve loop.
		ctx, _ = context.WithTimeout(ctx, 19*time.Second)
	}

	return ctx
}

// Serve FS. Will block.
func (f *FS) Serve(ctx context.Context) error {
	srv := fs.New(f.conn, &fs.Config{
		WithContext: func(ctx context.Context, _ fuse.Request) context.Context {
			return f.WithContext(ctx)
		},
	})
	f.fuse = srv

	f.LaunchNotificationProcessor(ctx)
	f.remoteStatus.Init(ctx, f.log, f.config)
	// Blocks forever, unless an interrupt signal is received
	// (handled by libkbfs.Init).
	return srv.Serve(f)
}

var _ fs.FS = (*FS)(nil)

var _ fs.FSStatfser = (*FS)(nil)

func (f *FS) reportErr(ctx context.Context,
	mode libkbfs.ErrorModeType, err error) {
	if err == nil {
		f.errLog.CDebugf(ctx, "Request complete")
		return
	}

	f.config.Reporter().ReportErr(ctx, "", false, mode, err)
	// We just log the error as debug, rather than error, because it
	// might just indicate an expected error such as an ENOENT.
	//
	// TODO: Classify errors and escalate the logging level of the
	// important ones.
	f.errLog.CDebugf(ctx, err.Error())
}

// Root implements the fs.FS interface for FS.
func (f *FS) Root() (fs.Node, error) {
	n := &Root{
		private: &FolderList{
			fs:      f,
			folders: make(map[string]*TLF),
		},
		public: &FolderList{
			fs:      f,
			public:  true,
			folders: make(map[string]*TLF),
		},
	}
	return n, nil
}

// Statfs implements the fs.FSStatfser interface for FS.
func (f *FS) Statfs(ctx context.Context, req *fuse.StatfsRequest, resp *fuse.StatfsResponse) error {
	// TODO: Fill in real values for these.
	var bsize uint32 = 32 * 1024
	*resp = fuse.StatfsResponse{
		Blocks:  ^uint64(0) / uint64(bsize),
		Bfree:   ^uint64(0) / uint64(bsize),
		Bavail:  ^uint64(0) / uint64(bsize),
		Files:   0,
		Ffree:   0,
		Bsize:   bsize,
		Namelen: ^uint32(0),
		Frsize:  0,
	}
	return nil
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
	r.private.fs.log.CDebugf(ctx, "FS Lookup %s", req.Name)
	defer func() { r.private.fs.reportErr(ctx, libkbfs.ReadMode, err) }()

	specialNode := handleSpecialFile(req.Name, r.private.fs, resp)
	if specialNode != nil {
		return specialNode, nil
	}

	switch req.Name {
	case libfs.StatusFileName:
		return NewStatusFile(r.private.fs, nil, resp), nil
	case PrivateName:
		return r.private, nil
	case PublicName:
		return r.public, nil
	case libfs.HumanErrorFileName, libfs.HumanNoLoginFileName:
		resp.EntryValid = 0
		return &SpecialReadFile{r.private.fs.remoteStatus.NewSpecialReadFunc}, nil
	}

	// Don't want to pop up errors on special OS files.
	if strings.HasPrefix(req.Name, ".") {
		return nil, fuse.ENOENT
	}

	return nil, libkbfs.NoSuchFolderListError{
		Name:     req.Name,
		PrivName: PrivateName,
		PubName:  PublicName,
	}
}

var _ fs.Handle = (*Root)(nil)

var _ fs.HandleReadDirAller = (*Root)(nil)

// ReadDirAll implements the ReadDirAll interface for Root.
func (r *Root) ReadDirAll(ctx context.Context) (res []fuse.Dirent, err error) {
	r.private.fs.log.CDebugf(ctx, "FS ReadDirAll")
	defer func() { r.private.fs.reportErr(ctx, libkbfs.ReadMode, err) }()
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

	if name := r.private.fs.remoteStatus.ExtraFileName(); name != "" {
		res = append(res, fuse.Dirent{Type: fuse.DT_File, Name: name})
	}
	return res, nil
}
