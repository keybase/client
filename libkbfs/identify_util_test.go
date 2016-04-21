package libkbfs

import (
	"strings"
	"sync"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/stretchr/testify/require"

	"golang.org/x/net/context"
)

type testIdentifier struct {
	uidsLock sync.Mutex
	uids     map[keybase1.UID]bool
}

func (ti *testIdentifier) Identify(
	ctx context.Context, assertion, reason string) (UserInfo, error) {
	uid, err := keybase1.UIDFromString(strings.TrimPrefix(assertion, "user_"))
	if err != nil {
		return UserInfo{}, err
	}

	func() {
		ti.uidsLock.Lock()
		defer ti.uidsLock.Unlock()
		if ti.uids == nil {
			ti.uids = make(map[keybase1.UID]bool)
		}
		ti.uids[uid] = true
	}()

	return UserInfo{
		Name: libkb.NewNormalizedUsername(assertion),
		UID:  uid,
	}, nil
}

func TestIdentify(t *testing.T) {
	uids := map[keybase1.UID]bool{
		keybase1.MakeTestUID(1): true,
		keybase1.MakeTestUID(5): true,
		keybase1.MakeTestUID(7): true,
	}

	var nug testNormalizedUsernameGetter
	var ti testIdentifier
	uidList := make([]keybase1.UID, 0, len(uids))
	for uid := range uids {
		uidList = append(uidList, uid)
	}
	err := identifyUserList(context.Background(), nug, &ti, uidList, false)
	require.Nil(t, err)

	require.Equal(t, uids, ti.uids)
}
