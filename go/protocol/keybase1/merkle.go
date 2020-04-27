// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/merkle.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

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

type GetCurrentMerkleRootArg struct {
	FreshnessMsec int `codec:"freshnessMsec" json:"freshnessMsec"`
}

type VerifyMerkleRootAndKBFSArg struct {
	Root             MerkleRootV2 `codec:"root" json:"root"`
	ExpectedKBFSRoot KBFSRoot     `codec:"expectedKBFSRoot" json:"expectedKBFSRoot"`
}

type MerkleInterface interface {
	// GetCurrentMerkleRoot gets the current-most Merkle root from the keybase server.
	// The caller can specify how stale a result can be with freshnessMsec.
	// If 0 is specified, then any amount of staleness is OK. If -1 is specified, then
	// we force a GET and a round-trip.
	GetCurrentMerkleRoot(context.Context, int) (MerkleRootAndTime, error)
	// VerifyMerkleRootAndKBFS checks that the given merkle root is indeed a valid
	// root of the keybase server's Merkle tree, and that the given KBFS root
	// is included in that global root.
	VerifyMerkleRootAndKBFS(context.Context, VerifyMerkleRootAndKBFSArg) error
}

func MerkleProtocol(i MerkleInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.merkle",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getCurrentMerkleRoot": {
				MakeArg: func() interface{} {
					var ret [1]GetCurrentMerkleRootArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetCurrentMerkleRootArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetCurrentMerkleRootArg)(nil), args)
						return
					}
					ret, err = i.GetCurrentMerkleRoot(ctx, typedArgs[0].FreshnessMsec)
					return
				},
			},
			"verifyMerkleRootAndKBFS": {
				MakeArg: func() interface{} {
					var ret [1]VerifyMerkleRootAndKBFSArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]VerifyMerkleRootAndKBFSArg)
					if !ok {
						err = rpc.NewTypeError((*[1]VerifyMerkleRootAndKBFSArg)(nil), args)
						return
					}
					err = i.VerifyMerkleRootAndKBFS(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type MerkleClient struct {
	Cli rpc.GenericClient
}

// GetCurrentMerkleRoot gets the current-most Merkle root from the keybase server.
// The caller can specify how stale a result can be with freshnessMsec.
// If 0 is specified, then any amount of staleness is OK. If -1 is specified, then
// we force a GET and a round-trip.
func (c MerkleClient) GetCurrentMerkleRoot(ctx context.Context, freshnessMsec int) (res MerkleRootAndTime, err error) {
	__arg := GetCurrentMerkleRootArg{FreshnessMsec: freshnessMsec}
	err = c.Cli.Call(ctx, "keybase.1.merkle.getCurrentMerkleRoot", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// VerifyMerkleRootAndKBFS checks that the given merkle root is indeed a valid
// root of the keybase server's Merkle tree, and that the given KBFS root
// is included in that global root.
func (c MerkleClient) VerifyMerkleRootAndKBFS(ctx context.Context, __arg VerifyMerkleRootAndKBFSArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.merkle.verifyMerkleRootAndKBFS", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
