// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/merkle.avdl

package keybase1

type MerkleRootAndTime struct {
	Root       MerkleRootV2 `codec:"root" json:"root"`
	UpdateTime Time         `codec:"updateTime" json:"updateTime"`
	FetchTime  Time         `codec:"fetchTime" json:"fetchTime"`
}

func (o MerkleRootAndTime) DeepCopy() MerkleRootAndTime {
	return MerkleRootAndTime{
		Root:       o.Root.DeepCopy(),
		UpdateTime: o.UpdateTime.DeepCopy(),
		FetchTime:  o.FetchTime.DeepCopy(),
	}
}

type KBFSRootHash []byte

func (o KBFSRootHash) DeepCopy() KBFSRootHash {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type KBFSRoot struct {
	TreeID MerkleTreeID `codec:"treeID" json:"treeID"`
	Root   KBFSRootHash `codec:"root" json:"root"`
}

func (o KBFSRoot) DeepCopy() KBFSRoot {
	return KBFSRoot{
		TreeID: o.TreeID.DeepCopy(),
		Root:   o.Root.DeepCopy(),
	}
}
