// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package fsrpc

import (
	"fmt"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

type fs struct {
	config libkbfs.Config
	log    logger.Logger
}

// NewFS returns a new FS protocol implementation
func NewFS(config libkbfs.Config, log logger.Logger) keybase1.FsInterface {
	return &fs{config: config, log: log}
}

func (f fs) favorites(ctx context.Context, path Path) (keybase1.ListResult, error) {
	favs, err := f.config.KBFSOps().GetFavorites(ctx)
	if err != nil {
		return keybase1.ListResult{}, err
	}
	files := []keybase1.File{}
	for _, fav := range favs {
		if fav.Public == (path.TLFType == tlf.Public) {
			favPath, err := path.Join(fav.Name)
			if err != nil {
				return keybase1.ListResult{}, err
			}
			files = append(files, keybase1.File{Path: favPath.String()})
		}
	}
	return keybase1.ListResult{Files: files}, nil
}

func (f fs) tlf(ctx context.Context, path Path) (keybase1.ListResult, error) {
	files := []keybase1.File{}

	node, de, err := path.GetNode(ctx, f.config)
	if err != nil {
		return keybase1.ListResult{}, err
	}

	if node == nil {
		return keybase1.ListResult{}, fmt.Errorf("Node not found for path: %s", path)
	}

	if de.Type == libkbfs.Dir {
		children, err := f.config.KBFSOps().GetDirChildren(ctx, node)
		if err != nil {
			return keybase1.ListResult{}, err
		}

		// For entryInfo: for name, entryInfo := range children
		for name := range children {
			dirPath, err := path.Join(name)
			if err != nil {
				return keybase1.ListResult{}, err
			}
			files = append(files, keybase1.File{Path: dirPath.String()})
		}
	} else {
		_, name, err := path.DirAndBasename()
		if err != nil {
			return keybase1.ListResult{}, err
		}
		filePath, err := path.Join(name)
		if err != nil {
			return keybase1.ListResult{}, err
		}
		files = append(files, keybase1.File{Path: filePath.String()})
	}
	return keybase1.ListResult{Files: files}, nil
}

func (f fs) keybase(ctx context.Context) (keybase1.ListResult, error) {
	return keybase1.ListResult{
		Files: []keybase1.File{
			keybase1.File{Path: "/keybase/public"},
			keybase1.File{Path: "/keybase/private"},
		},
	}, nil
}

func (f fs) root(ctx context.Context) (keybase1.ListResult, error) {
	return keybase1.ListResult{
		Files: []keybase1.File{
			keybase1.File{Path: "/keybase"},
		},
	}, nil
}

// List implements keybase1.FsInterface
func (f *fs) List(ctx context.Context, arg keybase1.ListArg) (keybase1.ListResult, error) {
	f.log.CDebugf(ctx, "Listing %q", arg.Path)

	kbfsPath, err := NewPath(arg.Path)
	if err != nil {
		return keybase1.ListResult{}, err
	}

	var result keybase1.ListResult
	switch kbfsPath.PathType {
	case RootPathType:
		result, err = f.root(ctx)
	case KeybasePathType:
		result, err = f.keybase(ctx)
	case KeybaseChildPathType:
		result, err = f.favorites(ctx, kbfsPath)
	default:
		result, err = f.tlf(ctx, kbfsPath)
	}
	if err != nil {
		f.log.CErrorf(ctx, "Error listing path %q: %s", arg.Path, err)
	}
	return result, err
}
