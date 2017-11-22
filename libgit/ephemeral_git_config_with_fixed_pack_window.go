// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"io"

	gogitcfg "gopkg.in/src-d/go-git.v4/config"
	"gopkg.in/src-d/go-git.v4/plumbing"
	"gopkg.in/src-d/go-git.v4/plumbing/storer"
	"gopkg.in/src-d/go-git.v4/storage"
)

// ephemeralGitConfigWithFixedPackWindow always returns a fixed pack
// window, regardless of what the underlying storage says.  It also
// never persists any config changes to storage.
type ephemeralGitConfigWithFixedPackWindow struct {
	storage.Storer
	initer     storer.Initializer
	pfWriter   storer.PackfileWriter
	packWindow uint
}

// Init implements the `storer.Initializer` interface.
func (e *ephemeralGitConfigWithFixedPackWindow) Init() error {
	return e.initer.Init()
}

// PackfileWriter implements the `storer.PackfileWriter` interface.
func (e *ephemeralGitConfigWithFixedPackWindow) PackfileWriter(
	ch plumbing.StatusChan) (io.WriteCloser, error) {
	return e.pfWriter.PackfileWriter(ch)
}

// Config implements the `storer.Storer` interface.
func (e *ephemeralGitConfigWithFixedPackWindow) Config() (
	*gogitcfg.Config, error) {
	cfg, err := e.Storer.Config()
	if err != nil {
		return nil, err
	}
	cfg.Pack.Window = e.packWindow
	return cfg, nil
}

// SetConfig implements the `storer.Storer` interface.
func (e *ephemeralGitConfigWithFixedPackWindow) SetConfig(c *gogitcfg.Config) (
	err error) {
	// The config is "ephemeral", so don't persist any config
	// changes to storage.
	return nil
}

var _ storage.Storer = (*ephemeralGitConfigWithFixedPackWindow)(nil)
var _ storer.Initializer = (*ephemeralGitConfigWithFixedPackWindow)(nil)
var _ storer.PackfileWriter = (*ephemeralGitConfigWithFixedPackWindow)(nil)
