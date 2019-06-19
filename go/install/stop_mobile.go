// +build ios android

package install

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func StopAllButService(mctx libkb.MetaContext, _ keybase1.ExitCode) {}
