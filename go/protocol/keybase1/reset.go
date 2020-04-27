// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/reset.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type SHA512 []byte

func (o SHA512) DeepCopy() SHA512 {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type ResetType int

const (
	ResetType_NONE   ResetType = 0
	ResetType_RESET  ResetType = 1
	ResetType_DELETE ResetType = 2
)

func (o ResetType) DeepCopy() ResetType { return o }

var ResetTypeMap = map[string]ResetType{
	"NONE":   0,
	"RESET":  1,
	"DELETE": 2,
}

var ResetTypeRevMap = map[ResetType]string{
	0: "NONE",
	1: "RESET",
	2: "DELETE",
}

func (e ResetType) String() string {
	if v, ok := ResetTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ResetMerkleRoot struct {
	HashMeta HashMeta `codec:"hashMeta" json:"hash_meta"`
	Seqno    Seqno    `codec:"seqno" json:"seqno"`
}

func (o ResetMerkleRoot) DeepCopy() ResetMerkleRoot {
	return ResetMerkleRoot{
		HashMeta: o.HashMeta.DeepCopy(),
		Seqno:    o.Seqno.DeepCopy(),
	}
}

type ResetPrev struct {
	EldestKID *KID   `codec:"eldestKID,omitempty" json:"eldest_kid,omitempty"`
	LastSeqno Seqno  `codec:"lastSeqno" json:"public_seqno"`
	Reset     SHA512 `codec:"reset" json:"reset"`
}

func (o ResetPrev) DeepCopy() ResetPrev {
	return ResetPrev{
		EldestKID: (func(x *KID) *KID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.EldestKID),
		LastSeqno: o.LastSeqno.DeepCopy(),
		Reset:     o.Reset.DeepCopy(),
	}
}

type ResetLink struct {
	Ctime      UnixTime        `codec:"ctime" json:"ctime"`
	MerkleRoot ResetMerkleRoot `codec:"merkleRoot" json:"merkle_root"`
	Prev       ResetPrev       `codec:"prev" json:"prev"`
	ResetSeqno Seqno           `codec:"resetSeqno" json:"reset_seqno"`
	Type       ResetType       `codec:"type" json:"type"`
	Uid        UID             `codec:"uid" json:"uid"`
}

func (o ResetLink) DeepCopy() ResetLink {
	return ResetLink{
		Ctime:      o.Ctime.DeepCopy(),
		MerkleRoot: o.MerkleRoot.DeepCopy(),
		Prev:       o.Prev.DeepCopy(),
		ResetSeqno: o.ResetSeqno.DeepCopy(),
		Type:       o.Type.DeepCopy(),
		Uid:        o.Uid.DeepCopy(),
	}
}

type ResetSummary struct {
	Ctime       UnixTime        `codec:"ctime" json:"ctime"`
	MerkleRoot  ResetMerkleRoot `codec:"merkleRoot" json:"merkleRoot"`
	ResetSeqno  Seqno           `codec:"resetSeqno" json:"resetSeqno"`
	EldestSeqno Seqno           `codec:"eldestSeqno" json:"eldestSeqno"`
	Type        ResetType       `codec:"type" json:"type"`
}

func (o ResetSummary) DeepCopy() ResetSummary {
	return ResetSummary{
		Ctime:       o.Ctime.DeepCopy(),
		MerkleRoot:  o.MerkleRoot.DeepCopy(),
		ResetSeqno:  o.ResetSeqno.DeepCopy(),
		EldestSeqno: o.EldestSeqno.DeepCopy(),
		Type:        o.Type.DeepCopy(),
	}
}

type ResetInterface interface {
}

func ResetProtocol(i ResetInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "keybase.1.Reset",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type ResetClient struct {
	Cli rpc.GenericClient
}
