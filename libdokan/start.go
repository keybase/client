// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"os"
	"path"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/simplefs"
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
	var mounter = &mounter{options: options, log: log}
	mi.MountAndSetUnmount(mounter)
	log.Info("Mounting the filesystem was a success!")
	return mounter.c.BlockTillDone()
}

// Start the filesystem
func Start(options StartOptions, kbCtx libkbfs.Context) *libfs.Error {
	// Hook simplefs implementation in.
	options.KbfsParams.CreateSimpleFSInstance = simplefs.NewSimpleFS

	log, err := libkbfs.InitLog(options.KbfsParams, kbCtx)
	if err != nil {
		return libfs.InitError(err.Error())
	}

	mi := libfs.NewMountInterrupter(log)
	config, err := libkbfs.Init(kbCtx, options.KbfsParams, nil, mi.Done, log)
	if err != nil {
		return libfs.InitError(err.Error())
	}

	defer libkbfs.Shutdown()

	if options.RuntimeDir != "" {
		info := libkb.NewServiceInfo(libkbfs.Version, libkbfs.PrereleaseBuild, options.Label, os.Getpid())
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

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if options.MountPoint == "" {
		// The mounter will detect this case and pick up the path from DokanConfig
		options.MountPoint, err = config.KeybaseService().EstablishMountDir(ctx)
		if err != nil {
			return libfs.InitError(err.Error())
		}
		log.CInfof(ctx, "Got mount dir from service: %s", options.DokanConfig.Path)
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

		err = startMounting(options, log, mi)
		if err != nil {
			// Abort on error if we were force mounting, otherwise continue.
			if options.ForceMount {
				// Cleanup when exiting in case the mount got dirty.
				mi.Done()
				return libfs.MountError(err.Error())
			}
		}
	}

	mi.Wait()
	return nil
}
