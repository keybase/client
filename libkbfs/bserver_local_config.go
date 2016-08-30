// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import "github.com/keybase/client/go/logger"

// blockServerLocalConfig is the subset of the Config interface needed
// by the local BlockServer implementations (for ease of testing).
type blockServerLocalConfig interface {
	Codec() Codec
	cryptoPure() cryptoPure
	MakeLogger(module string) logger.Logger
}

// blockServerLocalConfigWrapper is an adapter for Config objects to the
// blockServerLocalConfig interface.
type blockServerLocalConfigAdapter struct {
	Config
}

func (ca blockServerLocalConfigAdapter) cryptoPure() cryptoPure {
	return ca.Config.Crypto()
}
