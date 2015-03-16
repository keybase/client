package libkb

import "fmt"

type UIKind int

const (
	DoctorUIKind UIKind = iota
	GPGUIKind
	LogUIKind
	LoginUIKind
	SecretUIKind
	IdentifyUIKind
)

func (u UIKind) String() string {
	switch u {
	case DoctorUIKind:
		return "DoctorUI"
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
