// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/blevesearch/bleve"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/pkg/errors"
)

type Indexer struct {
	index bleve.Index
}

func indexPath(root string) string {
	return filepath.Join(root, "kbfs_index")
}

func NewIndexer(config libkbfs.Config) (*Indexer, error) {
	p := indexPath(config.StorageRoot())
	var index bleve.Index
	_, err := os.Stat(p)
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
		index: index,
	}, nil
}

type file struct {
	Name          string
	TokenizedName string
}

var filesToIgnore = map[string]bool{
	".Trashes":   true,
	".fseventsd": true,
	".DS_Store":  true,
}

func (i *Indexer) doIndexDir(fs *libfs.FS) error {
	children, err := fs.ReadDir("")
	if err != nil {
		return err
	}

	for _, fi := range children {
		name := fi.Name()
		if filesToIgnore[name] || strings.HasPrefix(name, "._") {
			continue
		}

		tokenized := strings.ReplaceAll(name, "_", " ")
		tokenized = strings.ReplaceAll(tokenized, "-", " ")
		tokenized = strings.ReplaceAll(tokenized, ".", " ")
		f := file{
			Name:          name,
			TokenizedName: tokenized,
		}
		id := fs.Join(fs.Root(), name)
		err := i.index.Index(id, f)
		if err != nil {
			return err
		}

		if fi.IsDir() {
			childFS, err := fs.ChrootAsLibFS(name)
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

func (i *Indexer) Index(fs *libfs.FS) error {
	return i.doIndexDir(fs)
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
