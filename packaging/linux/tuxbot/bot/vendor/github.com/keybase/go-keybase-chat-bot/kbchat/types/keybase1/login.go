// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/login.avdl

package keybase1

type ConfiguredAccount struct {
	Username        string   `codec:"username" json:"username"`
	Fullname        FullName `codec:"fullname" json:"fullname"`
	HasStoredSecret bool     `codec:"hasStoredSecret" json:"hasStoredSecret"`
	IsCurrent       bool     `codec:"isCurrent" json:"isCurrent"`
}

func (o ConfiguredAccount) DeepCopy() ConfiguredAccount {
	return ConfiguredAccount{
		Username:        o.Username,
		Fullname:        o.Fullname.DeepCopy(),
		HasStoredSecret: o.HasStoredSecret,
		IsCurrent:       o.IsCurrent,
	}
}
