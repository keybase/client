// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"context"
	"path/filepath"

	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libkbfs"
)

const (
	indexStorageDir    = "kbfs_index"
	bleveIndexDir      = "bleve"
	bserverStorageDir  = "bserver"
	mdserverStorageDir = "mdserver"
)

// Params returns a set of default parameters for search-related
// operations.
func Params(kbCtx libkbfs.Context, storageRoot string) (
	params libkbfs.InitParams, err error) {
	params = libkbfs.DefaultInitParams(kbCtx)
	params.Debug = true
	params.LogToFile = true

	params.EnableJournal = false
	params.DiskCacheMode = libkbfs.DiskCacheModeOff
	params.StorageRoot = filepath.Join(storageRoot, indexStorageDir)
	params.BServerAddr = "dir:" + filepath.Join(
		params.StorageRoot, bserverStorageDir)
	params.MDServerAddr = "dir:" + filepath.Join(
		params.StorageRoot, mdserverStorageDir)
	params.Mode = libkbfs.InitSingleOpString

	return params, nil
}

// Init initializes a context and a libkbfs.Config for search
// operations.  The config should be shutdown when it is done being
// used.
func Init(ctx context.Context, kbCtx libkbfs.Context, params libkbfs.InitParams,
	keybaseServiceCn libkbfs.KeybaseServiceCn,
	defaultLogPath string, vlogLevel string) (
	context.Context, libkbfs.Config, error) {
	log, err := libkbfs.InitLogWithPrefix(
		params, kbCtx, "search", defaultLogPath)
	if err != nil {
		return ctx, nil, err
	}

	ctx, err = libcontext.NewContextWithCancellationDelayer(
		libcontext.NewContextReplayable(
			ctx, func(ctx context.Context) context.Context {
				return ctx
			}))
	if err != nil {
		return ctx, nil, err
	}

	config, err := libkbfs.InitWithLogPrefix(
		ctx, kbCtx, params, keybaseServiceCn, nil, log, "git")
	if err != nil {
		return ctx, nil, err
	}
	config.SetVLogLevel(vlogLevel)

	return ctx, config, nil
}
