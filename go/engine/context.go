package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
)

type Context struct {
	DoctorUI    libkb.DoctorUI
	GPGUI       libkb.GPGUI
	LocksmithUI libkb.LocksmithUI
	LogUI       libkb.LogUI
	LoginUI     libkb.LoginUI
	SecretUI    libkb.SecretUI
	IdentifyUI  libkb.IdentifyUI
	ProveUI     libkb.ProveUI

	LoginContext libkb.LoginContext

	// For everything else global...
	GlobalContext *libkb.GlobalContext
}

func (c *Context) HasUI(kind libkb.UIKind) bool {
	switch kind {
	case libkb.DoctorUIKind:
		return c.DoctorUI != nil
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
	case libkb.ProveUIKind:
		return c.ProveUI != nil
	}
	panic(fmt.Sprintf("unhandled kind:  %d", kind))
}
