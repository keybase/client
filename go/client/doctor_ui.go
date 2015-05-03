package client

import (
	"errors"
	"fmt"
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

func (d *DoctorUIServer) DisplayStatus(arg keybase_1.DisplayStatusArg) (bool, error) {
	return d.ui.DisplayStatus(arg.Status)
}

func (d *DoctorUIServer) DisplayResult(arg keybase_1.DisplayResultArg) error {
	return d.ui.DisplayResult(arg.Message)
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

func (d DoctorUI) DisplayStatus(status keybase_1.DoctorStatus) (bool, error) {
	if status.WebDevice != nil || len(status.Devices) > 0 {
		d.parent.Output("All devices:\n")
		if status.WebDevice != nil {
			d.parent.Printf("web device:\t\t[%s]\n", status.WebDevice.DeviceID)
		}
		for _, dev := range status.Devices {
			d.parent.Printf("%s\t%s\t[%s]\n", dev.Name, dev.Type, dev.DeviceID)
		}
	}
	if status.CurrentDevice != nil {
		d.parent.Printf("current device: %s\t%s\t[%s]\n", status.CurrentDevice.Name, status.CurrentDevice.Type, status.CurrentDevice.DeviceID)
	}

	if status.Fix == keybase_1.DoctorFixType_NONE {
		d.parent.Output("\nNo fix necessary.  This account looks fine.\n\n")
		return true, nil
	}
	if status.Fix == keybase_1.DoctorFixType_ADD_ELDEST_DEVICE {
		d.parent.Output("\nThere are no devices associated with this user.\n")
		d.parent.Output("If you proceed, we'll add this device to your account.\n")
	} else if status.Fix == keybase_1.DoctorFixType_ADD_SIBLING_DEVICE {
		d.parent.Output("\nWe need to add this device to your account.\n")
	} else {
		return false, fmt.Errorf("unhandled DoctorFixType: %v", status.Fix)
	}

	if !status.SignerOpts.Internal {
		var signout string
		if status.SignerOpts.OtherDevice {
			signout = "You can authorize this device with an existing device"
			if status.SignerOpts.Pgp {
				signout += " or a PGP key."
			} else {
				signout += "."
			}
		} else if status.SignerOpts.Pgp {
			signout = "You can authorize this device with a PGP key."
		} else {
			return false, fmt.Errorf("no signers available")
		}
		d.parent.Output(signout + "\n")
	}

	return d.parent.PromptYesNo("Proceed?", PromptDefaultYes)
}

func (d DoctorUI) DisplayResult(msg string) error {
	d.parent.Output(msg + "\n")
	return nil
}
