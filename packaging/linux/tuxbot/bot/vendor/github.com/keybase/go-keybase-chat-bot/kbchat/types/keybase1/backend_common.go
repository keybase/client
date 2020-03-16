// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/backend_common.avdl

package keybase1

import (
	"fmt"
)

type BlockType int

const (
	BlockType_DATA BlockType = 0
	BlockType_MD   BlockType = 1
	BlockType_GIT  BlockType = 2
)

func (o BlockType) DeepCopy() BlockType { return o }

var BlockTypeMap = map[string]BlockType{
	"DATA": 0,
	"MD":   1,
	"GIT":  2,
}

var BlockTypeRevMap = map[BlockType]string{
	0: "DATA",
	1: "MD",
	2: "GIT",
}

func (e BlockType) String() string {
	if v, ok := BlockTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type BlockIdCombo struct {
	BlockHash string       `codec:"blockHash" json:"blockHash"`
	ChargedTo UserOrTeamID `codec:"chargedTo" json:"chargedTo"`
	BlockType BlockType    `codec:"blockType" json:"blockType"`
}

func (o BlockIdCombo) DeepCopy() BlockIdCombo {
	return BlockIdCombo{
		BlockHash: o.BlockHash,
		ChargedTo: o.ChargedTo.DeepCopy(),
		BlockType: o.BlockType.DeepCopy(),
	}
}

type ChallengeInfo struct {
	Now       int64  `codec:"now" json:"now"`
	Challenge string `codec:"challenge" json:"challenge"`
}

func (o ChallengeInfo) DeepCopy() ChallengeInfo {
	return ChallengeInfo{
		Now:       o.Now,
		Challenge: o.Challenge,
	}
}
