// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfsmd"
)

// mdServerLocalConfig is the subset of the Config interface needed by
// the local MDServer implementations (for ease of testing).
type mdServerLocalConfig interface {
	Clock() Clock
	Codec() kbfscodec.Codec
	currentSessionGetter() CurrentSessionGetter
	MetadataVersion() kbfsmd.MetadataVer
	logMaker
	cryptoPureGetter
	teamMembershipChecker() kbfsmd.TeamMembershipChecker
}

// mdServerLocalConfigWrapper is an adapter for Config objects to the
// mdServerLocalConfig interface.
type mdServerLocalConfigAdapter struct {
	Config
}

func (ca mdServerLocalConfigAdapter) currentSessionGetter() CurrentSessionGetter {
	return ca.Config.KBPKI()
}

func (ca mdServerLocalConfigAdapter) teamMembershipChecker() kbfsmd.TeamMembershipChecker {
	return ca.Config.KBPKI()
}
