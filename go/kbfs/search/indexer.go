// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"context"
	"os"
	"path/filepath"
	"strings"

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

type file struct {
	Path          string
	TokenizedName string
}

func (i *Indexer) doIndexDir(fs *libfs.FS) error {
	children, err := fs.ReadDir("")
	if err != nil {
		return err
	}

	for _, fi := range children {
		tokenized := strings.ReplaceAll(fi.Name(), "_", " ")
		tokenized = strings.ReplaceAll(tokenized, "-", " ")
		tokenized = strings.ReplaceAll(tokenized, ".", " ")
		f := file{
			TokenizedName: tokenized,
		}
		id := fs.Join(fs.Root(), fi.Name())
		err := i.index.Index(id, f)
		if err != nil {
			return err
		}

		if fi.IsDir() {
			childFS, err := fs.ChrootAsLibFS(fi.Name())
			if err != nil {
				return err
			}
			err = i.doIndexDir(childFS)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (i *Indexer) Index(_ context.Context) error {
	return i.doIndexDir(i.fs)
}

func (i *Indexer) Search(queryString string) (paths []string, err error) {
	query := bleve.NewQueryStringQuery(queryString)
	request := bleve.NewSearchRequest(query)
	result, err := i.index.Search(request)
	if err != nil {
		return nil, err
	}

	for _, hit := range result.Hits {
		paths = append(paths, hit.ID)
	}
	return paths, nil
}
