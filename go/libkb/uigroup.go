package libkb

import "fmt"

type UIKind int

const (
	DoctorUIKind UIKind = iota
	GPGUIKind
	LogUIKind
	LoginUIKind
	SecretUIKind
	TrackUIKind
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
	case TrackUIKind:
		return "TrackUI"
	}
	panic(fmt.Sprintf("unhandled uikind: %d", u))
}
