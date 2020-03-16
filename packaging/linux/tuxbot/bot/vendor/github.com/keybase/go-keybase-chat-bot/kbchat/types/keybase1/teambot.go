// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/teambot.avdl

package keybase1

type TeambotKeyGeneration int64

func (o TeambotKeyGeneration) DeepCopy() TeambotKeyGeneration {
	return o
}

type TeambotKeyMetadata struct {
	Kid           KID                  `codec:"kid" json:"teambot_dh_public"`
	Generation    TeambotKeyGeneration `codec:"generation" json:"generation"`
	Uid           UID                  `codec:"uid" json:"uid"`
	PukGeneration PerUserKeyGeneration `codec:"pukGeneration" json:"puk_generation"`
	Application   TeamApplication      `codec:"application" json:"application"`
}

func (o TeambotKeyMetadata) DeepCopy() TeambotKeyMetadata {
	return TeambotKeyMetadata{
		Kid:           o.Kid.DeepCopy(),
		Generation:    o.Generation.DeepCopy(),
		Uid:           o.Uid.DeepCopy(),
		PukGeneration: o.PukGeneration.DeepCopy(),
		Application:   o.Application.DeepCopy(),
	}
}

type TeambotKeyBoxed struct {
	Box      string             `codec:"box" json:"box"`
	Metadata TeambotKeyMetadata `codec:"metadata" json:"metadata"`
}

func (o TeambotKeyBoxed) DeepCopy() TeambotKeyBoxed {
	return TeambotKeyBoxed{
		Box:      o.Box,
		Metadata: o.Metadata.DeepCopy(),
	}
}

type TeambotKey struct {
	Seed     Bytes32            `codec:"seed" json:"seed"`
	Metadata TeambotKeyMetadata `codec:"metadata" json:"metadata"`
}

func (o TeambotKey) DeepCopy() TeambotKey {
	return TeambotKey{
		Seed:     o.Seed.DeepCopy(),
		Metadata: o.Metadata.DeepCopy(),
	}
}
