package libkbfs

import (
	"runtime"
	"sync"
	"testing"

	keybase1 "github.com/keybase/client/protocol/go"
)

// CounterLock keeps track of the number of lock attempts
type CounterLock struct {
	countLock sync.Mutex
	realLock  sync.Mutex
	count     int
}

func (cl *CounterLock) Lock() {
	cl.countLock.Lock()
	cl.count++
	cl.countLock.Unlock()
	cl.realLock.Lock()
}

func (cl *CounterLock) Unlock() {
	cl.realLock.Unlock()
}

func (cl *CounterLock) GetCount() int {
	cl.countLock.Lock()
	defer cl.countLock.Unlock()
	return cl.count
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
	cl := &CounterLock{}

	ops := config.KBFSOps().(*KBFSOpsStandard).getOps(opID{dir, MasterBranch})
	ops.writerLock = cl
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
	// are guaranteed the first one is currently running, and they
	// both need the same lock).
	for cl.GetCount() < 2 {
		runtime.Gosched()
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

// Test that a read can happen concurrently with a sync
func TestKBFSOpsConcurReadDuringSync(t *testing.T) {
	config, uid := kbfsOpsConcurInit(t, "test_user")
	defer config.KBFSOps().(*KBFSOpsStandard).Shutdown()

	// create and write to a file
	kbfsOps := config.KBFSOps()
	h := NewDirHandle()
	uid, err := config.KBPKI().GetLoggedInUser()
	if err != nil {
		t.Errorf("Couldn't get logged in user: %v", err)
	}
	h.Writers = append(h.Writers, uid)
	rootPath, _, err := kbfsOps.GetOrCreateRootPathForHandle(h)
	if err != nil {
		t.Errorf("Couldn't create folder: %v", err)
	}
	filePath, _, err := kbfsOps.CreateFile(rootPath, "a", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	data := []byte{1}
	err = kbfsOps.Write(filePath, data, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	// now make an MDOps that will pause during Put()
	m := NewMDOpsConcurTest(uid)
	config.SetMDOps(m)

	// start the sync
	errChan := make(chan error)
	go func() {
		_, err := kbfsOps.Sync(filePath)
		errChan <- err
	}()

	// wait until Sync gets stuck at MDOps.Put()
	m.start <- struct{}{}

	// now make sure we can read the file and see the byte we wrote
	buf := make([]byte, 1, 1)
	nr, err := kbfsOps.Read(filePath, buf, 0)
	if err != nil {
		t.Errorf("Couldn't read data: %v\n", err)
	}
	if nr != 1 || !bytesEqual(data, buf) {
		t.Errorf("Got wrong data %v; expected %v", buf, data)
	}

	// now unblock Sync and make sure there was no error
	m.enter <- struct{}{}
	err = <-errChan
	if err != nil {
		t.Errorf("Sync got an error: %v", err)
	}
}
