package main

import (
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// doctor ui rpc protocol
func NewDoctorUIProtocol() rpc2.Protocol {
	return keybase_1.DoctorUiProtocol(&DoctorUIServer{G_UI.GetDoctorUI()})
}

// doctor ui server...translates keybase_1 protocol interface into
// libkb interface
type DoctorUIServer struct {
	ui libkb.DoctorUI
}

func (d *DoctorUIServer) LoginSelect(arg keybase_1.LoginSelectArg) (string, error) {
	return d.ui.LoginSelect(arg.CurrentUser, arg.OtherUsers)
}

func (d *DoctorUIServer) DisplayStatus(int) error {
	return d.ui.DisplayStatus()
}

func (d *DoctorUIServer) DisplayResult(int) error {
	return d.ui.DisplayResult()
}

// the actual ui
type DoctorUI struct {
	parent *UI
}

func (d DoctorUI) LoginSelect(currentUser string, otherUsers []string) (string, error) {
	return "", nil
}

func (d DoctorUI) DisplayStatus() error {
	d.parent.Output("\n\nhello from DisplayStatus\n\n")
	return nil
}

func (d DoctorUI) DisplayResult() error {
	return nil
}
