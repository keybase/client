// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/pkg/errors"
)

const (
	kbfsRepoDir              = ".kbfs_git"
	kbfsConfigName           = "kbfs_config"
	kbfsConfigNameTemp       = "._kbfs_config"
	gitSuffixToIgnore        = ".git"
	kbfsDeletedReposDir      = ".kbfs_deleted_repos"
	minDeletedAgeForCleaning = 1 * time.Hour
)

// This character set is what Github supports in repo names.  It's
// probably to avoid any problems when cloning onto filesystems that
// have different Unicode decompression schemes
// (https://en.wikipedia.org/wiki/Unicode_equivalence).  There's no
// internal reason to be so restrictive, but it probably makes sense
// to start off more restrictive and then relax things later as we
// test.
var repoNameRE = regexp.MustCompile(`^([a-zA-Z0-9][a-zA-Z0-9_\.-]*)$`)

func checkValidRepoName(repoName string, config libkbfs.Config) bool {
	return len(repoName) >= 1 &&
		uint32(len(repoName)) <= config.MaxNameBytes() &&
		(os.Getenv("KBFS_GIT_REPONAME_SKIP_CHECK") != "" ||
			repoNameRE.MatchString(repoName))
}

func recursiveDelete(
	ctx context.Context, fs *libfs.FS, fi os.FileInfo) error {
	if !fi.IsDir() {
		// Delete regular files and symlinks directly.
		return fs.Remove(fi.Name())
	}

	subdirFS, err := fs.Chroot(fi.Name())
	if err != nil {
		return err
	}

	children, err := subdirFS.ReadDir("/")
	if err != nil {
		return err
	}
	for _, childFI := range children {
		err := recursiveDelete(ctx, subdirFS.(*libfs.FS), childFI)
		if err != nil {
			return err
		}
	}

	return fs.Remove(fi.Name())
}

// CleanOldDeletedRepos completely removes any "deleted" repos that
// have been deleted for longer than `minDeletedAgeForCleaning`.  The
// caller is responsible for syncing any data to disk, if desired.
func CleanOldDeletedRepos(
	ctx context.Context, config libkbfs.Config,
	tlfHandle *libkbfs.TlfHandle) (err error) {
	fs, err := libfs.NewFS(
		ctx, config, tlfHandle, path.Join(kbfsRepoDir, kbfsDeletedReposDir),
		"" /* uniq ID isn't used for removals */)
	switch errors.Cause(err).(type) {
	case libkbfs.NoSuchNameError:
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
		err = recursiveDelete(ctx, fs, fi)
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
	tlfHandle *libkbfs.TlfHandle) error {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	err := CleanOldDeletedRepos(ctx, config, tlfHandle)
	if errors.Cause(err) == context.DeadlineExceeded {
		return nil
	}
	return err
}

// UpdateRepoMD lets the Keybase service know that a repo's MD has
// been updated.
func UpdateRepoMD(ctx context.Context, config libkbfs.Config,
	tlfHandle *libkbfs.TlfHandle, fs *libfs.FS) error {
	folder := tlfHandle.ToFavorite().ToKBFolder(false)

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

	log := config.MakeLogger("")
	log.CDebugf(ctx, "Putting git MD update")
	err = config.KBPKI().PutGitMetadata(
		ctx, folder, keybase1.RepoID(c.ID.String()),
		keybase1.GitRepoName(c.Name))
	if err != nil {
		// Just log the put error, it shouldn't block the success of
		// the overall git operation.
		log.CDebugf(ctx, "Failed to put git metadata: %+v", err)
	}
	return nil
}

func createNewRepoAndID(
	ctx context.Context, config libkbfs.Config, tlfHandle *libkbfs.TlfHandle,
	repoName string, fs *libfs.FS) (ID, error) {
	// TODO: take a global repo lock here to make sure only one
	// client generates the repo ID.
	repoID, err := makeRandomID()
	if err != nil {
		return NullID, err
	}
	config.MakeLogger("").CDebugf(ctx,
		"Creating a new repo %s in %s: repoID=%s",
		repoName, tlfHandle.GetCanonicalPath(), repoID)

	// Lock a temp file to avoid a duplicate create of the actual
	// file.  TODO: clean up this file at some point?
	lockFile, err := fs.Create(kbfsConfigNameTemp)
	if err != nil && !os.IsExist(err) {
		return NullID, err
	} else if os.IsExist(err) {
		lockFile, err = fs.Open(kbfsConfigNameTemp)
	}
	if err != nil {
		return NullID, err
	}
	defer lockFile.Close()

	// Take a lock during creation.
	err = lockFile.Lock()
	if err != nil {
		return NullID, err
	}

	f, err := fs.Create(kbfsConfigName)
	if err != nil && !os.IsExist(err) {
		return NullID, err
	} else if os.IsExist(err) {
		// The config file already exists, so someone else already
		// initialized the repo.
		config.MakeLogger("").CDebugf(
			ctx, "Config file for repo %s already exists", repoName)
		f, err := fs.Open(kbfsConfigName)
		if err != nil {
			return NullID, err
		}
		defer f.Close()
		buf, err := ioutil.ReadAll(f)
		if err != nil {
			return NullID, err
		}
		existingConfig, err := configFromBytes(buf)
		if err != nil {
			return NullID, err
		}
		return NullID, errors.WithStack(libkb.RepoAlreadyExistsError{
			DesiredName:  repoName,
			ExistingName: existingConfig.Name,
			ExistingID:   existingConfig.ID.String(),
		})
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

	err = UpdateRepoMD(ctx, config, tlfHandle, fs)
	if err != nil {
		return NullID, err
	}

	return repoID, nil
}

func normalizeRepoName(repoName string) string {
	return strings.TrimSuffix(strings.ToLower(repoName), gitSuffixToIgnore)
}

func lookupOrCreateDir(ctx context.Context, config libkbfs.Config,
	n libkbfs.Node, name string) (libkbfs.Node, error) {
	newNode, _, err := config.KBFSOps().Lookup(ctx, n, name)
	switch errors.Cause(err).(type) {
	case libkbfs.NoSuchNameError:
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

// NoSuchRepoError indicates that a repo doesn't yet exist, and it
// will not be created.
type NoSuchRepoError struct {
	name string
}

func (nsre NoSuchRepoError) Error() string {
	return fmt.Sprintf("A repo named %s hasn't been created yet", nsre.name)
}

func getOrCreateRepoAndID(
	ctx context.Context, config libkbfs.Config, tlfHandle *libkbfs.TlfHandle,
	repoName string, uniqID string, op repoOpType) (
	fs *libfs.FS, id ID, err error) {
	if !checkValidRepoName(repoName, config) {
		return nil, NullID, errors.WithStack(libkb.InvalidRepoNameError{Name: repoName})
	}

	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, tlfHandle, libkbfs.MasterBranch)
	if err != nil {
		return nil, NullID, err
	}
	normalizedRepoName := normalizeRepoName(repoName)

	// If the user doesn't have write access, but the repo doesn't
	// exist, give them a nice error message.
	repoExists := false
	defer func() {
		_, isWriteAccessErr := errors.Cause(err).(libkbfs.WriteAccessError)
		if !repoExists && isWriteAccessErr {
			err = NoSuchRepoError{repoName}
		}
	}()

	repoDir, err := lookupOrCreateDir(ctx, config, rootNode, kbfsRepoDir)
	if err != nil {
		return nil, NullID, err
	}
	if op == getOnly {
		_, _, err = config.KBFSOps().Lookup(ctx, repoDir, normalizedRepoName)
		switch errors.Cause(err).(type) {
		case libkbfs.NoSuchNameError:
			return nil, NullID, errors.WithStack(NoSuchRepoError{repoName})
		case nil:
		default:
			return nil, NullID, err
		}
	} else {
		_, err = lookupOrCreateDir(ctx, config, repoDir, normalizedRepoName)
		if err != nil {
			return nil, NullID, err
		}
	}
	repoExists = true

	fs, err = libfs.NewFS(
		ctx, config, tlfHandle, path.Join(kbfsRepoDir, normalizedRepoName),
		uniqID)
	if err != nil {
		return nil, NullID, err
	}

	f, err := fs.Open(kbfsConfigName)
	if err != nil && !os.IsNotExist(err) {
		return nil, NullID, err
	} else if os.IsNotExist(err) {
		if op == getOnly {
			return nil, NullID, errors.WithStack(NoSuchRepoError{repoName})
		}

		// Create a new repo ID.
		repoID, err := createNewRepoAndID(ctx, config, tlfHandle, repoName, fs)
		if err != nil {
			return nil, NullID, err
		}
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
	ctx context.Context, config libkbfs.Config, tlfHandle *libkbfs.TlfHandle,
	repoName string, uniqID string) (*libfs.FS, ID, error) {
	return getOrCreateRepoAndID(
		ctx, config, tlfHandle, repoName, uniqID, getOrCreate)
}

// GetRepoAndID returns a filesystem object rooted at the
// specified repo, along with the stable repo ID, if it already
// exists.
func GetRepoAndID(
	ctx context.Context, config libkbfs.Config, tlfHandle *libkbfs.TlfHandle,
	repoName string, uniqID string) (*libfs.FS, ID, error) {
	return getOrCreateRepoAndID(
		ctx, config, tlfHandle, repoName, uniqID, getOnly)
}

// CreateRepoAndID returns a new stable repo ID for the provided
// repoName in the given TLF.  If the repo has already been created,
// it returns a `RepoAlreadyExistsError`.  The caller is responsible
// for syncing the FS and flushing the journal, if desired.  It
// expects the `config` object to be unique during the lifetime of
// this call.
func CreateRepoAndID(
	ctx context.Context, config libkbfs.Config, tlfHandle *libkbfs.TlfHandle,
	repoName string) (ID, error) {
	// Create a unique ID using the verifying key and the `config`
	// object, which should be unique to each call in practice.
	session, err := config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return NullID, err
	}
	uniqID := fmt.Sprintf("%s-%p", session.VerifyingKey.String(), config)

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
	ctx context.Context, config libkbfs.Config, tlfHandle *libkbfs.TlfHandle,
	repoName string) error {
	// Create a unique ID using the verifying key and the `config`
	// object, which should be unique to each call in practice.
	session, err := config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return err
	}

	kbfsOps := config.KBFSOps()
	rootNode, _, err := kbfsOps.GetOrCreateRootNode(
		ctx, tlfHandle, libkbfs.MasterBranch)
	if err != nil {
		return err
	}
	normalizedRepoName := normalizeRepoName(repoName)

	repoNode, _, err := kbfsOps.Lookup(ctx, rootNode, kbfsRepoDir)
	if err != nil {
		return err
	}

	_, _, err = kbfsOps.Lookup(ctx, repoNode, normalizedRepoName)
	if err != nil {
		return err
	}

	deletedReposNode, err := lookupOrCreateDir(
		ctx, config, repoNode, kbfsDeletedReposDir)
	if err != nil {
		return err
	}

	// For now, just rename the repo out of the way, using the device
	// ID and the current time in nanoseconds to make uniqueness
	// probable.  TODO(KBFS-2442): periodically delete old-enough
	// repos from `kbfsDeletedReposDir`.
	dirSuffix := fmt.Sprintf(
		"%s-%d", session.VerifyingKey.String(), config.Clock().Now().UnixNano())
	return kbfsOps.Rename(
		ctx, repoNode, normalizedRepoName, deletedReposNode,
		normalizedRepoName+dirSuffix)
}
