// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/provision_ui.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type ProvisionMethod int

const (
	ProvisionMethod_DEVICE     ProvisionMethod = 0
	ProvisionMethod_PAPER_KEY  ProvisionMethod = 1
	ProvisionMethod_PASSPHRASE ProvisionMethod = 2
	ProvisionMethod_GPG_IMPORT ProvisionMethod = 3
	ProvisionMethod_GPG_SIGN   ProvisionMethod = 4
)

func (o ProvisionMethod) DeepCopy() ProvisionMethod { return o }

var ProvisionMethodMap = map[string]ProvisionMethod{
	"DEVICE":     0,
	"PAPER_KEY":  1,
	"PASSPHRASE": 2,
	"GPG_IMPORT": 3,
	"GPG_SIGN":   4,
}

var ProvisionMethodRevMap = map[ProvisionMethod]string{
	0: "DEVICE",
	1: "PAPER_KEY",
	2: "PASSPHRASE",
	3: "GPG_IMPORT",
	4: "GPG_SIGN",
}

func (e ProvisionMethod) String() string {
	if v, ok := ProvisionMethodRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type GPGMethod int

const (
	GPGMethod_GPG_NONE   GPGMethod = 0
	GPGMethod_GPG_IMPORT GPGMethod = 1
	GPGMethod_GPG_SIGN   GPGMethod = 2
)

func (o GPGMethod) DeepCopy() GPGMethod { return o }

var GPGMethodMap = map[string]GPGMethod{
	"GPG_NONE":   0,
	"GPG_IMPORT": 1,
	"GPG_SIGN":   2,
}

var GPGMethodRevMap = map[GPGMethod]string{
	0: "GPG_NONE",
	1: "GPG_IMPORT",
	2: "GPG_SIGN",
}

func (e GPGMethod) String() string {
	if v, ok := GPGMethodRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ChooseType int

const (
	ChooseType_EXISTING_DEVICE ChooseType = 0
	ChooseType_NEW_DEVICE      ChooseType = 1
)

func (o ChooseType) DeepCopy() ChooseType { return o }

var ChooseTypeMap = map[string]ChooseType{
	"EXISTING_DEVICE": 0,
	"NEW_DEVICE":      1,
}

var ChooseTypeRevMap = map[ChooseType]string{
	0: "EXISTING_DEVICE",
	1: "NEW_DEVICE",
}

func (e ChooseType) String() string {
	if v, ok := ChooseTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

// SecretResponse should be returned by DisplayAndPromptSecret.  Use either secret or phrase.
type SecretResponse struct {
	Secret []byte `codec:"secret" json:"secret"`
	Phrase string `codec:"phrase" json:"phrase"`
}

func (o SecretResponse) DeepCopy() SecretResponse {
	return SecretResponse{
		Secret: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Secret),
		Phrase: o.Phrase,
	}
}

type ChooseProvisioningMethodArg struct {
	SessionID int  `codec:"sessionID" json:"sessionID"`
	GpgOption bool `codec:"gpgOption" json:"gpgOption"`
}

type ChooseGPGMethodArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Keys      []GPGKey `codec:"keys" json:"keys"`
}

type SwitchToGPGSignOKArg struct {
	SessionID   int    `codec:"sessionID" json:"sessionID"`
	Key         GPGKey `codec:"key" json:"key"`
	ImportError string `codec:"importError" json:"importError"`
}

type ChooseDeviceArg struct {
	SessionID         int      `codec:"sessionID" json:"sessionID"`
	Devices           []Device `codec:"devices" json:"devices"`
	CanSelectNoDevice bool     `codec:"canSelectNoDevice" json:"canSelectNoDevice"`
}

type ChooseDeviceTypeArg struct {
	SessionID int        `codec:"sessionID" json:"sessionID"`
	Kind      ChooseType `codec:"kind" json:"kind"`
}

type DisplayAndPromptSecretArg struct {
	SessionID       int        `codec:"sessionID" json:"sessionID"`
	Secret          []byte     `codec:"secret" json:"secret"`
	Phrase          string     `codec:"phrase" json:"phrase"`
	OtherDeviceType DeviceType `codec:"otherDeviceType" json:"otherDeviceType"`
	PreviousErr     string     `codec:"previousErr" json:"previousErr"`
}

type DisplaySecretExchangedArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type PromptNewDeviceNameArg struct {
	SessionID       int      `codec:"sessionID" json:"sessionID"`
	ExistingDevices []string `codec:"existingDevices" json:"existingDevices"`
	ErrorMessage    string   `codec:"errorMessage" json:"errorMessage"`
}

type ProvisioneeSuccessArg struct {
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	Username   string `codec:"username" json:"username"`
	DeviceName string `codec:"deviceName" json:"deviceName"`
}

type ProvisionerSuccessArg struct {
	SessionID  int          `codec:"sessionID" json:"sessionID"`
	DeviceName string       `codec:"deviceName" json:"deviceName"`
	DeviceType DeviceTypeV2 `codec:"deviceType" json:"deviceType"`
}

type ProvisionUiInterface interface {
	// DEPRECATED:
	// Called during device provisioning for the user to select a
	// method for provisioning.  gpgOption will be true if GPG
	// should be offered as an option.
	ChooseProvisioningMethod(context.Context, ChooseProvisioningMethodArg) (ProvisionMethod, error)
	// Called during device provisioning for the user to select a
	// GPG method, either import the key into keybase's local keyring
	// or use GPG to sign a provisioning statement.
	//
	// The keys are provided for display purposes, so the UI can
	// do something like "We found the following GPG keys on this
	// machine.  How would you like to use one of them to provision
	// this device?"
	//
	// After this, gpg_ui.selectKey will be called (if there are
	// multiple keys available).
	ChooseGPGMethod(context.Context, ChooseGPGMethodArg) (GPGMethod, error)
	// If there was an error importing a gpg key into the local
	// keyring, tell the user and offer to switch to GPG signing
	// with this key.  Return true to switch to GPG signing,
	// false to abort provisioning.
	SwitchToGPGSignOK(context.Context, SwitchToGPGSignOKArg) (bool, error)
	ChooseDevice(context.Context, ChooseDeviceArg) (DeviceID, error)
	// If provisioning via device, this will be called so user can select the provisioner/provisionee device type: desktop or mobile.
	// If selecting the existing device type, set kind to EXISTING_DEVICE_0.
	// If selecting the new device type, set kind to NEW_DEVICE_1.
	ChooseDeviceType(context.Context, ChooseDeviceTypeArg) (DeviceType, error)
	// DisplayAndPromptSecret displays a secret that the user can enter into the other device.
	// It also can return a secret that the user enters into this device (from the other device).
	// If it does not return a secret, it will be canceled when this device receives the secret via kex2.
	// If there is an error in the phrase, then previousErr will be set when this is called again.
	DisplayAndPromptSecret(context.Context, DisplayAndPromptSecretArg) (SecretResponse, error)
	// DisplaySecretExchanged is called when the kex2 secret has successfully been exchanged by the two
	// devices.
	DisplaySecretExchanged(context.Context, int) error
	// PromptNewDeviceName is called when the device provisioning process needs a name for the new device.
	// To help the clients not send a duplicate name, existingDevices is populated with the current device
	// names for the user.  If the device name returned to the service is invalid or already
	// taken, it will call this again with an error message in errorMessage.
	PromptNewDeviceName(context.Context, PromptNewDeviceNameArg) (string, error)
	// ProvisioneeSuccess is called on provisionee when it is successfully provisioned.
	ProvisioneeSuccess(context.Context, ProvisioneeSuccessArg) error
	// ProvisionerSuccess is called on provisioner when it successfully provisions another device.
	ProvisionerSuccess(context.Context, ProvisionerSuccessArg) error
}

func ProvisionUiProtocol(i ProvisionUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.provisionUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"chooseProvisioningMethod": {
				MakeArg: func() interface{} {
					var ret [1]ChooseProvisioningMethodArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ChooseProvisioningMethodArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ChooseProvisioningMethodArg)(nil), args)
						return
					}
					ret, err = i.ChooseProvisioningMethod(ctx, typedArgs[0])
					return
				},
			},
			"chooseGPGMethod": {
				MakeArg: func() interface{} {
					var ret [1]ChooseGPGMethodArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ChooseGPGMethodArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ChooseGPGMethodArg)(nil), args)
						return
					}
					ret, err = i.ChooseGPGMethod(ctx, typedArgs[0])
					return
				},
			},
			"switchToGPGSignOK": {
				MakeArg: func() interface{} {
					var ret [1]SwitchToGPGSignOKArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SwitchToGPGSignOKArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SwitchToGPGSignOKArg)(nil), args)
						return
					}
					ret, err = i.SwitchToGPGSignOK(ctx, typedArgs[0])
					return
				},
			},
			"chooseDevice": {
				MakeArg: func() interface{} {
					var ret [1]ChooseDeviceArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ChooseDeviceArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ChooseDeviceArg)(nil), args)
						return
					}
					ret, err = i.ChooseDevice(ctx, typedArgs[0])
					return
				},
			},
			"chooseDeviceType": {
				MakeArg: func() interface{} {
					var ret [1]ChooseDeviceTypeArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ChooseDeviceTypeArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ChooseDeviceTypeArg)(nil), args)
						return
					}
					ret, err = i.ChooseDeviceType(ctx, typedArgs[0])
					return
				},
			},
			"DisplayAndPromptSecret": {
				MakeArg: func() interface{} {
					var ret [1]DisplayAndPromptSecretArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DisplayAndPromptSecretArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DisplayAndPromptSecretArg)(nil), args)
						return
					}
					ret, err = i.DisplayAndPromptSecret(ctx, typedArgs[0])
					return
				},
			},
			"DisplaySecretExchanged": {
				MakeArg: func() interface{} {
					var ret [1]DisplaySecretExchangedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DisplaySecretExchangedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DisplaySecretExchangedArg)(nil), args)
						return
					}
					err = i.DisplaySecretExchanged(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"PromptNewDeviceName": {
				MakeArg: func() interface{} {
					var ret [1]PromptNewDeviceNameArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PromptNewDeviceNameArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PromptNewDeviceNameArg)(nil), args)
						return
					}
					ret, err = i.PromptNewDeviceName(ctx, typedArgs[0])
					return
				},
			},
			"ProvisioneeSuccess": {
				MakeArg: func() interface{} {
					var ret [1]ProvisioneeSuccessArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ProvisioneeSuccessArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ProvisioneeSuccessArg)(nil), args)
						return
					}
					err = i.ProvisioneeSuccess(ctx, typedArgs[0])
					return
				},
			},
			"ProvisionerSuccess": {
				MakeArg: func() interface{} {
					var ret [1]ProvisionerSuccessArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ProvisionerSuccessArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ProvisionerSuccessArg)(nil), args)
						return
					}
					err = i.ProvisionerSuccess(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type ProvisionUiClient struct {
	Cli rpc.GenericClient
}

// DEPRECATED:
// Called during device provisioning for the user to select a
// method for provisioning.  gpgOption will be true if GPG
// should be offered as an option.
func (c ProvisionUiClient) ChooseProvisioningMethod(ctx context.Context, __arg ChooseProvisioningMethodArg) (res ProvisionMethod, err error) {
	err = c.Cli.Call(ctx, "keybase.1.provisionUi.chooseProvisioningMethod", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// Called during device provisioning for the user to select a
// GPG method, either import the key into keybase's local keyring
// or use GPG to sign a provisioning statement.
//
// The keys are provided for display purposes, so the UI can
// do something like "We found the following GPG keys on this
// machine.  How would you like to use one of them to provision
// this device?"
//
// After this, gpg_ui.selectKey will be called (if there are
// multiple keys available).
func (c ProvisionUiClient) ChooseGPGMethod(ctx context.Context, __arg ChooseGPGMethodArg) (res GPGMethod, err error) {
	err = c.Cli.Call(ctx, "keybase.1.provisionUi.chooseGPGMethod", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// If there was an error importing a gpg key into the local
// keyring, tell the user and offer to switch to GPG signing
// with this key.  Return true to switch to GPG signing,
// false to abort provisioning.
func (c ProvisionUiClient) SwitchToGPGSignOK(ctx context.Context, __arg SwitchToGPGSignOKArg) (res bool, err error) {
	err = c.Cli.Call(ctx, "keybase.1.provisionUi.switchToGPGSignOK", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ProvisionUiClient) ChooseDevice(ctx context.Context, __arg ChooseDeviceArg) (res DeviceID, err error) {
	err = c.Cli.Call(ctx, "keybase.1.provisionUi.chooseDevice", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// If provisioning via device, this will be called so user can select the provisioner/provisionee device type: desktop or mobile.
// If selecting the existing device type, set kind to EXISTING_DEVICE_0.
// If selecting the new device type, set kind to NEW_DEVICE_1.
func (c ProvisionUiClient) ChooseDeviceType(ctx context.Context, __arg ChooseDeviceTypeArg) (res DeviceType, err error) {
	err = c.Cli.Call(ctx, "keybase.1.provisionUi.chooseDeviceType", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// DisplayAndPromptSecret displays a secret that the user can enter into the other device.
// It also can return a secret that the user enters into this device (from the other device).
// If it does not return a secret, it will be canceled when this device receives the secret via kex2.
// If there is an error in the phrase, then previousErr will be set when this is called again.
func (c ProvisionUiClient) DisplayAndPromptSecret(ctx context.Context, __arg DisplayAndPromptSecretArg) (res SecretResponse, err error) {
	err = c.Cli.Call(ctx, "keybase.1.provisionUi.DisplayAndPromptSecret", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// DisplaySecretExchanged is called when the kex2 secret has successfully been exchanged by the two
// devices.
func (c ProvisionUiClient) DisplaySecretExchanged(ctx context.Context, sessionID int) (err error) {
	__arg := DisplaySecretExchangedArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.provisionUi.DisplaySecretExchanged", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// PromptNewDeviceName is called when the device provisioning process needs a name for the new device.
// To help the clients not send a duplicate name, existingDevices is populated with the current device
// names for the user.  If the device name returned to the service is invalid or already
// taken, it will call this again with an error message in errorMessage.
func (c ProvisionUiClient) PromptNewDeviceName(ctx context.Context, __arg PromptNewDeviceNameArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.provisionUi.PromptNewDeviceName", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// ProvisioneeSuccess is called on provisionee when it is successfully provisioned.
func (c ProvisionUiClient) ProvisioneeSuccess(ctx context.Context, __arg ProvisioneeSuccessArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.provisionUi.ProvisioneeSuccess", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// ProvisionerSuccess is called on provisioner when it successfully provisions another device.
func (c ProvisionUiClient) ProvisionerSuccess(ctx context.Context, __arg ProvisionerSuccessArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.provisionUi.ProvisionerSuccess", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
