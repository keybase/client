// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"os"
	"path"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// StartOptions are options for starting up
type StartOptions struct {
	KbfsParams  libkbfs.InitParams
	RuntimeDir  string
	Label       string
	DokanConfig dokan.Config
}

// Start the filesystem
func Start(mounter Mounter, options StartOptions, kbCtx libkbfs.Context) *libfs.Error {
	log, err := libkbfs.InitLog(options.KbfsParams, kbCtx)
	if err != nil {
		return libfs.InitError(err.Error())
	}

	onInterruptFn := func() {
		mounter.Unmount()
	}

	config, err := libkbfs.Init(kbCtx, options.KbfsParams, nil, onInterruptFn, log)
	if err != nil {
		return libfs.InitError(err.Error())
	}

	defer libkbfs.Shutdown()

	if options.RuntimeDir != "" {
		info := libkb.NewServiceInfo(libkbfs.Version, libkbfs.PrereleaseBuild, options.Label, os.Getpid())
		err = info.WriteFile(path.Join(options.RuntimeDir, "kbfs.info"))
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
	fs, err := NewFS(ctx, config, log)
	if err != nil {
		return libfs.InitError(err.Error())
	}
	options.DokanConfig.FileSystem = fs
	options.DokanConfig.Path = mounter.Dir()

	if newFolderNameErr != nil {
		log.CWarningf(ctx, "Error guessing new folder name: %v", newFolderNameErr)
	}
	log.CDebugf(ctx, "New folder name guess: %q %q", newFolderName, newFolderAltName)

	err = mounter.Mount(&options.DokanConfig, log)
	if err != nil {
		return libfs.MountError(err.Error())
	}

	return nil
}
