// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/test/clocktest"
	"golang.org/x/net/context"
)

type singleCurrentSessionGetter struct {
	session idutil.SessionInfo
}

func (csg singleCurrentSessionGetter) GetCurrentSession(ctx context.Context) (
	idutil.SessionInfo, error) {
	return csg.session, nil
}

type testMDServerLocalConfig struct {
	codecGetter
	logMaker
	clock  Clock
	crypto cryptoPure
	csg    idutil.CurrentSessionGetter
}

func newTestMDServerLocalConfig(
	t *testing.T, csg idutil.CurrentSessionGetter) testMDServerLocalConfig {
	cg := newTestCodecGetter()
	return testMDServerLocalConfig{
		codecGetter: cg,
		logMaker:    newTestLogMaker(t),
		clock:       clocktest.NewTestClockNow(),
		crypto:      MakeCryptoCommon(cg.Codec(), makeBlockCryptV1()),
		csg:         csg,
	}
}

func (c testMDServerLocalConfig) Clock() Clock {
	return c.clock
}

func (c testMDServerLocalConfig) cryptoPure() cryptoPure {
	return c.crypto
}

func (c testMDServerLocalConfig) currentSessionGetter() idutil.CurrentSessionGetter {
	return c.csg
}

func (c testMDServerLocalConfig) MetadataVersion() kbfsmd.MetadataVer {
	return defaultClientMetadataVer
}

func (c testMDServerLocalConfig) teamMembershipChecker() kbfsmd.TeamMembershipChecker {
	// TODO: support team TLFs in the test mdserver.
	return nil
}
