// Copyright 2026 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
//go:build darwin
// +build darwin

package libfskit

import (
	"context"
	"fmt"
	"os"
	"path"

	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libgit"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/simplefs"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/systemd"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// PlatformParams contains all platform-specific parameters.
type PlatformParams struct {
	UseLocal bool
}

// StartOptions are options for starting up.
type StartOptions struct {
	KbfsParams        libkbfs.InitParams
	PlatformParams    PlatformParams
	RuntimeDir        string
	Label             string
	ForceMount        bool
	MountErrorIsFatal bool
	SkipMount         bool
	MountPoint        string
}

// Start the filesystem stack for the FSKit-backed macOS driver.
//
// The in-process FUSE mount is intentionally skipped on darwin. Mounting is
// performed by the native FSKit extension.
func Start(options StartOptions, kbCtx libkbfs.Context) *libfs.Error {
	shutdownSimpleFS := func(_ context.Context) error { return nil }
	createSimpleFS := func(
		libkbfsCtx libkbfs.Context, config libkbfs.Config,
	) (rpc.Protocol, error) {
		var sfs *simplefs.SimpleFS
		sfs, shutdownSimpleFS = simplefs.NewSimpleFS(libkbfsCtx, config)
		config.AddResetForLoginTarget(sfs)
		return keybase1.SimpleFSProtocol(sfs), nil
	}

	shutdownGit := func() {}
	createGitHandler := func(
		libkbfsCtx libkbfs.Context, config libkbfs.Config,
	) (rpc.Protocol, error) {
		var handler keybase1.KBFSGitInterface
		handler, shutdownGit = libgit.NewRPCHandlerWithCtx(
			libkbfsCtx, config, &options.KbfsParams)
		return keybase1.KBFSGitProtocol(handler), nil
	}
	defer func() {
		err := shutdownSimpleFS(context.Background())
		if err != nil {
			fmt.Fprintf(os.Stderr, "Couldn't shut down SimpleFS: %+v\n", err)
		}
		shutdownGit()
	}()

	options.KbfsParams.AdditionalProtocolCreators = []libkbfs.AdditionalProtocolCreator{
		createSimpleFS, createGitHandler,
	}

	log, err := libkbfs.InitLog(options.KbfsParams, kbCtx)
	if err != nil {
		return libfs.InitError(err.Error())
	}

	if options.RuntimeDir != "" {
		err := os.MkdirAll(options.RuntimeDir, libkb.PermDir)
		if err != nil {
			return libfs.InitError(err.Error())
		}
		info := libkb.NewServiceInfo(libkb.Version, libkbfs.PrereleaseBuild, options.Label, os.Getpid())
		err = info.WriteFile(path.Join(options.RuntimeDir, "kbfs.info"), log)
		if err != nil {
			return libfs.InitError(err.Error())
		}
	}

	log.Debug("Initializing FSKit backend")
	mi := libfs.NewMountInterrupter(log)
	ctx := context.Background()
	config, err := libkbfs.Init(ctx, kbCtx, options.KbfsParams, nil, mi.Done, log)
	if err != nil {
		return libfs.InitError(err.Error())
	}
	defer libkbfs.Shutdown()

	libfs.AddRootWrapper(config)
	systemd.NotifyStartupFinished()

	if options.SkipMount {
		log.Debug("Skipping mount startup for FSKit backend")
	} else {
		log.Debug("FSKit backend active; mount lifecycle is owned by native extension")
	}

	mi.Wait()
	return nil
}
