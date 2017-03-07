// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfscodec"
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
	log    logger.Logger
	clock  Clock
	codec  kbfscodec.Codec
	crypto cryptoPure
	csg    currentSessionGetter
}

func newTestMDServerLocalConfig(
	log logger.Logger, csg currentSessionGetter) testMDServerLocalConfig {
	codec := kbfscodec.NewMsgpack()
	return testMDServerLocalConfig{
		log:    log,
		clock:  newTestClockNow(),
		codec:  codec,
		crypto: MakeCryptoCommon(codec),
		csg:    csg,
	}
}

func (c testMDServerLocalConfig) Clock() Clock {
	return c.clock
}

func (c testMDServerLocalConfig) Codec() kbfscodec.Codec {
	return c.codec
}

func (c testMDServerLocalConfig) cryptoPure() cryptoPure {
	return c.crypto
}

func (c testMDServerLocalConfig) currentSessionGetter() currentSessionGetter {
	return c.csg
}

func (c testMDServerLocalConfig) MetadataVersion() MetadataVer {
	return defaultClientMetadataVer
}

func (c testMDServerLocalConfig) MakeLogger(module string) logger.Logger {
	return c.log
}
