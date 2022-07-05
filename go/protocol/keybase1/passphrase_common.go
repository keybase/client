// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/passphrase_common.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type Feature struct {
	Allow        bool   `codec:"allow" json:"allow"`
	DefaultValue bool   `codec:"defaultValue" json:"defaultValue"`
	Readonly     bool   `codec:"readonly" json:"readonly"`
	Label        string `codec:"label" json:"label"`
}

func (o Feature) DeepCopy() Feature {
	return Feature{
		Allow:        o.Allow,
		DefaultValue: o.DefaultValue,
		Readonly:     o.Readonly,
		Label:        o.Label,
	}
}

type GUIEntryFeatures struct {
	ShowTyping Feature `codec:"showTyping" json:"showTyping"`
}

func (o GUIEntryFeatures) DeepCopy() GUIEntryFeatures {
	return GUIEntryFeatures{
		ShowTyping: o.ShowTyping.DeepCopy(),
	}
}

type PassphraseType int

const (
	PassphraseType_NONE               PassphraseType = 0
	PassphraseType_PAPER_KEY          PassphraseType = 1
	PassphraseType_PASS_PHRASE        PassphraseType = 2
	PassphraseType_VERIFY_PASS_PHRASE PassphraseType = 3
)

func (o PassphraseType) DeepCopy() PassphraseType { return o }

var PassphraseTypeMap = map[string]PassphraseType{
	"NONE":               0,
	"PAPER_KEY":          1,
	"PASS_PHRASE":        2,
	"VERIFY_PASS_PHRASE": 3,
}

var PassphraseTypeRevMap = map[PassphraseType]string{
	0: "NONE",
	1: "PAPER_KEY",
	2: "PASS_PHRASE",
	3: "VERIFY_PASS_PHRASE",
}

func (e PassphraseType) String() string {
	if v, ok := PassphraseTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type GUIEntryArg struct {
	WindowTitle string           `codec:"windowTitle" json:"windowTitle"`
	Prompt      string           `codec:"prompt" json:"prompt"`
	Username    string           `codec:"username" json:"username"`
	SubmitLabel string           `codec:"submitLabel" json:"submitLabel"`
	CancelLabel string           `codec:"cancelLabel" json:"cancelLabel"`
	RetryLabel  string           `codec:"retryLabel" json:"retryLabel"`
	Type        PassphraseType   `codec:"type" json:"type"`
	Features    GUIEntryFeatures `codec:"features" json:"features"`
}

func (o GUIEntryArg) DeepCopy() GUIEntryArg {
	return GUIEntryArg{
		WindowTitle: o.WindowTitle,
		Prompt:      o.Prompt,
		Username:    o.Username,
		SubmitLabel: o.SubmitLabel,
		CancelLabel: o.CancelLabel,
		RetryLabel:  o.RetryLabel,
		Type:        o.Type.DeepCopy(),
		Features:    o.Features.DeepCopy(),
	}
}

type GetPassphraseRes struct {
	Passphrase  string `codec:"passphrase" json:"passphrase"`
	StoreSecret bool   `codec:"storeSecret" json:"storeSecret"`
}

func (o GetPassphraseRes) DeepCopy() GetPassphraseRes {
	return GetPassphraseRes{
		Passphrase:  o.Passphrase,
		StoreSecret: o.StoreSecret,
	}
}

type PassphraseCommonInterface interface {
}

func PassphraseCommonProtocol(i PassphraseCommonInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "keybase.1.passphraseCommon",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type PassphraseCommonClient struct {
	Cli rpc.GenericClient
}
