// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"

	"golang.org/x/net/context"
)

type testNormalizedUsernameGetter map[keybase1.UID]libkb.NormalizedUsername

func (g testNormalizedUsernameGetter) GetNormalizedUsername(
	ctx context.Context, uid keybase1.UID) (
	libkb.NormalizedUsername, error) {
	name, ok := g[uid]
	if !ok {
		return libkb.NormalizedUsername(""),
			NoSuchUserError{fmt.Sprintf("uid:%s", uid)}
	}
	return name, nil
}

type testIdentifier struct {
	assertions         map[string]UserInfo
	identifiedUidsLock sync.Mutex
	identifiedUids     map[keybase1.UID]bool
}

func (ti *testIdentifier) Identify(
	ctx context.Context, assertion, reason string) (UserInfo, error) {
	userInfo, ok := ti.assertions[assertion]
	if !ok {
		return UserInfo{}, NoSuchUserError{assertion}
	}

	func() {
		ti.identifiedUidsLock.Lock()
		defer ti.identifiedUidsLock.Unlock()
		if ti.identifiedUids == nil {
			ti.identifiedUids = make(map[keybase1.UID]bool)
		}
		ti.identifiedUids[userInfo.UID] = true
	}()

	return userInfo, nil
}

func TestIdentify(t *testing.T) {
	nug := testNormalizedUsernameGetter{
		keybase1.MakeTestUID(1): "alice",
		keybase1.MakeTestUID(2): "bob",
		keybase1.MakeTestUID(3): "charlie",
	}

	ti := &testIdentifier{
		assertions: map[string]UserInfo{
			"alice": {
				Name: "alice",
				UID:  keybase1.MakeTestUID(1),
			},
			"bob": {
				Name: "bob",
				UID:  keybase1.MakeTestUID(2),
			},
			"charlie": {
				Name: "charlie",
				UID:  keybase1.MakeTestUID(3),
			},
		},
	}

	uids := make(map[keybase1.UID]bool, len(nug))
	uidList := make([]keybase1.UID, 0, len(nug))
	for u := range nug {
		uids[u] = true
		uidList = append(uidList, u)
	}

	err := identifyUserList(context.Background(), nug, ti, uidList, false)
	require.NoError(t, err)
	require.Equal(t, uids, ti.identifiedUids)
}
