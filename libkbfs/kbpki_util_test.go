// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// daemonKBPKI is a hacky way to make a KBPKI instance that uses some
// methods from KeybaseService.
type daemonKBPKI struct {
	KBPKI
	daemon KeybaseService
}

func (d *daemonKBPKI) GetCurrentUserInfo(ctx context.Context) (
	libkb.NormalizedUsername, keybase1.UID, error) {
	const sessionID = 0
	session, err := d.daemon.CurrentSession(ctx, sessionID)
	if err != nil {
		return libkb.NormalizedUsername(""), keybase1.UID(""), err
	}
	return session.Name, session.UID, nil
}

func (d *daemonKBPKI) Resolve(ctx context.Context, assertion string) (
	libkb.NormalizedUsername, keybase1.UID, error) {
	return d.daemon.Resolve(ctx, assertion)
}

func (d *daemonKBPKI) Identify(ctx context.Context, assertion, reason string) (UserInfo, error) {
	return d.daemon.Identify(ctx, assertion, reason)
}

func (d *daemonKBPKI) GetNormalizedUsername(ctx context.Context, uid keybase1.UID) (libkb.NormalizedUsername, error) {
	userInfo, err := d.daemon.LoadUserPlusKeys(ctx, uid)
	if err != nil {
		return libkb.NormalizedUsername(""), err
	}
	return userInfo.Name, nil
}

// interposeDaemonKBPKI replaces the existing (mock) KBPKI with a
// daemonKBPKI that handles all the username-related calls.
//
// TODO: Make tests that use this just use KBPKIClient; need to figure
// out what to do with other mocked methods of KBPKI.
func interposeDaemonKBPKI(
	config *ConfigMock, users ...libkb.NormalizedUsername) {
	localUsers := MakeLocalUsers(users)
	loggedInUser := localUsers[0]

	daemon := NewKeybaseDaemonMemory(loggedInUser.UID, localUsers,
		NewCodecMsgpack())
	config.SetKeybaseService(daemon)

	daemonKBPKI := &daemonKBPKI{
		KBPKI:  config.mockKbpki,
		daemon: daemon,
	}
	config.SetKBPKI(daemonKBPKI)
}

// identifyCountingKBPKI is a KBPKI instance that counts calls to
// Identify.
type identifyCountingKBPKI struct {
	KBPKI
	identifyLock  sync.RWMutex
	identifyCalls int
}

func (ik *identifyCountingKBPKI) addIdentifyCall() {
	ik.identifyLock.Lock()
	defer ik.identifyLock.Unlock()
	ik.identifyCalls++
}

func (ik *identifyCountingKBPKI) getIdentifyCalls() int {
	ik.identifyLock.RLock()
	defer ik.identifyLock.RUnlock()
	return ik.identifyCalls
}

func (ik *identifyCountingKBPKI) Identify(ctx context.Context, assertion, reason string) (UserInfo, error) {
	ik.addIdentifyCall()
	return ik.KBPKI.Identify(ctx, assertion, reason)
}
