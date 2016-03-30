package libfs

import (
	"runtime"
	"strings"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/go/libkb"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// RemoteStatus is for maintaining status of various remote connections like keybase
// service and md-server.
type RemoteStatus struct {
	sync.RWMutex
	failingServices map[string]error
	ExtraFileName   string
}

// Init a RemoteStatus and register it with libkbfs.
func (r *RemoteStatus) Init() {
	r.failingServices = map[string]error{}
	libkbfs.RegisterForConnectionStatusChanges(r.onConnectionStatusChange)
}

// Special files in root directory.
const (
	HumanErrorFileName   = "kbfs.error.txt"
	HumanNoLoginFileName = "kbfs.nologin.txt"
)

func (r *RemoteStatus) onConnectionStatusChange(cs *libkbfs.ConnectionStatus) {
	r.Lock()
	defer r.Unlock()

	if cs.Error != nil {
		r.failingServices[cs.Service] = cs.Error
	} else {
		delete(r.failingServices, cs.Service)
	}

	switch {
	case len(r.failingServices) == 1 && isNotLoggedInError(cs.Error):
		r.ExtraFileName = HumanNoLoginFileName
	case len(r.failingServices) > 0:
		r.ExtraFileName = HumanErrorFileName
	default:
		r.ExtraFileName = ""
	}
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

// NewSpecialReadFunc implements a special read file that contains human readable
// current status.
func (r *RemoteStatus) NewSpecialReadFunc(ctx context.Context) ([]byte, time.Time, error) {
	var ss []string
	r.RLock()
	defer r.RUnlock()

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

	return []byte(strings.Join(ss, newline)), time.Time{}, nil
}
