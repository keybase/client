package libfs

import (
	"runtime"
	"strings"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// Special files in root directory.
const (
	HumanErrorFileName   = "kbfs.error.txt"
	HumanNoLoginFileName = "kbfs.nologin.txt"
)

// RemoteStatus is for maintaining status of various remote connections like keybase
// service and md-server.
type RemoteStatus struct {
	sync.Mutex
	failingServices   map[string]error
	extraFileName     string
	extraFileContents []byte
}

// Init a RemoteStatus and register it with libkbfs.
func (r *RemoteStatus) Init(ctx context.Context, log logger.Logger, config libkbfs.Config) {
	r.failingServices = map[string]error{}
	go r.loop(ctx, log, config)
}

func (r *RemoteStatus) loop(ctx context.Context, log logger.Logger, config libkbfs.Config) {
	for {
		tctx, cancel := context.WithTimeout(ctx, 1*time.Second)
		st, ch, err := config.KBFSOps().Status(tctx)
		// No deferring inside loops, and no panics either here.
		cancel()
		if err != nil {
			log.Warning("KBFS Status failed: %v", err)
		}
		r.update(st)
		// Block on the channel or shutdown.
		select {
		case <-ctx.Done():
			return
		case <-ch:
		}
	}
}

func (r *RemoteStatus) update(st libkbfs.KBFSStatus) {
	r.Lock()
	defer r.Unlock()

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
	r.extraFileName = fname
	r.extraFileContents = nil
}

func isNotLoggedInError(err error) bool {
	_, ok := err.(keybase1.LoginRequiredError)
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

	return r.extraFileName
}

// ExtraFileNameAndSize returns the extra file name or an empty string for none and the size of the extra file.
func (r *RemoteStatus) ExtraFileNameAndSize() (string, int64) {
	r.Lock()
	defer r.Unlock()

	var size int64
	if r.extraFileName != "" {
		size = int64(len(r.humanReadableBytesLocked()))
	}
	return r.extraFileName, size
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
		case *keybase1.LoginRequiredError:
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
