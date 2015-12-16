// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"errors"
	"os"
	"strings"
	"sync"
	"syscall"

	"github.com/eapache/channels"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// FS implements the newfuse FS interface for KBFS.
type FS struct {
	config libkbfs.Config
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

	root *Root
}

// NewFS creates an FS
func NewFS(config libkbfs.Config, debug bool) *FS {
	log := logger.New("kbfsfuse", os.Stderr)
	if debug {
		// Turn on debugging.  TODO: allow a proper log file and
		// style to be specified.
		log.Configure("", true, "")
	}
	f := &FS{config: config, log: log}
	f.root = &Root{
		private: &FolderList{
			fs:      f,
			folders: make(map[string]*Dir),
		},
		public: &FolderList{
			fs:      f,
			public:  true,
			folders: make(map[string]*Dir),
		}}
	return f
}

var vinfo = dokan.VolumeInformation{
	VolumeName:             "KBFS",
	MaximumComponentLength: 0xFF, // This can be changed.
	FileSystemFlags: dokan.FileCasePreservedNames | dokan.FileCaseSensitiveSearch |
		dokan.FileUnicodeOnDisk | dokan.FileSupportsReparsePoints,
	FileSystemName: "KBFS",
}

// GetVolumeInformation returns information about the whole filesystem for dokan.
func (f *FS) GetVolumeInformation() (dokan.VolumeInformation, error) {
	return vinfo, nil
}

// GetDiskFreeSpace returns information about free space on the volume for dokan.
func (*FS) GetDiskFreeSpace() (dokan.FreeSpace, error) {
	return dokan.FreeSpace{}, nil
}

// createData stores the flags for CreateFile calls
type createData dokan.CreateData

// isCreation checks the flags whether a file creation is wanted, return false when caf=nil.
func (caf *createData) isCreateDirectory() bool {
	return caf.isCreation() && caf.CreateOptions&fileDirectoryFile != 0
}

const fileDirectoryFile = 1

// isCreation checks the flags whether a file creation is wanted, return false when caf=nil.
func (caf *createData) isCreation() bool {
	switch caf.CreateDisposition {
	case dokan.FILE_SUPERSEDE, dokan.FILE_CREATE, dokan.FILE_OPEN_IF, dokan.FILE_OVERWRITE_IF:
		return true
	}
	return false
}
func (caf *createData) isExistingError() bool {
	switch caf.CreateDisposition {
	case dokan.FILE_CREATE:
		return true
	}
	return false
}

// isTruncate checks the flags whether a file truncation is wanted, return false when caf=nil.
func (caf *createData) isTruncate() bool {
	switch caf.CreateDisposition {
	case dokan.FILE_SUPERSEDE, dokan.FILE_OVERWRITE, dokan.FILE_OVERWRITE_IF:
		return true
	}
	return false
}

// isOpenReparsePoint checks the flags whether a reparse point open is wanted, return false when caf=nil.
func (caf *createData) isOpenReparsePoint() bool {
	return caf.CreateOptions&syscall.FILE_FLAG_OPEN_REPARSE_POINT != 0
}

func (caf *createData) mayNotBeDirectory() bool {
	return caf.CreateOptions&dokan.FILE_NON_DIRECTORY_FILE != 0
}

// CreateFile called from dokan, may be a file or directory.
func (f *FS) CreateFile(fi *dokan.FileInfo, cd *dokan.CreateData) (dokan.File, bool, error) {
	return f.openRaw(fi, (*createData)(cd))
}

// openRaw is a wrapper between CreateFile/CreateDirectory/OpenDirectory and open
func (f *FS) openRaw(fi *dokan.FileInfo, caf *createData) (dokan.File, bool, error) {
	ps, err := pathSplit(fi.Path())
	if err != nil {
		return nil, false, err
	}
	file, isd, err := f.open(fi, ps, caf)
	if err != nil {
		err = errToDokan(err)
	}
	return file, isd, err
}

// open tries to open a file deferring to more specific implementations.
func (f *FS) open(fi *dokan.FileInfo, ps []string, caf *createData) (dokan.File, bool, error) {
	switch {
	case len(ps) < 1:
		return nil, false, dokan.ErrObjectNameNotFound
	case len(ps) == 1 && ps[0] == ``:
		if caf.mayNotBeDirectory() {
			return nil, true, dokan.ErrFileIsADirectory
		}
		return f.root, true, nil
	case libkbfs.ErrorFile == ps[len(ps)-1]:
		return NewErrorFile(f), false, nil
	case MetricsFileName == ps[len(ps)-1]:
		return NewMetricsFile(f), false, nil
	case PublicName == ps[0]:
		return f.root.public.open(fi, ps[1:], caf)
	case PrivateName == ps[0]:
		return f.root.private.open(fi, ps[1:], caf)
	}
	return nil, false, dokan.ErrObjectNameNotFound
}

func pathSplit(raw string) ([]string, error) {
	if raw == `` {
		raw = `\`
	}
	if raw[0] != '\\' {
		return nil, dokan.ErrObjectNameNotFound
	}
	return strings.Split(raw[1:], `\`), nil
}

// MoveFile tries to move a file.
func (f *FS) MoveFile(source *dokan.FileInfo, targetPath string, replaceExisting bool) (err error) {
	ctx := context.TODO()
	ctx = NewContextWithOpID(ctx, f.log)
	f.log.CDebugf(ctx, "Dir Rename")
	defer func() { f.reportErr(ctx, err) }()

	var cd createData
	cd.CreateDisposition = dokan.FILE_OPEN
	src, _, err := f.openRaw(source, &cd)
	if err != nil {
		return err
	}

	// Destination directory, not the destination file
	dstPath, err := pathSplit(targetPath)
	if err != nil {
		return err
	}
	if len(dstPath) < 1 {
		return errors.New("Invalid destination for move")
	}
	dstDirPath := dstPath[0 : len(dstPath)-1]

	dst, dstIsDir, err := f.open(nil, dstDirPath, &cd)
	if err != nil {
		return err
	}
	if !dstIsDir {
		return errors.New("Tried to move to a non-directory path")
	}

	ddst, ok := dst.(*Dir)
	if !ok {
		return errors.New("Destination directory is not of type Dir")
	}

	var srcFolder *Folder
	var srcParent libkbfs.Node
	var srcName string
	switch x := src.(type) {
	case *Dir:
		srcFolder = x.folder
		srcParent = x.parent
		srcName = x.name
	case *File:
		srcFolder = x.folder
		srcParent = x.parent
		srcName = x.name
	}

	if srcFolder != ddst.folder {
		return errors.New("Move only supported inside a top-level directory")
	}

	// here we race...
	if !replaceExisting {
		_, _, err := f.open(nil, dstPath, &cd)
		if err != dokan.ErrObjectPathNotFound {
			return errors.New("Refusing to replace existing target!")
		}

	}

	// overwritten node, if any, will be removed from Folder.nodes, if
	// it is there in the first place, by its Forget

	if err := srcFolder.fs.config.KBFSOps().Rename(
		ctx, srcParent, srcName, ddst.node, dstPath[len(dstPath)-1]); err != nil {
		return err
	}

	switch x := src.(type) {
	case *Dir:
		x.parent = ddst.node
	case *File:
		x.parent = ddst.node
	}

	return nil
}

// Mounted is called from dokan on unmount.
func (f *FS) Mounted() error {
	return nil
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
func (f *FS) Root() (dokan.File, error) {
	return f.root, nil
}

// Root represents the root of the KBFS file system.
type Root struct {
	emptyFile
	private *FolderList
	public  *FolderList
}

// GetFileInformation for dokan stats.
func (r *Root) GetFileInformation(*dokan.FileInfo) (*dokan.Stat, error) {
	return defaultDirectoryInformation()
}

// FindFiles for dokan readdir.
func (r *Root) FindFiles(fi *dokan.FileInfo, callback func(*dokan.NamedStat) error) error {
	var ns dokan.NamedStat
	ns.NumberOfLinks = 1
	ns.FileAttributes = fileAttributeDirectory
	ns.Name = PrivateName
	err := callback(&ns)
	if err != nil {
		return err
	}
	ns.Name = PublicName
	err = callback(&ns)
	return err
}
