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

	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/pkg/errors"
)

const (
	kbfsRepoDir    = ".kbfs_git"
	kbfsConfigName = "kbfs_config"
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
	c := &Config{repoID, repoName}
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
	return repoID, nil
}

// GetOrCreateRepoAndID returns a filesystem object rooted at the
// specified repo, along with the stable repo ID.  If the repo hasn't
// been created yet, it generates a new ID and creates the repo.  The
// caller is responsible for syncing the FS and flushing the journal,
// if desired.
func GetOrCreateRepoAndID(
	ctx context.Context, config libkbfs.Config, tlfHandle *libkbfs.TlfHandle,
	repoName string, uniqID string) (*libfs.FS, ID, error) {
	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, tlfHandle, libkbfs.MasterBranch)
	if err != nil {
		return nil, NullID, err
	}
	normalizedRepoName := strings.ToLower(repoName)

	lookupOrCreateDir := func(n libkbfs.Node, name string) (
		libkbfs.Node, error) {
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

	repoDir, err := lookupOrCreateDir(rootNode, kbfsRepoDir)
	if err != nil {
		return nil, NullID, err
	}
	_, err = lookupOrCreateDir(repoDir, normalizedRepoName)
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
	return fs, c.ID, nil
}
