// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/dokan/winacl"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

// FS implements the newfuse FS interface for KBFS.
type FS struct {
	config libkbfs.Config
	log    logger.Logger
	// renameAndDeletionLock should be held when doing renames or deletions.
	renameAndDeletionLock sync.Mutex

	notifications *libfs.FSNotifications

	root *Root

	// remoteStatus is the current status of remote connections.
	remoteStatus libfs.RemoteStatus

	quotaUsage *libkbfs.EventuallyConsistentQuotaUsage
}

// DefaultMountFlags are the default mount flags for libdokan.
const DefaultMountFlags = dokan.CurrentSession

// currentUserSID stores the Windows identity of the user running
// this process. This is the same process-wide.
var currentUserSID, currentUserSIDErr = winacl.CurrentProcessUserSid()
var currentGroupSID, _ = winacl.CurrentProcessPrimaryGroupSid()

// NewFS creates an FS
func NewFS(ctx context.Context, config libkbfs.Config, log logger.Logger) (*FS, error) {
	if currentUserSIDErr != nil {
		return nil, currentUserSIDErr
	}
	f := &FS{
		config:        config,
		log:           log,
		notifications: libfs.NewFSNotifications(log),
		quotaUsage:    libkbfs.NewEventuallyConsistentQuotaUsage(config, "FS"),
	}

	f.root = &Root{
		private: &FolderList{
			fs:         f,
			tlfType:    tlf.Private,
			folders:    make(map[string]fileOpener),
			aliasCache: map[string]string{},
		},
		public: &FolderList{
			fs:         f,
			tlfType:    tlf.Public,
			folders:    make(map[string]fileOpener),
			aliasCache: map[string]string{},
		},
		team: &FolderList{
			fs:         f,
			tlfType:    tlf.SingleTeam,
			folders:    make(map[string]fileOpener),
			aliasCache: map[string]string{},
		}}

	ctx = wrapContext(ctx, f)

	f.remoteStatus.Init(ctx, f.log, f.config, f)
	f.notifications.LaunchProcessor(ctx)
	go clearFolderListCacheLoop(ctx, f.root)

	return f, nil
}

// Adds log tags etc
func wrapContext(ctx context.Context, f *FS) context.Context {
	ctx = context.WithValue(ctx, libfs.CtxAppIDKey, f)
	logTags := make(logger.CtxLogTags)
	logTags[CtxIDKey] = CtxOpID
	ctx = logger.NewContextWithLogTags(ctx, logTags)
	return ctx
}

// WithContext creates context for filesystem operations.
func (f *FS) WithContext(ctx context.Context) (context.Context, context.CancelFunc) {
	id, err := libkbfs.MakeRandomRequestID()
	if err != nil {
		f.log.Errorf("Couldn't make request ID: %v", err)
		return ctx, func() {}
	}

	ctx, cancel := context.WithCancel(ctx)

	// context.WithDeadline uses clock from `time` package, so we are not using
	// f.config.Clock() here
	start := time.Now()
	ctx, err = libkbfs.NewContextWithCancellationDelayer(
		libkbfs.NewContextReplayable(ctx, func(ctx context.Context) context.Context {
			ctx = wrapContext(context.WithValue(ctx, CtxIDKey, id), f)
			ctx, _ = context.WithDeadline(ctx, start.Add(29*time.Second))
			return ctx
		}))
	if err != nil {
		panic(err)
	}
	return ctx, cancel
}

var vinfo = dokan.VolumeInformation{
	VolumeName:             "KBFS",
	MaximumComponentLength: 0xFF, // This can be changed.
	FileSystemFlags: dokan.FileCasePreservedNames | dokan.FileCaseSensitiveSearch |
		dokan.FileUnicodeOnDisk | dokan.FileSupportsReparsePoints |
		dokan.FileSupportsRemoteStorage,
	FileSystemName: "KBFS",
}

// GetVolumeInformation returns information about the whole filesystem for dokan.
func (f *FS) GetVolumeInformation(ctx context.Context) (dokan.VolumeInformation, error) {
	// TODO should this be explicitely refused to other users?
	// As the mount is limited to current session there is little need.
	return vinfo, nil
}

const dummyFreeSpace = 10 * 1024 * 1024 * 1024

// quotaUsageStaleTolerance is the lifespan of stale usage data that libfuse
// accepts in the Statfs handler. In other words, this causes libkbfs to issue
// a fresh RPC call if cached usage data is older than 10s.
const quotaUsageStaleTolerance = 10 * time.Second

// GetDiskFreeSpace returns information about free space on the volume for dokan.
func (f *FS) GetDiskFreeSpace(ctx context.Context) (freeSpace dokan.FreeSpace, err error) {
	// TODO should this be refused to other users?
	// As the mount is limited to current session there is little need.
	f.logEnter(ctx, "FS GetDiskFreeSpace")
	// Refuse private directories while we are in a error state.
	if f.remoteStatus.ExtraFileName() != "" {
		f.log.Warning("Dummy disk free space while errors are present!")
		return dokan.FreeSpace{
			TotalNumberOfBytes:     dummyFreeSpace,
			TotalNumberOfFreeBytes: dummyFreeSpace,
			FreeBytesAvailable:     dummyFreeSpace,
		}, nil
	}
	defer func() {
		if err == nil {
			f.log.CDebugf(ctx, "Request complete")
		} else {
			// Don't report the error (perhaps resulting in a user
			// notification) since this method is mostly called by the
			// OS and not because of a user action.
			f.log.CDebugf(ctx, err.Error())
		}
	}()
	_, usageBytes, limitBytes, err := f.quotaUsage.Get(
		ctx, quotaUsageStaleTolerance/2, quotaUsageStaleTolerance)
	if err != nil {
		return dokan.FreeSpace{}, errToDokan(err)
	}
	free := uint64(limitBytes - usageBytes)
	return dokan.FreeSpace{
		TotalNumberOfBytes:     uint64(limitBytes),
		TotalNumberOfFreeBytes: free,
		FreeBytesAvailable:     free,
	}, nil
}

// openContext is for opening files.
type openContext struct {
	fi *dokan.FileInfo
	*dokan.CreateData
	redirectionsLeft int
	// isUppercasePath marks a path containing only upper case letters,
	// associated with e.g. resolving some reparse points. This has
	// special case insensitive path resolving functionality.
	isUppercasePath bool
}

// reduceRedictionsLeft reduces redirections and returns whether there are
// redirections left (true), or whether processing should be stopped (false).
func (oc *openContext) reduceRedirectionsLeft() bool {
	oc.redirectionsLeft--
	return oc.redirectionsLeft > 0
}

// isCreation checks the flags whether a file creation is wanted.
func (oc *openContext) isCreateDirectory() bool {
	return oc.isCreation() && oc.CreateOptions&fileDirectoryFile != 0
}

const fileDirectoryFile = 1

// isCreation checks the flags whether a file creation is wanted.
func (oc *openContext) isCreation() bool {
	switch oc.CreateDisposition {
	case dokan.FileSupersede, dokan.FileCreate, dokan.FileOpenIf, dokan.FileOverwriteIf:
		return true
	}
	return false
}
func (oc *openContext) isExistingError() bool {
	switch oc.CreateDisposition {
	case dokan.FileCreate:
		return true
	}
	return false
}

// isTruncate checks the flags whether a file truncation is wanted.
func (oc *openContext) isTruncate() bool {
	switch oc.CreateDisposition {
	case dokan.FileSupersede, dokan.FileOverwrite, dokan.FileOverwriteIf:
		return true
	}
	return false
}

// isOpenReparsePoint checks the flags whether a reparse point open is wanted.
func (oc *openContext) isOpenReparsePoint() bool {
	return oc.CreateOptions&dokan.FileOpenReparsePoint != 0
}

// returnDirNoCleanup returns a dir or nothing depending on the open
// flags and does not call .Cleanup on error.
func (oc *openContext) returnDirNoCleanup(f dokan.File) (dokan.File, bool, error) {
	if err := oc.ReturningDirAllowed(); err != nil {
		return nil, true, err
	}
	return f, true, nil
}

// returnFileNoCleanup returns a file or nothing depending on the open
// flags and does not call .Cleanup on error.
func (oc *openContext) returnFileNoCleanup(f dokan.File) (dokan.File, bool, error) {
	if err := oc.ReturningFileAllowed(); err != nil {
		return nil, false, err
	}
	return f, false, nil
}

func (oc *openContext) mayNotBeDirectory() bool {
	return oc.CreateOptions&dokan.FileNonDirectoryFile != 0
}

func newSyntheticOpenContext() *openContext {
	var oc openContext
	oc.CreateData = &dokan.CreateData{}
	oc.CreateDisposition = dokan.FileOpen
	oc.redirectionsLeft = 30
	return &oc
}

// CreateFile called from dokan, may be a file or directory.
func (f *FS) CreateFile(ctx context.Context, fi *dokan.FileInfo, cd *dokan.CreateData) (dokan.File, bool, error) {
	// Only allow the current user access
	if !fi.IsRequestorUserSidEqualTo(currentUserSID) {
		f.log.Errorf("FS CreateFile - Refusing real access: SID match error")
		return openFakeRoot(ctx, f, fi)
	}
	f.logEnter(ctx, "FS CreateFile")
	return f.openRaw(ctx, fi, cd)
}

// openRaw is a wrapper between CreateFile/CreateDirectory/OpenDirectory and open
func (f *FS) openRaw(ctx context.Context, fi *dokan.FileInfo, caf *dokan.CreateData) (dokan.File, bool, error) {
	ps, err := windowsPathSplit(fi.Path())
	if err != nil {
		return nil, false, err
	}
	oc := openContext{fi: fi, CreateData: caf, redirectionsLeft: 30}
	file, isd, err := f.open(ctx, &oc, ps)
	if err != nil {
		err = errToDokan(err)
	}
	return file, isd, err
}

// open tries to open a file deferring to more specific implementations.
func (f *FS) open(ctx context.Context, oc *openContext, ps []string) (dokan.File, bool, error) {
	f.log.CDebugf(ctx, "open: %#v", ps)
	psl := len(ps)
	switch {
	case psl < 1:
		return nil, false, dokan.ErrObjectNameNotFound
	case psl == 1 && ps[0] == ``:
		return oc.returnDirNoCleanup(f.root)

		// This section is equivalent to
		// handleCommonSpecialFile in libfuse.
	case libkbfs.ErrorFile == ps[psl-1]:
		return oc.returnFileNoCleanup(NewErrorFile(f))
	case libfs.MetricsFileName == ps[psl-1]:
		return oc.returnFileNoCleanup(NewMetricsFile(f))
		// TODO: Make the two cases below available from any
		// directory.
	case libfs.ProfileListDirName == ps[0]:
		return (ProfileList{fs: f}).open(ctx, oc, ps[1:])
	case libfs.ResetCachesFileName == ps[0]:
		return oc.returnFileNoCleanup(&ResetCachesFile{fs: f.root.private.fs})

		// This section is equivalent to
		// handleNonTLFSpecialFile in libfuse.
		//
		// TODO: Make the two cases below available from any
		// non-TLF directory.
	case libfs.StatusFileName == ps[0]:
		return oc.returnFileNoCleanup(NewNonTLFStatusFile(f.root.private.fs))
	case libfs.HumanErrorFileName == ps[0], libfs.HumanNoLoginFileName == ps[0]:
		return oc.returnFileNoCleanup(&SpecialReadFile{
			read: f.remoteStatus.NewSpecialReadFunc,
			fs:   f})

	case libfs.EnableAutoJournalsFileName == ps[0]:
		return oc.returnFileNoCleanup(&JournalControlFile{
			folder: &Folder{fs: f}, // fake Folder for logging, etc.
			action: libfs.JournalEnableAuto,
		})
	case libfs.DisableAutoJournalsFileName == ps[0]:
		return oc.returnFileNoCleanup(&JournalControlFile{
			folder: &Folder{fs: f}, // fake Folder for logging, etc.
			action: libfs.JournalDisableAuto,
		})
	case libfs.EnableBlockPrefetchingFileName == ps[0]:
		return oc.returnFileNoCleanup(&PrefetchFile{
			fs:     f,
			enable: true,
		})
	case libfs.DisableBlockPrefetchingFileName == ps[0]:
		return oc.returnFileNoCleanup(&PrefetchFile{
			fs:     f,
			enable: false,
		})

	case ".kbfs_unmount" == ps[0]:
		os.Exit(0)
	case ".kbfs_number_of_handles" == ps[0]:
		x := stringReadFile(strconv.Itoa(int(oc.fi.NumberOfFileHandles())))
		return oc.returnFileNoCleanup(x)
	// TODO
	// Unfortunately sometimes we end up in this case while using
	// reparse points.
	case strings.ToUpper(PublicName) == ps[0]:
		oc.isUppercasePath = true
		fallthrough
	case PublicName == ps[0]:
		// Refuse private directories while we are in a a generic error state.
		if f.remoteStatus.ExtraFileName() == libfs.HumanErrorFileName {
			f.log.CWarningf(ctx, "Refusing access to public directory while errors are present!")
			return nil, false, dokan.ErrAccessDenied
		}
		return f.root.public.open(ctx, oc, ps[1:])
	case strings.ToUpper(PrivateName) == ps[0]:
		oc.isUppercasePath = true
		fallthrough
	case PrivateName == ps[0]:
		// Refuse private directories while we are in a error state.
		if f.remoteStatus.ExtraFileName() != "" {
			f.log.CWarningf(ctx, "Refusing access to private directory while errors are present!")
			return nil, false, dokan.ErrAccessDenied
		}
		return f.root.private.open(ctx, oc, ps[1:])
	case strings.ToUpper(TeamName) == ps[0]:
		oc.isUppercasePath = true
		fallthrough
	case TeamName == ps[0]:
		// Refuse team directories while we are in a error state.
		if f.remoteStatus.ExtraFileName() != "" {
			f.log.CWarningf(ctx, "Refusing access to team directory while errors are present!")
			return nil, false, dokan.ErrAccessDenied
		}
		return f.root.team.open(ctx, oc, ps[1:])
	}
	return nil, false, dokan.ErrObjectNameNotFound
}

// windowsPathSplit handles paths we get from Dokan.
// As a special case `` means `\`, it gets generated
// on special occasions.
func windowsPathSplit(raw string) ([]string, error) {
	if raw == `` {
		raw = `\`
	}
	if raw[0] != '\\' || raw[len(raw)-1] == '*' {
		return nil, dokan.ErrObjectNameNotFound
	}
	return strings.Split(raw[1:], `\`), nil
}

// ErrorPrint prints errors from the Dokan library.
func (f *FS) ErrorPrint(err error) {
	f.log.Errorf("Dokan error: %v", err)
}

// MoveFile tries to move a file.
func (f *FS) MoveFile(ctx context.Context, src dokan.File, sourceFI *dokan.FileInfo, targetPath string, replaceExisting bool) (err error) {
	// User checking was handled by original file open, this is no longer true.
	// However we only allow fake files with names that are not potential rename
	// paths. Filter those out here.

	f.log.CDebugf(ctx, "MoveFile %T %q -> %q", src, sourceFI.Path(), targetPath)
	// isPotentialRenamePath filters out some special paths
	// for rename. Especially those provided by fakeroot.go.
	if !isPotentialRenamePath(sourceFI.Path()) {
		f.log.Errorf("Refusing MoveFile access: not potential rename path")
		return dokan.ErrAccessDenied
	}
	switch src.(type) {
	case *FolderList, *File, *Dir, *TLF, *EmptyFolder:
	default:
		f.log.Errorf("Refusing MoveFile access: wrong type source argument")
		return dokan.ErrAccessDenied
	}

	f.logEnter(ctx, "FS MoveFile")
	// No racing deletions or renames.
	// Note that this calls Cleanup multiple times, however with nil
	// FileInfo which means that Cleanup will not try to lock renameAndDeletionLock.
	// renameAndDeletionLock should be the first lock to be grabbed in libdokan.
	f.renameAndDeletionLock.Lock()
	defer func() {
		f.renameAndDeletionLock.Unlock()
		f.reportErr(ctx, libkbfs.WriteMode, err)
	}()

	oc := newSyntheticOpenContext()

	// Source directory
	srcDirPath, err := windowsPathSplit(sourceFI.Path())
	if err != nil {
		return err
	}
	if len(srcDirPath) < 1 {
		return errors.New("Invalid source for move")
	}
	srcName := srcDirPath[len(srcDirPath)-1]
	srcDirPath = srcDirPath[0 : len(srcDirPath)-1]
	srcDir, _, err := f.open(ctx, oc, srcDirPath)
	if err != nil {
		return err
	}
	defer srcDir.Cleanup(ctx, nil)

	// Destination directory, not the destination file
	dstPath, err := windowsPathSplit(targetPath)
	if err != nil {
		return err
	}
	if len(dstPath) < 1 {
		return errors.New("Invalid destination for move")
	}
	dstDirPath := dstPath[0 : len(dstPath)-1]

	dstDir, dstIsDir, err := f.open(ctx, oc, dstDirPath)
	f.log.CDebugf(ctx, "FS MoveFile dstDir open %v -> %v,%v,%v dstType %T", dstDirPath, dstDir, dstIsDir, err, dstDir)
	if err != nil {
		return err
	}
	defer dstDir.Cleanup(ctx, nil)
	if !dstIsDir {
		return errors.New("Tried to move to a non-directory path")
	}

	fl1, ok := srcDir.(*FolderList)
	fl2, ok2 := dstDir.(*FolderList)
	if ok && ok2 && fl1 == fl2 {
		return f.folderListRename(ctx, fl1, oc, src, srcName, dstPath, replaceExisting)
	}

	srcDirD := asDir(ctx, srcDir)
	if srcDirD == nil {
		return errors.New("Parent of src not a Dir")
	}
	srcFolder := srcDirD.folder
	srcParent := srcDirD.node

	ddst := asDir(ctx, dstDir)
	if ddst == nil {
		return errors.New("Destination directory is not of type Dir")
	}

	switch src.(type) {
	case *Dir:
	case *File:
	case *TLF:
	default:
		return dokan.ErrAccessDenied
	}

	// here we race...
	if !replaceExisting {
		x, _, err := f.open(ctx, oc, dstPath)
		if err == nil {
			defer x.Cleanup(ctx, nil)
		}
		if !isNoSuchNameError(err) {
			f.log.CDebugf(ctx, "FS MoveFile required non-existent destination, got: %T %v", err, err)
			return dokan.ErrObjectNameCollision
		}

	}

	if srcFolder != ddst.folder {
		return dokan.ErrNotSameDevice
	}

	// overwritten node, if any, will be removed from Folder.nodes, if
	// it is there in the first place, by its Forget

	dstName := dstPath[len(dstPath)-1]
	f.log.CDebugf(ctx, "FS MoveFile KBFSOps().Rename(ctx,%v,%v,%v,%v)", srcParent, srcName, ddst.node, dstName)
	if err := srcFolder.fs.config.KBFSOps().Rename(
		ctx, srcParent, srcName, ddst.node, dstName); err != nil {
		f.log.CDebugf(ctx, "FS MoveFile KBFSOps().Rename FAILED %v", err)
		return err
	}

	switch x := src.(type) {
	case *Dir:
		x.parent = ddst.node
		x.name = dstName
	case *File:
		x.parent = ddst.node
		x.name = dstName
	}

	f.log.CDebugf(ctx, "FS MoveFile SUCCESS")
	return nil
}

func isPotentialRenamePath(s string) bool {
	if len(s) < 3 || s[0] != '\\' {
		return false
	}
	s = s[1:]
	return strings.HasPrefix(s, PrivateName) ||
		strings.HasPrefix(s, PublicName) ||
		strings.HasPrefix(s, TeamName)
}

func (f *FS) folderListRename(ctx context.Context, fl *FolderList, oc *openContext, src dokan.File, srcName string, dstPath []string, replaceExisting bool) error {
	ef, ok := src.(*EmptyFolder)
	f.log.CDebugf(ctx, "FS MoveFile folderlist %v", ef)
	if !ok || !isNewFolderName(srcName) {
		return dokan.ErrAccessDenied
	}
	dstName := dstPath[len(dstPath)-1]
	// Yes, this is slow, but that is ok here.
	if _, err := libkbfs.ParseTlfHandlePreferred(
		ctx, f.config.KBPKI(), dstName, fl.tlfType); err != nil {
		return dokan.ErrObjectNameNotFound
	}
	fl.mu.Lock()
	_, ok = fl.folders[dstName]
	fl.mu.Unlock()
	if !replaceExisting && ok {
		f.log.CDebugf(ctx, "FS MoveFile folderlist refusing to replace target")
		return dokan.ErrAccessDenied
	}
	// Perhaps create destination by opening it.
	x, _, err := f.open(ctx, oc, dstPath)
	if err == nil {
		x.Cleanup(ctx, nil)
	}
	fl.mu.Lock()
	defer fl.mu.Unlock()
	_, ok = fl.folders[dstName]
	delete(fl.folders, srcName)
	if !ok {
		f.log.CDebugf(ctx, "FS MoveFile folderlist adding target")
		fl.folders[dstName] = ef
	}
	f.log.CDebugf(ctx, "FS MoveFile folderlist success")
	return nil
}

func (f *FS) queueNotification(fn func()) {
	f.notifications.QueueNotification(fn)
}

func (f *FS) reportErr(ctx context.Context, mode libkbfs.ErrorModeType, err error) {
	if err == nil {
		f.log.CDebugf(ctx, "Request complete")
		return
	}

	f.config.Reporter().ReportErr(ctx, "", tlf.Private, mode, err)
	// We just log the error as debug, rather than error, because it
	// might just indicate an expected error such as an ENOENT.
	//
	// TODO: Classify errors and escalate the logging level of the
	// important ones.
	f.log.CDebugf(ctx, err.Error())
}

// NotificationGroupWait waits till the local notification group is done.
func (f *FS) NotificationGroupWait() {
	f.notifications.Wait()
}

func (f *FS) logEnter(ctx context.Context, s string) {
	f.log.CDebugf(ctx, "=> %s", s)
}

func (f *FS) logEnterf(ctx context.Context, fmt string, args ...interface{}) {
	f.log.CDebugf(ctx, "=> "+fmt, args...)
}

// UserChanged is called from libfs.
func (f *FS) UserChanged(ctx context.Context, oldName, newName libkb.NormalizedUsername) {
	f.log.CDebugf(ctx, "User changed: %q -> %q", oldName, newName)
	f.root.public.userChanged(ctx, oldName, newName)
	f.root.private.userChanged(ctx, oldName, newName)
}

var _ libfs.RemoteStatusUpdater = (*FS)(nil)

// Root represents the root of the KBFS file system.
type Root struct {
	emptyFile
	private *FolderList
	public  *FolderList
	team    *FolderList
}

// GetFileInformation for dokan stats.
func (r *Root) GetFileInformation(ctx context.Context, fi *dokan.FileInfo) (*dokan.Stat, error) {
	return defaultDirectoryInformation()
}

// FindFiles for dokan readdir.
func (r *Root) FindFiles(ctx context.Context, fi *dokan.FileInfo, ignored string, callback func(*dokan.NamedStat) error) error {
	var ns dokan.NamedStat
	var err error
	ns.FileAttributes = dokan.FileAttributeDirectory
	ename, esize := r.private.fs.remoteStatus.ExtraFileNameAndSize()
	switch ename {
	case "":
		ns.Name = PrivateName
		err = callback(&ns)
		if err != nil {
			return err
		}
		ns.Name = TeamName
		err = callback(&ns)
		if err != nil {
			return err
		}
		fallthrough
	case libfs.HumanNoLoginFileName:
		ns.Name = PublicName
		err = callback(&ns)
		if err != nil {
			return err
		}
	}
	if ename != "" {
		ns.Name = ename
		ns.FileAttributes = dokan.FileAttributeNormal
		ns.FileSize = esize
		err = callback(&ns)
		if err != nil {
			return err
		}
	}
	return nil
}
