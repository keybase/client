package engine

import (
	"fmt"

	"github.com/keybase/go/libkb"
)

type Context struct {
	DoctorUI libkb.DoctorUI
	GPGUI    libkb.GPGUI
	LogUI    libkb.LogUI
	LoginUI  libkb.LoginUI
	SecretUI libkb.SecretUI
}

func (c *Context) HasUI(kind libkb.UIKind) bool {
	switch kind {
	case libkb.DoctorUIKind:
		return c.DoctorUI != nil
	case libkb.GPGUIKind:
		return c.GPGUI != nil
	case libkb.LogUIKind:
		return c.LogUI != nil
	case libkb.LoginUIKind:
		return c.LoginUI != nil
	case libkb.SecretUIKind:
		return c.SecretUI != nil
	}
	panic(fmt.Sprintf("unhandled kind:  %d", kind))
}
