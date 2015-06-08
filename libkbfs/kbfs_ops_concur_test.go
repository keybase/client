package libkbfs

import (
	"fmt"
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

type MDOpsConcurTest struct {
	uid   keybase1.UID
	enter chan struct{}
	start chan struct{}
}

func NewMDOpsConcurTest(uid keybase1.UID) *MDOpsConcurTest {
	return &MDOpsConcurTest{
		uid:   uid,
		enter: make(chan struct{}),
		start: make(chan struct{}),
	}
}

func (m *MDOpsConcurTest) GetAtHandle(handle *DirHandle) (
	*RootMetadata, error) {
	return nil, fmt.Errorf("Not supported")
}

func (m *MDOpsConcurTest) Get(id DirID) (*RootMetadata, error) {
	_, ok := <-m.enter
	if !ok {
		// Only one caller should ever get here
		return nil, fmt.Errorf("More than one caller to Get()!")
	}
	<-m.start
	dh := NewDirHandle()
	dh.Writers = append(dh.Writers, m.uid)
	return NewRootMetadata(dh, id), nil
}

func (m *MDOpsConcurTest) GetAtID(id DirID, mdID MdID) (*RootMetadata, error) {
	return nil, fmt.Errorf("Not supported")
}

func (m *MDOpsConcurTest) Put(id DirID, md *RootMetadata) error {
	return nil
}

func (m *MDOpsConcurTest) GetFavorites() ([]DirID, error) {
	return []DirID{}, nil
}

func kbfsOpsConcurInit(t *testing.T, users ...string) (Config, keybase1.UID) {
	config := MakeTestConfigOrBust(t, users...)

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
			_, err := config.KBFSOps().GetRootMD(dir)
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
