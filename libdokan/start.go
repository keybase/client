// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"os"
	"path"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// StartOptions are options for starting up
type StartOptions struct {
	KbfsParams libkbfs.InitParams
	RuntimeDir string
	Label      string
}

// Start the filesystem
func Start(mounter Mounter, options StartOptions, kbCtx libkbfs.Context) *libfs.Error {
	// InitLog errors are non-fatal and are ignored.
	log, _ := libkbfs.InitLog(options.KbfsParams, kbCtx)

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

	fs, err := NewFS(context.Background(), config, log)
	if err != nil {
		return libfs.InitError(err.Error())
	}

	if newFolderNameErr != nil {
		log.CWarningf(fs.context, "Error guessing new folder name: %v", newFolderNameErr)
	}
	log.CDebugf(fs.context, "New folder name guess: %q %q", newFolderName, newFolderAltName)

	err = mounter.Mount(fs, log)
	if err != nil {
		return libfs.MountError(err.Error())
	}

	return nil
}
