// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/keybase/client/go/logger"
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
	syncedTlfs map[tlf.ID]bool
}

var _ syncedTlfGetterSetter = (*testSyncedTlfGetterSetter)(nil)

func newTestSyncedTlfGetterSetter() *testSyncedTlfGetterSetter {
	return &testSyncedTlfGetterSetter{
		syncedTlfs: make(map[tlf.ID]bool),
	}
}

func (t *testSyncedTlfGetterSetter) IsSyncedTlf(tlfID tlf.ID) bool {
	return t.syncedTlfs[tlfID]
}

func (t *testSyncedTlfGetterSetter) SetTlfSyncState(tlfID tlf.ID,
	isSynced bool) {
	t.syncedTlfs[tlfID] = isSynced
}
