package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
)

type Context struct {
	LocksmithUI libkb.LocksmithUI
	GPGUI       libkb.GPGUI
	LogUI       libkb.LogUI
	LoginUI     libkb.LoginUI
	SecretUI    libkb.SecretUI
	IdentifyUI  libkb.IdentifyUI

	// For everything else global...
	GlobalContext *libkb.GlobalContext
}

func (c *Context) HasUI(kind libkb.UIKind) bool {
	switch kind {
	case libkb.LocksmithUIKind:
		return c.LocksmithUI != nil
	case libkb.GPGUIKind:
		return c.GPGUI != nil
	case libkb.LogUIKind:
		return c.LogUI != nil
	case libkb.LoginUIKind:
		return c.LoginUI != nil
	case libkb.SecretUIKind:
		return c.SecretUI != nil
	case libkb.IdentifyUIKind:
		return c.IdentifyUI != nil
	}
	panic(fmt.Sprintf("unhandled kind:  %d", kind))
}
