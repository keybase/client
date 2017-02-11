// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfscodec"
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
