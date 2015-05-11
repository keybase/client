package libkbfs

import (
	"runtime"
	"sync"
	"testing"

	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/keybase/kbfs/util"
)

type RWChannelCounter struct {
	lock   sync.Mutex
	rwc    util.RWScheduler
	rcount int
	wcount int
}

func NewRWChannelCounter(bufSize int) *RWChannelCounter {
	return &RWChannelCounter{rwc: util.NewRWChannel(bufSize)}
}

func (rwc *RWChannelCounter) QueueReadReq(rreq func()) {
	rwc.lock.Lock()
	rwc.rcount++
	rwc.lock.Unlock()
	rwc.rwc.QueueReadReq(rreq)
}

func (rwc *RWChannelCounter) QueueWriteReq(wreq func()) {
	rwc.lock.Lock()
	rwc.wcount++
	rwc.lock.Unlock()
	rwc.rwc.QueueWriteReq(wreq)
}

func (rwc *RWChannelCounter) Shutdown() chan struct{} {
	return rwc.rwc.Shutdown()
}

func kbfsOpsConcurInit(t *testing.T, users ...string) (Config, keybase1.UID) {
	config := MakeTestConfigOrBust(t, false, users...)

	loggedInUser, err := config.KBPKI().GetLoggedInUser()
	if err != nil {
		t.Fatal(err)
	}

	return config, loggedInUser
}

// Test that only one of two concurrent GetRootMD requests can end up
// fetching the MD from the server.  The second one should wait, and
// then get it from the MD cache.
func TestKBFSOpsConcurDoubleMDGet(t *testing.T) {
	config, uid := kbfsOpsConcurInit(t, "test_user")
	defer config.KBFSOps().(*KBFSOpsStandard).Shutdown()
	m := NewMDOpsConcurTest(uid)
	config.SetMDOps(m)

	n := 10
	c := make(chan error, n)
	dir := DirID{0}
	rwc := NewRWChannelCounter(n)
	config.KBFSOps().(*KBFSOpsStandard).dirRWChans.chans[dir] = rwc
	for i := 0; i < n; i++ {
		go func() {
			_, _, _, err := config.KBFSOps().GetRootPath(dir)
			c <- err
		}()
	}
	// wait until at least the first one started
	m.enter <- struct{}{}
	close(m.enter)
	// make sure that the second goroutine has also started its write
	// call, and thus must be queued behind the first one (since we
	// are guaranteed the first one is currently running, and
	// RWChannel only allows one write at a time).
	for {
		rwc.lock.Lock()
		rc := rwc.rcount
		wc := rwc.wcount
		rwc.lock.Unlock()
		if rc == n && wc >= 2 {
			break
		} else {
			runtime.Gosched()
		}
	}
	// Now let the first one complete.  The second one should find the
	// MD in the cache, and thus never call MDOps.Get().
	m.start <- struct{}{}
	close(m.start)
	for i := 0; i < n; i++ {
		err := <-c
		if err != nil {
			t.Errorf("Got an error doing concurrent MD gets: err=(%s)", err)
		}
	}
}
