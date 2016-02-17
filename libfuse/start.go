package libfuse

import (
	"os"
	"path"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
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
func Start(mounter Mounter, options StartOptions) *libfs.Error {
	log := logger.NewWithCallDepth("", 1, os.Stderr)
	log.Configure("", options.KbfsParams.Debug, "")
	log.Info("KBFS version %s", libkbfs.VersionString())

	if options.RuntimeDir != "" {
		info := libkb.NewServiceInfo(libkbfs.Version, libkbfs.Build(), options.Label, os.Getpid())
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
	defer c.Close()

	onInterruptFn := func() {
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
	}

	log.Debug("Initializing")
	config, err := libkbfs.Init(options.KbfsParams, onInterruptFn, log)
	if err != nil {
		return libfs.InitError(err.Error())
	}

	defer libkbfs.Shutdown()

	log.Debug("Creating filesystem")
	fs := NewFS(config, c, options.KbfsParams.Debug)
	ctx := context.WithValue(context.Background(), CtxAppIDKey, fs)
	logTags := make(logger.CtxLogTags)
	logTags[CtxIDKey] = CtxOpID
	ctx = logger.NewContextWithLogTags(ctx, logTags)
	log.Debug("Serving filesystem")
	fs.Serve(ctx)

	<-c.Ready
	err = c.MountError
	if err != nil {
		return libfs.MountError(err.Error())
	}

	log.Debug("Ending")
	return nil
}
