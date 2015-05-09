package libkb

import "fmt"

type UIKind int

const (
	DoctorUIKind UIKind = iota
	GPGUIKind
	IdentifyUIKind
	LocksmithUIKind
	LogUIKind
	LoginUIKind
	ProveUIKind
	SecretUIKind
)

func (u UIKind) String() string {
	switch u {
	case DoctorUIKind:
		return "DoctorUI"
	case LocksmithUIKind:
		return "LocksmithUI"
	case GPGUIKind:
		return "GPGUI"
	case IdentifyUIKind:
		return "IdentifyUI"
	case LogUIKind:
		return "LogUI"
	case LoginUIKind:
		return "LoginUI"
	case ProveUIKind:
		return "ProveUI"
	case SecretUIKind:
		return "SecretUI"
	}
	panic(fmt.Sprintf("unhandled uikind: %d", u))
}
