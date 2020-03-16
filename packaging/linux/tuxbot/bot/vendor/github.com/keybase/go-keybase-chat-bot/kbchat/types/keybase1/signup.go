// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/signup.avdl

package keybase1

type SignupRes struct {
	PassphraseOk bool   `codec:"passphraseOk" json:"passphraseOk"`
	PostOk       bool   `codec:"postOk" json:"postOk"`
	WriteOk      bool   `codec:"writeOk" json:"writeOk"`
	PaperKey     string `codec:"paperKey" json:"paperKey"`
}

func (o SignupRes) DeepCopy() SignupRes {
	return SignupRes{
		PassphraseOk: o.PassphraseOk,
		PostOk:       o.PostOk,
		WriteOk:      o.WriteOk,
		PaperKey:     o.PaperKey,
	}
}
