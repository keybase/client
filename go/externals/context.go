// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
)

// ProofContext defines the context for proofs
type ProofContext interface {
	GetLog() logger.Logger
	GetAPI() libkb.API
	GetExternalAPI() libkb.ExternalAPI
	GetServerURI() string
}
