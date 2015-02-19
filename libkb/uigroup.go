package libkb

import "fmt"

type UIKind int

const (
	DoctorUIKind UIKind = iota
	GPGUIKind
	LogUIKind
	SecretUIKind
)

func (u UIKind) String() string {
	switch u {
	case DoctorUIKind:
		return "DoctorUI"
	case GPGUIKind:
		return "GPGUI"
	case LogUIKind:
		return "LogUI"
	case SecretUIKind:
		return "SecretUI"
	}
	panic(fmt.Sprintf("unhandled uikind: %d", u))
}

type UIGroup struct {
	Doctor DoctorUI
	Log    LogUI
	Secret SecretUI
	GPG    GPGUI
}

func NewUIGroup() *UIGroup {
	return &UIGroup{}
}

func (u *UIGroup) Exists(kind UIKind) bool {
	switch kind {
	case DoctorUIKind:
		return u.Doctor != nil
	case GPGUIKind:
		return u.GPG != nil
	case LogUIKind:
		return u.Log != nil
	case SecretUIKind:
		return u.Secret != nil
	}
	panic(fmt.Sprintf("unhandled kind:  %d", kind))
}

func (u *UIGroup) Add(ui interface{}) error {
	switch x := ui.(type) {
	case DoctorUI:
		u.Doctor = x
	case LogUI:
		u.Log = x
	case SecretUI:
		u.Secret = x
	case GPGUI:
		u.GPG = x
	default:
		return fmt.Errorf("unknown ui type %T", ui)
	}
	return nil
}
