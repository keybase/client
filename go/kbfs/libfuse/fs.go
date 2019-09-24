// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package libfuse

import (
	"net"
	"net/http"
	"net/http/pprof"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
	"golang.org/x/net/trace"
)

// FS implements the newfuse FS interface for KBFS.
type FS struct {
	config  libkbfs.Config
	fuse    *fs.Server
	conn    *fuse.Conn
	log     logger.Logger
	errLog  logger.Logger
	vlog    *libkb.VDebugLog
	errVlog *libkb.VDebugLog

	// Protects debugServerListener and debugServer.addr.
	debugServerLock     sync.Mutex
	debugServerListener net.Listener
	// An HTTP server used for debugging. Normally off unless
	// turned on via enableDebugServer().
	debugServer *http.Server

	notifications *libfs.FSNotifications

	// remoteStatus is the current status of remote connections.
	remoteStatus libfs.RemoteStatus

	// this is like time.AfterFunc, except that in some tests this can be
	// overridden to execute f without any delay.
	execAfterDelay func(d time.Duration, f func())

	root *Root

	platformParams PlatformParams

	quotaUsage *libkbfs.EventuallyConsistentQuotaUsage

	inodeLock sync.Mutex
	nextInode uint64
}

func makeTraceHandler(renderFn func(http.ResponseWriter, *http.Request, bool)) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, req *http.Request) {
		any, sensitive := trace.AuthRequest(req)
		if !any {
			http.Error(w, "not allowed", http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		renderFn(w, req, sensitive)
	}
}

// NewFS creates an FS. Note that this isn't the only constructor; see
// makeFS in libfuse/mount_test.go.
func NewFS(config libkbfs.Config, conn *fuse.Conn, debug bool,
	platformParams PlatformParams) *FS {
	log := config.MakeLogger("kbfsfuse")
	// We need extra depth for errors, so that we can report the line
	// number for the caller of processError, not processError itself.
	errLog := log.CloneWithAddedDepth(1)
	if debug {
		// Turn on debugging.  TODO: allow a proper log file and
		// style to be specified.
		log.Configure("", true, "")
		errLog.Configure("", true, "")
	}

	serveMux := http.NewServeMux()

	// Replicate the default endpoints from pprof's init function.
	serveMux.HandleFunc("/debug/pprof/", pprof.Index)
	serveMux.HandleFunc("/debug/pprof/cmdline", pprof.Cmdline)
	serveMux.HandleFunc("/debug/pprof/profile", pprof.Profile)
	serveMux.HandleFunc("/debug/pprof/symbol", pprof.Symbol)
	serveMux.HandleFunc("/debug/pprof/trace", pprof.Trace)

	// Replicate the default endpoints from net/trace's init function.
	serveMux.HandleFunc("/debug/requests", makeTraceHandler(func(w http.ResponseWriter, req *http.Request, sensitive bool) {
		trace.Render(w, req, sensitive)
	}))
	serveMux.HandleFunc("/debug/events", makeTraceHandler(trace.RenderEvents))

	// Leave Addr blank to be set in enableDebugServer() and
	// disableDebugServer().
	debugServer := &http.Server{
		Handler:      serveMux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	quLog := config.MakeLogger(libkbfs.QuotaUsageLogModule("FS"))
	fs := &FS{
		config:         config,
		conn:           conn,
		log:            log,
		errLog:         errLog,
		vlog:           config.MakeVLogger(log),
		errVlog:        config.MakeVLogger(errLog),
		debugServer:    debugServer,
		notifications:  libfs.NewFSNotifications(log),
		root:           NewRoot(),
		platformParams: platformParams,
		quotaUsage: libkbfs.NewEventuallyConsistentQuotaUsage(
			config, quLog, config.MakeVLogger(quLog)),
		nextInode: 2, // root is 1
	}
	fs.root.private = &FolderList{
		fs:      fs,
		tlfType: tlf.Private,
		folders: make(map[string]*TLF),
		inode:   fs.assignInode(),
	}
	fs.root.public = &FolderList{
		fs:      fs,
		tlfType: tlf.Public,
		folders: make(map[string]*TLF),
		inode:   fs.assignInode(),
	}
	fs.root.team = &FolderList{
		fs:      fs,
		tlfType: tlf.SingleTeam,
		folders: make(map[string]*TLF),
		inode:   fs.assignInode(),
	}
	fs.execAfterDelay = func(d time.Duration, f func()) {
		time.AfterFunc(d, f)
	}
	return fs
}

func (f *FS) assignInode() uint64 {
	f.inodeLock.Lock()
	defer f.inodeLock.Unlock()
	next := f.nextInode
	f.nextInode++
	return next
}

// tcpKeepAliveListener is copied from net/http/server.go, since it is
// used in http.(*Server).ListenAndServe() which we want to emulate in
// enableDebugServer.
type tcpKeepAliveListener struct {
	*net.TCPListener
}

func (tkal tcpKeepAliveListener) Accept() (c net.Conn, err error) {
	tc, err := tkal.AcceptTCP()
	if err != nil {
		return nil, err
	}
	err = tc.SetKeepAlive(true)
	if err != nil {
		return nil, err
	}
	err = tc.SetKeepAlivePeriod(3 * time.Minute)
	if err != nil {
		return nil, err
	}
	return tc, nil
}

func (f *FS) enableDebugServer(ctx context.Context, port uint16) error {
	f.debugServerLock.Lock()
	defer f.debugServerLock.Unlock()

	// Note that f.debugServer may be nil if f was created via
	// makeFS. But in that case we shouldn't be calling this
	// function then anyway.
	if f.debugServer.Addr != "" {
		return errors.Errorf("Debug server already enabled at %s",
			f.debugServer.Addr)
	}

	addr := net.JoinHostPort("localhost",
		strconv.FormatUint(uint64(port), 10))
	f.log.CDebugf(ctx, "Enabling debug http server at %s", addr)

	// Do Listen and Serve separately so we can catch errors with
	// the port (e.g. "port already in use") and return it.
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		f.log.CDebugf(ctx, "Got error when listening on %s: %+v",
			addr, err)
		return err
	}

	f.debugServer.Addr = addr
	f.debugServerListener =
		tcpKeepAliveListener{listener.(*net.TCPListener)}

	// This seems racy because the spawned goroutine may be
	// scheduled to run after disableDebugServer is called. But
	// that's okay since Serve will error out immediately after
	// f.debugServerListener.Close() is called.
	go func(server *http.Server, listener net.Listener) {
		err := server.Serve(listener)
		f.log.Debug("Debug http server ended with %+v", err)
	}(f.debugServer, f.debugServerListener)

	// TODO: Perhaps enable turning tracing on and off
	// independently from the debug server.
	f.config.SetTraceOptions(true)

	return nil
}

func (f *FS) disableDebugServer(ctx context.Context) error {
	f.debugServerLock.Lock()
	defer f.debugServerLock.Unlock()

	// Note that f.debugServer may be nil if f was created via
	// makeFS. But in that case we shouldn't be calling this
	// function then anyway.
	if f.debugServer.Addr == "" {
		return errors.New("Debug server already disabled")
	}

	f.log.CDebugf(ctx, "Disabling debug http server at %s",
		f.debugServer.Addr)
	// TODO: Use f.debugServer.Close() or f.debugServer.Shutdown()
	// when we switch to go 1.8.
	err := f.debugServerListener.Close()
	f.log.CDebugf(ctx, "Debug http server shutdown with %+v", err)

	// Assume the close succeeds in stopping the server, even if
	// it returns an error.
	f.debugServer.Addr = ""
	f.debugServerListener = nil

	f.config.SetTraceOptions(false)

	return err
}

// SetFuseConn sets fuse connection for this FS.
func (f *FS) SetFuseConn(fuse *fs.Server, conn *fuse.Conn) {
	f.fuse = fuse
	f.conn = conn
}

// NotificationGroupWait - wait on the notification group.
func (f *FS) NotificationGroupWait() {
	f.notifications.Wait()
}

func (f *FS) queueNotification(fn func()) {
	f.notifications.QueueNotification(fn)
}

// LaunchNotificationProcessor launches the notification processor.
func (f *FS) LaunchNotificationProcessor(ctx context.Context) {
	f.notifications.LaunchProcessor(ctx)
}

// WithContext adds app- and request-specific values to the context.
// libkbfs.NewContextWithCancellationDelayer is called before returning the
// context to ensure the cancellation is controllable.
//
// It is called by FUSE for normal runs, but may be called explicitly in other
// settings, such as tests.
func (f *FS) WithContext(ctx context.Context) context.Context {
	id, errRandomReqID := libkbfs.MakeRandomRequestID()
	if errRandomReqID != nil {
		f.log.Errorf("Couldn't make request ID: %v", errRandomReqID)
	}

	// context.WithDeadline uses clock from `time` package, so we are not using
	// f.config.Clock() here
	start := time.Now()
	ctx, err := libcontext.NewContextWithCancellationDelayer(
		libcontext.NewContextReplayable(ctx, func(ctx context.Context) context.Context {
			ctx = context.WithValue(ctx, libfs.CtxAppIDKey, f)
			logTags := make(logger.CtxLogTags)
			logTags[CtxIDKey] = CtxOpID
			ctx = logger.NewContextWithLogTags(ctx, logTags)

			if errRandomReqID == nil {
				// Add a unique ID to this context, identifying a particular
				// request.
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
				ctx, _ = context.WithDeadline(ctx, start.Add(19*time.Second))
			}

			return ctx

		}))

	if err != nil {
		panic(err) // this should never happen
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

	f.notifications.LaunchProcessor(ctx)
	f.remoteStatus.Init(ctx, f.log, f.config, f)
	// Blocks forever, unless an interrupt signal is received
	// (handled by libkbfs.Init).
	return srv.Serve(f)
}

// UserChanged is called from libfs.
func (f *FS) UserChanged(ctx context.Context, oldName, newName kbname.NormalizedUsername) {
	f.log.CDebugf(ctx, "User changed: %q -> %q", oldName, newName)
	f.root.public.userChanged(ctx, oldName, newName)
	f.root.private.userChanged(ctx, oldName, newName)
}

var _ libfs.RemoteStatusUpdater = (*FS)(nil)

var _ fs.FS = (*FS)(nil)

var _ fs.FSStatfser = (*FS)(nil)

func (f *FS) processError(ctx context.Context,
	mode libkbfs.ErrorModeType, err error) error {
	if err == nil {
		f.errVlog.CLogf(ctx, libkb.VLog1, "Request complete")
		return nil
	}

	f.config.Reporter().ReportErr(ctx, "", tlf.Private, mode, err)
	// We just log the error as debug, rather than error, because it
	// might just indicate an expected error such as an ENOENT.
	//
	// TODO: Classify errors and escalate the logging level of the
	// important ones.
	f.errLog.CDebugf(ctx, err.Error())
	return filterError(err)
}

// Root implements the fs.FS interface for FS.
func (f *FS) Root() (fs.Node, error) {
	return f.root, nil
}

// quotaUsageStaleTolerance is the lifespan of stale usage data that libfuse
// accepts in the Statfs handler. In other words, this causes libkbfs to issue
// a fresh RPC call if cached usage data is older than 10s.
const quotaUsageStaleTolerance = 10 * time.Second

// Statfs implements the fs.FSStatfser interface for FS.
func (f *FS) Statfs(ctx context.Context, req *fuse.StatfsRequest, resp *fuse.StatfsResponse) error {
	*resp = fuse.StatfsResponse{
		Bsize:   fuseBlockSize,
		Namelen: ^uint32(0),
		Frsize:  fuseBlockSize,
	}

	if f.remoteStatus.ExtraFileName() != "" {
		f.vlog.CLogf(
			ctx, libkb.VLog1,
			"Skipping quota usage check while errors are present")
		return nil
	}

	if session, err := idutil.GetCurrentSessionIfPossible(
		ctx, f.config.KBPKI(), true); err != nil {
		return err
	} else if session == (idutil.SessionInfo{}) {
		// If user is not logged in, don't bother getting quota info. Otherwise
		// reading a public TLF while logged out can fail on macOS.
		return nil
	}
	_, usageBytes, _, limitBytes, err := f.quotaUsage.Get(
		ctx, quotaUsageStaleTolerance/2, quotaUsageStaleTolerance)
	if err != nil {
		f.vlog.CLogf(ctx, libkb.VLog1, "Getting quota usage error: %v", err)
		return err
	}

	total := getNumBlocksFromSize(uint64(limitBytes))
	used := getNumBlocksFromSize(uint64(usageBytes))
	resp.Blocks = total
	resp.Bavail = total - used
	resp.Bfree = total - used

	return nil
}

// Root represents the root of the KBFS file system.
type Root struct {
	private *FolderList
	public  *FolderList
	team    *FolderList

	lookupLock sync.RWMutex
	lookupMap  map[tlf.Type]bool
}

// NewRoot creates a new root structure for KBFS FUSE mounts.
func NewRoot() *Root {
	return &Root{
		lookupMap: make(map[tlf.Type]bool),
	}
}

var _ fs.NodeAccesser = (*FolderList)(nil)

// Access implements fs.NodeAccesser interface for *Root.
func (*Root) Access(ctx context.Context, r *fuse.AccessRequest) error {
	if int(r.Uid) != os.Getuid() &&
		// Finder likes to use UID 0 for some operations. osxfuse already allows
		// ACCESS and GETXATTR requests from root to go through. This allows root
		// in ACCESS handler. See KBFS-1733 for more details.
		int(r.Uid) != 0 {
		// short path: not accessible by anybody other than root or the user who
		// executed the kbfsfuse process.
		return fuse.EPERM
	}

	if r.Mask&02 != 0 {
		return fuse.EPERM
	}

	return nil
}

var _ fs.Node = (*Root)(nil)

// Attr implements the fs.Node interface for Root.
func (*Root) Attr(ctx context.Context, a *fuse.Attr) error {
	a.Mode = os.ModeDir | 0500
	a.Inode = 1
	return nil
}

var _ fs.NodeRequestLookuper = (*Root)(nil)

// Lookup implements the fs.NodeRequestLookuper interface for Root.
func (r *Root) Lookup(ctx context.Context, req *fuse.LookupRequest, resp *fuse.LookupResponse) (_ fs.Node, err error) {
	r.private.fs.vlog.CLogf(ctx, libkb.VLog1, "FS Lookup %s", req.Name)
	defer func() { err = r.private.fs.processError(ctx, libkbfs.ReadMode, err) }()

	specialNode := handleNonTLFSpecialFile(
		req.Name, r.private.fs, &resp.EntryValid)
	if specialNode != nil {
		return specialNode, nil
	}

	platformNode, err := r.platformLookup(ctx, req, resp)
	if platformNode != nil || err != nil {
		return platformNode, err
	}

	r.lookupLock.Lock()
	defer r.lookupLock.Unlock()
	switch req.Name {
	case PrivateName:
		r.lookupMap[tlf.Private] = true
		return r.private, nil
	case PublicName:
		r.lookupMap[tlf.Public] = true
		return r.public, nil
	case TeamName:
		r.lookupMap[tlf.SingleTeam] = true
		return r.team, nil
	}

	// Don't want to pop up errors on special OS files.
	if strings.HasPrefix(req.Name, ".") {
		return nil, fuse.ENOENT
	}

	nameToLog := req.Name
	// This error is logged, but we don't have a handy obfuscator
	// here, so just log a special string to avoid exposing the user's
	// typos or misdirected lookups.
	if r.private.fs.config.Mode().DoLogObfuscation() {
		nameToLog = "<obfuscated>"
	}

	return nil, libkbfs.NoSuchFolderListError{
		Name:      req.Name,
		NameToLog: nameToLog,
		PrivName:  PrivateName,
		PubName:   PublicName,
	}
}

// PathType returns PathType for this folder
func (r *Root) PathType() tlfhandle.PathType {
	return tlfhandle.KeybasePathType
}

var _ fs.NodeCreater = (*Root)(nil)

// Create implements the fs.NodeCreater interface for Root.
func (r *Root) Create(ctx context.Context, req *fuse.CreateRequest, resp *fuse.CreateResponse) (_ fs.Node, _ fs.Handle, err error) {
	r.log().CDebugf(ctx, "FS Create")
	defer func() { err = r.private.fs.processError(ctx, libkbfs.WriteMode, err) }()
	if strings.HasPrefix(req.Name, "._") {
		// Quietly ignore writes to special macOS files, without
		// triggering a notification.
		return nil, nil, syscall.ENOENT
	}
	return nil, nil, libkbfs.NewWriteUnsupportedError(tlfhandle.BuildCanonicalPath(r.PathType(), req.Name))
}

// Mkdir implements the fs.NodeMkdirer interface for Root.
func (r *Root) Mkdir(ctx context.Context, req *fuse.MkdirRequest) (_ fs.Node, err error) {
	r.log().CDebugf(ctx, "FS Mkdir")
	defer func() { err = r.private.fs.processError(ctx, libkbfs.WriteMode, err) }()
	return nil, libkbfs.NewWriteUnsupportedError(tlfhandle.BuildCanonicalPath(r.PathType(), req.Name))
}

var _ fs.Handle = (*Root)(nil)

var _ fs.HandleReadDirAller = (*Root)(nil)

// ReadDirAll implements the ReadDirAll interface for Root.
func (r *Root) ReadDirAll(ctx context.Context) (res []fuse.Dirent, err error) {
	r.log().CDebugf(ctx, "FS ReadDirAll")
	defer func() { err = r.private.fs.processError(ctx, libkbfs.ReadMode, err) }()
	res = []fuse.Dirent{
		{
			Type: fuse.DT_Dir,
			Name: PrivateName,
		},
		{
			Type: fuse.DT_Dir,
			Name: PublicName,
		},
		{
			Type: fuse.DT_Dir,
			Name: TeamName,
		},
	}
	if r.private.fs.platformParams.shouldAppendPlatformRootDirs() {
		res = append(res, platformRootDirs...)
	}

	if name := r.private.fs.remoteStatus.ExtraFileName(); name != "" {
		res = append(res, fuse.Dirent{Type: fuse.DT_File, Name: name})
	}
	return res, nil
}

var _ fs.NodeSymlinker = (*Root)(nil)

// Symlink implements the fs.NodeSymlinker interface for Root.
func (r *Root) Symlink(
	_ context.Context, _ *fuse.SymlinkRequest) (fs.Node, error) {
	return nil, fuse.ENOTSUP
}

var _ fs.NodeLinker = (*Root)(nil)

// Link implements the fs.NodeLinker interface for Root.
func (r *Root) Link(
	_ context.Context, _ *fuse.LinkRequest, _ fs.Node) (fs.Node, error) {
	return nil, fuse.ENOTSUP
}

func (r *Root) log() logger.Logger {
	return r.private.fs.log
}
func (r *Root) openFileCount() (ret int64) {
	ret += r.private.openFileCount()
	ret += r.public.openFileCount()
	ret += r.team.openFileCount()

	r.lookupLock.RLock()
	defer r.lookupLock.RUnlock()
	return ret + int64(len(r.lookupMap))
}

func (r *Root) forgetFolderList(t tlf.Type) {
	// If the kernel ever forgets a folder list, reset the lookup
	// function for that type and decrement the lookup counter.
	r.lookupLock.Lock()
	defer r.lookupLock.Unlock()
	delete(r.lookupMap, t)
}
