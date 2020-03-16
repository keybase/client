// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/kbfs.avdl

package keybase1

type KBFSTeamSettings struct {
	TlfID TLFID `codec:"tlfID" json:"tlfID"`
}

func (o KBFSTeamSettings) DeepCopy() KBFSTeamSettings {
	return KBFSTeamSettings{
		TlfID: o.TlfID.DeepCopy(),
	}
}
