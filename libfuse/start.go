package libfuse

import (
	"fmt"
	"io/ioutil"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// StartOptions are options for starting up
type StartOptions struct {
	LocalUser     libkb.NormalizedUsername
	ServerRootDir *string
	CPUProfile    string
	MemProfile    string
	VersionFile   string
	Debug         bool
}

// Start the filesystem
func Start(mounter Mounter, options StartOptions) *Error {
	c, err := mounter.Mount()
	if err != nil {
		return MountError(err.Error())
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

	config, err := libkbfs.Init(options.LocalUser, options.ServerRootDir, options.CPUProfile, options.MemProfile, onInterruptFn, options.Debug)
	if err != nil {
		return InitError(err.Error())
	}

	defer libkbfs.Shutdown(options.MemProfile)

	if options.VersionFile != "" {
		version := fmt.Sprintf("%s-%s", libkbfs.Version, libkbfs.Build)
		err = ioutil.WriteFile(options.VersionFile, []byte(version), 0644)
		if err != nil {
			return InitError(err.Error())
		}
	}

	fs := NewFS(config, c, options.Debug)
	ctx := context.WithValue(context.Background(), CtxAppIDKey, &fs)
	logTags := make(logger.CtxLogTags)
	logTags[CtxIDKey] = CtxOpID
	ctx = logger.NewContextWithLogTags(ctx, logTags)
	fs.Serve(ctx)

	<-c.Ready
	err = c.MountError
	if err != nil {
		return MountError(err.Error())
	}

	return nil
}
