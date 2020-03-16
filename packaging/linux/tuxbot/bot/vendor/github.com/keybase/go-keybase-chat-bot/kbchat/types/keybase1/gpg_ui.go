// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/gpg_ui.avdl

package keybase1

type SelectKeyRes struct {
	KeyID        string `codec:"keyID" json:"keyID"`
	DoSecretPush bool   `codec:"doSecretPush" json:"doSecretPush"`
}

func (o SelectKeyRes) DeepCopy() SelectKeyRes {
	return SelectKeyRes{
		KeyID:        o.KeyID,
		DoSecretPush: o.DoSecretPush,
	}
}
