// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/airdrop.avdl

package keybase1

type AirdropDetails struct {
	Uid  UID       `codec:"uid" json:"uid"`
	Kid  BinaryKID `codec:"kid" json:"kid"`
	Vid  VID       `codec:"vid" json:"vid"`
	Vers string    `codec:"vers" json:"vers"`
	Time Time      `codec:"time" json:"time"`
}

func (o AirdropDetails) DeepCopy() AirdropDetails {
	return AirdropDetails{
		Uid:  o.Uid.DeepCopy(),
		Kid:  o.Kid.DeepCopy(),
		Vid:  o.Vid.DeepCopy(),
		Vers: o.Vers,
		Time: o.Time.DeepCopy(),
	}
}
