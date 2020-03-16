// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/secret_ui.avdl

package keybase1

type SecretEntryArg struct {
	Desc       string `codec:"desc" json:"desc"`
	Prompt     string `codec:"prompt" json:"prompt"`
	Err        string `codec:"err" json:"err"`
	Cancel     string `codec:"cancel" json:"cancel"`
	Ok         string `codec:"ok" json:"ok"`
	Reason     string `codec:"reason" json:"reason"`
	ShowTyping bool   `codec:"showTyping" json:"showTyping"`
}

func (o SecretEntryArg) DeepCopy() SecretEntryArg {
	return SecretEntryArg{
		Desc:       o.Desc,
		Prompt:     o.Prompt,
		Err:        o.Err,
		Cancel:     o.Cancel,
		Ok:         o.Ok,
		Reason:     o.Reason,
		ShowTyping: o.ShowTyping,
	}
}

type SecretEntryRes struct {
	Text        string `codec:"text" json:"text"`
	Canceled    bool   `codec:"canceled" json:"canceled"`
	StoreSecret bool   `codec:"storeSecret" json:"storeSecret"`
}

func (o SecretEntryRes) DeepCopy() SecretEntryRes {
	return SecretEntryRes{
		Text:        o.Text,
		Canceled:    o.Canceled,
		StoreSecret: o.StoreSecret,
	}
}
