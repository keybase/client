// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/login_ui.avdl

package keybase1

import (
	"errors"
	"fmt"
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
