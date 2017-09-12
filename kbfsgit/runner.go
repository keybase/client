// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsgit

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"runtime/pprof"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libgit"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	billy "gopkg.in/src-d/go-billy.v3"
	"gopkg.in/src-d/go-billy.v3/osfs"
	gogit "gopkg.in/src-d/go-git.v4"
	gogitcfg "gopkg.in/src-d/go-git.v4/config"
	"gopkg.in/src-d/go-git.v4/plumbing"
	"gopkg.in/src-d/go-git.v4/storage"
)

const (
	gitCmdCapabilities = "capabilities"
	gitCmdList         = "list"
	gitCmdFetch        = "fetch"
	gitCmdPush         = "push"
	gitCmdOption       = "option"

	gitOptionVerbosity = "verbosity"
	gitOptionProgress  = "progress"
	gitOptionCloning   = "cloning"

	// Debug tag ID for an individual git command passed to the process.
	ctxCommandOpID = "GITCMDID"

	kbfsgitPrefix = "keybase://"
	repoSplitter  = "/"
	kbfsRepoDir   = ".kbfs_git"

	publicName  = "public"
	privateName = "private"
	teamName    = "team"

	// localRepoRemoteName is the name of the remote that gets added
	// locally to the config of the KBFS bare repo, pointing to the
	// git repo stored at the `gitDir` passed to `newRunner`.
	//
	// In go-git, there is no way to hook two go-git.Repository
	// instances together to do fetches/pulls between them. One of the
	// two repos has to be defined as a "remote" to the other one in
	// order to use the nice Fetch and Pull commands. (There might be
	// other more involved ways to transfer objects manually
	// one-by-one, but that seems like it would be pretty sad.)
	//
	// Since there is no standard remote protocol for keybase yet
	// (that's what we're building!), it's not supported by go-git
	// itself. That means our only option is to treat the local
	// on-disk repo as a "remote" with respect to the bare KBFS repo,
	// and do everything in reverse: for example, when a user does a
	// push, we actually fetch from the local repo and write the
	// objects into the bare repo.
	localRepoRemoteName = "local"
)

type ctxCommandTagKey int

const (
	ctxCommandIDKey ctxCommandTagKey = iota
)

type runner struct {
	config libkbfs.Config
	log    logger.Logger
	h      *libkbfs.TlfHandle
	remote string
	repo   string
	gitDir string
	uniqID string
	input  io.Reader
	output io.Writer
	errput io.Writer

	verbosity int64
	progress  bool
	cloning   bool

	logSync     sync.Once
	logSyncDone sync.Once
}

// newRunner creates a new runner for git commands.  It expects `repo`
// to be in the form "keybase://private/user/reponame".  `remote`
// is the local name assigned to that URL, while `gitDir` is the
// filepath leading to the .git directory of the caller's local
// on-disk repo
func newRunner(ctx context.Context, config libkbfs.Config,
	remote, repo, gitDir string, input io.Reader, output io.Writer, errput io.Writer) (
	*runner, error) {
	tlfAndRepo := strings.TrimPrefix(repo, kbfsgitPrefix)
	parts := strings.Split(tlfAndRepo, repoSplitter)
	if len(parts) != 3 {
		return nil, errors.Errorf("Repo should be in the format "+
			"%s<tlfType>%s<tlf>%s<repo>, but got %s",
			kbfsgitPrefix, repoSplitter, repoSplitter, tlfAndRepo)
	}

	var t tlf.Type
	switch parts[0] {
	case publicName:
		t = tlf.Public
	case privateName:
		t = tlf.Private
	case teamName:
		t = tlf.SingleTeam
	default:
		return nil, errors.Errorf("Unrecognized TLF type: %s", parts[0])
	}

	h, err := libkbfs.GetHandleFromFolderNameAndType(
		ctx, config.KBPKI(), parts[1], t)
	if err != nil {
		return nil, err
	}

	// Use the device ID and PID to make a unique ID (for generating
	// temp files in KBFS).
	session, err := libkbfs.GetCurrentSessionIfPossible(
		ctx, config.KBPKI(), h.Type() == tlf.Public)
	if err != nil {
		return nil, err
	}
	uniqID := fmt.Sprintf("%s-%d", session.VerifyingKey.String(), os.Getpid())

	return &runner{
		config:    config,
		log:       config.MakeLogger(""),
		h:         h,
		remote:    remote,
		repo:      parts[2],
		gitDir:    gitDir,
		uniqID:    uniqID,
		input:     input,
		output:    output,
		errput:    errput,
		verbosity: 1,
		progress:  true,
	}, nil
}

// handleCapabilities: from https://git-scm.com/docs/git-remote-helpers
//
// Lists the capabilities of the helper, one per line, ending with a
// blank line. Each capability may be preceded with *, which marks
// them mandatory for git versions using the remote helper to
// understand. Any unknown mandatory capability is a fatal error.
func (r *runner) handleCapabilities() error {
	caps := []string{
		gitCmdFetch,
		gitCmdPush,
		gitCmdOption,
	}
	for _, c := range caps {
		_, err := r.output.Write([]byte(c + "\n"))
		if err != nil {
			return err
		}
	}
	_, err := r.output.Write([]byte("\n"))
	return err
}

// getElapsedStr gets an additional string to append to the errput
// message at the end of a phase.  It includes the measured time of
// the phase, and if verbosity is high enough, it includes the
// location of a memory profile taken at the end of the phase.
func (r *runner) getElapsedStr(
	ctx context.Context, startTime time.Time, profName string) string {
	if r.verbosity < 2 {
		return ""
	}
	elapsed := r.config.Clock().Now().Sub(startTime)
	elapsedStr := fmt.Sprintf(" [%s]", elapsed)

	if r.verbosity >= 3 {
		profName = filepath.Join(os.TempDir(), profName)
		f, err := os.Create(profName)
		if err != nil {
			r.log.CDebugf(ctx, err.Error())
		} else {
			runtime.GC()
			pprof.WriteHeapProfile(f)
			f.Close()
		}
		elapsedStr += " [memprof " + profName + "]"
	}

	return elapsedStr
}

func (r *runner) printDoneOrErr(
	ctx context.Context, err error, startTime time.Time) {
	if r.verbosity < 1 {
		return
	}
	profName := "mem.init.prof"
	elapsedStr := r.getElapsedStr(ctx, startTime, profName)
	if err != nil {
		r.errput.Write([]byte(err.Error() + elapsedStr + "\n"))
	} else {
		r.errput.Write([]byte("done." + elapsedStr + "\n"))
	}
}

func (r *runner) initRepoIfNeeded(ctx context.Context, forCmd string) (
	repo *gogit.Repository, fs *libfs.FS, err error) {
	// This function might be called multiple times per function, but
	// the subsequent calls will use the local cache.  So only print
	// these messages once.
	if r.verbosity >= 1 {
		var startTime time.Time
		r.logSync.Do(func() {
			startTime = r.config.Clock().Now()
			r.errput.Write([]byte("Syncing with Keybase... "))
		})
		defer func() {
			r.logSyncDone.Do(func() { r.printDoneOrErr(ctx, err, startTime) })
		}()
	}

	fs, _, err = libgit.GetOrCreateRepoAndID(
		ctx, r.config, r.h, r.repo, r.uniqID)
	if err != nil {
		return nil, nil, err
	}

	// We don't persist remotes to the config on disk for two
	// reasons. 1) gogit/gcfg has a bug where it can't handle
	// backslashes in remote URLs, and 2) we don't want to persist the
	// remotes anyway since they'll contain local paths and wouldn't
	// make sense to other devices, plus that could leak local info.
	var storage storage.Storer
	storage, err = newConfigWithoutRemotesStorer(fs)
	if err != nil {
		return nil, nil, err
	}

	if forCmd == gitCmdFetch {
		r.log.CDebugf(ctx, "Using on-demand storer")
		// Wrap it in an on-demand storer, so we don't try to read all the
		// objects of big repos into memory at once.
		storage, err = newOnDemandStorer(storage)
		if err != nil {
			return nil, nil, err
		}
	}

	config, err := storage.Config()
	if err != nil {
		return nil, nil, err
	}
	if config.Pack.Window > 0 {
		// Turn delta compression off, both to avoid messing up the
		// on-demand storer, and to avoid the unnecessary computation
		// since we're not transferring the objects over a network.
		// TODO: this results in uncompressed local git repo after
		// fetches, so we should either run:
		//
		// `git repack -a -d -f --depth=250 --window=250` as needed.
		// (via https://stackoverflow.com/questions/7102053/git-pull-without-remotely-compressing-objects)
		//
		// or we should document that the user should do so.
		r.log.CDebugf(ctx, "Disabling pack compression by using a 0 window")
		config.Pack.Window = 0
		err = storage.SetConfig(config)
		if err != nil {
			return nil, nil, err
		}
	}

	// TODO: This needs to take a server lock when initializing a
	// repo.
	r.log.CDebugf(ctx, "Attempting to init or open repo %s", r.repo)
	repo, err = gogit.Init(storage, nil)
	if err == gogit.ErrRepositoryAlreadyExists {
		repo, err = gogit.Open(storage, nil)
	}
	if err != nil {
		return nil, nil, err
	}

	return repo, fs, nil
}

func (r *runner) printJournalStatus(
	ctx context.Context, jServer *libkbfs.JournalServer, tlf tlf.ID,
	doneCh <-chan struct{}) {
	// Note: the "first" status here gets us the number of unflushed
	// bytes left at the time we started printing.  However, we don't
	// have the total number of bytes being flushed to the server
	// throughout the whole operation, which would be more
	// informative.  It would be better to have that as the
	// denominator, but there's no easy way to get it right now.
	firstStatus, err := jServer.JournalStatus(tlf)
	if err != nil {
		r.log.CDebugf(ctx, "Error getting status: %+v", err)
		return
	}
	if firstStatus.UnflushedBytes == 0 {
		return
	}
	if r.verbosity >= 1 {
		r.errput.Write([]byte("Syncing data to Keybase: "))
	}
	startTime := r.config.Clock().Now()

	// TODO: should we "humanize" the units of these bytes if they are
	// more than a KB, MB, etc?
	bytesFmt := "%d/%d bytes... "
	str := fmt.Sprintf(bytesFmt, 0, firstStatus.UnflushedBytes)
	lastByteCount := len(str)
	if r.progress {
		r.errput.Write([]byte(str))
	}

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
		case <-doneCh:
		}
		status, err := jServer.JournalStatus(tlf)
		if err != nil {
			r.log.CDebugf(ctx, "Error getting status: %+v", err)
			return
		}

		if r.verbosity >= 1 && r.progress {
			eraseStr := strings.Repeat("\b", lastByteCount)
			str := fmt.Sprintf(
				bytesFmt, firstStatus.UnflushedBytes-status.UnflushedBytes,
				firstStatus.UnflushedBytes)
			lastByteCount = len(str)
			r.errput.Write([]byte(eraseStr + str))
		}

		if status.UnflushedBytes == 0 {
			elapsedStr := r.getElapsedStr(ctx, startTime, "mem.flush.prof")
			if r.verbosity >= 1 {
				r.errput.Write([]byte("done." + elapsedStr + "\n"))
			}
			return
		}
	}
}

func (r *runner) waitForJournal(ctx context.Context) error {
	rootNode, _, err := r.config.KBFSOps().GetOrCreateRootNode(
		ctx, r.h, libkbfs.MasterBranch)
	if err != nil {
		return err
	}

	err = r.config.KBFSOps().SyncAll(ctx, rootNode.GetFolderBranch())
	if err != nil {
		return err
	}

	jServer, err := libkbfs.GetJournalServer(r.config)
	if err != nil {
		r.log.CDebugf(ctx, "No journal server: %+v", err)
		return nil
	}

	printDoneCh := make(chan struct{})
	waitDoneCh := make(chan struct{})
	go func() {
		r.printJournalStatus(
			ctx, jServer, rootNode.GetFolderBranch().Tlf, waitDoneCh)
		close(printDoneCh)
	}()

	// This squashes everything written to the journal into a single
	// revision, to make sure that no partial states of the bare repo
	// are seen by other readers of the TLF.  It also waits for any
	// necessary conflict resolution to complete.
	err = jServer.FinishSingleOp(ctx, rootNode.GetFolderBranch().Tlf)
	if err != nil {
		return err
	}
	close(waitDoneCh)
	<-printDoneCh

	// Make sure that everything is truly flushed.
	status, err := jServer.JournalStatus(rootNode.GetFolderBranch().Tlf)
	if err != nil {
		return err
	}

	if status.RevisionStart != kbfsmd.RevisionUninitialized {
		r.log.CDebugf(ctx, "Journal status: %+v", status)
		return errors.New("Journal is non-empty after a wait")
	}
	return nil
}

// handleList: From https://git-scm.com/docs/git-remote-helpers
//
// Lists the refs, one per line, in the format "<value> <name> [<attr>
// …​]". The value may be a hex sha1 hash, "@<dest>" for a symref, or
// "?" to indicate that the helper could not get the value of the
// ref. A space-separated list of attributes follows the name;
// unrecognized attributes are ignored. The list ends with a blank
// line.
func (r *runner) handleList(ctx context.Context, args []string) (err error) {
	if len(args) == 1 && args[0] == "for-push" {
		r.log.CDebugf(ctx, "Treating for-push the same as a regular list")
	} else if len(args) > 0 {
		return errors.Errorf("Bad list request: %v", args)
	}

	repo, _, err := r.initRepoIfNeeded(ctx, gitCmdList)
	if err != nil {
		return err
	}

	refs, err := repo.References()
	if err != nil {
		return err
	}

	for {
		ref, err := refs.Next()
		if errors.Cause(err) == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		value := ""
		switch ref.Type() {
		case plumbing.HashReference:
			value = ref.Hash().String()
		case plumbing.SymbolicReference:
			value = "@" + ref.Target().String()
		default:
			value = "?"
		}
		refStr := value + " " + ref.Name().String() + "\n"
		_, err = r.output.Write([]byte(refStr))
		if err != nil {
			return err
		}
	}

	err = r.waitForJournal(ctx)
	if err != nil {
		return err
	}
	r.log.CDebugf(ctx, "Done waiting for journal")

	_, err = r.output.Write([]byte("\n"))
	return err
}

var gogitStagesToStatus = map[plumbing.StatusStage]string{
	plumbing.StatusCount:     "Counting: ",
	plumbing.StatusRead:      "Reading: ",
	plumbing.StatusFixChains: "Fixing: ",
	plumbing.StatusSort:      "Sorting... ",
	plumbing.StatusDelta:     "Calculating deltas: ",
	// For us, a "send" actually means fetch.
	plumbing.StatusSend: "Fetching: ",
	// For us, a "fetch" actually means writing objects to
	// the local journal.
	plumbing.StatusFetch:       "Preparing: ",
	plumbing.StatusIndexHash:   "Indexing hashes: ",
	plumbing.StatusIndexCRC:    "Indexing CRCs: ",
	plumbing.StatusIndexOffset: "Indexing offsets: ",
}

func (r *runner) processGogitStatus(
	ctx context.Context, statusChan <-chan plumbing.StatusUpdate) {
	currStage := plumbing.StatusUnknown
	var startTime time.Time
	lastByteCount := 0
	for update := range statusChan {
		if update.Stage != currStage {
			if currStage != plumbing.StatusUnknown {
				profName := fmt.Sprintf("mem.%d.prof", update.Stage)
				elapsedStr := r.getElapsedStr(ctx, startTime, profName)
				r.errput.Write([]byte("done." + elapsedStr + "\n"))
			}
			r.errput.Write([]byte(gogitStagesToStatus[update.Stage]))
			lastByteCount = 0
			currStage = update.Stage
			startTime = r.config.Clock().Now()
		}
		eraseStr := strings.Repeat("\b", lastByteCount)
		newStr := ""

		switch update.Stage {
		case plumbing.StatusDone:
			r.log.CDebugf(ctx, "Status processing done")
			return
		case plumbing.StatusCount:
			newStr = fmt.Sprintf("%d objects... ", update.ObjectsTotal)
		case plumbing.StatusSort:
		default:
			newStr = fmt.Sprintf(
				"%d/%d objects... ", update.ObjectsDone, update.ObjectsTotal)
		}

		lastByteCount = len(newStr)
		if r.progress {
			r.errput.Write([]byte(eraseStr + newStr))
		}

		currStage = update.Stage
	}
	r.log.CDebugf(ctx, "Status channel closed")
	r.errput.Write([]byte("\n"))
}

// recursiveByteCount returns a sum of the size of all files under the
// directory represented by `fs`.  It also returns the length of the
// last string it printed to `r.errput` as `toErase`, to aid in
// overwriting the text on the next update.
func (r *runner) recursiveByteCount(
	ctx context.Context, fs billy.Filesystem, totalSoFar int64, toErase int) (
	bytes int64, toEraseRet int, err error) {
	fileInfos, err := fs.ReadDir("/")
	if err != nil {
		return 0, 0, err
	}

	for _, fi := range fileInfos {
		if fi.IsDir() {
			chrootFS, err := fs.Chroot(fi.Name())
			if err != nil {
				return 0, 0, err
			}
			var chrootBytes int64
			chrootBytes, toErase, err = r.recursiveByteCount(
				ctx, chrootFS, totalSoFar+bytes, toErase)
			if err != nil {
				return 0, 0, err
			}
			bytes += chrootBytes
		} else {
			bytes += fi.Size()
			if r.progress {
				// This function only runs if r.verbosity >= 1.
				eraseStr := strings.Repeat("\b", toErase)
				newStr := fmt.Sprintf("%d bytes... ", totalSoFar+bytes)
				toErase = len(newStr)
				r.errput.Write([]byte(eraseStr + newStr))
			}
		}
	}
	return bytes, toErase, nil
}

// statusWriter is a simple io.Writer shim that logs to `r.errput` the
// number of bytes written to `output`.
type statusWriter struct {
	r           *runner
	output      io.Writer
	soFar       int64
	totalBytes  int64
	nextToErase int
}

var _ io.Writer = (*statusWriter)(nil)

func (sw *statusWriter) Write(p []byte) (n int, err error) {
	n, err = sw.output.Write(p)
	if err != nil {
		return n, err
	}

	sw.soFar += int64(len(p))
	eraseStr := strings.Repeat("\b", sw.nextToErase)
	newStr := fmt.Sprintf("%d/%d bytes... ", sw.soFar, sw.totalBytes)
	sw.r.errput.Write([]byte(eraseStr + newStr))
	sw.nextToErase = len(newStr)
	return n, nil
}

func (r *runner) copyFile(
	ctx context.Context, from billy.Filesystem, to billy.Filesystem,
	name string, sw *statusWriter) (err error) {
	f, err := from.Open(name)
	if err != nil {
		return err
	}
	defer f.Close()
	toF, err := to.Create(name)
	if err != nil {
		return err
	}
	defer toF.Close()

	var w io.Writer = toF
	// Wrap the destination file in a status shim if we are supposed
	// to report progress.
	if sw != nil && r.progress {
		sw.output = toF
		w = sw
	}
	_, err = io.Copy(w, f)
	return err
}

// recursiveCopy copies the entire subdirectory rooted at `fs` to
// `localFS`.
func (r *runner) recursiveCopy(
	ctx context.Context, from billy.Filesystem, to billy.Filesystem,
	sw *statusWriter) (err error) {
	fileInfos, err := from.ReadDir("")
	if err != nil {
		return err
	}

	for _, fi := range fileInfos {
		if fi.IsDir() {
			err := to.MkdirAll(fi.Name(), 0775)
			if err != nil {
				return err
			}
			chrootFrom, err := from.Chroot(fi.Name())
			if err != nil {
				return err
			}
			chrootTo, err := to.Chroot(fi.Name())
			if err != nil {
				return err
			}
			err = r.recursiveCopy(ctx, chrootFrom, chrootTo, sw)
			if err != nil {
				return err
			}
		} else {
			err := r.copyFile(ctx, from, to, fi.Name(), sw)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

// handleClone copies all the object files of a KBFS repo directly
// into the local git dir, instead of using go-git to calculate the
// full set of objects that are to be transferred (which is slow and
// memory inefficient).  If the user requested only a single branch of
// cloning, this will copy more objects that necessary, but still only
// a single ref will show up for the user.  TODO: Maybe we should run
// `git gc` for the user on the local repo?
func (r *runner) handleClone(ctx context.Context) (err error) {
	_, _, err = r.initRepoIfNeeded(ctx, "clone")
	if err != nil {
		return err
	}

	r.log.CDebugf(ctx, "Cloning into %s", r.gitDir)

	fs, _, err := libgit.GetOrCreateRepoAndID(
		ctx, r.config, r.h, r.repo, r.uniqID)
	if err != nil {
		return err
	}
	fsObjects, err := fs.Chroot("objects")
	if err != nil {
		return err
	}

	localObjectsPath := filepath.Join(r.gitDir, "objects")
	err = os.MkdirAll(localObjectsPath, 0775)
	if err != nil {
		return err
	}
	localFSObjects := osfs.New(localObjectsPath)

	var sw *statusWriter
	if r.verbosity >= 1 {
		// Get the total number of bytes we expect to fetch, for the
		// progress report.
		startTime := r.config.Clock().Now()
		r.errput.Write([]byte("Counting: "))
		b, _, err := r.recursiveByteCount(ctx, fsObjects, 0, 0)
		if err != nil {
			return err
		}
		elapsedStr := r.getElapsedStr(ctx, startTime, "mem.count.prof")
		r.errput.Write([]byte("done." + elapsedStr + "\n"))

		sw = &statusWriter{r, nil, 0, b, 0}
		r.errput.Write([]byte("Cloning: "))
	}

	// Copy the entire objects subdirectory straight into the git
	// directory.  This saves time and memory from having to calculate
	// packfiles.
	startTime := r.config.Clock().Now()
	err = r.recursiveCopy(ctx, fsObjects, localFSObjects, sw)
	if err != nil {
		return err
	}

	if r.verbosity >= 1 {
		elapsedStr := r.getElapsedStr(ctx, startTime, "mem.clone.prof")
		r.errput.Write([]byte("done." + elapsedStr + "\n"))
	}
	_, err = r.output.Write([]byte("\n"))
	return err
}

// handleFetchBatch: From https://git-scm.com/docs/git-remote-helpers
//
// fetch <sha1> <name>
// Fetches the given object, writing the necessary objects to the
// database. Fetch commands are sent in a batch, one per line,
// terminated with a blank line. Outputs a single blank line when all
// fetch commands in the same batch are complete. Only objects which
// were reported in the output of list with a sha1 may be fetched this
// way.
//
// Optionally may output a lock <file> line indicating a file under
// GIT_DIR/objects/pack which is keeping a pack until refs can be
// suitably updated.
func (r *runner) handleFetchBatch(ctx context.Context, args [][]string) (
	err error) {
	repo, _, err := r.initRepoIfNeeded(ctx, gitCmdFetch)
	if err != nil {
		return err
	}

	r.log.CDebugf(ctx, "Fetching %d refs into %s", len(args), r.gitDir)

	remote, err := repo.CreateRemote(&gogitcfg.RemoteConfig{
		Name: localRepoRemoteName,
		URLs: []string{r.gitDir},
	})

	var refSpecs []gogitcfg.RefSpec
	var deleteRefSpecs []gogitcfg.RefSpec
	for i, fetch := range args {
		if len(fetch) != 2 {
			return errors.Errorf("Bad fetch request: %v", fetch)
		}
		refInBareRepo := fetch[1]

		// Push into a local ref with a temporary name, because the
		// git process that invoked us will get confused if we make a
		// ref with the same name.  Later, delete this temporary ref.
		localTempRef := fmt.Sprintf("%s-%s-%d",
			plumbing.ReferenceName(refInBareRepo).Short(), r.uniqID, i)
		refSpec := fmt.Sprintf(
			"%s:refs/remotes/%s/%s", refInBareRepo, r.remote, localTempRef)
		r.log.CDebugf(ctx, "Fetching %s", refSpec)

		refSpecs = append(refSpecs, gogitcfg.RefSpec(refSpec))
		deleteRefSpecs = append(deleteRefSpecs, gogitcfg.RefSpec(
			fmt.Sprintf(":refs/remotes/%s/%s", r.remote, localTempRef)))
	}

	var statusChan plumbing.StatusChan
	if r.verbosity >= 1 {
		s := make(chan plumbing.StatusUpdate)
		defer close(s)
		statusChan = plumbing.StatusChan(s)
		go r.processGogitStatus(ctx, s)
	}

	// Now "push" into the local repo to get it to store objects
	// from the KBFS bare repo.
	err = remote.PushContext(ctx, &gogit.PushOptions{
		RemoteName: localRepoRemoteName,
		RefSpecs:   refSpecs,
		StatusChan: statusChan,
	})
	if err != nil && err != gogit.NoErrAlreadyUpToDate {
		return err
	}

	// Delete the temporary refspecs now that the objects are
	// safely stored in the local repo.
	err = remote.PushContext(ctx, &gogit.PushOptions{
		RemoteName: localRepoRemoteName,
		RefSpecs:   deleteRefSpecs,
	})
	if err != nil && err != gogit.NoErrAlreadyUpToDate {
		return err
	}

	err = r.waitForJournal(ctx)
	if err != nil {
		return err
	}
	r.log.CDebugf(ctx, "Done waiting for journal")

	_, err = r.output.Write([]byte("\n"))
	return err
}

// handlePushBatch: From https://git-scm.com/docs/git-remote-helpers
//
// push +<src>:<dst>
// Pushes the given local <src> commit or branch to the remote branch
// described by <dst>. A batch sequence of one or more push commands
// is terminated with a blank line (if there is only one reference to
// push, a single push command is followed by a blank line). For
// example, the following would be two batches of push, the first
// asking the remote-helper to push the local ref master to the remote
// ref master and the local HEAD to the remote branch, and the second
// asking to push ref foo to ref bar (forced update requested by the
// +).
//
// push refs/heads/master:refs/heads/master
// push HEAD:refs/heads/branch
// \n
// push +refs/heads/foo:refs/heads/bar
// \n
//
// Zero or more protocol options may be entered after the last push
// command, before the batch’s terminating blank line.
//
// When the push is complete, outputs one or more ok <dst> or error
// <dst> <why>? lines to indicate success or failure of each pushed
// ref. The status report output is terminated by a blank line. The
// option field <why> may be quoted in a C style string if it contains
// an LF.
func (r *runner) handlePushBatch(ctx context.Context, args [][]string) (
	err error) {
	repo, fs, err := r.initRepoIfNeeded(ctx, gitCmdPush)
	if err != nil {
		return err
	}

	r.log.CDebugf(ctx, "Pushing %d refs into %s", len(args), r.gitDir)

	remote, err := repo.CreateRemote(&gogitcfg.RemoteConfig{
		Name: localRepoRemoteName,
		URLs: []string{r.gitDir},
	})

	results := make(map[string]error, len(args))
	var refspecs []gogitcfg.RefSpec
	for _, push := range args {
		if len(push) != 1 {
			return errors.Errorf("Bad push request: %v", push)
		}
		refspec := gogitcfg.RefSpec(push[0])
		err := refspec.Validate()
		if err != nil {
			return err
		}

		// Delete the reference in the repo if needed; otherwise,
		// fetch from the local repo into the remote repo.
		if refspec.IsDelete() {
			start := strings.Index(push[0], ":") + 1
			dst := push[0][start:]

			if refspec.IsWildcard() {
				results[dst] = errors.Errorf(
					"Wildcards not supported for deletes: %s", refspec)
				continue
			}
			err = repo.Storer.RemoveReference(plumbing.ReferenceName(dst))
			if err == gogit.NoErrAlreadyUpToDate {
				err = nil
			}
			results[dst] = err
		} else {
			if !refspec.IsForceUpdate() {
				r.log.CDebugf(ctx,
					"Turning a non-force push into a force push for now: %s",
					refspec)
			}

			refspecs = append(refspecs, refspec)
		}
		if err != nil {
			r.log.CDebugf(ctx, "Error fetching %s: %+v", refspec, err)
		}
	}

	if len(refspecs) > 0 {
		var statusChan plumbing.StatusChan
		if r.verbosity >= 1 {
			s := make(chan plumbing.StatusUpdate)
			defer close(s)
			statusChan = plumbing.StatusChan(s)
			go r.processGogitStatus(ctx, s)
		}

		err = remote.FetchContext(ctx, &gogit.FetchOptions{
			RemoteName: localRepoRemoteName,
			RefSpecs:   refspecs,
			StatusChan: statusChan,
		})
		if err == gogit.NoErrAlreadyUpToDate {
			err = nil
		}
		// All non-delete refspecs in the batch get the same error.
		for _, refspec := range refspecs {
			refStr := refspec.String()
			start := strings.Index(refStr, ":") + 1
			dst := refStr[start:]
			results[dst] = err
		}
	}

	err = r.waitForJournal(ctx)
	if err != nil {
		return err
	}
	r.log.CDebugf(ctx, "Done waiting for journal")

	for d, e := range results {
		result := ""
		if e == nil {
			result = fmt.Sprintf("ok %s", d)
		} else {
			result = fmt.Sprintf("error %s %s", d, e.Error())
		}
		_, err = r.output.Write([]byte(result + "\n"))
	}

	err = libgit.UpdateRepoMD(ctx, r.config, r.h, fs)
	if err != nil {
		return err
	}

	_, err = r.output.Write([]byte("\n"))
	return err
}

// handleOption: https://git-scm.com/docs/git-remote-helpers#git-remote-helpers-emoptionemltnamegtltvaluegt
//
// option <name> <value>
// Sets the transport helper option <name> to <value>. Outputs a
// single line containing one of ok (option successfully set),
// unsupported (option not recognized) or error <msg> (option <name>
// is supported but <value> is not valid for it). Options should be
// set before other commands, and may influence the behavior of those
// commands.
func (r *runner) handleOption(ctx context.Context, args []string) (err error) {
	defer func() {
		if err != nil {
			r.output.Write([]byte(fmt.Sprintf("error %s\n", err.Error())))
		}
	}()

	if len(args) != 2 {
		return errors.Errorf("Bad option request: %v", args)
	}

	option := args[0]
	result := ""
	switch option {
	case gitOptionVerbosity:
		v, err := strconv.ParseInt(args[1], 10, 64)
		if err != nil {
			return err
		}
		r.verbosity = v
		r.log.CDebugf(ctx, "Setting verbosity to %d", v)
		result = "ok"
	case gitOptionProgress:
		b, err := strconv.ParseBool(args[1])
		if err != nil {
			return err
		}
		r.progress = b
		r.log.CDebugf(ctx, "Setting progress to %t", b)
		result = "ok"
	case gitOptionCloning:
		b, err := strconv.ParseBool(args[1])
		if err != nil {
			return err
		}
		r.cloning = b
		r.log.CDebugf(ctx, "Setting cloning to %t", b)
		result = "ok"
	default:
		result = "unsupported"
	}

	_, err = r.output.Write([]byte(result + "\n"))
	return err
}

func (r *runner) processCommand(
	ctx context.Context, commandChan <-chan string) (err error) {
	var fetchBatch, pushBatch [][]string
	for {
		select {
		case cmd := <-commandChan:
			ctx := libkbfs.CtxWithRandomIDReplayable(
				ctx, ctxCommandIDKey, ctxCommandOpID, r.log)

			cmdParts := strings.Fields(cmd)
			if len(cmdParts) == 0 {
				if len(fetchBatch) > 0 {
					if r.cloning {
						r.log.CDebugf(ctx, "Processing clone")
						err = r.handleClone(ctx)
						if err != nil {
							return err
						}
					} else {
						r.log.CDebugf(ctx, "Processing fetch batch")
						err = r.handleFetchBatch(ctx, fetchBatch)
						if err != nil {
							return err
						}
					}
					fetchBatch = nil
					continue
				} else if len(pushBatch) > 0 {
					r.log.CDebugf(ctx, "Processing push batch")
					err = r.handlePushBatch(ctx, pushBatch)
					if err != nil {
						return err
					}
					pushBatch = nil
					continue
				} else {
					r.log.CDebugf(ctx, "Done processing commands")
					return nil
				}
			}

			switch cmdParts[0] {
			case gitCmdCapabilities:
				err = r.handleCapabilities()
			case gitCmdList:
				err = r.handleList(ctx, cmdParts[1:])
			case gitCmdFetch:
				if len(pushBatch) > 0 {
					return errors.New(
						"Cannot fetch in the middle of a push batch")
				}
				fetchBatch = append(fetchBatch, cmdParts[1:])
			case gitCmdPush:
				if len(fetchBatch) > 0 {
					return errors.New(
						"Cannot push in the middle of a fetch batch")
				}
				pushBatch = append(pushBatch, cmdParts[1:])
			case gitCmdOption:
				err = r.handleOption(ctx, cmdParts[1:])
			default:
				err = errors.Errorf("Unsupported command: %s", cmdParts[0])
			}
			if err != nil {
				return err
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (r *runner) processCommands(ctx context.Context) (err error) {
	r.log.CDebugf(ctx, "Ready to process")
	reader := bufio.NewReader(r.input)
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Process the commands with a separate queue in a separate
	// goroutine, so we can exit as soon as EOF is received
	// (indicating the corresponding `git` command has been
	// interrupted).
	commandChan := make(chan string, 100)
	processorErrChan := make(chan error, 1)
	go func() {
		processorErrChan <- r.processCommand(ctx, commandChan)
	}()

	for {
		stdinErrChan := make(chan error, 1)
		go func() {
			cmd, err := reader.ReadString('\n')
			if err != nil {
				stdinErrChan <- err
				return
			}

			r.log.CDebugf(ctx, "Received command: %s", cmd)
			commandChan <- cmd
			stdinErrChan <- nil
		}()

		select {
		case err := <-stdinErrChan:
			if errors.Cause(err) == io.EOF {
				r.log.CDebugf(ctx, "Done processing commands")
				return nil
			} else if err != nil {
				return err
			}
			// Otherwise continue to read the next command.
		case err := <-processorErrChan:
			return err
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}
