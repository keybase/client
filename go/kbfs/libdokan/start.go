// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"os"
	"path"
	"strings"

	"github.com/keybase/client/go/kbfs/dokan"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libgit"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/simplefs"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

// StartOptions are options for starting up
type StartOptions struct {
	KbfsParams  libkbfs.InitParams
	RuntimeDir  string
	Label       string
	DokanConfig dokan.Config
	ForceMount  bool
	SkipMount   bool
	MountPoint  string
}

func startMounting(options StartOptions,
	log logger.Logger, mi *libfs.MountInterrupter) error {
	log.Info("Starting mount with options: %#v", options)
	var mounter = &mounter{options: options, log: log}
	err := mi.MountAndSetUnmount(mounter)
	if err != nil {
		return err
	}
	log.Info("Mounting the filesystem was a success!")
	return mounter.c.BlockTillDone()
}

// Start the filesystem
func Start(options StartOptions, kbCtx libkbfs.Context) *libfs.Error {
	// Hook simplefs implementation in.
	createSimpleFS := func(
		libkbfsCtx libkbfs.Context, config libkbfs.Config) (rpc.Protocol, error) {
		return keybase1.SimpleFSProtocol(
			simplefs.NewSimpleFS(libkbfsCtx, config)), nil
	}
	// Hook git implementation in.
	shutdownGit := func() {}
	createGitHandler := func(
		libkbfsCtx libkbfs.Context, config libkbfs.Config) (rpc.Protocol, error) {
		var handler keybase1.KBFSGitInterface
		handler, shutdownGit = libgit.NewRPCHandlerWithCtx(
			libkbfsCtx, config, &options.KbfsParams)
		return keybase1.KBFSGitProtocol(handler), nil
	}
	defer func() {
		shutdownGit()
	}()

	// Patch the kbfsParams to inject two additional protocols.
	options.KbfsParams.AdditionalProtocolCreators = []libkbfs.AdditionalProtocolCreator{
		createSimpleFS, createGitHandler,
	}

	log, err := libkbfs.InitLog(options.KbfsParams, kbCtx)
	if err != nil {
		return libfs.InitError(err.Error())
	}

	mi := libfs.NewMountInterrupter(log)
	ctx := context.Background()
	config, err := libkbfs.Init(
		ctx, kbCtx, options.KbfsParams, nil, mi.Done, log)
	if err != nil {
		return libfs.InitError(err.Error())
	}

	defer libkbfs.Shutdown()

	libfs.AddRootWrapper(config)

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

	if options.KbfsParams.Debug {
		// Turn on debugging.  TODO: allow a proper log file and
		// style to be specified.
		log.Configure("", true, "")
	}

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	if options.MountPoint == "" {
		// The mounter will detect this case and pick up the path from DokanConfig
		options.MountPoint, err = config.KeybaseService().EstablishMountDir(ctx)
		if err != nil {
			return libfs.InitError(err.Error())
		}
		log.CInfof(ctx, "Got mount dir from service: -%s-", options.MountPoint)
	}
	options.DokanConfig.Path = options.MountPoint

	if !options.SkipMount && !strings.EqualFold(options.MountPoint, "none") {

		fs, err := NewFS(ctx, config, log)
		if err != nil {
			return libfs.InitError(err.Error())
		}
		options.DokanConfig.FileSystem = fs

		if newFolderNameErr != nil {
			log.CWarningf(ctx, "Error guessing new folder name: %v", newFolderNameErr)
		}
		log.CDebugf(ctx, "New folder name guess: %q %q", newFolderName, newFolderAltName)

		st, err := os.Lstat(options.MountPoint)
		log.CDebugf(ctx, "Before mount check (should fail) Lstat(%q): %v,%v", options.MountPoint, st, err)

		err = startMounting(options, log, mi)
		if err != nil {
			logDokanInfo(ctx, log)
			// Abort on error if we were force mounting, otherwise continue.
			if options.ForceMount {
				// Cleanup when exiting in case the mount got dirty.
				err = mi.Done()
				if err != nil {
					log.CErrorf(ctx, "Couldn't mount: %v", err)
				}
				return libfs.MountError(err.Error())
			}
			log.CErrorf(ctx, "Running KBFS without a filesystem mount due to: %v", err)
		}
	}

	log.CDebugf(ctx, "Entering mount wait")
	mi.Wait()
	log.CDebugf(ctx, "Filesystem unmounted - mount wait returned - exiting")
	return nil
}
