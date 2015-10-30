package libkb

import "fmt"

type UIKind int

const (
	GPGUIKind UIKind = iota
	IdentifyUIKind
	LogUIKind
	LoginUIKind
	ProveUIKind
	SecretUIKind
	ProvisionUIKind
)

func (u UIKind) String() string {
	switch u {
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
	case ProvisionUIKind:
		return "ProvisionUI"
	}
	panic(fmt.Sprintf("unhandled uikind: %d", u))
}
