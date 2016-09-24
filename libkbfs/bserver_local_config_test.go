// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfscodec"
)

type testBlockServerLocalConfig struct {
	t      *testing.T
	codec  kbfscodec.Codec
	crypto cryptoPure
}

func newTestBlockServerLocalConfig(t *testing.T) testBlockServerLocalConfig {
	codec := kbfscodec.NewMsgpack()
	return testBlockServerLocalConfig{
		t:      t,
		codec:  codec,
		crypto: MakeCryptoCommon(codec),
	}
}

func (c testBlockServerLocalConfig) Codec() kbfscodec.Codec {
	return c.codec
}

func (c testBlockServerLocalConfig) cryptoPure() cryptoPure {
	return c.crypto
}

func (c testBlockServerLocalConfig) MakeLogger(module string) logger.Logger {
	return logger.NewTestLogger(c.t)
}
