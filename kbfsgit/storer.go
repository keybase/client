// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsgit

import (
	"github.com/keybase/kbfs/libfs"
	gogitcfg "gopkg.in/src-d/go-git.v4/config"
	"gopkg.in/src-d/go-git.v4/plumbing/storer"
	"gopkg.in/src-d/go-git.v4/storage"
	"gopkg.in/src-d/go-git.v4/storage/filesystem"
)

// configInMemoryStorer keeps the git config in memory, to work around
// a gcfg bug (used by go-git when reading configs from disk) that
// causes a freakout when it sees backslashes in git file URLs.
type configInMemoryStorer struct {
	*filesystem.Storage
	cfg *gogitcfg.Config
}

func newConfigInMemoryStorer(fs *libfs.FS) (*configInMemoryStorer, error) {
	fsStorer, err := filesystem.NewStorage(fs)
	if err != nil {
		return nil, err
	}
	cfg, err := fsStorer.Config()
	if err != nil {
		return nil, err
	}
	return &configInMemoryStorer{fsStorer, cfg}, nil
}

func (cims *configInMemoryStorer) Init() error {
	return cims.Storage.Init()
}

func (cims *configInMemoryStorer) Config() (*gogitcfg.Config, error) {
	return cims.cfg, nil
}

func (cims *configInMemoryStorer) SetConfig(c *gogitcfg.Config) error {
	cims.cfg = c
	return nil
}

var _ storage.Storer = (*configInMemoryStorer)(nil)
var _ storer.Initializer = (*configInMemoryStorer)(nil)
