package libkbfs

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
)

type MDOpsConcurTest struct {
	uid   libkb.UID
	start chan struct{}
}

func NewMDOpsConcurTest(uid libkb.UID) *MDOpsConcurTest {
	return &MDOpsConcurTest{uid: uid, start: make(chan struct{})}
}

func (m *MDOpsConcurTest) GetAtHandle(handle *DirHandle) (
	*RootMetadata, error) {
	return nil, fmt.Errorf("Not supported")
}

func (m *MDOpsConcurTest) Get(id DirId) (*RootMetadata, error) {
	_, ok := <-m.start
	if !ok {
		// Only one caller should ever get here
		return nil, fmt.Errorf("More than one caller to Get()!")
	}
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

	n := 2
	c := make(chan error, n)
	for i := 0; i < n; i++ {
		go func() {
			_, err := config.KBFSOps().GetRootMD(DirId{0})
			c <- err
		}()
	}
	// wait until at least the first one started
	m.start <- struct{}{}
	close(m.start)
	for i := 0; i < n; i++ {
		err := <-c
		if err != nil {
			t.Errorf("Got an error doing concurrent MD gets: err=(%s)", err)
		}
	}
}
