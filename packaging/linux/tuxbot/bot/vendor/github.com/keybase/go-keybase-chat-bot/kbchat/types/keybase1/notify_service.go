// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/notify_service.avdl

package keybase1

type HttpSrvInfo struct {
	Address string `codec:"address" json:"address"`
	Token   string `codec:"token" json:"token"`
}

func (o HttpSrvInfo) DeepCopy() HttpSrvInfo {
	return HttpSrvInfo{
		Address: o.Address,
		Token:   o.Token,
	}
}
