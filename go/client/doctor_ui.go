package main

import (
	"errors"
	"strings"

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
	d.parent.Output("In order to run the doctor command, you need to login.\n\n")
	if len(currentUser) == 0 && len(otherUsers) == 0 {
		return "", errors.New("no users provided to LoginSelect")
	}
	if len(otherUsers) == 0 {
		d.parent.Printf("Logging in as %s.\n", ColorString("bold", currentUser))
		return currentUser, nil
	}

	d.parent.Printf("The last account you used on this device was %s.\n\n", ColorString("bold", currentUser))
	d.parent.Printf("Other accounts you have used: %s\n\n", strings.Join(otherUsers, ", "))
	allusers := append([]string{currentUser}, otherUsers...)
	selection, err := d.parent.Prompt("Which account would you like to check?", false, libkb.CheckMember{Set: allusers}.Checker())
	if err != nil {
		return "", err
	}
	d.parent.Printf("\nLogging in as %s.\n", ColorString("bold", selection))
	return selection, nil
}

func (d DoctorUI) DisplayStatus() error {
	d.parent.Output("\n\nhello from DisplayStatus\n\n")
	return nil
}

func (d DoctorUI) DisplayResult() error {
	return nil
}
