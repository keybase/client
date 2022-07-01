// Auto-generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/kbgitkbfs1/disk_block_cache.avdl

package kbgitkbfs1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type PrefetchStatus int

const (
	PrefetchStatus_NO_PREFETCH        PrefetchStatus = 0
	PrefetchStatus_TRIGGERED_PREFETCH PrefetchStatus = 1
	PrefetchStatus_FINISHED_PREFETCH  PrefetchStatus = 2
)

func (o PrefetchStatus) DeepCopy() PrefetchStatus { return o }

var PrefetchStatusMap = map[string]PrefetchStatus{
	"NO_PREFETCH":        0,
	"TRIGGERED_PREFETCH": 1,
	"FINISHED_PREFETCH":  2,
}

var PrefetchStatusRevMap = map[PrefetchStatus]string{
	0: "NO_PREFETCH",
	1: "TRIGGERED_PREFETCH",
	2: "FINISHED_PREFETCH",
}

func (e PrefetchStatus) String() string {
	if v, ok := PrefetchStatusRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

// GetCachedBlockRes is the response from GetBlock.
type GetBlockRes struct {
	Buf            []byte         `codec:"buf" json:"buf"`
	ServerHalf     []byte         `codec:"serverHalf" json:"serverHalf"`
	PrefetchStatus PrefetchStatus `codec:"prefetchStatus" json:"prefetchStatus"`
}

func (o GetBlockRes) DeepCopy() GetBlockRes {
	return GetBlockRes{
		Buf: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Buf),
		ServerHalf: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.ServerHalf),
		PrefetchStatus: o.PrefetchStatus.DeepCopy(),
	}
}

// DeleteBlocksRes is the response from DeleteBlocks.
type DeleteBlocksRes struct {
	NumRemoved  int   `codec:"numRemoved" json:"numRemoved"`
	SizeRemoved int64 `codec:"sizeRemoved" json:"sizeRemoved"`
}

func (o DeleteBlocksRes) DeepCopy() DeleteBlocksRes {
	return DeleteBlocksRes{
		NumRemoved:  o.NumRemoved,
		SizeRemoved: o.SizeRemoved,
	}
}

type GetBlockArg struct {
	TlfID   []byte `codec:"tlfID" json:"tlfID"`
	BlockID []byte `codec:"blockID" json:"blockID"`
}

type GetPrefetchStatusArg struct {
	TlfID   []byte `codec:"tlfID" json:"tlfID"`
	BlockID []byte `codec:"blockID" json:"blockID"`
}

type PutBlockArg struct {
	TlfID      []byte `codec:"tlfID" json:"tlfID"`
	BlockID    []byte `codec:"blockID" json:"blockID"`
	Buf        []byte `codec:"buf" json:"buf"`
	ServerHalf []byte `codec:"serverHalf" json:"serverHalf"`
}

type DeleteBlocksArg struct {
	BlockIDs [][]byte `codec:"blockIDs" json:"blockIDs"`
}

type UpdateBlockMetadataArg struct {
	TlfID          []byte         `codec:"tlfID" json:"tlfID"`
	BlockID        []byte         `codec:"blockID" json:"blockID"`
	PrefetchStatus PrefetchStatus `codec:"prefetchStatus" json:"prefetchStatus"`
}

// DiskBlockCacheInterface specifies how to access a disk cache remotely.
type DiskBlockCacheInterface interface {
	// GetBlock gets a block from the disk cache.
	GetBlock(context.Context, GetBlockArg) (GetBlockRes, error)
	// GetPrefetchStatus gets the prefetch status from the disk cache.
	GetPrefetchStatus(context.Context, GetPrefetchStatusArg) (PrefetchStatus, error)
	// PutBlock puts a block into the disk cache.
	PutBlock(context.Context, PutBlockArg) error
	// DeleteBlocks deletes a set of blocks from the disk cache.
	DeleteBlocks(context.Context, [][]byte) (DeleteBlocksRes, error)
	// UpdateBlockMetadata updates the metadata for a block in the disk cache.
	UpdateBlockMetadata(context.Context, UpdateBlockMetadataArg) error
}

func DiskBlockCacheProtocol(i DiskBlockCacheInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "kbgitkbfs.1.DiskBlockCache",
		Methods: map[string]rpc.ServeHandlerDescription{
			"GetBlock": {
				MakeArg: func() interface{} {
					var ret [1]GetBlockArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetBlockArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetBlockArg)(nil), args)
						return
					}
					ret, err = i.GetBlock(ctx, typedArgs[0])
					return
				},
			},
			"GetPrefetchStatus": {
				MakeArg: func() interface{} {
					var ret [1]GetPrefetchStatusArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetPrefetchStatusArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetPrefetchStatusArg)(nil), args)
						return
					}
					ret, err = i.GetPrefetchStatus(ctx, typedArgs[0])
					return
				},
			},
			"PutBlock": {
				MakeArg: func() interface{} {
					var ret [1]PutBlockArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PutBlockArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PutBlockArg)(nil), args)
						return
					}
					err = i.PutBlock(ctx, typedArgs[0])
					return
				},
			},
			"DeleteBlocks": {
				MakeArg: func() interface{} {
					var ret [1]DeleteBlocksArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DeleteBlocksArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DeleteBlocksArg)(nil), args)
						return
					}
					ret, err = i.DeleteBlocks(ctx, typedArgs[0].BlockIDs)
					return
				},
			},
			"UpdateBlockMetadata": {
				MakeArg: func() interface{} {
					var ret [1]UpdateBlockMetadataArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UpdateBlockMetadataArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UpdateBlockMetadataArg)(nil), args)
						return
					}
					err = i.UpdateBlockMetadata(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type DiskBlockCacheClient struct {
	Cli rpc.GenericClient
}

// GetBlock gets a block from the disk cache.
func (c DiskBlockCacheClient) GetBlock(ctx context.Context, __arg GetBlockArg) (res GetBlockRes, err error) {
	err = c.Cli.Call(ctx, "kbgitkbfs.1.DiskBlockCache.GetBlock", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// GetPrefetchStatus gets the prefetch status from the disk cache.
func (c DiskBlockCacheClient) GetPrefetchStatus(ctx context.Context, __arg GetPrefetchStatusArg) (res PrefetchStatus, err error) {
	err = c.Cli.Call(ctx, "kbgitkbfs.1.DiskBlockCache.GetPrefetchStatus", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// PutBlock puts a block into the disk cache.
func (c DiskBlockCacheClient) PutBlock(ctx context.Context, __arg PutBlockArg) (err error) {
	err = c.Cli.Call(ctx, "kbgitkbfs.1.DiskBlockCache.PutBlock", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// DeleteBlocks deletes a set of blocks from the disk cache.
func (c DiskBlockCacheClient) DeleteBlocks(ctx context.Context, blockIDs [][]byte) (res DeleteBlocksRes, err error) {
	__arg := DeleteBlocksArg{BlockIDs: blockIDs}
	err = c.Cli.Call(ctx, "kbgitkbfs.1.DiskBlockCache.DeleteBlocks", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// UpdateBlockMetadata updates the metadata for a block in the disk cache.
func (c DiskBlockCacheClient) UpdateBlockMetadata(ctx context.Context, __arg UpdateBlockMetadataArg) (err error) {
	err = c.Cli.Call(ctx, "kbgitkbfs.1.DiskBlockCache.UpdateBlockMetadata", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
