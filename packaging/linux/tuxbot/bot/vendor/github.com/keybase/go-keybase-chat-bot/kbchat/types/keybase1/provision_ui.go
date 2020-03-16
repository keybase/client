// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/provision_ui.avdl

package keybase1

import (
	"fmt"
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
