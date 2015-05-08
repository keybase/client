package libkbfs

import (
	"fmt"
	"runtime"
	"sync"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/kbfs/util"
)

type RWChannelCounter struct {
	lock   sync.Mutex
	rwc    util.RWChannel
	rcount int
	wcount int
}

func NewRWChannelCounter(bufSize int) *RWChannelCounter {
	return &RWChannelCounter{rwc: util.NewRWChannelImpl(bufSize)}
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
	uid   libkb.UID
	enter chan struct{}
	start chan struct{}
}

func NewMDOpsConcurTest(uid libkb.UID) *MDOpsConcurTest {
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

func (m *MDOpsConcurTest) Get(id DirId) (*RootMetadata, error) {
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

func (m *MDOpsConcurTest) GetAtId(id DirId, mdId MDId) (*RootMetadata, error) {
	return nil, fmt.Errorf("Not supported")
}

func (m *MDOpsConcurTest) Put(id DirId, md *RootMetadata) error {
	return nil
}

func (m *MDOpsConcurTest) GetFavorites() ([]DirId, error) {
	return []DirId{}, nil
}

func kbfsOpsConcurInit(users []string) (Config, libkb.UID) {
	config := NewConfigLocal()

	localUsers := make([]LocalUser, len(users))
	for i := 0; i < len(users); i++ {
		kid := KID("test_sub_key_" + users[i])
		localUsers[i] = LocalUser{
			Name:            users[i],
			Uid:             libkb.UID{byte(i + 1)},
			SubKeys:         []Key{NewKeyFake(kid)},
			DeviceSubkeyKid: kid,
		}
	}
	loggedInUid := localUsers[0].Uid

	// TODO: Consider using fake BlockOps and MDOps instead.
	k := NewKBPKILocal(loggedInUid, localUsers)
	config.SetKBPKI(k)
	config.SetBlockServer(NewFakeBlockServer())
	config.SetMDServer(NewFakeMDServer(config))

	return config, loggedInUid
}

// Test that only one of two concurrent GetRootMD requests can end up
// fetching the MD from the server.  The second one should wait, and
// then get it from the MD cache.
func TestKBFSOpsConcurDoubleMDGet(t *testing.T) {
	config, uid := kbfsOpsConcurInit([]string{"test_user"})
	defer config.KBFSOps().(*KBFSOpsStandard).Shutdown()
	m := NewMDOpsConcurTest(uid)
	config.SetMDOps(m)

	n := 10
	c := make(chan error, n)
	dir := DirId{0}
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
