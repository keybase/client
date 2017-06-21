// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfuse

import (
	"os"
	"path"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/simplefs"
	"golang.org/x/net/context"
)

// StartOptions are options for starting up
type StartOptions struct {
	KbfsParams     libkbfs.InitParams
	PlatformParams PlatformParams
	RuntimeDir     string
	Label          string
	ForceMount     bool
	SkipMount      bool
	MountPoint     string
}

// Start the filesystem
func Start(options StartOptions, kbCtx libkbfs.Context) *libfs.Error {
	// Hook simplefs implementation in.
	options.KbfsParams.CreateSimpleFSInstance = simplefs.NewSimpleFS

	log, err := libkbfs.InitLog(options.KbfsParams, kbCtx)
	if err != nil {
		return libfs.InitError(err.Error())
	}

	if options.RuntimeDir != "" {
		info := libkb.NewServiceInfo(libkbfs.Version, libkbfs.PrereleaseBuild, options.Label, os.Getpid())
		err := info.WriteFile(path.Join(options.RuntimeDir, "kbfs.info"), log)
		if err != nil {
			return libfs.InitError(err.Error())
		}
	}

	log.Debug("Initializing")
	mi := libfs.NewMountInterrupter()
	config, err := libkbfs.Init(kbCtx, options.KbfsParams, nil, mi.Done, log)
	if err != nil {
		return libfs.InitError(err.Error())
	}
	defer libkbfs.Shutdown()

	if options.SkipMount {
		log.Debug("Skipping mounting filesystem")
	} else {
		err = startMounting(config, options, log, mi)
		if err != nil {
			log.Errorf("Mounting filesystem failed: %v", err)
			// Abort on error if we were force mounting, otherwise continue.
			if options.ForceMount {
				// If we exit we might want to clean a mount behind us.
				mi.Done()
				return libfs.MountError(err.Error())
			}
		}
	}
	mi.Wait()
	return nil
}

func startMounting(config libkbfs.Config, options StartOptions,
	log logger.Logger, mi *libfs.MountInterrupter) error {
	log.Debug("Mounting: %q", options.MountPoint)
	c, err := fuseMount(options)
	if err != nil {
		return err
	}
	mi.SetOnceFun(func() { fuseUnmount(options) })

	<-c.Ready
	err = c.MountError
	if err != nil {
		return err
	}

	log.Debug("Creating filesystem")
	fs := NewFS(config, c, options.KbfsParams.Debug, options.PlatformParams)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	ctx = context.WithValue(ctx, libfs.CtxAppIDKey, fs)
	log.Debug("Serving filesystem")
	if err = fs.Serve(ctx); err != nil {
		return err
	}

	log.Debug("Ending")
	return nil
}
