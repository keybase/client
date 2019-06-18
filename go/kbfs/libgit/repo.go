// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"bytes"
	"context"
	"encoding/hex"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	billy "gopkg.in/src-d/go-billy.v4"
	gogit "gopkg.in/src-d/go-git.v4"
	"gopkg.in/src-d/go-git.v4/plumbing"
	"gopkg.in/src-d/go-git.v4/plumbing/object"
	"gopkg.in/src-d/go-git.v4/plumbing/storer"
	"gopkg.in/src-d/go-git.v4/storage"
	"gopkg.in/src-d/go-git.v4/storage/filesystem"
)

const (
	kbfsRepoDir              = ".kbfs_git"
	kbfsConfigName           = "kbfs_config"
	kbfsConfigNameTemp       = "._kbfs_config"
	gitSuffixToIgnore        = ".git"
	kbfsDeletedReposDir      = ".kbfs_deleted_repos"
	minDeletedAgeForCleaning = 1 * time.Hour
	cleaningTimeLimit        = 2 * time.Second
	repoGCLockFileName       = ".gc"
	repoGCInProgressFileName = ".gc_in_progress"
	gcTimeLimit              = 1 * time.Hour
)

// CommitSentinelValue marks the end of a list of commits, where there are
// still commits that haven't been read.
// Use the zero-value `nil`.
var CommitSentinelValue *object.Commit

// This character set is what Github supports in repo names.  It's
// probably to avoid any problems when cloning onto filesystems that
// have different Unicode decompression schemes
// (https://en.wikipedia.org/wiki/Unicode_equivalence).  There's no
// internal reason to be so restrictive, but it probably makes sense
// to start off more restrictive and then relax things later as we
// test.
var repoNameRE = regexp.MustCompile(`^([a-zA-Z0-9][a-zA-Z0-9_\.-]*)$`)

// RefData stores the data for a ref.
type RefData struct {
	IsDelete bool
	Commits  []*object.Commit
}

// RefDataByName represents a map of reference names to data about that ref.
type RefDataByName map[plumbing.ReferenceName]*RefData

func checkValidRepoName(repoName string, config libkbfs.Config) bool {
	return len(repoName) >= 1 &&
		uint32(len(repoName)) <= config.MaxNameBytes() &&
		(os.Getenv("KBFS_GIT_REPONAME_SKIP_CHECK") != "" ||
			repoNameRE.MatchString(repoName))
}

// For the common "repo doesn't exist" case, use the error type that the client can recognize.
func castNoSuchNameError(err error, repoName string) error {
	switch errors.Cause(err).(type) {
	case idutil.NoSuchNameError:
		return libkb.RepoDoesntExistError{
			Name: repoName,
		}
	default:
		return err
	}
}

// CleanOldDeletedRepos completely removes any "deleted" repos that
// have been deleted for longer than `minDeletedAgeForCleaning`.  The
// caller is responsible for syncing any data to disk, if desired.
func CleanOldDeletedRepos(
	ctx context.Context, config libkbfs.Config,
	tlfHandle *tlfhandle.Handle) (err error) {
	fs, err := libfs.NewFS(
		ctx, config, tlfHandle, data.MasterBranch,
		path.Join(kbfsRepoDir, kbfsDeletedReposDir),
		"" /* uniq ID isn't used for removals */, keybase1.MDPriorityGit)
	switch errors.Cause(err).(type) {
	case idutil.NoSuchNameError:
		// Nothing to clean.
		return nil
	case nil:
	default:
		return err
	}

	deletedRepos, err := fs.ReadDir("/")
	if err != nil {
		return err
	}

	if len(deletedRepos) == 0 {
		return nil
	}

	log := config.MakeLogger("")
	now := config.Clock().Now()

	log.CDebugf(ctx, "Checking %d deleted repos for cleaning in %s",
		len(deletedRepos), tlfHandle.GetCanonicalPath())
	defer func() {
		log.CDebugf(ctx, "Done checking deleted repos: %+v", err)
	}()
	for _, fi := range deletedRepos {
		parts := strings.Split(fi.Name(), "-")
		if len(parts) < 2 {
			log.CDebugf(ctx,
				"Ignoring deleted repo name with wrong format: %s", fi.Name())
			continue
		}

		deletedTimeUnixNano, err := strconv.ParseInt(
			parts[len(parts)-1], 10, 64)
		if err != nil {
			log.CDebugf(ctx,
				"Ignoring deleted repo name with wrong format: %s: %+v",
				fi.Name(), err)
			continue
		}

		deletedTime := time.Unix(0, deletedTimeUnixNano)
		if deletedTime.Add(minDeletedAgeForCleaning).After(now) {
			// Repo was deleted too recently.
			continue
		}

		log.CDebugf(ctx, "Cleaning deleted repo %s", fi.Name())
		err = libfs.RecursiveDelete(ctx, fs, fi)
		if err != nil {
			return err
		}
	}
	return nil
}

// CleanOldDeletedReposTimeLimited is the same as
// `CleanOldDeletedRepos`, except it limits the time spent on
// cleaning, deleting as much data as possible within the given time
// limit (without returning an error).
func CleanOldDeletedReposTimeLimited(
	ctx context.Context, config libkbfs.Config,
	tlfHandle *tlfhandle.Handle) error {
	ctx, cancel := context.WithTimeout(ctx, cleaningTimeLimit)
	defer cancel()
	err := CleanOldDeletedRepos(ctx, config, tlfHandle)
	switch errors.Cause(err) {
	case context.DeadlineExceeded, context.Canceled:
		return nil
	default:
		if _, ok := errors.Cause(err).(libkbfs.OfflineUnsyncedError); ok {
			return nil
		}
		return err
	}
}

// UpdateRepoMD lets the Keybase service know that a repo's MD has
// been updated.
func UpdateRepoMD(ctx context.Context, config libkbfs.Config,
	tlfHandle *tlfhandle.Handle, fs billy.Filesystem,
	pushType keybase1.GitPushType,
	oldRepoName string, refDataByName RefDataByName) error {
	folder := tlfHandle.ToFavorite().ToKBFolderHandle(false)

	// Get the user-formatted repo name.
	f, err := fs.Open(kbfsConfigName)
	if err != nil {
		return err
	}
	defer f.Close()
	buf, err := ioutil.ReadAll(f)
	if err != nil {
		return err
	}
	c, err := configFromBytes(buf)
	if err != nil {
		return err
	}

	gitRefMetadata := make([]keybase1.GitRefMetadata, 0, len(refDataByName))
	for refName, refData := range refDataByName {
		hasMoreCommits := false
		kbCommits := make([]keybase1.GitCommit, 0, len(refData.Commits))
		for _, c := range refData.Commits {
			if c == CommitSentinelValue {
				// Accept a sentinel value at the end of the commit list that
				// indicates that there would have been more commits, but we
				// stopped due to a cap.
				hasMoreCommits = true
				break
			}
			kbCommits = append(kbCommits, keybase1.GitCommit{
				CommitHash:  hex.EncodeToString(c.Hash[:]),
				Message:     c.Message,
				AuthorName:  c.Author.Name,
				AuthorEmail: c.Author.Email,
				Ctime:       keybase1.Time(c.Author.When.Unix()),
			})
		}
		gitRefMetadata = append(gitRefMetadata, keybase1.GitRefMetadata{
			RefName:              string(refName),
			Commits:              kbCommits,
			MoreCommitsAvailable: hasMoreCommits,
			IsDelete:             refData.IsDelete,
		})
	}
	log := config.MakeLogger("")
	log.CDebugf(ctx, "Putting git MD update")
	err = config.KBPKI().PutGitMetadata(
		ctx, folder, keybase1.RepoID(c.ID.String()),
		keybase1.GitLocalMetadata{
			RepoName:         keybase1.GitRepoName(c.Name),
			Refs:             gitRefMetadata,
			PushType:         pushType,
			PreviousRepoName: keybase1.GitRepoName(oldRepoName),
		})
	if err != nil {
		// Just log the put error, it shouldn't block the success of
		// the overall git operation.
		log.CDebugf(ctx, "Failed to put git metadata: %+v", err)
	}
	return nil
}

func normalizeRepoName(repoName string) string {
	return strings.TrimSuffix(strings.ToLower(repoName), gitSuffixToIgnore)
}

func takeConfigLock(
	fs *libfs.FS, tlfHandle *tlfhandle.Handle, repoName string) (
	closer io.Closer, err error) {
	// Double-check that the namespace of the FS matches the
	// normalized repo name, so that we're locking only the config
	// file within the actual repo we care about.  This is appended to
	// the default locknamespace for a libfs.FS instance.
	normalizedRepoName := normalizeRepoName(repoName)
	nsPath := path.Join(
		"/keybase", tlfHandle.Type().String(), kbfsRepoDir, normalizedRepoName)
	expectedNamespace := make([]byte, len(nsPath))
	copy(expectedNamespace, nsPath)
	if !bytes.Equal(expectedNamespace, fs.GetLockNamespace()) {
		return nil, errors.Errorf("Unexpected FS namespace for repo %s: %s",
			repoName, string(fs.GetLockNamespace()))
	}

	// Lock a temp file to avoid a duplicate create of the actual
	// file.  TODO: clean up this file at some point?
	f, err := fs.Create(kbfsConfigNameTemp)
	if err != nil && !os.IsExist(err) {
		return nil, err
	} else if os.IsExist(err) {
		f, err = fs.Open(kbfsConfigNameTemp)
	}
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			f.Close()
		}
	}()

	// Take the lock
	err = f.Lock()
	if err != nil {
		return nil, err
	}
	return f, nil
}

func makeExistingRepoError(
	ctx context.Context, config libkbfs.Config, repoFS billy.Filesystem,
	repoName string) error {
	config.MakeLogger("").CDebugf(
		ctx, "Config file for repo %s already exists", repoName)
	f, err := repoFS.Open(kbfsConfigName)
	if err != nil {
		return err
	}
	defer f.Close()
	buf, err := ioutil.ReadAll(f)
	if err != nil {
		return err
	}
	existingConfig, err := configFromBytes(buf)
	if err != nil {
		return err
	}
	return errors.WithStack(libkb.RepoAlreadyExistsError{
		DesiredName:  repoName,
		ExistingName: existingConfig.Name,
		ExistingID:   existingConfig.ID.String(),
	})
}

func createNewRepoAndID(
	ctx context.Context, config libkbfs.Config, tlfHandle *tlfhandle.Handle,
	repoName string, fs *libfs.FS) (repoID ID, err error) {
	// TODO: take a global repo lock here to make sure only one
	// client generates the repo ID.
	repoID, err = makeRandomID()
	if err != nil {
		return NullID, err
	}
	config.MakeLogger("").CDebugf(ctx,
		"Creating a new repo %s in %s: repoID=%s",
		repoName, tlfHandle.GetCanonicalPath(), repoID)

	lockFile, err := takeConfigLock(fs, tlfHandle, repoName)
	if err != nil {
		return NullID, err
	}
	defer func() {
		closeErr := lockFile.Close()
		if err == nil {
			err = closeErr
		}
	}()

	_, err = fs.Stat(kbfsConfigName)
	if err == nil {
		// The config file already exists, so someone else already
		// initialized the repo.
		return NullID, makeExistingRepoError(ctx, config, fs, repoName)
	} else if !os.IsNotExist(err) {
		return NullID, err
	}

	f, err := fs.Create(kbfsConfigName)
	if err != nil {
		return NullID, err
	}
	defer f.Close()

	session, err := config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return NullID, err
	}
	c := &Config{
		ID:         repoID,
		Name:       repoName,
		CreatorUID: session.UID.String(),
		Ctime:      config.Clock().Now().UnixNano(),
	}
	buf, err := c.toBytes()
	if err != nil {
		return NullID, err
	}
	_, err = f.Write(buf)
	if err != nil {
		return NullID, err
	}

	err = UpdateRepoMD(
		ctx, config, tlfHandle, fs, keybase1.GitPushType_CREATEREPO, "", nil)
	if err != nil {
		return NullID, err
	}

	return repoID, nil
}

func lookupOrCreateDir(ctx context.Context, config libkbfs.Config,
	n libkbfs.Node, name string) (libkbfs.Node, error) {
	newNode, _, err := config.KBFSOps().Lookup(ctx, n, name)
	switch errors.Cause(err).(type) {
	case idutil.NoSuchNameError:
		newNode, _, err = config.KBFSOps().CreateDir(ctx, n, name)
		if err != nil {
			return nil, err
		}
	case nil:
	default:
		return nil, err
	}
	return newNode, nil
}

type repoOpType int

const (
	getOrCreate repoOpType = iota
	createOnly
	getOnly
)

func getOrCreateRepoAndID(
	ctx context.Context, config libkbfs.Config, tlfHandle *tlfhandle.Handle,
	repoName string, uniqID string, op repoOpType) (
	fs *libfs.FS, id ID, err error) {
	if !checkValidRepoName(repoName, config) {
		return nil, NullID,
			errors.WithStack(libkb.InvalidRepoNameError{Name: repoName})
	}

	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, tlfHandle, data.MasterBranch)
	if err != nil {
		return nil, NullID, err
	}
	normalizedRepoName := normalizeRepoName(repoName)

	// If the user doesn't have write access, but the repo doesn't
	// exist, give them a nice error message.
	repoExists := false
	defer func() {
		_, isWriteAccessErr := errors.Cause(err).(tlfhandle.WriteAccessError)
		if !repoExists && isWriteAccessErr {
			err = libkb.RepoDoesntExistError{Name: repoName}
		}
	}()

	repoDir, err := lookupOrCreateDir(ctx, config, rootNode, kbfsRepoDir)
	if err != nil {
		return nil, NullID, err
	}

	_, repoEI, err := config.KBFSOps().Lookup(ctx, repoDir, normalizedRepoName)
	switch errors.Cause(err).(type) {
	case idutil.NoSuchNameError:
		if op == getOnly {
			return nil, NullID,
				errors.WithStack(libkb.RepoDoesntExistError{Name: repoName})
		}
		_, err = lookupOrCreateDir(ctx, config, repoDir, normalizedRepoName)
		if err != nil {
			return nil, NullID, err
		}
	case nil:
		// If the repo was renamed to something else, we should
		// override it with a new repo if we're in create-only mode.
		if op == createOnly && repoEI.Type == data.Sym {
			config.MakeLogger("").CDebugf(
				ctx, "Overwriting symlink for repo %s with a new repo",
				normalizedRepoName)
			err = config.KBFSOps().RemoveEntry(ctx, repoDir, normalizedRepoName)
			if err != nil {
				return nil, NullID, err
			}
			_, err = lookupOrCreateDir(ctx, config, repoDir, normalizedRepoName)
			if err != nil {
				return nil, NullID, err
			}
		}
	default:
		return nil, NullID, err
	}

	repoExists = true

	fs, err = libfs.NewFS(
		ctx, config, tlfHandle, data.MasterBranch,
		path.Join(kbfsRepoDir, normalizedRepoName),
		uniqID, keybase1.MDPriorityGit)
	if err != nil {
		return nil, NullID, err
	}

	f, err := fs.Open(kbfsConfigName)
	if err != nil && !os.IsNotExist(err) {
		return nil, NullID, err
	} else if os.IsNotExist(err) {
		if op == getOnly {
			return nil, NullID, errors.WithStack(libkb.RepoDoesntExistError{Name: repoName})
		}

		// Create a new repo ID.
		repoID, err := createNewRepoAndID(ctx, config, tlfHandle, repoName, fs)
		if err != nil {
			return nil, NullID, err
		}
		fs.SetLockNamespace(repoID.Bytes())
		return fs, repoID, nil
	}
	defer f.Close()

	buf, err := ioutil.ReadAll(f)
	if err != nil {
		return nil, NullID, err
	}
	c, err := configFromBytes(buf)
	if err != nil {
		return nil, NullID, err
	}

	if op == createOnly {
		// If this was already created, but we were expected to create
		// it, then send back an error.
		return nil, NullID, libkb.RepoAlreadyExistsError{
			DesiredName:  repoName,
			ExistingName: c.Name,
			ExistingID:   c.ID.String(),
		}
	}

	fs.SetLockNamespace(c.ID.Bytes())

	return fs, c.ID, nil
}

// GetOrCreateRepoAndID returns a filesystem object rooted at the
// specified repo, along with the stable repo ID.  If the repo hasn't
// been created yet, it generates a new ID and creates the repo.  The
// caller is responsible for syncing the FS and flushing the journal,
// if desired.
func GetOrCreateRepoAndID(
	ctx context.Context, config libkbfs.Config, tlfHandle *tlfhandle.Handle,
	repoName string, uniqID string) (*libfs.FS, ID, error) {
	return getOrCreateRepoAndID(
		ctx, config, tlfHandle, repoName, uniqID, getOrCreate)
}

// GetRepoAndID returns a filesystem object rooted at the
// specified repo, along with the stable repo ID, if it already
// exists.
func GetRepoAndID(
	ctx context.Context, config libkbfs.Config, tlfHandle *tlfhandle.Handle,
	repoName string, uniqID string) (*libfs.FS, ID, error) {
	return getOrCreateRepoAndID(
		ctx, config, tlfHandle, repoName, uniqID, getOnly)
}

func makeUniqueID(ctx context.Context, config libkbfs.Config) (string, error) {
	// Create a unique ID using the verifying key and the `config`
	// object, which should be unique to each call in practice.
	session, err := config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s-%p", session.VerifyingKey.String(), config), nil
}

// CreateRepoAndID returns a new stable repo ID for the provided
// repoName in the given TLF.  If the repo has already been created,
// it returns a `RepoAlreadyExistsError`.  If `repoName` already
// exists, but is a symlink to another renamed directory, the symlink
// will be removed in favor of the new repo.  The caller is
// responsible for syncing the FS and flushing the journal, if
// desired.  It expects the `config` object to be unique during the
// lifetime of this call.
func CreateRepoAndID(
	ctx context.Context, config libkbfs.Config, tlfHandle *tlfhandle.Handle,
	repoName string) (ID, error) {
	uniqID, err := makeUniqueID(ctx, config)
	if err != nil {
		return NullID, err
	}

	fs, id, err := getOrCreateRepoAndID(
		ctx, config, tlfHandle, repoName, uniqID, createOnly)
	if err != nil {
		return NullID, err
	}
	err = fs.SyncAll()
	if err != nil {
		return NullID, err
	}
	return id, err
}

// DeleteRepo "deletes" the given repo in the given TLF.  Right now it
// simply moves the repo out of the way to a special directory, to
// allow any concurrent writers to finish their pushes without
// triggering conflict resolution.  The caller is responsible for
// syncing the FS and flushing the journal, if desired.  It expects
// the `config` object to be unique during the lifetime of this call.
func DeleteRepo(
	ctx context.Context, config libkbfs.Config, tlfHandle *tlfhandle.Handle,
	repoName string) error {
	// Create a unique ID using the verifying key and the `config`
	// object, which should be unique to each call in practice.
	session, err := config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return err
	}

	kbfsOps := config.KBFSOps()
	rootNode, _, err := kbfsOps.GetOrCreateRootNode(
		ctx, tlfHandle, data.MasterBranch)
	if err != nil {
		return err
	}
	normalizedRepoName := normalizeRepoName(repoName)

	repoNode, _, err := kbfsOps.Lookup(ctx, rootNode, kbfsRepoDir)
	if err != nil {
		return castNoSuchNameError(err, repoName)
	}

	_, _, err = kbfsOps.Lookup(ctx, repoNode, normalizedRepoName)
	if err != nil {
		return castNoSuchNameError(err, repoName)
	}

	ctx = context.WithValue(ctx, libkbfs.CtxAllowNameKey, kbfsDeletedReposDir)
	deletedReposNode, err := lookupOrCreateDir(
		ctx, config, repoNode, kbfsDeletedReposDir)
	if err != nil {
		return err
	}

	// For now, just rename the repo out of the way, using the device
	// ID and the current time in nanoseconds to make uniqueness
	// probable.
	dirSuffix := fmt.Sprintf(
		"%s-%d", session.VerifyingKey.String(), config.Clock().Now().UnixNano())
	return kbfsOps.Rename(
		ctx, repoNode, normalizedRepoName, deletedReposNode,
		normalizedRepoName+dirSuffix)
}

func renameRepoInConfigFile(
	ctx context.Context, repoFS billy.Filesystem, newRepoName string) error {
	// Assume lock file is already taken for both the old repo and the
	// new one.
	f, err := repoFS.OpenFile(kbfsConfigName, os.O_RDWR, 0600)
	if err != nil {
		return err
	}
	defer f.Close()
	buf, err := ioutil.ReadAll(f)
	if err != nil {
		return err
	}
	c, err := configFromBytes(buf)
	if err != nil {
		return err
	}
	c.Name = newRepoName
	buf, err = c.toBytes()
	if err != nil {
		return err
	}
	_, err = f.Seek(0, io.SeekStart)
	if err != nil {
		return err
	}
	err = f.Truncate(0)
	if err != nil {
		return err
	}
	_, err = f.Write(buf)
	if err != nil {
		return err
	}
	return nil
}

// RenameRepo renames the repo from an old name to a new name.  It
// leaves a symlink behind so that old remotes will continue to work.
// The caller is responsible for syncing the FS and flushing the
// journal, if desired.
func RenameRepo(
	ctx context.Context, config libkbfs.Config, tlfHandle *tlfhandle.Handle,
	oldRepoName, newRepoName string) (err error) {
	if !checkValidRepoName(newRepoName, config) {
		return errors.WithStack(libkb.InvalidRepoNameError{Name: newRepoName})
	}

	kbfsOps := config.KBFSOps()
	rootNode, _, err := kbfsOps.GetOrCreateRootNode(
		ctx, tlfHandle, data.MasterBranch)
	if err != nil {
		return err
	}
	normalizedOldRepoName := normalizeRepoName(oldRepoName)
	normalizedNewRepoName := normalizeRepoName(newRepoName)

	repoNode, _, err := kbfsOps.Lookup(ctx, rootNode, kbfsRepoDir)
	if err != nil {
		return err
	}

	// Does the old repo definitely exist?
	_, _, err = kbfsOps.Lookup(ctx, repoNode, normalizedOldRepoName)
	if err != nil {
		return err
	}

	if oldRepoName == newRepoName {
		// The names are the same, nothing else to do.
		return nil
	}

	fs, err := libfs.NewFS(
		ctx, config, tlfHandle, data.MasterBranch, path.Join(kbfsRepoDir),
		"", keybase1.MDPriorityGit)
	if err != nil {
		return err
	}

	oldRepoFS, err := fs.Chroot(normalizedOldRepoName)
	if err != nil {
		return err
	}

	// Take locks in both repos during rename (same lock that's taken
	// for new repo creation).
	oldLockFile, err := takeConfigLock(
		oldRepoFS.(*libfs.FS), tlfHandle, oldRepoName)
	if err != nil {
		return err
	}
	defer func() {
		closeErr := oldLockFile.Close()
		if err == nil {
			err = closeErr
		}
	}()

	if normalizedOldRepoName == normalizedNewRepoName {
		// All we need to do is update the name in the config file,
		// and the MD.
		err = renameRepoInConfigFile(ctx, oldRepoFS, newRepoName)
		if err != nil {
			return err
		}
		// We pass in `oldRepoFS`, which now has the new repo name in its
		// config.
		return UpdateRepoMD(ctx, config, tlfHandle, oldRepoFS,
			keybase1.GitPushType_RENAMEREPO, oldRepoName, nil)
	}

	// Does the new repo not exist yet?
	_, ei, err := kbfsOps.Lookup(ctx, repoNode, normalizedNewRepoName)
	switch errors.Cause(err).(type) {
	case idutil.NoSuchNameError:
		// The happy path.
	case nil:
		if ei.Type == data.Sym {
			config.MakeLogger("").CDebugf(
				ctx, "Overwriting symlink for repo %s with a new repo",
				normalizedNewRepoName)
			err = config.KBFSOps().RemoveEntry(
				ctx, repoNode, normalizedNewRepoName)
			if err != nil {
				return err
			}
		} else {
			newRepoFS, err := fs.Chroot(normalizedNewRepoName)
			if err != nil {
				return err
			}
			// Someone else already created and initialized the repo.
			return makeExistingRepoError(ctx, config, newRepoFS, newRepoName)
		}
	default:
		return err
	}

	// Make the new repo subdir just so we can take the lock inside
	// the new repo.  (We'll delete the new dir before the rename.)
	err = fs.MkdirAll(normalizedNewRepoName, 0777)
	if err != nil {
		return err
	}
	newRepoFS, err := fs.Chroot(normalizedNewRepoName)
	if err != nil {
		return err
	}
	newLockFile, err := takeConfigLock(
		newRepoFS.(*libfs.FS), tlfHandle, newRepoName)
	if err != nil {
		return err
	}
	defer func() {
		closeErr := newLockFile.Close()
		if err == nil {
			err = closeErr
		}
	}()

	// Rename this new dir out of the way before we rename.
	fi, err := fs.Stat(normalizedNewRepoName)
	if err != nil {
		return err
	}
	err = libfs.RecursiveDelete(ctx, fs, fi)
	if err != nil {
		return err
	}

	// Now update the old config file and rename, and leave a symlink
	// behind.  TODO: if any of the modifying steps below fail, we
	// should technically clean up any modifications before return, so
	// they don't get flushed.  However, with journaling on these are
	// all local operations and all very unlikely to fail.
	err = renameRepoInConfigFile(ctx, oldRepoFS, newRepoName)
	if err != nil {
		return err
	}
	err = fs.Rename(normalizedOldRepoName, normalizedNewRepoName)
	if err != nil {
		return err
	}
	err = fs.Symlink(normalizedNewRepoName, normalizedOldRepoName)
	if err != nil {
		return err
	}
	newRepoFS, err = fs.Chroot(normalizedNewRepoName)
	if err != nil {
		return err
	}
	return UpdateRepoMD(ctx, config, tlfHandle, newRepoFS,
		keybase1.GitPushType_RENAMEREPO, oldRepoName, nil)
}

// GCOptions describe options foe garbage collection.
type GCOptions struct {
	// The most loose refs we will tolerate; if there are more loose
	// refs, we should pack them.
	MaxLooseRefs int
	// The minimum number of potentially-expired loose objects we need
	// to start the pruning process.  If < 0, pruning will not be done.
	PruneMinLooseObjects int
	// Any unreachable objects older than this time are subject to
	// pruning.
	PruneExpireTime time.Time
	// The most object packs we will tolerate; if there are more
	// object packs, we should re-pack all the objects.  If < 0,
	// re-packing will not be done.
	MaxObjectPacks int
}

// NeedsGC checks the given repo storage layer against the given
// options to see what kinds of GC are needed on the repo.
func NeedsGC(storage storage.Storer, options GCOptions) (
	doPackRefs bool, numLooseRefs int, doPruneLoose, doObjectRepack bool,
	numObjectPacks int, err error) {
	numLooseRefs, err = storage.CountLooseRefs()
	if err != nil {
		return false, 0, false, false, 0, err
	}

	doPackRefs = numLooseRefs > options.MaxLooseRefs

	if options.PruneMinLooseObjects >= 0 {
		los, ok := storage.(storer.LooseObjectStorer)
		if !ok {
			panic("storage is unexpectedly not a LooseObjectStorer")
		}

		// Count the number of loose objects that are older than the
		// expire time, to see if pruning is needed.
		numLooseMaybePrune := 0
		err = los.ForEachObjectHash(func(h plumbing.Hash) error {
			t, err := los.LooseObjectTime(h)
			if err != nil {
				return err
			}
			if t.Before(options.PruneExpireTime) {
				numLooseMaybePrune++
				if numLooseMaybePrune >= options.PruneMinLooseObjects {
					doPruneLoose = true
					return storer.ErrStop
				}
			}
			return nil
		})
		if err != nil {
			return false, 0, false, false, 0, err
		}
	}

	pos, ok := storage.(storer.PackedObjectStorer)
	if !ok {
		panic("storage is unexpectedly not a PackedObjectStorer")
	}

	packs, err := pos.ObjectPacks()
	if err != nil {
		return false, 0, false, false, 0, err
	}
	numObjectPacks = len(packs)
	doObjectRepack = options.MaxObjectPacks >= 0 &&
		numObjectPacks > options.MaxObjectPacks

	return doPackRefs, numLooseRefs, doPruneLoose,
		doObjectRepack, numObjectPacks, nil
}

func markSuccessfulGC(
	ctx context.Context, config libkbfs.Config, fs billy.Filesystem) (
	err error) {
	changer, ok := fs.(billy.Change)
	if !ok {
		return errors.New("FS does not handle changing mtimes")
	}

	f, err := fs.Create(repoGCLockFileName)
	if err != nil {
		return err
	}
	err = f.Close()
	if err != nil {
		return err
	}
	return changer.Chtimes(
		repoGCLockFileName, time.Time{}, config.Clock().Now())
}

func canDoGC(
	ctx context.Context, config libkbfs.Config, fs *libfs.FS,
	log logger.Logger) (bool, error) {
	log.CDebugf(ctx, "Locking for GC")
	f, err := fs.Create(repoGCLockFileName)
	if err != nil {
		return false, err
	}
	defer func() {
		closeErr := f.Close()
		if err == nil {
			err = closeErr
		}
	}()
	err = f.Lock()
	if err != nil {
		return false, err
	}

	return canDoWork(
		ctx, config.MDServer(), config.Clock(), fs,
		repoGCInProgressFileName, gcTimeLimit, log)
}

// GCRepo runs garbage collection on the specified repo, if it exceeds
// any of the thresholds provided in `options`.
func GCRepo(
	ctx context.Context, config libkbfs.Config, tlfHandle *tlfhandle.Handle,
	repoName string, options GCOptions) (err error) {
	log := config.MakeLogger("")
	log.CDebugf(ctx, "Checking whether GC is needed for %s/%s",
		tlfHandle.GetCanonicalName(), repoName)

	uniqID, err := makeUniqueID(ctx, config)
	if err != nil {
		return err
	}

	fs, _, err := getOrCreateRepoAndID(
		ctx, config, tlfHandle, repoName, uniqID, getOnly)
	if err != nil {
		return err
	}
	defer func() {
		if err == nil {
			err = markSuccessfulGC(ctx, config, fs)
		}
	}()

	fsStorer, err := filesystem.NewStorage(fs)
	if err != nil {
		return err
	}
	var fsStorage storage.Storer
	fsStorage = fsStorer

	// Wrap it in an on-demand storer, so we don't try to read all the
	// objects of big repos into memory at once.
	var storage storage.Storer
	storage, err = NewOnDemandStorer(fsStorage)
	if err != nil {
		return err
	}

	// Wrap it in an "ephemeral" config with a fixed pack window, so
	// we create packs with delta compression, but don't persist the
	// pack window setting to disk.
	storage = &ephemeralGitConfigWithFixedPackWindow{
		storage,
		fsStorage.(storer.Initializer),
		fsStorage.(storer.PackfileWriter),
		fsStorage.(storer.LooseObjectStorer),
		fsStorage.(storer.PackedObjectStorer),
		10,
	}

	doPackRefs, _, doPruneLoose, doObjectRepack, _, err := NeedsGC(
		storage, options)
	if err != nil {
		return err
	}
	if !doPackRefs && !doPruneLoose && !doObjectRepack {
		log.CDebugf(ctx, "Skipping GC")
		return nil
	}

	doGC, err := canDoGC(ctx, config, fs, log)
	if err != nil {
		return err
	}
	if !doGC {
		log.CDebugf(ctx, "Skipping GC due to other worker")
		return nil
	}

	defer func() {
		removeErr := fs.Remove(repoGCInProgressFileName)
		if err == nil {
			err = removeErr
		}
	}()

	// Check the GC thresholds again since they might have changed
	// while getting the lock.
	doPackRefs, numLooseRefs, doPruneLoose, doObjectRepack,
		numObjectPacks, err := NeedsGC(storage, options)
	if err != nil {
		return err
	}
	if !doPackRefs && !doPruneLoose && !doObjectRepack {
		log.CDebugf(ctx, "GC no longer needed")
		return nil
	}

	if doPackRefs {
		log.CDebugf(ctx, "Packing %s loose refs", numLooseRefs)
		err = storage.PackRefs()
		if err != nil {
			return err
		}
	}

	if doPruneLoose {
		repo, err := gogit.Open(storage, nil)
		if err != nil {
			return err
		}
		err = repo.Prune(gogit.PruneOptions{
			OnlyObjectsOlderThan: options.PruneExpireTime,
			Handler:              repo.DeleteObject,
		})
		if err != nil {
			return err
		}
	}

	if doObjectRepack {
		log.CDebugf(ctx, "Re-packing %d object packs", numObjectPacks)
		repo, err := gogit.Open(storage, nil)
		if err != nil {
			return err
		}
		err = repo.RepackObjects(&gogit.RepackConfig{
			OnlyDeletePacksOlderThan: options.PruneExpireTime,
		})
		if err != nil {
			return err
		}
	}

	// TODO: add object re-packing.
	return nil
}

// LastGCTime returns the last time the repo was successfully
// garbage-collected.
func LastGCTime(ctx context.Context, fs billy.Filesystem) (
	time.Time, error) {
	fi, err := fs.Stat(repoGCLockFileName)
	if os.IsNotExist(err) {
		return time.Time{}, nil
	} else if err != nil {
		return time.Time{}, err
	}

	return fi.ModTime(), nil
}
