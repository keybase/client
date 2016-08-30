// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import "github.com/keybase/client/go/logger"

// mdServerLocalConfig is the subset of the Config interface needed by
// the local MDServer implementations (for ease of testing).
type mdServerLocalConfig interface {
	Clock() Clock
	Codec() Codec
	cryptoPure() cryptoPure
	currentInfoGetter() currentInfoGetter
	MetadataVersion() MetadataVer
	MakeLogger(module string) logger.Logger
}

// mdServerLocalConfigWrapper is an adapter for Config objects to the
// mdServerLocalConfig interface.
type mdServerLocalConfigAdapter struct {
	Config
}

func (ca mdServerLocalConfigAdapter) cryptoPure() cryptoPure {
	return ca.Config.Crypto()
}

func (ca mdServerLocalConfigAdapter) currentInfoGetter() currentInfoGetter {
	return ca.Config.KBPKI()
}
