// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"golang.org/x/net/context"
)

type singleCurrentSessionGetter struct {
	session SessionInfo
}

func (csg singleCurrentSessionGetter) GetCurrentSession(ctx context.Context) (
	SessionInfo, error) {
	return csg.session, nil
}

type testMDServerLocalConfig struct {
	codecGetter
	logMaker
	clock  Clock
	crypto cryptoPure
	csg    CurrentSessionGetter
}

func newTestMDServerLocalConfig(
	t *testing.T, csg CurrentSessionGetter) testMDServerLocalConfig {
	cg := newTestCodecGetter()
	return testMDServerLocalConfig{
		codecGetter: cg,
		logMaker:    newTestLogMaker(t),
		clock:       newTestClockNow(),
		crypto:      MakeCryptoCommon(cg.Codec()),
		csg:         csg,
	}
}

func (c testMDServerLocalConfig) Clock() Clock {
	return c.clock
}

func (c testMDServerLocalConfig) cryptoPure() cryptoPure {
	return c.crypto
}

func (c testMDServerLocalConfig) currentSessionGetter() CurrentSessionGetter {
	return c.csg
}

func (c testMDServerLocalConfig) MetadataVersion() MetadataVer {
	return defaultClientMetadataVer
}

func (c testMDServerLocalConfig) teamMembershipChecker() TeamMembershipChecker {
	// TODO: support team TLFs in the test mdserver.
	return nil
}
