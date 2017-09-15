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
	"strings"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/pkg/errors"
)

const (
	kbfsRepoDir         = ".kbfs_git"
	kbfsConfigName      = "kbfs_config"
	gitSuffixToIgnore   = ".git"
	kbfsDeletedReposDir = ".kbfs_deleted_repos"
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

// InvalidRepoNameError indicates that a repo name is invalid.
type InvalidRepoNameError struct {
	name string
}

func (e InvalidRepoNameError) Error() string {
	return fmt.Sprintf("Invalid repo name %q", e.name)
}

// RepoAlreadyCreatedError is returned when trying to create a repo
// that already exists.
type RepoAlreadyCreatedError struct {
	DesiredName    string
	ExistingConfig Config
}

func (race RepoAlreadyCreatedError) Error() string {
	return fmt.Sprintf(
		"A repo named %s (id=%s) already existed when trying to create "+
			"a repo named %s", race.ExistingConfig.Name,
		race.ExistingConfig.ID, race.DesiredName)
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
	if !checkValidRepoName(repoName, config) {
		return NullID, errors.WithStack(InvalidRepoNameError{repoName})
	}

	// TODO: take a global repo lock here to make sure only one
	// client generates the repo ID.
	repoID, err := makeRandomID()
	if err != nil {
		return NullID, err
	}
	config.MakeLogger("").CDebugf(ctx,
		"Creating a new repo %s in %s: repoID=%s",
		repoName, tlfHandle.GetCanonicalPath(), repoID)

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
	f, err := fs.Create(kbfsConfigName)
	if err != nil {
		return NullID, err
	}
	defer f.Close()
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

func getOrCreateRepoAndID(
	ctx context.Context, config libkbfs.Config, tlfHandle *libkbfs.TlfHandle,
	repoName string, uniqID string, createOnly bool) (*libfs.FS, ID, error) {
	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, tlfHandle, libkbfs.MasterBranch)
	if err != nil {
		return nil, NullID, err
	}
	normalizedRepoName := normalizeRepoName(repoName)

	repoDir, err := lookupOrCreateDir(ctx, config, rootNode, kbfsRepoDir)
	if err != nil {
		return nil, NullID, err
	}
	_, err = lookupOrCreateDir(ctx, config, repoDir, normalizedRepoName)
	if err != nil {
		return nil, NullID, err
	}

	fs, err := libfs.NewFS(
		ctx, config, tlfHandle, path.Join(kbfsRepoDir, normalizedRepoName),
		uniqID)
	if err != nil {
		return nil, NullID, err
	}

	f, err := fs.Open(kbfsConfigName)
	if err != nil && !os.IsNotExist(err) {
		return nil, NullID, err
	} else if os.IsNotExist(err) {
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

	if createOnly {
		// If this was already created, but we were expected to create
		// it, then send back an error.
		return nil, NullID, RepoAlreadyCreatedError{repoName, *c}
	}

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
		ctx, config, tlfHandle, repoName, uniqID, false)
}

// CreateRepoAndID returns a new stable repo ID for the provided
// repoName in the given TLF.  If the repo has already been created,
// it returns a `RepoAlreadyCreatedError`.  The caller is responsible
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
		ctx, config, tlfHandle, repoName, uniqID, true)
	if err != nil {
		return NullID, err
	}
	err = fs.SyncAll()
	if err != nil {
		return NullID, err
	}
	return id, err
}

// DeleteRepo "deletes" the given repo in the given TLF.  RIght now it
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
	uniqID := fmt.Sprintf("%s-%p", session.VerifyingKey.String(), config)

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

	// For now, just rename the repo out of the way, using the uniq
	// ID.  TODO(KBFS-2442): periodically delete old-enough repos from
	// `kbfsDeletedReposDir`.
	return kbfsOps.Rename(
		ctx, repoNode, normalizedRepoName, deletedReposNode,
		normalizedRepoName+uniqID)
}
