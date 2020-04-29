// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/block.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
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

type GetBlockSizesRes struct {
	Sizes    []int         `codec:"sizes" json:"sizes"`
	Statuses []BlockStatus `codec:"statuses" json:"statuses"`
}

func (o GetBlockSizesRes) DeepCopy() GetBlockSizesRes {
	return GetBlockSizesRes{
		Sizes: (func(x []int) []int {
			if x == nil {
				return nil
			}
			ret := make([]int, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Sizes),
		Statuses: (func(x []BlockStatus) []BlockStatus {
			if x == nil {
				return nil
			}
			ret := make([]BlockStatus, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Statuses),
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

type UsageStatRecord struct {
	Write      int64 `codec:"write" json:"write"`
	Archive    int64 `codec:"archive" json:"archive"`
	Read       int64 `codec:"read" json:"read"`
	MdWrite    int64 `codec:"mdWrite" json:"mdWrite"`
	GitWrite   int64 `codec:"gitWrite" json:"gitWrite"`
	GitArchive int64 `codec:"gitArchive" json:"gitArchive"`
}

func (o UsageStatRecord) DeepCopy() UsageStatRecord {
	return UsageStatRecord{
		Write:      o.Write,
		Archive:    o.Archive,
		Read:       o.Read,
		MdWrite:    o.MdWrite,
		GitWrite:   o.GitWrite,
		GitArchive: o.GitArchive,
	}
}

type UsageStat struct {
	Bytes  UsageStatRecord `codec:"bytes" json:"bytes"`
	Blocks UsageStatRecord `codec:"blocks" json:"blocks"`
	Mtime  Time            `codec:"mtime" json:"mtime"`
}

func (o UsageStat) DeepCopy() UsageStat {
	return UsageStat{
		Bytes:  o.Bytes.DeepCopy(),
		Blocks: o.Blocks.DeepCopy(),
		Mtime:  o.Mtime.DeepCopy(),
	}
}

type FolderUsageStat struct {
	FolderID string    `codec:"folderID" json:"folderID"`
	Stats    UsageStat `codec:"stats" json:"stats"`
}

func (o FolderUsageStat) DeepCopy() FolderUsageStat {
	return FolderUsageStat{
		FolderID: o.FolderID,
		Stats:    o.Stats.DeepCopy(),
	}
}

type BlockQuotaInfo struct {
	Folders  []FolderUsageStat `codec:"folders" json:"folders"`
	Total    UsageStat         `codec:"total" json:"total"`
	Limit    int64             `codec:"limit" json:"limit"`
	GitLimit int64             `codec:"gitLimit" json:"gitLimit"`
}

func (o BlockQuotaInfo) DeepCopy() BlockQuotaInfo {
	return BlockQuotaInfo{
		Folders: (func(x []FolderUsageStat) []FolderUsageStat {
			if x == nil {
				return nil
			}
			ret := make([]FolderUsageStat, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Folders),
		Total:    o.Total.DeepCopy(),
		Limit:    o.Limit,
		GitLimit: o.GitLimit,
	}
}

type GetSessionChallengeArg struct {
}

type AuthenticateSessionArg struct {
	Signature string `codec:"signature" json:"signature"`
}

type PutBlockArg struct {
	Bid      BlockIdCombo `codec:"bid" json:"bid"`
	Folder   string       `codec:"folder" json:"folder"`
	BlockKey string       `codec:"blockKey" json:"blockKey"`
	Buf      []byte       `codec:"buf" json:"buf"`
}

type PutBlockAgainArg struct {
	Folder   string         `codec:"folder" json:"folder"`
	Ref      BlockReference `codec:"ref" json:"ref"`
	BlockKey string         `codec:"blockKey" json:"blockKey"`
	Buf      []byte         `codec:"buf" json:"buf"`
}

type GetBlockArg struct {
	Bid      BlockIdCombo `codec:"bid" json:"bid"`
	Folder   string       `codec:"folder" json:"folder"`
	SizeOnly bool         `codec:"sizeOnly" json:"sizeOnly"`
}

type GetBlockSizesArg struct {
	Bids   []BlockIdCombo `codec:"bids" json:"bids"`
	Folder string         `codec:"folder" json:"folder"`
}

type AddReferenceArg struct {
	Folder string         `codec:"folder" json:"folder"`
	Ref    BlockReference `codec:"ref" json:"ref"`
}

type DelReferenceArg struct {
	Folder string         `codec:"folder" json:"folder"`
	Ref    BlockReference `codec:"ref" json:"ref"`
}

type ArchiveReferenceArg struct {
	Folder string           `codec:"folder" json:"folder"`
	Refs   []BlockReference `codec:"refs" json:"refs"`
}

type DelReferenceWithCountArg struct {
	Folder string           `codec:"folder" json:"folder"`
	Refs   []BlockReference `codec:"refs" json:"refs"`
}

type ArchiveReferenceWithCountArg struct {
	Folder string           `codec:"folder" json:"folder"`
	Refs   []BlockReference `codec:"refs" json:"refs"`
}

type GetReferenceCountArg struct {
	Folder string         `codec:"folder" json:"folder"`
	Ids    []BlockIdCombo `codec:"ids" json:"ids"`
	Status BlockStatus    `codec:"status" json:"status"`
}

type GetUserQuotaInfoArg struct {
}

type GetTeamQuotaInfoArg struct {
	Tid TeamID `codec:"tid" json:"tid"`
}

type GetUserQuotaInfo2Arg struct {
	IncludeFolders bool `codec:"includeFolders" json:"includeFolders"`
}

type GetTeamQuotaInfo2Arg struct {
	Tid            TeamID `codec:"tid" json:"tid"`
	IncludeFolders bool   `codec:"includeFolders" json:"includeFolders"`
}

type BlockPingArg struct {
}

type BlockInterface interface {
	GetSessionChallenge(context.Context) (ChallengeInfo, error)
	AuthenticateSession(context.Context, string) error
	PutBlock(context.Context, PutBlockArg) error
	PutBlockAgain(context.Context, PutBlockAgainArg) error
	GetBlock(context.Context, GetBlockArg) (GetBlockRes, error)
	GetBlockSizes(context.Context, GetBlockSizesArg) (GetBlockSizesRes, error)
	AddReference(context.Context, AddReferenceArg) error
	DelReference(context.Context, DelReferenceArg) error
	ArchiveReference(context.Context, ArchiveReferenceArg) ([]BlockReference, error)
	DelReferenceWithCount(context.Context, DelReferenceWithCountArg) (DowngradeReferenceRes, error)
	ArchiveReferenceWithCount(context.Context, ArchiveReferenceWithCountArg) (DowngradeReferenceRes, error)
	GetReferenceCount(context.Context, GetReferenceCountArg) (ReferenceCountRes, error)
	GetUserQuotaInfo(context.Context) ([]byte, error)
	GetTeamQuotaInfo(context.Context, TeamID) ([]byte, error)
	GetUserQuotaInfo2(context.Context, bool) (BlockQuotaInfo, error)
	GetTeamQuotaInfo2(context.Context, GetTeamQuotaInfo2Arg) (BlockQuotaInfo, error)
	BlockPing(context.Context) (BlockPingResponse, error)
}

func BlockProtocol(i BlockInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.block",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getSessionChallenge": {
				MakeArg: func() interface{} {
					var ret [1]GetSessionChallengeArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetSessionChallenge(ctx)
					return
				},
			},
			"authenticateSession": {
				MakeArg: func() interface{} {
					var ret [1]AuthenticateSessionArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AuthenticateSessionArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AuthenticateSessionArg)(nil), args)
						return
					}
					err = i.AuthenticateSession(ctx, typedArgs[0].Signature)
					return
				},
			},
			"putBlock": {
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
			"putBlockAgain": {
				MakeArg: func() interface{} {
					var ret [1]PutBlockAgainArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PutBlockAgainArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PutBlockAgainArg)(nil), args)
						return
					}
					err = i.PutBlockAgain(ctx, typedArgs[0])
					return
				},
			},
			"getBlock": {
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
			"getBlockSizes": {
				MakeArg: func() interface{} {
					var ret [1]GetBlockSizesArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetBlockSizesArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetBlockSizesArg)(nil), args)
						return
					}
					ret, err = i.GetBlockSizes(ctx, typedArgs[0])
					return
				},
			},
			"addReference": {
				MakeArg: func() interface{} {
					var ret [1]AddReferenceArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AddReferenceArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AddReferenceArg)(nil), args)
						return
					}
					err = i.AddReference(ctx, typedArgs[0])
					return
				},
			},
			"delReference": {
				MakeArg: func() interface{} {
					var ret [1]DelReferenceArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DelReferenceArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DelReferenceArg)(nil), args)
						return
					}
					err = i.DelReference(ctx, typedArgs[0])
					return
				},
			},
			"archiveReference": {
				MakeArg: func() interface{} {
					var ret [1]ArchiveReferenceArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ArchiveReferenceArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ArchiveReferenceArg)(nil), args)
						return
					}
					ret, err = i.ArchiveReference(ctx, typedArgs[0])
					return
				},
			},
			"delReferenceWithCount": {
				MakeArg: func() interface{} {
					var ret [1]DelReferenceWithCountArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DelReferenceWithCountArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DelReferenceWithCountArg)(nil), args)
						return
					}
					ret, err = i.DelReferenceWithCount(ctx, typedArgs[0])
					return
				},
			},
			"archiveReferenceWithCount": {
				MakeArg: func() interface{} {
					var ret [1]ArchiveReferenceWithCountArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ArchiveReferenceWithCountArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ArchiveReferenceWithCountArg)(nil), args)
						return
					}
					ret, err = i.ArchiveReferenceWithCount(ctx, typedArgs[0])
					return
				},
			},
			"getReferenceCount": {
				MakeArg: func() interface{} {
					var ret [1]GetReferenceCountArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetReferenceCountArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetReferenceCountArg)(nil), args)
						return
					}
					ret, err = i.GetReferenceCount(ctx, typedArgs[0])
					return
				},
			},
			"getUserQuotaInfo": {
				MakeArg: func() interface{} {
					var ret [1]GetUserQuotaInfoArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetUserQuotaInfo(ctx)
					return
				},
			},
			"getTeamQuotaInfo": {
				MakeArg: func() interface{} {
					var ret [1]GetTeamQuotaInfoArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetTeamQuotaInfoArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetTeamQuotaInfoArg)(nil), args)
						return
					}
					ret, err = i.GetTeamQuotaInfo(ctx, typedArgs[0].Tid)
					return
				},
			},
			"getUserQuotaInfo2": {
				MakeArg: func() interface{} {
					var ret [1]GetUserQuotaInfo2Arg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetUserQuotaInfo2Arg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetUserQuotaInfo2Arg)(nil), args)
						return
					}
					ret, err = i.GetUserQuotaInfo2(ctx, typedArgs[0].IncludeFolders)
					return
				},
			},
			"getTeamQuotaInfo2": {
				MakeArg: func() interface{} {
					var ret [1]GetTeamQuotaInfo2Arg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetTeamQuotaInfo2Arg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetTeamQuotaInfo2Arg)(nil), args)
						return
					}
					ret, err = i.GetTeamQuotaInfo2(ctx, typedArgs[0])
					return
				},
			},
			"blockPing": {
				MakeArg: func() interface{} {
					var ret [1]BlockPingArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.BlockPing(ctx)
					return
				},
			},
		},
	}
}

type BlockClient struct {
	Cli rpc.GenericClient
}

func (c BlockClient) GetSessionChallenge(ctx context.Context) (res ChallengeInfo, err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.block.getSessionChallenge", []interface{}{GetSessionChallengeArg{}}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c BlockClient) AuthenticateSession(ctx context.Context, signature string) (err error) {
	__arg := AuthenticateSessionArg{Signature: signature}
	err = c.Cli.CallCompressed(ctx, "keybase.1.block.authenticateSession", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c BlockClient) PutBlock(ctx context.Context, __arg PutBlockArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.block.putBlock", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c BlockClient) PutBlockAgain(ctx context.Context, __arg PutBlockAgainArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.block.putBlockAgain", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c BlockClient) GetBlock(ctx context.Context, __arg GetBlockArg) (res GetBlockRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.block.getBlock", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c BlockClient) GetBlockSizes(ctx context.Context, __arg GetBlockSizesArg) (res GetBlockSizesRes, err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.block.getBlockSizes", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c BlockClient) AddReference(ctx context.Context, __arg AddReferenceArg) (err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.block.addReference", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c BlockClient) DelReference(ctx context.Context, __arg DelReferenceArg) (err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.block.delReference", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c BlockClient) ArchiveReference(ctx context.Context, __arg ArchiveReferenceArg) (res []BlockReference, err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.block.archiveReference", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c BlockClient) DelReferenceWithCount(ctx context.Context, __arg DelReferenceWithCountArg) (res DowngradeReferenceRes, err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.block.delReferenceWithCount", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c BlockClient) ArchiveReferenceWithCount(ctx context.Context, __arg ArchiveReferenceWithCountArg) (res DowngradeReferenceRes, err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.block.archiveReferenceWithCount", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c BlockClient) GetReferenceCount(ctx context.Context, __arg GetReferenceCountArg) (res ReferenceCountRes, err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.block.getReferenceCount", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c BlockClient) GetUserQuotaInfo(ctx context.Context) (res []byte, err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.block.getUserQuotaInfo", []interface{}{GetUserQuotaInfoArg{}}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c BlockClient) GetTeamQuotaInfo(ctx context.Context, tid TeamID) (res []byte, err error) {
	__arg := GetTeamQuotaInfoArg{Tid: tid}
	err = c.Cli.CallCompressed(ctx, "keybase.1.block.getTeamQuotaInfo", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c BlockClient) GetUserQuotaInfo2(ctx context.Context, includeFolders bool) (res BlockQuotaInfo, err error) {
	__arg := GetUserQuotaInfo2Arg{IncludeFolders: includeFolders}
	err = c.Cli.CallCompressed(ctx, "keybase.1.block.getUserQuotaInfo2", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c BlockClient) GetTeamQuotaInfo2(ctx context.Context, __arg GetTeamQuotaInfo2Arg) (res BlockQuotaInfo, err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.block.getTeamQuotaInfo2", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c BlockClient) BlockPing(ctx context.Context) (res BlockPingResponse, err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.block.blockPing", []interface{}{BlockPingArg{}}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}
