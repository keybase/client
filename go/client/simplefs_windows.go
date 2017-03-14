// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package client

import (
	"context"
	"errors"
	"path/filepath"
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func doSimpleFSRemoteGlob(g *libkb.GlobalContext, ctx context.Context, cli keybase1.SimpleFSInterface, path keybase1.Path) ([]keybase1.Path, error) {

	var returnPaths []keybase1.Path
	directory := filepath.ToSlash(filepath.Dir(path.Kbfs()))
	base := filepath.Base(path.Kbfs())

	// We know the filename has wildcards at this point.
	// kbfs list only works on directories, so build a glob from a list result.

	g.Log.Debug("doSimpleFSRemoteGlob %s", path.Kbfs())

	if strings.ContainsAny(directory, "?*[]") == true {
		return nil, errors.New("wildcards not supported in parent directories")
	}

	opid, err := cli.SimpleFSMakeOpid(ctx)
	if err != nil {
		return nil, err
	}
	defer cli.SimpleFSClose(ctx, opid)

	err = cli.SimpleFSList(ctx, keybase1.SimpleFSListArg{
		OpID: opid,
		Path: keybase1.NewPathWithKbfs(directory),
	})
	if err != nil {
		return nil, err
	}

	err = cli.SimpleFSWait(ctx, opid)
	if err != nil {
		return nil, err
	}

	for {
		listResult, err := cli.SimpleFSReadList(ctx, opid)
		if err != nil {
			break
		}
		for _, entry := range listResult.Entries {
			match, err := filepath.Match(base, entry.Name)
			if err == nil && match == true {
				returnPaths = append(returnPaths, keybase1.NewPathWithKbfs(filepath.ToSlash(filepath.Join(directory, entry.Name))))
			}
		}
	}
	return returnPaths, err
}

func doSimpleFSPlatformGlob(g *libkb.GlobalContext, ctx context.Context, cli keybase1.SimpleFSInterface, paths []keybase1.Path) ([]keybase1.Path, error) {
	var returnPaths []keybase1.Path
	for _, path := range paths {
		pathType, err := path.PathType()
		if err != nil {
			return returnPaths, err
		}

		pathString := pathToString(path)
		if strings.ContainsAny(filepath.Base(pathString), "?*[]") == false {
			returnPaths = append(returnPaths, path)
			continue
		}

		if pathType == keybase1.PathType_KBFS {
			// remote glob
			globbed, err := doSimpleFSRemoteGlob(g, ctx, cli, path)
			if err != nil {
				return nil, err
			}
			returnPaths = append(returnPaths, globbed...)
		} else {
			// local glob
			matches, err := filepath.Glob(pathString)
			if err != nil {
				return nil, err
			}
			for _, match := range matches {
				returnPaths = append(returnPaths, keybase1.NewPathWithLocal(match))
			}
		}
	}
	return returnPaths, nil
}
