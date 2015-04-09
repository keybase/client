package libkb

import "fmt"

type UIKind int

const (
	LocksmithUIKind UIKind = iota
	GPGUIKind
	LogUIKind
	LoginUIKind
	SecretUIKind
	IdentifyUIKind
)

func (u UIKind) String() string {
	switch u {
	case LocksmithUIKind:
		return "LocksmithUI"
	case GPGUIKind:
		return "GPGUI"
	case LogUIKind:
		return "LogUI"
	case LoginUIKind:
		return "LoginUI"
	case SecretUIKind:
		return "SecretUI"
	case IdentifyUIKind:
		return "IdentifyUI"
	}
	panic(fmt.Sprintf("unhandled uikind: %d", u))
}
