// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"golang.org/x/net/context"
)

// daemonKBPKI is a hacky way to make a KBPKI instance that uses some
// methods from KeybaseService.
type daemonKBPKI struct {
	KBPKI
	daemon KeybaseService
}

func (d *daemonKBPKI) GetCurrentSession(ctx context.Context) (
	SessionInfo, error) {
	const sessionID = 0
	return d.daemon.CurrentSession(ctx, sessionID)
}

func (d *daemonKBPKI) Resolve(ctx context.Context, assertion string) (
	libkb.NormalizedUsername, keybase1.UserOrTeamID, error) {
	return d.daemon.Resolve(ctx, assertion)
}

func (d *daemonKBPKI) Identify(ctx context.Context, assertion, reason string) (
	libkb.NormalizedUsername, keybase1.UserOrTeamID, error) {
	return d.daemon.Identify(ctx, assertion, reason)
}

func (d *daemonKBPKI) GetNormalizedUsername(
	ctx context.Context, id keybase1.UserOrTeamID) (
	libkb.NormalizedUsername, error) {
	asUser, err := id.AsUser()
	if err != nil {
		return libkb.NormalizedUsername(""), err
	}
	userInfo, err := d.daemon.LoadUserPlusKeys(ctx, asUser, "")
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
		kbfscodec.NewMsgpack())
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

func (ik *identifyCountingKBPKI) Identify(
	ctx context.Context, assertion, reason string) (
	libkb.NormalizedUsername, keybase1.UserOrTeamID, error) {
	ik.addIdentifyCall()
	return ik.KBPKI.Identify(ctx, assertion, reason)
}
