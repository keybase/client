package libkb

import "fmt"

type UIName string

const (
	LogUIName UIName = "logui"
)

type UIGroup struct {
	Doctor DoctorUI
	Log    LogUI
	Secret SecretUI
}

func NewUIGroup() *UIGroup {
	return &UIGroup{}
}

func (u *UIGroup) Exists(name UIName) bool {
	switch name {
	case LogUIName:
		return u.Log != nil
	}
	panic("unhandled name:  " + name)
}

func (u *UIGroup) Add(ui interface{}) error {
	switch x := ui.(type) {
	case DoctorUI:
		u.Doctor = x
	case LogUI:
		u.Log = x
	case SecretUI:
		u.Secret = x
	default:
		return fmt.Errorf("unknown ui type %T", ui)
	}
	return nil
}
