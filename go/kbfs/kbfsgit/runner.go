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

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libgit"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	billy "gopkg.in/src-d/go-billy.v4"
	"gopkg.in/src-d/go-billy.v4/osfs"
	gogit "gopkg.in/src-d/go-git.v4"
	gogitcfg "gopkg.in/src-d/go-git.v4/config"
	"gopkg.in/src-d/go-git.v4/plumbing"
	gogitobj "gopkg.in/src-d/go-git.v4/plumbing/object"
	gogitstor "gopkg.in/src-d/go-git.v4/plumbing/storer"
	"gopkg.in/src-d/go-git.v4/storage"
	"gopkg.in/src-d/go-git.v4/storage/filesystem"
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
	gitOptionPushcert  = "pushcert"
	gitOptionIfAsked   = "if-asked"

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

	packedRefsPath     = "packed-refs"
	packedRefsTempPath = "._packed-refs"

	defaultMaxLooseRefs         = 50
	defaultPruneMinLooseObjects = -1
	defaultMaxObjectPacks       = 50
	minGCInterval               = 7 * 24 * time.Hour

	unlockPrintBytesStatusThreshold = time.Second / 2
	gcPrintStatusThreshold          = time.Second

	maxCommitsToVisitPerRef = 20
)

type ctxCommandTagKey int

const (
	ctxCommandIDKey ctxCommandTagKey = iota
)

type runner struct {
	config libkbfs.Config
	log    logger.Logger
	h      *tlfhandle.Handle
	remote string
	repo   string
	gitDir string
	uniqID string
	input  io.Reader
	output io.Writer
	errput io.Writer
	gcDone bool

	verbosity int64
	progress  bool
	cloning   bool

	logSync     sync.Once
	logSyncDone sync.Once

	printStageLock   sync.Mutex
	needPrintDone    bool
	stageStartTime   time.Time
	stageMemProfName string
	stageCPUProfPath string
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
		ctx, config.KBPKI(), config.MDOps(), config, parts[1], t)
	if err != nil {
		return nil, err
	}

	// Use the device ID and PID to make a unique ID (for generating
	// temp files in KBFS).
	session, err := idutil.GetCurrentSessionIfPossible(
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
	ctx context.Context, startTime time.Time, profName string,
	cpuProfFullPath string) string {
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
			err := pprof.WriteHeapProfile(f)
			if err != nil {
				r.log.CDebugf(ctx, "Couldn't write heap profile: %+v", err)
			}
			f.Close()
		}
		elapsedStr += " [memprof " + profName + "]"
	}

	if cpuProfFullPath != "" {
		pprof.StopCPUProfile()
		elapsedStr += " [cpuprof " + cpuProfFullPath + "]"
	}

	return elapsedStr
}

func (r *runner) printDoneOrErr(
	ctx context.Context, err error, startTime time.Time) {
	if r.verbosity < 1 {
		return
	}
	profName := "mem.init.prof"
	elapsedStr := r.getElapsedStr(ctx, startTime, profName, "")
	var writeErr error
	if err != nil {
		_, writeErr = r.errput.Write([]byte(err.Error() + elapsedStr + "\n"))
	} else {
		_, writeErr = r.errput.Write([]byte("done." + elapsedStr + "\n"))
	}
	if writeErr != nil {
		r.log.CDebugf(ctx, "Couldn't write error: %+v", err)
	}
}

func (r *runner) isManagedByApp() bool {
	switch r.h.Type() {
	case tlf.Public:
		// Public TLFs are never managed by the app.
		return false
	case tlf.SingleTeam:
		// Single-team TLFs are always managed by the app.
		return true
	case tlf.Private:
		// Only single-user private TLFs are managed by the app.  So
		// if the canonical name contains any commas, readers, or
		// spaces, it's not managed by the app.
		name := string(r.h.GetCanonicalName())
		return !strings.ContainsAny(name, " ,"+tlf.ReaderSep)
	default:
		panic(fmt.Sprintf("Unexpected type: %s", r.h.Type()))
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
			_, err := r.errput.Write([]byte("Syncing with Keybase... "))
			if err != nil {
				r.log.CDebugf(ctx, "Couldn't write: %+v", err)
			}
		})
		defer func() {
			r.logSyncDone.Do(func() { r.printDoneOrErr(ctx, err, startTime) })
		}()
	}

	// Only allow lazy creates for TLFs that aren't managed by the
	// Keybase app.
	if r.isManagedByApp() {
		fs, _, err = libgit.GetRepoAndID(
			ctx, r.config, r.h, r.repo, r.uniqID)
	} else {
		fs, _, err = libgit.GetOrCreateRepoAndID(
			ctx, r.config, r.h, r.repo, r.uniqID)
	}
	if err != nil {
		return nil, nil, err
	}

	// We don't persist remotes to the config on disk for two
	// reasons. 1) gogit/gcfg has a bug where it can't handle
	// backslashes in remote URLs, and 2) we don't want to persist the
	// remotes anyway since they'll contain local paths and wouldn't
	// make sense to other devices, plus that could leak local info.
	var storage storage.Storer
	storage, err = libgit.NewGitConfigWithoutRemotesStorer(fs)
	if err != nil {
		return nil, nil, err
	}

	if forCmd == gitCmdFetch {
		r.log.CDebugf(ctx, "Using on-demand storer")
		// Wrap it in an on-demand storer, so we don't try to read all the
		// objects of big repos into memory at once.
		storage, err = libgit.NewOnDemandStorer(storage)
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

func percent(n int64, d int64) float64 {
	return float64(100) * (float64(n) / float64(d))
}

func humanizeBytes(n int64, d int64) string {
	const kb = 1024
	const kbf = float64(kb)
	const mb = kb * 1024
	const mbf = float64(mb)
	const gb = mb * 1024
	const gbf = float64(gb)
	// Special case the counting of bytes, when there's no denominator.
	if d == 1 {
		switch {
		case n < kb:
			return fmt.Sprintf("%d bytes", n)
		case n < mb:
			return fmt.Sprintf("%.2f KB", float64(n)/kbf)
		case n < gb:
			return fmt.Sprintf("%.2f MB", float64(n)/mbf)
		}
		return fmt.Sprintf("%.2f GB", float64(n)/gbf)
	}

	switch {
	case d < kb:
		return fmt.Sprintf("%d/%d bytes", n, d)
	case d < mb:
		return fmt.Sprintf("%.2f/%.2f KB", float64(n)/kbf, float64(d)/kbf)
	case d < gb:
		return fmt.Sprintf("%.2f/%.2f MB", float64(n)/mbf, float64(d)/mbf)
	}
	return fmt.Sprintf("%.2f/%.2f GB", float64(n)/gbf, float64(d)/gbf)
}

// printStageEndIfNeeded should only be used to end stages started with
// printStageStart.
func (r *runner) printStageEndIfNeeded(ctx context.Context) {
	r.printStageLock.Lock()
	defer r.printStageLock.Unlock()
	// go-git grabs the lock right after plumbing.StatusIndexOffset, but before
	// sending the Done status update. As a result, it would look like we are
	// flushing the journal before plumbing.StatusIndexOffset is done. So
	// instead, print "done." only if it's not printed yet.
	if r.needPrintDone {
		elapsedStr := r.getElapsedStr(ctx,
			r.stageStartTime, r.stageMemProfName, r.stageCPUProfPath)
		_, err := r.errput.Write([]byte("done." + elapsedStr + "\n"))
		if err != nil {
			r.log.CDebugf(ctx, "Couldn't write: %+v", err)
		}
		r.needPrintDone = false
	}
}

func (r *runner) printStageStart(ctx context.Context,
	toPrint []byte, memProfName, cpuProfName string) {
	if len(toPrint) == 0 {
		return
	}
	r.printStageEndIfNeeded(ctx)

	r.printStageLock.Lock()
	defer r.printStageLock.Unlock()

	r.stageStartTime = r.config.Clock().Now()
	r.stageMemProfName = memProfName

	if len(cpuProfName) > 0 && r.verbosity >= 4 {
		cpuProfPath := filepath.Join(
			os.TempDir(), cpuProfName)
		f, err := os.Create(cpuProfPath)
		if err != nil {
			r.log.CDebugf(
				ctx, "Couldn't create CPU profile: %s", cpuProfName)
			cpuProfPath = ""
		} else {
			err := pprof.StartCPUProfile(f)
			if err != nil {
				r.log.CDebugf(ctx, "Couldn't start CPU profile: %+v", err)
			}
		}
		r.stageCPUProfPath = cpuProfPath
	}

	_, err := r.errput.Write(toPrint)
	if err != nil {
		r.log.CDebugf(ctx, "Couldn't write: %+v", err)
	}
	r.needPrintDone = true
}

// caller should make sure doneCh is closed when journal is all flushed.
func (r *runner) printJournalStatus(
	ctx context.Context, jManager *libkbfs.JournalManager, tlfID tlf.ID,
	doneCh <-chan struct{}) {
	r.printStageEndIfNeeded(ctx)
	// Note: the "first" status here gets us the number of unflushed
	// bytes left at the time we started printing.  However, we don't
	// have the total number of bytes being flushed to the server
	// throughout the whole operation, which would be more
	// informative.  It would be better to have that as the
	// denominator, but there's no easy way to get it right now.
	firstStatus, err := jManager.JournalStatus(tlfID)
	if err != nil {
		r.log.CDebugf(ctx, "Error getting status: %+v", err)
		return
	}
	if firstStatus.UnflushedBytes == 0 {
		return
	}
	adj := "encrypted"
	if r.h.Type() == tlf.Public {
		adj = "signed"
	}
	if r.verbosity >= 1 {
		r.printStageStart(ctx,
			[]byte(fmt.Sprintf("Syncing %s data to Keybase: ", adj)),
			"mem.flush.prof", "")
	}
	r.log.CDebugf(ctx, "Waiting for %d journal bytes to flush",
		firstStatus.UnflushedBytes)

	bytesFmt := "(%.2f%%) %s... "
	str := fmt.Sprintf(
		bytesFmt, float64(0), humanizeBytes(0, firstStatus.UnflushedBytes))
	lastByteCount := len(str)
	if r.progress {
		_, err := r.errput.Write([]byte(str))
		if err != nil {
			r.log.CDebugf(ctx, "Couldn't write: %+v", err)
		}
	}

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			status, err := jManager.JournalStatus(tlfID)
			if err != nil {
				r.log.CDebugf(ctx, "Error getting status: %+v", err)
				return
			}

			if r.verbosity >= 1 && r.progress {
				eraseStr := strings.Repeat("\b", lastByteCount)
				flushed := firstStatus.UnflushedBytes - status.UnflushedBytes
				str := fmt.Sprintf(
					bytesFmt, percent(flushed, firstStatus.UnflushedBytes),
					humanizeBytes(flushed, firstStatus.UnflushedBytes))
				lastByteCount = len(str)
				_, err := r.errput.Write([]byte(eraseStr + str))
				if err != nil {
					r.log.CDebugf(ctx, "Couldn't write: %+v", err)
				}
			}
		case <-doneCh:
			if r.verbosity >= 1 && r.progress {
				eraseStr := strings.Repeat("\b", lastByteCount)
				// doneCh is closed. So assume journal flushing is done and
				// take the shortcut.
				flushed := firstStatus.UnflushedBytes
				str := fmt.Sprintf(
					bytesFmt, percent(flushed, firstStatus.UnflushedBytes),
					humanizeBytes(flushed, firstStatus.UnflushedBytes))
				_, err := r.errput.Write([]byte(eraseStr + str))
				if err != nil {
					r.log.CDebugf(ctx, "Couldn't write: %+v", err)
				}
			}

			if r.verbosity >= 1 {
				r.printStageEndIfNeeded(ctx)
			}
			return
		}
	}
}

func (r *runner) waitForJournal(ctx context.Context) error {
	// See if there are any deleted repos to clean up before we flush
	// the journal.
	err := libgit.CleanOldDeletedReposTimeLimited(ctx, r.config, r.h)
	if err != nil {
		return err
	}

	rootNode, _, err := r.config.KBFSOps().GetOrCreateRootNode(
		ctx, r.h, data.MasterBranch)
	if err != nil {
		return err
	}

	err = r.config.KBFSOps().SyncAll(ctx, rootNode.GetFolderBranch())
	if err != nil {
		return err
	}

	jManager, err := libkbfs.GetJournalManager(r.config)
	if err != nil {
		r.log.CDebugf(ctx, "No journal server: %+v", err)
		return nil
	}

	_, err = jManager.JournalStatus(rootNode.GetFolderBranch().Tlf)
	if err != nil {
		r.log.CDebugf(ctx, "No journal: %+v", err)
		return nil
	}

	printDoneCh := make(chan struct{})
	waitDoneCh := make(chan struct{})
	go func() {
		r.printJournalStatus(
			ctx, jManager, rootNode.GetFolderBranch().Tlf, waitDoneCh)
		close(printDoneCh)
	}()

	// This squashes everything written to the journal into a single
	// revision, to make sure that no partial states of the bare repo
	// are seen by other readers of the TLF.  It also waits for any
	// necessary conflict resolution to complete.
	err = jManager.FinishSingleOp(ctx, rootNode.GetFolderBranch().Tlf,
		nil, keybase1.MDPriorityGit)
	if err != nil {
		return err
	}
	close(waitDoneCh)
	<-printDoneCh

	// Make sure that everything is truly flushed.
	status, err := jManager.JournalStatus(rootNode.GetFolderBranch().Tlf)
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

	var symRefs []string
	hashesSeen := false
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
			hashesSeen = true
		case plumbing.SymbolicReference:
			value = "@" + ref.Target().String()
		default:
			value = "?"
		}
		refStr := value + " " + ref.Name().String() + "\n"
		if ref.Type() == plumbing.SymbolicReference {
			// Don't list any symbolic references until we're sure
			// there's at least one object available.  Otherwise
			// cloning an empty repo will result in an error because
			// the HEAD symbolic ref points to a ref that doesn't
			// exist.
			symRefs = append(symRefs, refStr)
			continue
		}
		r.log.CDebugf(ctx, "Listing ref %s", refStr)
		_, err = r.output.Write([]byte(refStr))
		if err != nil {
			return err
		}
	}

	if hashesSeen {
		for _, refStr := range symRefs {
			r.log.CDebugf(ctx, "Listing symbolic ref %s", refStr)
			_, err = r.output.Write([]byte(refStr))
			if err != nil {
				return err
			}
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
	plumbing.StatusCount:     "Counting and decrypting: ",
	plumbing.StatusRead:      "Reading and decrypting metadata: ",
	plumbing.StatusFixChains: "Fixing: ",
	plumbing.StatusSort:      "Sorting... ",
	plumbing.StatusDelta:     "Calculating deltas: ",
	// For us, a "send" actually means fetch.
	plumbing.StatusSend: "Fetching and decrypting objects: ",
	// For us, a "fetch" actually means writing objects to
	// the local journal.
	plumbing.StatusFetch:       "Preparing and encrypting: ",
	plumbing.StatusIndexHash:   "Indexing hashes: ",
	plumbing.StatusIndexCRC:    "Indexing CRCs: ",
	plumbing.StatusIndexOffset: "Indexing offsets: ",
}

func humanizeObjects(n int, d int) string {
	const k = 1000
	const m = k * 1000
	// Special case the counting of objects, when there's no denominator.
	if d == 1 {
		if n < k {
			return fmt.Sprintf("%d", n)
		} else if n < m {
			return fmt.Sprintf("%.2fK", float64(n)/k)
		}
		return fmt.Sprintf("%.2fM", float64(n)/m)
	}

	if d < k {
		return fmt.Sprintf("%d/%d", n, d)
	} else if d < m {
		return fmt.Sprintf("%.2f/%.2fK", float64(n)/k, float64(d)/k)
	}
	return fmt.Sprintf("%.2f/%.2fM", float64(n)/m, float64(d)/m)
}

func (r *runner) printJournalStatusUntilFlushed(
	ctx context.Context, doneCh <-chan struct{}) {
	rootNode, _, err := r.config.KBFSOps().GetOrCreateRootNode(
		ctx, r.h, data.MasterBranch)
	if err != nil {
		r.log.CDebugf(ctx, "GetOrCreateRootNode error: %+v", err)
		return
	}

	err = r.config.KBFSOps().SyncAll(ctx, rootNode.GetFolderBranch())
	if err != nil {
		r.log.CDebugf(ctx, "SyncAll error: %+v", err)
		return
	}

	jManager, err := libkbfs.GetJournalManager(r.config)
	if err != nil {
		r.log.CDebugf(ctx, "No journal server: %+v", err)
	}

	r.printJournalStatus(
		ctx, jManager, rootNode.GetFolderBranch().Tlf, doneCh)
}

func (r *runner) processGogitStatus(ctx context.Context,
	statusChan <-chan plumbing.StatusUpdate, fsEvents <-chan libfs.FSEvent) {
	if r.h.Type() == tlf.Public {
		gogitStagesToStatus[plumbing.StatusFetch] = "Preparing and signing: "
	}

	currStage := plumbing.StatusUnknown
	lastByteCount := 0
	for {
		if statusChan == nil && fsEvents == nil {
			// statusChan is never passed in as nil. So if it's nil, it's been
			// closed in the select/case below because receive failed. So
			// instead of letting select block forever, we break out of the
			// loop here.
			break
		}
		select {
		case update, ok := <-statusChan:
			if !ok {
				statusChan = nil
				continue
			}
			if update.Stage != currStage {
				if currStage != plumbing.StatusUnknown {
					r.printStageEndIfNeeded(ctx)
				}
				r.printStageStart(ctx,
					[]byte(gogitStagesToStatus[update.Stage]),
					fmt.Sprintf("mem.%d.prof", update.Stage),
					fmt.Sprintf("cpu.%d.prof", update.Stage),
				)
				lastByteCount = 0
				if stage, ok := gogitStagesToStatus[update.Stage]; ok {
					r.log.CDebugf(ctx, "Entering stage: %s - %d total objects",
						stage, update.ObjectsTotal)
				}
			}
			eraseStr := strings.Repeat("\b", lastByteCount)
			newStr := ""

			switch update.Stage {
			case plumbing.StatusDone:
				r.log.CDebugf(ctx, "Status processing done")
				return
			case plumbing.StatusCount:
				newStr = fmt.Sprintf(
					"%s objects... ", humanizeObjects(update.ObjectsTotal, 1))
			case plumbing.StatusSort:
			default:
				newStr = fmt.Sprintf(
					"(%.2f%%) %s objects... ",
					percent(int64(update.ObjectsDone), int64(update.ObjectsTotal)),
					humanizeObjects(update.ObjectsDone, update.ObjectsTotal))
			}

			lastByteCount = len(newStr)
			if r.progress {
				_, err := r.errput.Write([]byte(eraseStr + newStr))
				if err != nil {
					r.log.CDebugf(ctx, "Couldn't write: %+v", err)
				}
			}

			currStage = update.Stage
		case fsEvent, ok := <-fsEvents:
			if !ok {
				fsEvents = nil
				continue
			}
			switch fsEvent.EventType {
			case libfs.FSEventLock, libfs.FSEventUnlock:
				r.printStageEndIfNeeded(ctx)
				// Since we flush all blocks in Lock, subsequent calls to
				// Lock/Unlock normally don't take much time. So we only print
				// journal status if it's been longer than
				// unlockPrintBytesStatusThreshold and fsEvent.Done hasn't been
				// closed.
				timer := time.NewTimer(unlockPrintBytesStatusThreshold)
				select {
				case <-timer.C:
					r.printJournalStatusUntilFlushed(ctx, fsEvent.Done)
				case <-fsEvent.Done:
					timer.Stop()
				case <-ctx.Done():
					timer.Stop()
				}
			}
		}
	}
	r.log.CDebugf(ctx, "Status channel closed")
	r.printStageEndIfNeeded(ctx)
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
			if fi.Name() == "." {
				continue
			}
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
				newStr := fmt.Sprintf(
					"%s... ", humanizeBytes(totalSoFar+bytes, 1))
				toErase = len(newStr)
				_, err := r.errput.Write([]byte(eraseStr + newStr))
				if err != nil {
					return 0, 0, err
				}
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
	newStr := fmt.Sprintf("(%.2f%%) %s... ",
		percent(sw.soFar, sw.totalBytes),
		humanizeBytes(sw.soFar, sw.totalBytes))
	_, err = sw.r.errput.Write([]byte(eraseStr + newStr))
	if err != nil {
		return n, err
	}
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

func (r *runner) copyFileWithCount(
	ctx context.Context, from billy.Filesystem, to billy.Filesystem,
	name, countingText, countingProf, copyingText, copyingProf string) error {
	var sw *statusWriter
	if r.verbosity >= 1 {
		// Get the total number of bytes we expect to fetch, for the
		// progress report.
		startTime := r.config.Clock().Now()
		zeroStr := fmt.Sprintf("%s... ", humanizeBytes(0, 1))
		_, err := r.errput.Write(
			[]byte(fmt.Sprintf("%s: %s", countingText, zeroStr)))
		if err != nil {
			return err
		}
		fi, err := from.Stat(name)
		if err != nil {
			return err
		}
		eraseStr := strings.Repeat("\b", len(zeroStr))
		newStr := fmt.Sprintf("%s... ", humanizeBytes(fi.Size(), 1))
		_, err = r.errput.Write([]byte(eraseStr + newStr))
		if err != nil {
			return err
		}

		elapsedStr := r.getElapsedStr(
			ctx, startTime, fmt.Sprintf("mem.%s.prof", countingProf), "")
		_, err = r.errput.Write([]byte("done." + elapsedStr + "\n"))
		if err != nil {
			return err
		}

		sw = &statusWriter{r, nil, 0, fi.Size(), 0}
		_, err = r.errput.Write([]byte(fmt.Sprintf("%s: ", copyingText)))
		if err != nil {
			return err
		}
	}

	// Copy the file directly into the other file system.
	startTime := r.config.Clock().Now()
	err := r.copyFile(ctx, from, to, name, sw)
	if err != nil {
		return err
	}

	if r.verbosity >= 1 {
		elapsedStr := r.getElapsedStr(
			ctx, startTime, fmt.Sprintf("mem.%s.prof", copyingProf), "")
		_, err = r.errput.Write([]byte("done." + elapsedStr + "\n"))
		if err != nil {
			return err
		}
	}
	return nil
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
			if fi.Name() == "." {
				continue
			}
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

func (r *runner) recursiveCopyWithCounts(
	ctx context.Context, from billy.Filesystem, to billy.Filesystem,
	countingText, countingProf, copyingText, copyingProf string) error {
	var sw *statusWriter
	if r.verbosity >= 1 {
		// Get the total number of bytes we expect to fetch, for the
		// progress report.
		startTime := r.config.Clock().Now()
		_, err := r.errput.Write([]byte(fmt.Sprintf("%s: ", countingText)))
		if err != nil {
			return err
		}
		b, _, err := r.recursiveByteCount(ctx, from, 0, 0)
		if err != nil {
			return err
		}
		elapsedStr := r.getElapsedStr(
			ctx, startTime, fmt.Sprintf("mem.%s.prof", countingProf), "")
		_, err = r.errput.Write([]byte("done." + elapsedStr + "\n"))
		if err != nil {
			return err
		}

		sw = &statusWriter{r, nil, 0, b, 0}
		_, err = r.errput.Write([]byte(fmt.Sprintf("%s: ", copyingText)))
		if err != nil {
			return err
		}
	}

	// Copy the entire subdirectory straight into the other file
	// system.  This saves time and memory relative to going through
	// go-git.
	startTime := r.config.Clock().Now()
	err := r.recursiveCopy(ctx, from, to, sw)
	if err != nil {
		return err
	}

	if r.verbosity >= 1 {
		elapsedStr := r.getElapsedStr(
			ctx, startTime, fmt.Sprintf("mem.%s.prof", copyingProf), "")
		_, err := r.errput.Write([]byte("done." + elapsedStr + "\n"))
		if err != nil {
			return err
		}
	}
	return nil
}

// checkGC should only be called from the main command-processing
// goroutine.
func (r *runner) checkGC(ctx context.Context) (err error) {
	if r.gcDone {
		return nil
	}
	r.gcDone = true

	if !r.isManagedByApp() {
		r.log.CDebugf(ctx, "Skipping GC check")
		return nil
	}

	r.log.CDebugf(ctx, "Checking for GC")

	var stageSync sync.Once
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	go func() {
		timer := time.NewTimer(gcPrintStatusThreshold)
		select {
		case <-timer.C:
			stageSync.Do(func() {
				r.printStageStart(ctx,
					[]byte("Checking repo for inefficiencies... "),
					"mem.gc.prof", "cpu.gc.prof")
			})
		case <-ctx.Done():
			timer.Stop()
		}
	}()
	defer func() {
		// Prevent stage from starting after we finish the stage.
		stageSync.Do(func() {})
		if err == nil {
			r.printStageEndIfNeeded(ctx)
		}
	}()

	fs, _, err := libgit.GetRepoAndID(
		ctx, r.config, r.h, r.repo, r.uniqID)
	if _, noRepo := errors.Cause(err).(libkb.RepoDoesntExistError); noRepo {
		r.log.CDebugf(ctx, "No such repo: %v", err)
		return nil
	} else if err != nil {
		return err
	}

	lastGCTime, err := libgit.LastGCTime(ctx, fs)
	if err != nil {
		return err
	}
	if r.config.Clock().Now().Sub(lastGCTime) < minGCInterval {
		r.log.CDebugf(ctx, "Last GC happened at %s; skipping GC check",
			lastGCTime)
		return nil
	}

	storage, err := libgit.NewGitConfigWithoutRemotesStorer(fs)
	if err != nil {
		return err
	}

	gco := libgit.GCOptions{
		MaxLooseRefs:         defaultMaxLooseRefs,
		PruneMinLooseObjects: defaultPruneMinLooseObjects,
		PruneExpireTime:      time.Time{},
		MaxObjectPacks:       defaultMaxObjectPacks,
	}
	doPackRefs, _, doPruneLoose, doObjectRepack, _, err := libgit.NeedsGC(
		storage, gco)
	if err != nil {
		return err
	}
	if !doPackRefs && !doPruneLoose && !doObjectRepack {
		r.log.CDebugf(ctx, "No GC needed")
		return nil
	}
	r.log.CDebugf(ctx, "GC needed: doPackRefs=%t, doPruneLoose=%t, "+
		"doObjectRepack=%t", doPackRefs, doPruneLoose, doObjectRepack)
	command := fmt.Sprintf("keybase git gc %s", r.repo)
	if r.h.Type() == tlf.SingleTeam {
		tid := r.h.FirstResolvedWriter()
		teamName, err := r.config.KBPKI().GetNormalizedUsername(
			ctx, tid, r.config.OfflineAvailabilityForID(r.h.TlfID()))
		if err != nil {
			return err
		}
		command += fmt.Sprintf(" --team %s", teamName)
	}
	_, err = r.errput.Write([]byte(
		"Tip: this repo could be sped up with some " +
			"garbage collection. Run this command:\n"))
	if err != nil {
		return err
	}
	_, err = r.errput.Write([]byte("\t" + command + "\n"))
	return err
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

	err = r.recursiveCopyWithCounts(
		ctx, fsObjects, localFSObjects,
		"Counting", "count", "Cryptographic cloning", "clone")
	if err != nil {
		return err
	}

	err = r.checkGC(ctx)
	if err != nil {
		return err
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
		go r.processGogitStatus(ctx, s, nil)
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

	err = r.checkGC(ctx)
	if err != nil {
		return err
	}

	_, err = r.output.Write([]byte("\n"))
	return err
}

// canPushAll returns true if a) the KBFS repo is currently empty, and
// b) we've been asked to push all the local references (i.e.,
// --all/--mirror).
func (r *runner) canPushAll(
	ctx context.Context, repo *gogit.Repository, args [][]string) (
	canPushAll, kbfsRepoEmpty bool, err error) {
	refs, err := repo.References()
	if err != nil {
		return false, false, err
	}
	defer refs.Close()

	// Iterate through the remote references.
	for {
		ref, err := refs.Next()
		if errors.Cause(err) == io.EOF {
			break
		} else if err != nil {
			return false, false, err
		}

		if ref.Type() != plumbing.SymbolicReference {
			r.log.CDebugf(ctx, "Remote has at least one non-symbolic ref: %s",
				ref.String())
			return false, false, nil
		}
	}

	// Build a set of all the source refs that the user is pushing.
	sources := make(map[string]bool)
	for _, push := range args {
		if len(push) != 1 {
			return false, false, errors.Errorf("Bad push request: %v", push)
		}
		refspec := gogitcfg.RefSpec(push[0])
		// If some ref is being pushed to a different name on the
		// remote, we can't do a push-all.
		if refspec.Src() != refspec.Dst("").String() {
			return false, true, nil
		}

		src := refspec.Src()
		sources[src] = true
	}

	localGit := osfs.New(r.gitDir)
	localStorer, err := filesystem.NewStorage(localGit)
	if err != nil {
		return false, false, err
	}
	localRefs, err := localStorer.IterReferences()
	if err != nil {
		return false, false, err
	}

	// Check whether all of the local refs are being used as a source
	// for this push.  If not, we can't blindly push everything.
	for {
		ref, err := localRefs.Next()
		if errors.Cause(err) == io.EOF {
			break
		}
		if err != nil {
			return false, false, err
		}

		if ref.Type() == plumbing.SymbolicReference {
			continue
		}

		// If the local repo has a non-symbolic ref that's not being
		// pushed, we can't push everything blindly, otherwise we
		// might leak some data.
		if !sources[ref.Name().String()] {
			r.log.CDebugf(ctx, "Not pushing local ref %s", ref)
			return false, true, nil
		}
	}

	return true, true, nil
}

func (r *runner) pushAll(ctx context.Context, fs *libfs.FS) (err error) {
	r.log.CDebugf(ctx, "Pushing the entire local repo")
	localFS := osfs.New(r.gitDir)

	// First copy objects.
	localFSObjects, err := localFS.Chroot("objects")
	if err != nil {
		return err
	}
	fsObjects, err := fs.Chroot("objects")
	if err != nil {
		return err
	}

	verb := "encrypting"
	if r.h.Type() == tlf.Public {
		verb = "signing"
	}

	err = r.recursiveCopyWithCounts(
		ctx, localFSObjects, fsObjects,
		"Counting objects", "countobj",
		fmt.Sprintf("Preparing and %s objects", verb), "pushobj")
	if err != nil {
		return err
	}

	// Hold the packed refs lock file while transferring, so we don't
	// clash with anyone else trying to push-init this repo.  go-git
	// takes the same lock while writing packed-refs during a
	// `Remote.Fetch()` operation (used in `pushSome()` below).
	lockFile, err := fs.Create(packedRefsTempPath)
	if err != nil {
		return err
	}
	defer func() {
		closeErr := lockFile.Close()
		if closeErr != nil && err == nil {
			err = closeErr
		}
	}()

	err = lockFile.Lock()
	if err != nil {
		return err
	}

	// Next, copy refs.
	localFSRefs, err := localFS.Chroot("refs")
	if err != nil {
		return err
	}
	fsRefs, err := fs.Chroot("refs")
	if err != nil {
		return err
	}
	err = r.recursiveCopyWithCounts(
		ctx, localFSRefs, fsRefs,
		"Counting refs", "countref",
		fmt.Sprintf("Preparing and %s refs", verb), "pushref")
	if err != nil {
		return err
	}

	// Finally, packed refs if it exists.
	_, err = localFS.Stat(packedRefsPath)
	if os.IsNotExist(err) {
		return nil
	} else if err != nil {
		return err
	}

	return r.copyFileWithCount(ctx, localFS, fs, packedRefsPath,
		"Counting packed refs", "countprefs",
		fmt.Sprintf("Preparing and %s packed refs", verb), "pushprefs")
}

func dstNameFromRefString(refStr string) plumbing.ReferenceName {
	return gogitcfg.RefSpec(refStr).Dst("")
}

// parentCommitsForRef returns a map of refs with a list of commits for each
// ref, newest first. It only includes commits that exist in `localStorer` but
// not in `remoteStorer`.
func (r *runner) parentCommitsForRef(ctx context.Context,
	localStorer gogitstor.Storer, remoteStorer gogitstor.Storer,
	refs map[gogitcfg.RefSpec]bool) (libgit.RefDataByName, error) {

	commitsByRef := make(libgit.RefDataByName, len(refs))
	haves := make(map[plumbing.Hash]bool)

	for refspec := range refs {
		if refspec.IsDelete() {
			commitsByRef[refspec.Dst("")] = &libgit.RefData{
				IsDelete: true,
			}
			continue
		}
		refName := plumbing.ReferenceName(refspec.Src())
		resolved, err := gogitstor.ResolveReference(localStorer, refName)
		if err != nil {
			r.log.CDebugf(ctx, "Error resolving ref %s", refName)
		}
		if resolved != nil {
			refName = resolved.Name()
		}

		ref, err := localStorer.Reference(refName)
		if err != nil {
			r.log.CDebugf(ctx, "Error getting reference %s: %+v",
				refName, err)
			continue
		}
		hash := ref.Hash()

		// Get the HEAD commit for the ref from the local repository.
		commit, err := gogitobj.GetCommit(localStorer, hash)
		if err != nil {
			r.log.CDebugf(ctx, "Error getting commit for hash %s (%s): %+v",
				string(hash[:]), refName, err)
			continue
		}

		// Iterate through the commits backward, until we experience any of the
		// following:
		// 1. Find a commit that the remote knows about,
		// 2. Reach our maximum number of commits to check,
		// 3. Run out of commits.
		walker := gogitobj.NewCommitPreorderIter(commit, haves, nil)
		toVisit := maxCommitsToVisitPerRef
		dstRefName := refspec.Dst("")
		commitsByRef[dstRefName] = &libgit.RefData{
			IsDelete: refspec.IsDelete(),
			Commits:  make([]*gogitobj.Commit, 0, maxCommitsToVisitPerRef),
		}
		err = walker.ForEach(func(c *gogitobj.Commit) error {
			haves[c.Hash] = true
			toVisit--
			// If toVisit starts out at 0 (indicating there is no
			// max), then it will be negative here and we won't stop
			// early.
			if toVisit == 0 {
				// Append a sentinel value to communicate that there would be
				// more commits.
				commitsByRef[dstRefName].Commits =
					append(commitsByRef[dstRefName].Commits,
						libgit.CommitSentinelValue)
				return gogitstor.ErrStop
			}
			hasEncodedObjectErr := remoteStorer.HasEncodedObject(c.Hash)
			if hasEncodedObjectErr == nil {
				return gogitstor.ErrStop
			}
			commitsByRef[dstRefName].Commits =
				append(commitsByRef[dstRefName].Commits, c)
			return nil
		})
		if err != nil {
			return nil, err
		}
	}
	return commitsByRef, nil
}

func (r *runner) pushSome(
	ctx context.Context, repo *gogit.Repository, fs *libfs.FS, args [][]string,
	kbfsRepoEmpty bool) (map[string]error, error) {
	r.log.CDebugf(ctx, "Pushing %d refs into %s", len(args), r.gitDir)

	remote, err := repo.CreateRemote(&gogitcfg.RemoteConfig{
		Name: localRepoRemoteName,
		URLs: []string{r.gitDir},
	})
	if err != nil {
		return nil, err
	}

	results := make(map[string]error, len(args))
	var refspecs []gogitcfg.RefSpec
	refs := make(map[string]bool, len(args))
	for _, push := range args {
		if len(push) != 1 {
			return nil, errors.Errorf("Bad push request: %v", push)
		}
		refspec := gogitcfg.RefSpec(push[0])
		err := refspec.Validate()
		if err != nil {
			return nil, err
		}

		// Delete the reference in the repo if needed; otherwise,
		// fetch from the local repo into the remote repo.
		if refspec.IsDelete() {
			dst := dstNameFromRefString(push[0])
			if refspec.IsWildcard() {
				results[dst.String()] = errors.Errorf(
					"Wildcards not supported for deletes: %s", refspec)
				continue
			}
			err = repo.Storer.RemoveReference(dst)
			if err == gogit.NoErrAlreadyUpToDate {
				err = nil
			}
			results[dst.String()] = err
		} else {
			refs[refspec.Src()] = true
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
			go func() {
				events := make(chan libfs.FSEvent)
				fs.SubscribeToEvents(events)
				r.processGogitStatus(ctx, s, events)
				fs.UnsubscribeToEvents(events)
				// Drain any pending writes to the channel.
				for range events {
				}
			}()
		}

		if kbfsRepoEmpty {
			r.log.CDebugf(
				ctx, "Requesting a pack-refs file for %d refs", len(refspecs))
		}

		err = remote.FetchContext(ctx, &gogit.FetchOptions{
			RemoteName: localRepoRemoteName,
			RefSpecs:   refspecs,
			StatusChan: statusChan,
			PackRefs:   kbfsRepoEmpty,
		})
		if err == gogit.NoErrAlreadyUpToDate {
			err = nil
		}

		// All non-deleted refspecs in the batch get the same error.
		for _, refspec := range refspecs {
			dst := refspec.Dst("")
			results[dst.String()] = err
		}
	}
	return results, nil
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
	commits libgit.RefDataByName, err error) {
	repo, fs, err := r.initRepoIfNeeded(ctx, gitCmdPush)
	if err != nil {
		return nil, err
	}

	canPushAll, kbfsRepoEmpty, err := r.canPushAll(ctx, repo, args)
	if err != nil {
		return nil, err
	}

	localGit := osfs.New(r.gitDir)
	localStorer, err := filesystem.NewStorage(localGit)
	if err != nil {
		return nil, err
	}

	refspecs := make(map[gogitcfg.RefSpec]bool, len(args))
	for _, push := range args {
		// `canPushAll` already validates the push reference.
		refspec := gogitcfg.RefSpec(push[0])
		refspecs[refspec] = true
	}

	// Get all commits associated with the refs. This must happen before the
	// push for us to be able to calculate the difference.
	commits, err = r.parentCommitsForRef(ctx, localStorer,
		repo.Storer, refspecs)
	if err != nil {
		return nil, err
	}

	var results map[string]error
	// Ignore pushAll for commit collection, for now.
	if canPushAll {
		err = r.pushAll(ctx, fs)
		// All refs in the batch get the same error.
		results = make(map[string]error, len(args))
		for _, push := range args {
			// `canPushAll` already validates the push reference.
			dst := dstNameFromRefString(push[0]).String()
			results[dst] = err
		}
	} else {
		results, err = r.pushSome(ctx, repo, fs, args, kbfsRepoEmpty)
	}
	if err != nil {
		return nil, err
	}

	err = r.waitForJournal(ctx)
	if err != nil {
		return nil, err
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
		if err != nil {
			return nil, err
		}
	}

	// Remove any errored commits so that we don't send an update
	// message about them.
	for refspec := range refspecs {
		dst := refspec.Dst("")
		if results[dst.String()] != nil {
			r.log.CDebugf(
				ctx, "Removing commit result for errored push on refspec %s",
				refspec)
			delete(commits, dst)
		}
	}

	if len(commits) > 0 {
		err = libgit.UpdateRepoMD(ctx, r.config, r.h, fs,
			keybase1.GitPushType_DEFAULT, "", commits)
		if err != nil {
			return nil, err
		}
	}

	err = r.checkGC(ctx)
	if err != nil {
		return nil, err
	}

	_, err = r.output.Write([]byte("\n"))
	if err != nil {
		return nil, err
	}
	return commits, nil
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
			_, _ = r.output.Write(
				[]byte(fmt.Sprintf("error %s\n", err.Error())))
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
	case gitOptionPushcert:
		if args[1] == gitOptionIfAsked {
			// "if-asked" means we should sign only if the server
			// supports it. Our server doesn't support it, but we
			// should still accept the configuration.
			result = "ok"
		} else {
			b, err := strconv.ParseBool(args[1])
			if err != nil {
				return err
			}
			if b {
				// We don't support signing.
				r.log.CDebugf(ctx, "Signing is unsupported")
				result = "unsupported"
			} else {
				result = "ok"
			}
		}
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
				switch {
				case len(fetchBatch) > 0:
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
				case len(pushBatch) > 0:
					r.log.CDebugf(ctx, "Processing push batch")
					_, err = r.handlePushBatch(ctx, pushBatch)
					if err != nil {
						return err
					}
					pushBatch = nil
					continue
				default:
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
	var wg sync.WaitGroup
	defer wg.Wait()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	// Allow the creation of .kbfs_git within KBFS.
	ctx = context.WithValue(ctx, libkbfs.CtxAllowNameKey, kbfsRepoDir)

	// Process the commands with a separate queue in a separate
	// goroutine, so we can exit as soon as EOF is received
	// (indicating the corresponding `git` command has been
	// interrupted).
	commandChan := make(chan string, 100)
	processorErrChan := make(chan error, 1)
	wg.Add(1)
	go func() {
		defer wg.Done()
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
