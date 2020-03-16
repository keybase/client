// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/block.avdl

package keybase1

import (
	"fmt"
)

type BlockStatus int

const (
	BlockStatus_UNKNOWN  BlockStatus = 0
	BlockStatus_LIVE     BlockStatus = 1
	BlockStatus_ARCHIVED BlockStatus = 2
)

func (o BlockStatus) DeepCopy() BlockStatus { return o }

var BlockStatusMap = map[string]BlockStatus{
	"UNKNOWN":  0,
	"LIVE":     1,
	"ARCHIVED": 2,
}

var BlockStatusRevMap = map[BlockStatus]string{
	0: "UNKNOWN",
	1: "LIVE",
	2: "ARCHIVED",
}

func (e BlockStatus) String() string {
	if v, ok := BlockStatusRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type GetBlockRes struct {
	BlockKey string      `codec:"blockKey" json:"blockKey"`
	Buf      []byte      `codec:"buf" json:"buf"`
	Size     int         `codec:"size" json:"size"`
	Status   BlockStatus `codec:"status" json:"status"`
}

func (o GetBlockRes) DeepCopy() GetBlockRes {
	return GetBlockRes{
		BlockKey: o.BlockKey,
		Buf: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Buf),
		Size:   o.Size,
		Status: o.Status.DeepCopy(),
	}
}

type BlockRefNonce [8]byte

func (o BlockRefNonce) DeepCopy() BlockRefNonce {
	var ret BlockRefNonce
	copy(ret[:], o[:])
	return ret
}

type BlockReference struct {
	Bid       BlockIdCombo  `codec:"bid" json:"bid"`
	Nonce     BlockRefNonce `codec:"nonce" json:"nonce"`
	ChargedTo UserOrTeamID  `codec:"chargedTo" json:"chargedTo"`
}

func (o BlockReference) DeepCopy() BlockReference {
	return BlockReference{
		Bid:       o.Bid.DeepCopy(),
		Nonce:     o.Nonce.DeepCopy(),
		ChargedTo: o.ChargedTo.DeepCopy(),
	}
}

type BlockReferenceCount struct {
	Ref       BlockReference `codec:"ref" json:"ref"`
	LiveCount int            `codec:"liveCount" json:"liveCount"`
}

func (o BlockReferenceCount) DeepCopy() BlockReferenceCount {
	return BlockReferenceCount{
		Ref:       o.Ref.DeepCopy(),
		LiveCount: o.LiveCount,
	}
}

type DowngradeReferenceRes struct {
	Completed []BlockReferenceCount `codec:"completed" json:"completed"`
	Failed    BlockReference        `codec:"failed" json:"failed"`
}

func (o DowngradeReferenceRes) DeepCopy() DowngradeReferenceRes {
	return DowngradeReferenceRes{
		Completed: (func(x []BlockReferenceCount) []BlockReferenceCount {
			if x == nil {
				return nil
			}
			ret := make([]BlockReferenceCount, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Completed),
		Failed: o.Failed.DeepCopy(),
	}
}

type BlockIdCount struct {
	Id        BlockIdCombo `codec:"id" json:"id"`
	LiveCount int          `codec:"liveCount" json:"liveCount"`
}

func (o BlockIdCount) DeepCopy() BlockIdCount {
	return BlockIdCount{
		Id:        o.Id.DeepCopy(),
		LiveCount: o.LiveCount,
	}
}

type ReferenceCountRes struct {
	Counts []BlockIdCount `codec:"counts" json:"counts"`
}

func (o ReferenceCountRes) DeepCopy() ReferenceCountRes {
	return ReferenceCountRes{
		Counts: (func(x []BlockIdCount) []BlockIdCount {
			if x == nil {
				return nil
			}
			ret := make([]BlockIdCount, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Counts),
	}
}

type BlockPingResponse struct {
}

func (o BlockPingResponse) DeepCopy() BlockPingResponse {
	return BlockPingResponse{}
}
