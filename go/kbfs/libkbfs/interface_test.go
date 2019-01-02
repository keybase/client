// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/tlf"
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
	log logger.Logger
}

func newTestLogMaker(t *testing.T) testLogMaker {
	return testLogMaker{logger.NewTestLogger(t)}
}

func (lm testLogMaker) MakeLogger(_ string) logger.Logger {
	return lm.log
}

type testClockGetter struct {
	clock *TestClock
}

var _ clockGetter = (*testClockGetter)(nil)

func newTestClockGetter() *testClockGetter {
	return &testClockGetter{newTestClockNow()}
}

func (cg *testClockGetter) Clock() Clock {
	return cg.clock
}

func (cg *testClockGetter) TestClock() *TestClock {
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

func (t *testSyncedTlfGetterSetter) SetTlfSyncState(tlfID tlf.ID,
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
