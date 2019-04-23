// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"testing"

	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/test/clocktest"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
)

type testCodecGetter struct {
	codec kbfscodec.Codec
}

func newTestCodecGetter() testCodecGetter {
	return testCodecGetter{kbfscodec.NewMsgpack()}
}

func (cg testCodecGetter) Codec() kbfscodec.Codec {
	return cg.codec
}

type testLogMaker struct {
	log           logger.Logger
	vdebugSetting string
}

func newTestLogMakerWithVDebug(
	t *testing.T, vdebugSetting string) testLogMaker {
	return testLogMaker{logger.NewTestLogger(t), vdebugSetting}
}

func newTestLogMaker(t *testing.T) testLogMaker {
	return newTestLogMakerWithVDebug(t, "")
}

func (lm testLogMaker) MakeLogger(_ string) logger.Logger {
	return lm.log
}

func (lm testLogMaker) MakeVLogger(log logger.Logger) *libkb.VDebugLog {
	vlog := libkb.NewVDebugLog(log)
	vlog.Configure(lm.vdebugSetting)
	return vlog
}

type testClockGetter struct {
	clock *clocktest.TestClock
}

var _ clockGetter = (*testClockGetter)(nil)

func newTestClockGetter() *testClockGetter {
	return &testClockGetter{clocktest.NewTestClockNow()}
}

func (cg *testClockGetter) Clock() Clock {
	return cg.clock
}

func (cg *testClockGetter) TestClock() *clocktest.TestClock {
	return cg.clock
}

type testSyncedTlfGetterSetter struct {
	syncedTlfs map[tlf.ID]FolderSyncConfig
}

var _ syncedTlfGetterSetter = (*testSyncedTlfGetterSetter)(nil)

func newTestSyncedTlfGetterSetter() *testSyncedTlfGetterSetter {
	return &testSyncedTlfGetterSetter{
		syncedTlfs: make(map[tlf.ID]FolderSyncConfig),
	}
}

func (t *testSyncedTlfGetterSetter) GetTlfSyncState(
	tlfID tlf.ID) FolderSyncConfig {
	return t.syncedTlfs[tlfID]
}

func (t *testSyncedTlfGetterSetter) IsSyncedTlf(tlfID tlf.ID) bool {
	return t.syncedTlfs[tlfID].Mode == keybase1.FolderSyncMode_ENABLED
}

func (t *testSyncedTlfGetterSetter) IsSyncedTlfPath(tlfPath string) bool {
	for _, config := range t.syncedTlfs {
		if config.TlfPath == tlfPath {
			return true
		}
	}
	return false
}

func (t *testSyncedTlfGetterSetter) SetTlfSyncState(
	_ context.Context, tlfID tlf.ID,
	config FolderSyncConfig) (<-chan error, error) {
	t.syncedTlfs[tlfID] = config
	return nil, nil
}

func (t *testSyncedTlfGetterSetter) GetAllSyncedTlfs() []tlf.ID {
	tlfs := make([]tlf.ID, 0, len(t.syncedTlfs))
	for tlf := range t.syncedTlfs {
		tlfs = append(tlfs, tlf)
	}
	return tlfs
}

func (t *testSyncedTlfGetterSetter) OfflineAvailabilityForPath(
	tlfPath string) keybase1.OfflineAvailability {
	if t.IsSyncedTlfPath(tlfPath) {
		return keybase1.OfflineAvailability_BEST_EFFORT
	}
	return keybase1.OfflineAvailability_NONE
}

func (t *testSyncedTlfGetterSetter) OfflineAvailabilityForID(
	tlfID tlf.ID) keybase1.OfflineAvailability {
	if t.IsSyncedTlf(tlfID) {
		return keybase1.OfflineAvailability_BEST_EFFORT
	}
	return keybase1.OfflineAvailability_NONE
}

type testInitModeGetter struct {
	mode InitModeType
}

var _ initModeGetter = (*testInitModeGetter)(nil)

func (t testInitModeGetter) Mode() InitMode {
	return modeTest{NewInitModeFromType(t.mode)}
}

func (t testInitModeGetter) IsTestMode() bool {
	return true
}
