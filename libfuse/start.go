// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfuse

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
	log, err := libkbfs.InitLog(options.KbfsParams, kbCtx)
	if err != nil {
		return libfs.InitError(err.Error())
	}

	if options.RuntimeDir != "" {
		info := libkb.NewServiceInfo(libkbfs.Version, libkbfs.PrereleaseBuild, options.Label, os.Getpid())
		err := info.WriteFile(path.Join(options.RuntimeDir, "kbfs.info"))
		if err != nil {
			return libfs.InitError(err.Error())
		}
	}

	log.Debug("Mounting: %s", mounter.Dir())
	c, err := mounter.Mount()
	if err != nil {
		return libfs.MountError(err.Error())
	}
	var doneChan <-chan struct{}
	var onInterruptFn func()

	if c != nil {
		defer c.Close()

		doneChan = c.Ready
		onInterruptFn = func() {
			select {
			case <-c.Ready:
				// Was mounted, so try to unmount if it was successful.
				if c.MountError == nil {
					err = mounter.Unmount()
					if err != nil {
						return
					}
				}

			default:
				// Was not mounted successfully yet, so do nothing. Note that the mount
				// could still happen, but that's a rare enough edge case.
			}
			libkbfs.Shutdown()
		}
	} else {
		// When there's no mount, declare ourselves done when we get
		// an interrupt.
		ch := make(chan struct{}, 1)
		doneChan = ch
		onInterruptFn = func() {
			select {
			case ch <- struct{}{}:
				libkbfs.Shutdown()
			default:
			}
		}
	}

	log.Debug("Initializing")

	config, err := libkbfs.Init(kbCtx, options.KbfsParams, nil, onInterruptFn, log)
	if err != nil {
		return libfs.InitError(err.Error())
	}

	defer libkbfs.Shutdown()

	if c != nil {
		log.Debug("Creating filesystem")
		fs := NewFS(config, c, options.KbfsParams.Debug)
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		ctx = context.WithValue(ctx, libfs.CtxAppIDKey, fs)
		log.Debug("Serving filesystem")
		fs.Serve(ctx)
	}

	<-doneChan
	if c != nil {
		err = c.MountError
		if err != nil {
			return libfs.MountError(err.Error())
		}
	}

	log.Debug("Ending")
	return nil
}
