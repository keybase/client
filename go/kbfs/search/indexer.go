// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"context"
	"os"
	"path/filepath"

	"github.com/blevesearch/bleve"
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
)

type Indexer struct {
	fs    *libfs.FS
	index bleve.Index
}

func indexPath(root string) string {
	return filepath.Join(root, "kbfs_index")
}

func NewIndexer(
	ctx context.Context, config libkbfs.Config,
	tlfHandle *tlfhandle.Handle) (*Indexer, error) {
	fs, err := libfs.NewFS(
		ctx, config, tlfHandle, data.MasterBranch, "", "",
		keybase1.MDPriorityNormal)
	if err != nil {
		return nil, err
	}

	p := indexPath(config.StorageRoot())
	var index bleve.Index
	_, err = os.Stat(p)
	switch {
	case os.IsNotExist(errors.Cause(err)):
		mapping := bleve.NewIndexMapping()
		index, err = bleve.New(p, mapping)
		if err != nil {
			return nil, err
		}
	case err == nil:
		index, err = bleve.Open(p)
		if err != nil {
			return nil, err
		}
	default:
		return nil, err
	}

	return &Indexer{
		fs:    fs,
		index: index,
	}, nil
}

func (i *Indexer) Index(ctx context.Context) error {
	return nil
}
