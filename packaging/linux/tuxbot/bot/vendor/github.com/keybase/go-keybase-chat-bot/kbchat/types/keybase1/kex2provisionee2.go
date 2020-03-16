// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/kex2provisionee2.avdl

package keybase1

type Hello2Res struct {
	EncryptionKey KID      `codec:"encryptionKey" json:"encryptionKey"`
	SigPayload    HelloRes `codec:"sigPayload" json:"sigPayload"`
	DeviceEkKID   KID      `codec:"deviceEkKID" json:"deviceEkKID"`
}

func (o Hello2Res) DeepCopy() Hello2Res {
	return Hello2Res{
		EncryptionKey: o.EncryptionKey.DeepCopy(),
		SigPayload:    o.SigPayload.DeepCopy(),
		DeviceEkKID:   o.DeviceEkKID.DeepCopy(),
	}
}

type PerUserKeyBox struct {
	Generation  PerUserKeyGeneration `codec:"generation" json:"generation"`
	Box         string               `codec:"box" json:"box"`
	ReceiverKID KID                  `codec:"receiverKID" json:"receiver_kid"`
}

func (o PerUserKeyBox) DeepCopy() PerUserKeyBox {
	return PerUserKeyBox{
		Generation:  o.Generation.DeepCopy(),
		Box:         o.Box,
		ReceiverKID: o.ReceiverKID.DeepCopy(),
	}
}
