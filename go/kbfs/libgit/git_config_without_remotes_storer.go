// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"github.com/keybase/client/go/kbfs/libfs"
	gogitcfg "gopkg.in/src-d/go-git.v4/config"
	format "gopkg.in/src-d/go-git.v4/plumbing/format/config"
	"gopkg.in/src-d/go-git.v4/plumbing/storer"
	"gopkg.in/src-d/go-git.v4/storage"
	"gopkg.in/src-d/go-git.v4/storage/filesystem"
)

// GitConfigWithoutRemotesStorer strips remotes from the config before
// writing them to disk, to work around a gcfg bug (used by go-git
// when reading configs from disk) that causes a freakout when it sees
// backslashes in git file URLs.
type GitConfigWithoutRemotesStorer struct {
	*filesystem.Storage
	cfg    *gogitcfg.Config
	stored bool
}

// NewGitConfigWithoutRemotesStorer creates a new git config
// implementation that strips remotes from the config before writing
// them to disk.
func NewGitConfigWithoutRemotesStorer(fs *libfs.FS) (
	*GitConfigWithoutRemotesStorer, error) {
	fsStorer, err := filesystem.NewStorage(fs)
	if err != nil {
		return nil, err
	}
	cfg, err := fsStorer.Config()
	if err != nil {
		return nil, err
	}
	// To figure out if this config has been written already, check if
	// it differs from the zero Core value (probably because the
	// IsBare bit is flipped).
	return &GitConfigWithoutRemotesStorer{
		fsStorer,
		cfg,
		cfg.Core != gogitcfg.Config{}.Core,
	}, nil
}

// Init implements the `storer.Initializer` interface.
func (cwrs *GitConfigWithoutRemotesStorer) Init() error {
	return cwrs.Storage.Init()
}

// Config implements the `storer.Storer` interface.
func (cwrs *GitConfigWithoutRemotesStorer) Config() (*gogitcfg.Config, error) {
	return cwrs.cfg, nil
}

// SetConfig implements the `storer.Storer` interface.
func (cwrs *GitConfigWithoutRemotesStorer) SetConfig(c *gogitcfg.Config) (
	err error) {
	if cwrs.stored && c.Core == cwrs.cfg.Core {
		// Ignore any change that doesn't change the core we know
		// about, to avoid attempting to write config files with
		// read-only access.
		return nil
	}

	defer func() {
		if err != nil {
			cwrs.stored = true
		}
	}()

	cwrs.cfg = c
	if len(c.Remotes) != 0 {
		// If there are remotes, we need to strip them out before
		// writing them out to disk.  Do that by making a copy of
		// everything but the remotes.  (Note that we can't just
		// Marshal+Unmarshal for a deep-copy, since Unmarshal is where
		// the gcfg bug is.)
		cCopy := gogitcfg.NewConfig()
		cCopy.Core = c.Core
		for k, v := range c.Submodules {
			v2 := *v
			cCopy.Submodules[k] = &v2
		}

		// Get the raw config so we don't lose any unsupported fields
		// from c, but clear out the remotes.
		_, err := c.Marshal()
		if err != nil {
			return err
		}
		s := c.Raw.Section("remote")
		s.Subsections = make(format.Subsections, 0)
		cCopy.Raw = c.Raw

		c = cCopy
	}
	return cwrs.Storage.SetConfig(c)
}

var _ storage.Storer = (*GitConfigWithoutRemotesStorer)(nil)
var _ storer.Initializer = (*GitConfigWithoutRemotesStorer)(nil)
