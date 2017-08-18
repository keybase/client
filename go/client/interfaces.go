// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import "github.com/keybase/client/go/protocol/keybase1"

type Canceler interface {
	Cancel() error
}

type Stopper interface {
	Stop(exitcode keybase1.ExitCode)
}
