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
	ExtraFileName     string
	ExtraFileContents []byte
}

// Init a RemoteStatus and register it with libkbfs.
func (r *RemoteStatus) Init(ctx context.Context, log logger.Logger, kbfsops libkbfs.KBFSOps) {
	r.failingServices = map[string]error{}
	go r.loop(ctx, log, kbfsops)
}

func (r *RemoteStatus) loop(ctx context.Context, log logger.Logger, kbfsops libkbfs.KBFSOps) {
	for {
		ctx, cancel := context.WithTimeout(ctx, 100*time.Millisecond)
		st, ch, err := kbfsops.Status(ctx)
		// No deferring inside loops, and no panics either here.
		cancel()
		if err != nil {
			log.Warning("KBFS Status failed: %v", err)
		}
		r.update(st)
		// Block on the channel.
		<-ch
	}
}

func (r *RemoteStatus) update(st libkbfs.KBFSStatus) {
	r.Lock()
	defer r.Unlock()

	r.failingServices = st.FailingServices

	fname := ""
	for _, err := range r.failingServices {
		if isNotLoggedInError(err) {
			fname = HumanNoLoginFileName
		} else {
			fname = HumanErrorFileName
			break
		}
	}
	r.ExtraFileName = fname
	r.ExtraFileContents = nil
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

// HumanReadableBytesNeedsLock should be called with lock already held.
func (r *RemoteStatus) HumanReadableBytesNeedsLock() []byte {
	var ss []string

	if r.ExtraFileContents != nil {
		return r.ExtraFileContents
	}

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
	r.ExtraFileContents = res
	return res
}

// NewSpecialReadFunc implements a special read file that contains human readable
// current status.
func (r *RemoteStatus) NewSpecialReadFunc(ctx context.Context) ([]byte, time.Time, error) {
	r.Lock()
	defer r.Unlock()

	return r.HumanReadableBytesNeedsLock(), time.Time{}, nil
}
