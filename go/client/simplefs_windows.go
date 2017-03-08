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

	cli, err := GetSimpleFSClient(g)
	if err != nil {
		return nil, err
	}

	g.Log.Debug("doSimpleFSRemoteGlob %s", path.Kbfs())

	if strings.ContainsAny(directory, "?*[]") == true {
		return nil, errors.New("wildcards not supported in parent directories")
	}
func doSimpleFSPlatformGlob(g *libkb.GlobalContext, ctx context.Context, paths []keybase1.Path) ([]keybase1.Path, error) {
		if strings.ContainsAny(filepath.Base(pathString), "?*") == false {
			globbed, err := doSimpleFSRemoteGlob(g, ctx, path)
