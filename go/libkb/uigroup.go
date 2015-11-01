// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

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
	ProvisionUIKind
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
	case ProvisionUIKind:
		return "ProvisionUI"
	}
	panic(fmt.Sprintf("unhandled uikind: %d", u))
}
