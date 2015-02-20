package libkb

import "fmt"

type UIKind int

const (
	DoctorUIKind UIKind = iota
	GPGUIKind
	KeyGenUIKind
	LogUIKind
	LoginUIKind
	SecretUIKind
)

func (u UIKind) String() string {
	switch u {
	case DoctorUIKind:
		return "DoctorUI"
	case GPGUIKind:
		return "GPGUI"
	case KeyGenUIKind:
		return "KeyGenUI"
	case LogUIKind:
		return "LogUI"
	case LoginUIKind:
		return "LoginUI"
	case SecretUIKind:
		return "SecretUI"
	}
	panic(fmt.Sprintf("unhandled uikind: %d", u))
}

type UIGroup struct {
	Doctor DoctorUI
	GPG    GPGUI
	KeyGen KeyGenUI
	Log    LogUI
	Login  LoginUI
	Secret SecretUI
}

func (u *UIGroup) Exists(kind UIKind) bool {
	switch kind {
	case DoctorUIKind:
		return u.Doctor != nil
	case GPGUIKind:
		return u.GPG != nil
	case KeyGenUIKind:
		return u.KeyGen != nil
	case LogUIKind:
		return u.Log != nil
	case LoginUIKind:
		return u.Login != nil
	case SecretUIKind:
		return u.Secret != nil
	}
	panic(fmt.Sprintf("unhandled kind:  %d", kind))
}

func (u *UIGroup) Add(ui interface{}) error {
	switch x := ui.(type) {
	case DoctorUI:
		u.Doctor = x
	case GPGUI:
		u.GPG = x
	case KeyGenUI:
		u.KeyGen = x
	case LogUI:
		u.Log = x
	case LoginUI:
		u.Login = x
	case SecretUI:
		u.Secret = x
	default:
		return fmt.Errorf("unknown ui type %T", ui)
	}
	return nil
}
