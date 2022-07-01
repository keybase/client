// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/libkbfs"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"golang.org/x/net/context"
)

// Special files in root directory.
const (
	HumanErrorFileName      = "kbfs.error.txt"
	HumanNoLoginFileName    = "kbfs.nologin.txt"
	failureDisplayThreshold = 5 * time.Second
)

// RemoteStatusUpdater has callbacks that will be called from libfs
// when kbfs status changes in interesting ways.
type RemoteStatusUpdater interface {
	// UserChanged is called when the kbfs user is changed.
	// Either oldName or newName, or both may be empty.
	UserChanged(ctx context.Context, oldName, newName kbname.NormalizedUsername)
}

// RemoteStatus is for maintaining status of various remote connections like keybase
// service and md-server.
type RemoteStatus struct {
	sync.Mutex
	currentUser       kbname.NormalizedUsername
	failingServices   map[string]error
	extraFileName     string
	extraFileContents []byte
	failingSince      time.Time
	callbacks         RemoteStatusUpdater
}

// Init a RemoteStatus and register it with libkbfs.
func (r *RemoteStatus) Init(ctx context.Context, log logger.Logger, config libkbfs.Config, rs RemoteStatusUpdater) {
	r.failingServices = map[string]error{}
	r.callbacks = rs
	// A time in the far past that is not IsZero
	r.failingSince.Add(time.Second)
	go r.loop(ctx, log, config)
}

func (r *RemoteStatus) loop(ctx context.Context, log logger.Logger, config libkbfs.Config) {
	for {
		tctx, cancel := context.WithTimeout(ctx, 1*time.Second)
		st, ch, err := config.KBFSOps().Status(tctx)
		// No deferring inside loops, and no panics either here.
		cancel()
		if err != nil {
			log.Warning("KBFS Status failed: %v,%v,%v", st, ch, err)
		}
		r.update(ctx, st)
		// Block on the channel or shutdown.
		select {
		case <-ctx.Done():
			return
		case <-ch:
		}
	}
}

func (r *RemoteStatus) update(ctx context.Context, st libkbfs.KBFSStatus) {
	r.Lock()
	defer r.Unlock()

	if newUser := kbname.NormalizedUsername(st.CurrentUser); r.currentUser != newUser {
		oldUser := r.currentUser
		r.currentUser = newUser
		if r.callbacks != nil {
			go r.callbacks.UserChanged(ctx, oldUser, newUser)
		}
	}

	r.failingServices = st.FailingServices

	// Select the file name:
	// + Default to an empty name
	// + If all errors are LoginRequiredError then display the nologin filename
	// + If there are any other errors use the generic error file name,
	//   implemented by breaking out of the loop if such an error is encountered.
	fname := ""
	for _, err := range r.failingServices {
		if isNotLoggedInError(err) {
			fname = HumanNoLoginFileName
		} else {
			fname = HumanErrorFileName
			break
		}
	}
	isZeroTime := r.failingSince.IsZero()
	if len(r.failingServices) > 0 {
		if isZeroTime {
			r.failingSince = time.Now()
		}
	} else if !isZeroTime {
		r.failingSince = time.Time{}
	}
	r.extraFileName = fname
	r.extraFileContents = nil
}

func isNotLoggedInError(err error) bool {
	_, ok := err.(libkb.LoginRequiredError)
	return ok
}

var newline = func() string {
	if runtime.GOOS == "windows" {
		return "\r\n"
	}
	return "\n"
}()

// ExtraFileName returns the extra file name or an empty string for none.
func (r *RemoteStatus) ExtraFileName() string {
	r.Lock()
	defer r.Unlock()

	if r.extraFileName == "" || time.Since(r.failingSince) < failureDisplayThreshold {
		return ""
	}

	return r.extraFileName
}

// ExtraFileNameAndSize returns the extra file name or an empty string for none and the size of the extra file.
func (r *RemoteStatus) ExtraFileNameAndSize() (string, int64) {
	r.Lock()
	defer r.Unlock()

	if r.extraFileName == "" || time.Since(r.failingSince) < failureDisplayThreshold {
		return "", 0
	}

	return r.extraFileName, int64(len(r.humanReadableBytesLocked()))
}

// humanReadableBytesNeedsLock should be called with lock already held.
func (r *RemoteStatus) humanReadableBytesLocked() []byte {
	if r.extraFileContents != nil {
		return r.extraFileContents
	}

	var ss []string
	needLogin := false
	for service, err := range r.failingServices {
		switch err.(type) {
		case *libkb.LoginRequiredError:
			needLogin = true
		default:
			ss = append(ss, service+": "+err.Error())
		}
	}

	if len(ss) == 0 {
		if needLogin {
			ss = append(ss, "Not logged in")
		} else {
			ss = append(ss, "Everything appears ok")
		}
	}
	ss = append(ss, "")

	res := []byte(strings.Join(ss, newline))
	r.extraFileContents = res
	return res
}

// NewSpecialReadFunc implements a special read file that contains human readable
// current status.
func (r *RemoteStatus) NewSpecialReadFunc(ctx context.Context) ([]byte, time.Time, error) {
	r.Lock()
	defer r.Unlock()

	return r.humanReadableBytesLocked(), time.Time{}, nil
}
