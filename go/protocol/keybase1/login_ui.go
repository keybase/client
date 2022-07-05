// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/login_ui.avdl

package keybase1

import (
	"errors"
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type ResetPromptType int

const (
	ResetPromptType_COMPLETE         ResetPromptType = 0
	ResetPromptType_ENTER_NO_DEVICES ResetPromptType = 1
	ResetPromptType_ENTER_FORGOT_PW  ResetPromptType = 2
	ResetPromptType_ENTER_RESET_PW   ResetPromptType = 3
)

func (o ResetPromptType) DeepCopy() ResetPromptType { return o }

var ResetPromptTypeMap = map[string]ResetPromptType{
	"COMPLETE":         0,
	"ENTER_NO_DEVICES": 1,
	"ENTER_FORGOT_PW":  2,
	"ENTER_RESET_PW":   3,
}

var ResetPromptTypeRevMap = map[ResetPromptType]string{
	0: "COMPLETE",
	1: "ENTER_NO_DEVICES",
	2: "ENTER_FORGOT_PW",
	3: "ENTER_RESET_PW",
}

func (e ResetPromptType) String() string {
	if v, ok := ResetPromptTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ResetPromptInfo struct {
	HasWallet bool `codec:"hasWallet" json:"hasWallet"`
}

func (o ResetPromptInfo) DeepCopy() ResetPromptInfo {
	return ResetPromptInfo{
		HasWallet: o.HasWallet,
	}
}

type ResetPrompt struct {
	T__        ResetPromptType  `codec:"t" json:"t"`
	Complete__ *ResetPromptInfo `codec:"complete,omitempty" json:"complete,omitempty"`
}

func (o *ResetPrompt) T() (ret ResetPromptType, err error) {
	switch o.T__ {
	case ResetPromptType_COMPLETE:
		if o.Complete__ == nil {
			err = errors.New("unexpected nil value for Complete__")
			return ret, err
		}
	}
	return o.T__, nil
}

func (o ResetPrompt) Complete() (res ResetPromptInfo) {
	if o.T__ != ResetPromptType_COMPLETE {
		panic("wrong case accessed")
	}
	if o.Complete__ == nil {
		return
	}
	return *o.Complete__
}

func NewResetPromptWithComplete(v ResetPromptInfo) ResetPrompt {
	return ResetPrompt{
		T__:        ResetPromptType_COMPLETE,
		Complete__: &v,
	}
}

func NewResetPromptDefault(t ResetPromptType) ResetPrompt {
	return ResetPrompt{
		T__: t,
	}
}

func (o ResetPrompt) DeepCopy() ResetPrompt {
	return ResetPrompt{
		T__: o.T__.DeepCopy(),
		Complete__: (func(x *ResetPromptInfo) *ResetPromptInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Complete__),
	}
}

type ResetPromptResponse int

const (
	ResetPromptResponse_NOTHING       ResetPromptResponse = 0
	ResetPromptResponse_CANCEL_RESET  ResetPromptResponse = 1
	ResetPromptResponse_CONFIRM_RESET ResetPromptResponse = 2
)

func (o ResetPromptResponse) DeepCopy() ResetPromptResponse { return o }

var ResetPromptResponseMap = map[string]ResetPromptResponse{
	"NOTHING":       0,
	"CANCEL_RESET":  1,
	"CONFIRM_RESET": 2,
}

var ResetPromptResponseRevMap = map[ResetPromptResponse]string{
	0: "NOTHING",
	1: "CANCEL_RESET",
	2: "CONFIRM_RESET",
}

func (e ResetPromptResponse) String() string {
	if v, ok := ResetPromptResponseRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type PassphraseRecoveryPromptType int

const (
	PassphraseRecoveryPromptType_ENCRYPTED_PGP_KEYS PassphraseRecoveryPromptType = 0
)

func (o PassphraseRecoveryPromptType) DeepCopy() PassphraseRecoveryPromptType { return o }

var PassphraseRecoveryPromptTypeMap = map[string]PassphraseRecoveryPromptType{
	"ENCRYPTED_PGP_KEYS": 0,
}

var PassphraseRecoveryPromptTypeRevMap = map[PassphraseRecoveryPromptType]string{
	0: "ENCRYPTED_PGP_KEYS",
}

func (e PassphraseRecoveryPromptType) String() string {
	if v, ok := PassphraseRecoveryPromptTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ResetMessage int

const (
	ResetMessage_ENTERED_VERIFIED     ResetMessage = 0
	ResetMessage_ENTERED_PASSWORDLESS ResetMessage = 1
	ResetMessage_REQUEST_VERIFIED     ResetMessage = 2
	ResetMessage_NOT_COMPLETED        ResetMessage = 3
	ResetMessage_CANCELED             ResetMessage = 4
	ResetMessage_COMPLETED            ResetMessage = 5
	ResetMessage_RESET_LINK_SENT      ResetMessage = 6
)

func (o ResetMessage) DeepCopy() ResetMessage { return o }

var ResetMessageMap = map[string]ResetMessage{
	"ENTERED_VERIFIED":     0,
	"ENTERED_PASSWORDLESS": 1,
	"REQUEST_VERIFIED":     2,
	"NOT_COMPLETED":        3,
	"CANCELED":             4,
	"COMPLETED":            5,
	"RESET_LINK_SENT":      6,
}

var ResetMessageRevMap = map[ResetMessage]string{
	0: "ENTERED_VERIFIED",
	1: "ENTERED_PASSWORDLESS",
	2: "REQUEST_VERIFIED",
	3: "NOT_COMPLETED",
	4: "CANCELED",
	5: "COMPLETED",
	6: "RESET_LINK_SENT",
}

func (e ResetMessage) String() string {
	if v, ok := ResetMessageRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type GetEmailOrUsernameArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type PromptRevokePaperKeysArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Device    Device `codec:"device" json:"device"`
	Index     int    `codec:"index" json:"index"`
}

type DisplayPaperKeyPhraseArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Phrase    string `codec:"phrase" json:"phrase"`
}

type DisplayPrimaryPaperKeyArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Phrase    string `codec:"phrase" json:"phrase"`
}

type PromptResetAccountArg struct {
	SessionID int         `codec:"sessionID" json:"sessionID"`
	Prompt    ResetPrompt `codec:"prompt" json:"prompt"`
}

type DisplayResetProgressArg struct {
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	Text       string `codec:"text" json:"text"`
	EndTime    Time   `codec:"endTime" json:"endTime"`
	NeedVerify bool   `codec:"needVerify" json:"needVerify"`
}

type ExplainDeviceRecoveryArg struct {
	SessionID int        `codec:"sessionID" json:"sessionID"`
	Kind      DeviceType `codec:"kind" json:"kind"`
	Name      string     `codec:"name" json:"name"`
}

type PromptPassphraseRecoveryArg struct {
	SessionID int                          `codec:"sessionID" json:"sessionID"`
	Kind      PassphraseRecoveryPromptType `codec:"kind" json:"kind"`
}

type ChooseDeviceToRecoverWithArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Devices   []Device `codec:"devices" json:"devices"`
}

type DisplayResetMessageArg struct {
	SessionID int          `codec:"sessionID" json:"sessionID"`
	Kind      ResetMessage `codec:"kind" json:"kind"`
}

type LoginUiInterface interface {
	GetEmailOrUsername(context.Context, int) (string, error)
	PromptRevokePaperKeys(context.Context, PromptRevokePaperKeysArg) (bool, error)
	DisplayPaperKeyPhrase(context.Context, DisplayPaperKeyPhraseArg) error
	DisplayPrimaryPaperKey(context.Context, DisplayPrimaryPaperKeyArg) error
	// Called during login / provisioning flows to ask the user whether they
	// would like to either enter the autoreset pipeline and perform the reset
	// of the account.
	PromptResetAccount(context.Context, PromptResetAccountArg) (ResetPromptResponse, error)
	// In some flows the user will get notified of the reset progress
	DisplayResetProgress(context.Context, DisplayResetProgressArg) error
	// During recovery the service might want to explain to the user how they can change
	// their password by using the "change password" functionality on other devices.
	ExplainDeviceRecovery(context.Context, ExplainDeviceRecoveryArg) error
	PromptPassphraseRecovery(context.Context, PromptPassphraseRecoveryArg) (bool, error)
	// Different from ProvisionUI's chooseDevice due to phrasing in the UI.
	ChooseDeviceToRecoverWith(context.Context, ChooseDeviceToRecoverWithArg) (DeviceID, error)
	// Simply displays a message in the recovery flow.
	DisplayResetMessage(context.Context, DisplayResetMessageArg) error
}

func LoginUiProtocol(i LoginUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.loginUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getEmailOrUsername": {
				MakeArg: func() interface{} {
					var ret [1]GetEmailOrUsernameArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetEmailOrUsernameArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetEmailOrUsernameArg)(nil), args)
						return
					}
					ret, err = i.GetEmailOrUsername(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"promptRevokePaperKeys": {
				MakeArg: func() interface{} {
					var ret [1]PromptRevokePaperKeysArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PromptRevokePaperKeysArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PromptRevokePaperKeysArg)(nil), args)
						return
					}
					ret, err = i.PromptRevokePaperKeys(ctx, typedArgs[0])
					return
				},
			},
			"displayPaperKeyPhrase": {
				MakeArg: func() interface{} {
					var ret [1]DisplayPaperKeyPhraseArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DisplayPaperKeyPhraseArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DisplayPaperKeyPhraseArg)(nil), args)
						return
					}
					err = i.DisplayPaperKeyPhrase(ctx, typedArgs[0])
					return
				},
			},
			"displayPrimaryPaperKey": {
				MakeArg: func() interface{} {
					var ret [1]DisplayPrimaryPaperKeyArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DisplayPrimaryPaperKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DisplayPrimaryPaperKeyArg)(nil), args)
						return
					}
					err = i.DisplayPrimaryPaperKey(ctx, typedArgs[0])
					return
				},
			},
			"promptResetAccount": {
				MakeArg: func() interface{} {
					var ret [1]PromptResetAccountArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PromptResetAccountArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PromptResetAccountArg)(nil), args)
						return
					}
					ret, err = i.PromptResetAccount(ctx, typedArgs[0])
					return
				},
			},
			"displayResetProgress": {
				MakeArg: func() interface{} {
					var ret [1]DisplayResetProgressArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DisplayResetProgressArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DisplayResetProgressArg)(nil), args)
						return
					}
					err = i.DisplayResetProgress(ctx, typedArgs[0])
					return
				},
			},
			"explainDeviceRecovery": {
				MakeArg: func() interface{} {
					var ret [1]ExplainDeviceRecoveryArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ExplainDeviceRecoveryArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ExplainDeviceRecoveryArg)(nil), args)
						return
					}
					err = i.ExplainDeviceRecovery(ctx, typedArgs[0])
					return
				},
			},
			"promptPassphraseRecovery": {
				MakeArg: func() interface{} {
					var ret [1]PromptPassphraseRecoveryArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PromptPassphraseRecoveryArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PromptPassphraseRecoveryArg)(nil), args)
						return
					}
					ret, err = i.PromptPassphraseRecovery(ctx, typedArgs[0])
					return
				},
			},
			"chooseDeviceToRecoverWith": {
				MakeArg: func() interface{} {
					var ret [1]ChooseDeviceToRecoverWithArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ChooseDeviceToRecoverWithArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ChooseDeviceToRecoverWithArg)(nil), args)
						return
					}
					ret, err = i.ChooseDeviceToRecoverWith(ctx, typedArgs[0])
					return
				},
			},
			"displayResetMessage": {
				MakeArg: func() interface{} {
					var ret [1]DisplayResetMessageArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DisplayResetMessageArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DisplayResetMessageArg)(nil), args)
						return
					}
					err = i.DisplayResetMessage(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type LoginUiClient struct {
	Cli rpc.GenericClient
}

func (c LoginUiClient) GetEmailOrUsername(ctx context.Context, sessionID int) (res string, err error) {
	__arg := GetEmailOrUsernameArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.loginUi.getEmailOrUsername", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LoginUiClient) PromptRevokePaperKeys(ctx context.Context, __arg PromptRevokePaperKeysArg) (res bool, err error) {
	err = c.Cli.Call(ctx, "keybase.1.loginUi.promptRevokePaperKeys", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LoginUiClient) DisplayPaperKeyPhrase(ctx context.Context, __arg DisplayPaperKeyPhraseArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.loginUi.displayPaperKeyPhrase", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LoginUiClient) DisplayPrimaryPaperKey(ctx context.Context, __arg DisplayPrimaryPaperKeyArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.loginUi.displayPrimaryPaperKey", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// Called during login / provisioning flows to ask the user whether they
// would like to either enter the autoreset pipeline and perform the reset
// of the account.
func (c LoginUiClient) PromptResetAccount(ctx context.Context, __arg PromptResetAccountArg) (res ResetPromptResponse, err error) {
	err = c.Cli.Call(ctx, "keybase.1.loginUi.promptResetAccount", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// In some flows the user will get notified of the reset progress
func (c LoginUiClient) DisplayResetProgress(ctx context.Context, __arg DisplayResetProgressArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.loginUi.displayResetProgress", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// During recovery the service might want to explain to the user how they can change
// their password by using the "change password" functionality on other devices.
func (c LoginUiClient) ExplainDeviceRecovery(ctx context.Context, __arg ExplainDeviceRecoveryArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.loginUi.explainDeviceRecovery", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LoginUiClient) PromptPassphraseRecovery(ctx context.Context, __arg PromptPassphraseRecoveryArg) (res bool, err error) {
	err = c.Cli.Call(ctx, "keybase.1.loginUi.promptPassphraseRecovery", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// Different from ProvisionUI's chooseDevice due to phrasing in the UI.
func (c LoginUiClient) ChooseDeviceToRecoverWith(ctx context.Context, __arg ChooseDeviceToRecoverWithArg) (res DeviceID, err error) {
	err = c.Cli.Call(ctx, "keybase.1.loginUi.chooseDeviceToRecoverWith", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// Simply displays a message in the recovery flow.
func (c LoginUiClient) DisplayResetMessage(ctx context.Context, __arg DisplayResetMessageArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.loginUi.displayResetMessage", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
