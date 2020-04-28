// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/metadata.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type KeyHalf struct {
	User      UID    `codec:"user" json:"user"`
	DeviceKID KID    `codec:"deviceKID" json:"deviceKID"`
	Key       []byte `codec:"key" json:"key"`
}

func (o KeyHalf) DeepCopy() KeyHalf {
	return KeyHalf{
		User:      o.User.DeepCopy(),
		DeviceKID: o.DeviceKID.DeepCopy(),
		Key: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Key),
	}
}

type MDBlock struct {
	Version   int    `codec:"version" json:"version"`
	Timestamp Time   `codec:"timestamp" json:"timestamp"`
	Block     []byte `codec:"block" json:"block"`
}

func (o MDBlock) DeepCopy() MDBlock {
	return MDBlock{
		Version:   o.Version,
		Timestamp: o.Timestamp.DeepCopy(),
		Block: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Block),
	}
}

type KeyBundle struct {
	Version int    `codec:"version" json:"version"`
	Bundle  []byte `codec:"bundle" json:"bundle"`
}

func (o KeyBundle) DeepCopy() KeyBundle {
	return KeyBundle{
		Version: o.Version,
		Bundle: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Bundle),
	}
}

type MetadataResponse struct {
	FolderID string    `codec:"folderID" json:"folderID"`
	MdBlocks []MDBlock `codec:"mdBlocks" json:"mdBlocks"`
}

func (o MetadataResponse) DeepCopy() MetadataResponse {
	return MetadataResponse{
		FolderID: o.FolderID,
		MdBlocks: (func(x []MDBlock) []MDBlock {
			if x == nil {
				return nil
			}
			ret := make([]MDBlock, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.MdBlocks),
	}
}

type MerkleRoot struct {
	Version int    `codec:"version" json:"version"`
	Root    []byte `codec:"root" json:"root"`
}

func (o MerkleRoot) DeepCopy() MerkleRoot {
	return MerkleRoot{
		Version: o.Version,
		Root: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Root),
	}
}

type PingResponse struct {
	Timestamp Time `codec:"timestamp" json:"timestamp"`
}

func (o PingResponse) DeepCopy() PingResponse {
	return PingResponse{
		Timestamp: o.Timestamp.DeepCopy(),
	}
}

type KeyBundleResponse struct {
	WriterBundle KeyBundle `codec:"WriterBundle" json:"WriterBundle"`
	ReaderBundle KeyBundle `codec:"ReaderBundle" json:"ReaderBundle"`
}

func (o KeyBundleResponse) DeepCopy() KeyBundleResponse {
	return KeyBundleResponse{
		WriterBundle: o.WriterBundle.DeepCopy(),
		ReaderBundle: o.ReaderBundle.DeepCopy(),
	}
}

type LockID int64

func (o LockID) DeepCopy() LockID {
	return o
}

type MDPriority int

func (o MDPriority) DeepCopy() MDPriority {
	return o
}

type LockContext struct {
	RequireLockID       LockID `codec:"requireLockID" json:"requireLockID"`
	ReleaseAfterSuccess bool   `codec:"releaseAfterSuccess" json:"releaseAfterSuccess"`
}

func (o LockContext) DeepCopy() LockContext {
	return LockContext{
		RequireLockID:       o.RequireLockID.DeepCopy(),
		ReleaseAfterSuccess: o.ReleaseAfterSuccess,
	}
}

type FindNextMDResponse struct {
	KbfsRoot    MerkleRoot `codec:"kbfsRoot" json:"kbfsRoot"`
	MerkleNodes [][]byte   `codec:"merkleNodes" json:"merkleNodes"`
	RootSeqno   Seqno      `codec:"rootSeqno" json:"rootSeqno"`
	RootHash    HashMeta   `codec:"rootHash" json:"rootHash"`
}

func (o FindNextMDResponse) DeepCopy() FindNextMDResponse {
	return FindNextMDResponse{
		KbfsRoot: o.KbfsRoot.DeepCopy(),
		MerkleNodes: (func(x [][]byte) [][]byte {
			if x == nil {
				return nil
			}
			ret := make([][]byte, len(x))
			for i, v := range x {
				vCopy := (func(x []byte) []byte {
					if x == nil {
						return nil
					}
					return append([]byte{}, x...)
				})(v)
				ret[i] = vCopy
			}
			return ret
		})(o.MerkleNodes),
		RootSeqno: o.RootSeqno.DeepCopy(),
		RootHash:  o.RootHash.DeepCopy(),
	}
}

type GetChallengeArg struct {
}

type AuthenticateArg struct {
	Signature string `codec:"signature" json:"signature"`
}

type PutMetadataArg struct {
	MdBlock         MDBlock           `codec:"mdBlock" json:"mdBlock"`
	ReaderKeyBundle KeyBundle         `codec:"readerKeyBundle" json:"readerKeyBundle"`
	WriterKeyBundle KeyBundle         `codec:"writerKeyBundle" json:"writerKeyBundle"`
	LogTags         map[string]string `codec:"logTags" json:"logTags"`
	LockContext     *LockContext      `codec:"lockContext,omitempty" json:"lockContext,omitempty"`
	Priority        MDPriority        `codec:"priority" json:"priority"`
}

type GetMetadataArg struct {
	FolderID      string            `codec:"folderID" json:"folderID"`
	FolderHandle  []byte            `codec:"folderHandle" json:"folderHandle"`
	BranchID      string            `codec:"branchID" json:"branchID"`
	Unmerged      bool              `codec:"unmerged" json:"unmerged"`
	StartRevision int64             `codec:"startRevision" json:"startRevision"`
	StopRevision  int64             `codec:"stopRevision" json:"stopRevision"`
	LogTags       map[string]string `codec:"logTags" json:"logTags"`
	LockBeforeGet *LockID           `codec:"lockBeforeGet,omitempty" json:"lockBeforeGet,omitempty"`
}

type GetMetadataByTimestampArg struct {
	FolderID   string `codec:"folderID" json:"folderID"`
	ServerTime Time   `codec:"serverTime" json:"serverTime"`
}

type RegisterForUpdatesArg struct {
	FolderID     string            `codec:"folderID" json:"folderID"`
	CurrRevision int64             `codec:"currRevision" json:"currRevision"`
	LogTags      map[string]string `codec:"logTags" json:"logTags"`
}

type PruneBranchArg struct {
	FolderID string            `codec:"folderID" json:"folderID"`
	BranchID string            `codec:"branchID" json:"branchID"`
	LogTags  map[string]string `codec:"logTags" json:"logTags"`
}

type PutKeysArg struct {
	KeyHalves []KeyHalf         `codec:"keyHalves" json:"keyHalves"`
	LogTags   map[string]string `codec:"logTags" json:"logTags"`
}

type GetKeyArg struct {
	KeyHalfID []byte            `codec:"keyHalfID" json:"keyHalfID"`
	DeviceKID string            `codec:"deviceKID" json:"deviceKID"`
	LogTags   map[string]string `codec:"logTags" json:"logTags"`
}

type DeleteKeyArg struct {
	Uid       UID               `codec:"uid" json:"uid"`
	DeviceKID KID               `codec:"deviceKID" json:"deviceKID"`
	KeyHalfID []byte            `codec:"keyHalfID" json:"keyHalfID"`
	LogTags   map[string]string `codec:"logTags" json:"logTags"`
}

type TruncateLockArg struct {
	FolderID string `codec:"folderID" json:"folderID"`
}

type TruncateUnlockArg struct {
	FolderID string `codec:"folderID" json:"folderID"`
}

type GetFolderHandleArg struct {
	FolderID  string `codec:"folderID" json:"folderID"`
	Signature string `codec:"signature" json:"signature"`
	Challenge string `codec:"challenge" json:"challenge"`
}

type GetFoldersForRekeyArg struct {
	DeviceKID KID `codec:"deviceKID" json:"deviceKID"`
}

type PingArg struct {
}

type Ping2Arg struct {
}

type GetLatestFolderHandleArg struct {
	FolderID string `codec:"folderID" json:"folderID"`
}

type GetKeyBundlesArg struct {
	FolderID       string `codec:"folderID" json:"folderID"`
	WriterBundleID string `codec:"writerBundleID" json:"writerBundleID"`
	ReaderBundleID string `codec:"readerBundleID" json:"readerBundleID"`
}

type LockArg struct {
	FolderID string `codec:"folderID" json:"folderID"`
	LockID   LockID `codec:"lockID" json:"lockID"`
}

type ReleaseLockArg struct {
	FolderID string `codec:"folderID" json:"folderID"`
	LockID   LockID `codec:"lockID" json:"lockID"`
}

type StartImplicitTeamMigrationArg struct {
	FolderID string `codec:"folderID" json:"folderID"`
}

type GetMerkleRootArg struct {
	TreeID MerkleTreeID `codec:"treeID" json:"treeID"`
	SeqNo  int64        `codec:"seqNo" json:"seqNo"`
}

type GetMerkleRootLatestArg struct {
	TreeID MerkleTreeID `codec:"treeID" json:"treeID"`
}

type GetMerkleRootSinceArg struct {
	TreeID MerkleTreeID `codec:"treeID" json:"treeID"`
	When   Time         `codec:"when" json:"when"`
}

type GetMerkleNodeArg struct {
	Hash string `codec:"hash" json:"hash"`
}

type FindNextMDArg struct {
	Seqno    Seqno  `codec:"seqno" json:"seqno"`
	FolderID string `codec:"folderID" json:"folderID"`
}

type SetImplicitTeamModeForTestArg struct {
	ImplicitTeamMode string `codec:"implicitTeamMode" json:"implicitTeamMode"`
}

type ForceMerkleBuildForTestArg struct {
}

type MetadataInterface interface {
	GetChallenge(context.Context) (ChallengeInfo, error)
	Authenticate(context.Context, string) (int, error)
	PutMetadata(context.Context, PutMetadataArg) error
	GetMetadata(context.Context, GetMetadataArg) (MetadataResponse, error)
	GetMetadataByTimestamp(context.Context, GetMetadataByTimestampArg) (MDBlock, error)
	RegisterForUpdates(context.Context, RegisterForUpdatesArg) error
	PruneBranch(context.Context, PruneBranchArg) error
	PutKeys(context.Context, PutKeysArg) error
	GetKey(context.Context, GetKeyArg) ([]byte, error)
	DeleteKey(context.Context, DeleteKeyArg) error
	TruncateLock(context.Context, string) (bool, error)
	TruncateUnlock(context.Context, string) (bool, error)
	GetFolderHandle(context.Context, GetFolderHandleArg) ([]byte, error)
	GetFoldersForRekey(context.Context, KID) error
	Ping(context.Context) error
	Ping2(context.Context) (PingResponse, error)
	GetLatestFolderHandle(context.Context, string) ([]byte, error)
	GetKeyBundles(context.Context, GetKeyBundlesArg) (KeyBundleResponse, error)
	Lock(context.Context, LockArg) error
	ReleaseLock(context.Context, ReleaseLockArg) error
	StartImplicitTeamMigration(context.Context, string) error
	GetMerkleRoot(context.Context, GetMerkleRootArg) (MerkleRoot, error)
	GetMerkleRootLatest(context.Context, MerkleTreeID) (MerkleRoot, error)
	GetMerkleRootSince(context.Context, GetMerkleRootSinceArg) (MerkleRoot, error)
	GetMerkleNode(context.Context, string) ([]byte, error)
	FindNextMD(context.Context, FindNextMDArg) (FindNextMDResponse, error)
	SetImplicitTeamModeForTest(context.Context, string) error
	ForceMerkleBuildForTest(context.Context) error
}

func MetadataProtocol(i MetadataInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.metadata",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getChallenge": {
				MakeArg: func() interface{} {
					var ret [1]GetChallengeArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetChallenge(ctx)
					return
				},
			},
			"authenticate": {
				MakeArg: func() interface{} {
					var ret [1]AuthenticateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AuthenticateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AuthenticateArg)(nil), args)
						return
					}
					ret, err = i.Authenticate(ctx, typedArgs[0].Signature)
					return
				},
			},
			"putMetadata": {
				MakeArg: func() interface{} {
					var ret [1]PutMetadataArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PutMetadataArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PutMetadataArg)(nil), args)
						return
					}
					err = i.PutMetadata(ctx, typedArgs[0])
					return
				},
			},
			"getMetadata": {
				MakeArg: func() interface{} {
					var ret [1]GetMetadataArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetMetadataArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetMetadataArg)(nil), args)
						return
					}
					ret, err = i.GetMetadata(ctx, typedArgs[0])
					return
				},
			},
			"getMetadataByTimestamp": {
				MakeArg: func() interface{} {
					var ret [1]GetMetadataByTimestampArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetMetadataByTimestampArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetMetadataByTimestampArg)(nil), args)
						return
					}
					ret, err = i.GetMetadataByTimestamp(ctx, typedArgs[0])
					return
				},
			},
			"registerForUpdates": {
				MakeArg: func() interface{} {
					var ret [1]RegisterForUpdatesArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RegisterForUpdatesArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RegisterForUpdatesArg)(nil), args)
						return
					}
					err = i.RegisterForUpdates(ctx, typedArgs[0])
					return
				},
			},
			"pruneBranch": {
				MakeArg: func() interface{} {
					var ret [1]PruneBranchArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PruneBranchArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PruneBranchArg)(nil), args)
						return
					}
					err = i.PruneBranch(ctx, typedArgs[0])
					return
				},
			},
			"putKeys": {
				MakeArg: func() interface{} {
					var ret [1]PutKeysArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PutKeysArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PutKeysArg)(nil), args)
						return
					}
					err = i.PutKeys(ctx, typedArgs[0])
					return
				},
			},
			"getKey": {
				MakeArg: func() interface{} {
					var ret [1]GetKeyArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetKeyArg)(nil), args)
						return
					}
					ret, err = i.GetKey(ctx, typedArgs[0])
					return
				},
			},
			"deleteKey": {
				MakeArg: func() interface{} {
					var ret [1]DeleteKeyArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DeleteKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DeleteKeyArg)(nil), args)
						return
					}
					err = i.DeleteKey(ctx, typedArgs[0])
					return
				},
			},
			"truncateLock": {
				MakeArg: func() interface{} {
					var ret [1]TruncateLockArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TruncateLockArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TruncateLockArg)(nil), args)
						return
					}
					ret, err = i.TruncateLock(ctx, typedArgs[0].FolderID)
					return
				},
			},
			"truncateUnlock": {
				MakeArg: func() interface{} {
					var ret [1]TruncateUnlockArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TruncateUnlockArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TruncateUnlockArg)(nil), args)
						return
					}
					ret, err = i.TruncateUnlock(ctx, typedArgs[0].FolderID)
					return
				},
			},
			"getFolderHandle": {
				MakeArg: func() interface{} {
					var ret [1]GetFolderHandleArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetFolderHandleArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetFolderHandleArg)(nil), args)
						return
					}
					ret, err = i.GetFolderHandle(ctx, typedArgs[0])
					return
				},
			},
			"getFoldersForRekey": {
				MakeArg: func() interface{} {
					var ret [1]GetFoldersForRekeyArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetFoldersForRekeyArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetFoldersForRekeyArg)(nil), args)
						return
					}
					err = i.GetFoldersForRekey(ctx, typedArgs[0].DeviceKID)
					return
				},
			},
			"ping": {
				MakeArg: func() interface{} {
					var ret [1]PingArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.Ping(ctx)
					return
				},
			},
			"ping2": {
				MakeArg: func() interface{} {
					var ret [1]Ping2Arg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.Ping2(ctx)
					return
				},
			},
			"getLatestFolderHandle": {
				MakeArg: func() interface{} {
					var ret [1]GetLatestFolderHandleArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetLatestFolderHandleArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetLatestFolderHandleArg)(nil), args)
						return
					}
					ret, err = i.GetLatestFolderHandle(ctx, typedArgs[0].FolderID)
					return
				},
			},
			"getKeyBundles": {
				MakeArg: func() interface{} {
					var ret [1]GetKeyBundlesArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetKeyBundlesArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetKeyBundlesArg)(nil), args)
						return
					}
					ret, err = i.GetKeyBundles(ctx, typedArgs[0])
					return
				},
			},
			"lock": {
				MakeArg: func() interface{} {
					var ret [1]LockArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LockArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LockArg)(nil), args)
						return
					}
					err = i.Lock(ctx, typedArgs[0])
					return
				},
			},
			"releaseLock": {
				MakeArg: func() interface{} {
					var ret [1]ReleaseLockArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ReleaseLockArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ReleaseLockArg)(nil), args)
						return
					}
					err = i.ReleaseLock(ctx, typedArgs[0])
					return
				},
			},
			"startImplicitTeamMigration": {
				MakeArg: func() interface{} {
					var ret [1]StartImplicitTeamMigrationArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]StartImplicitTeamMigrationArg)
					if !ok {
						err = rpc.NewTypeError((*[1]StartImplicitTeamMigrationArg)(nil), args)
						return
					}
					err = i.StartImplicitTeamMigration(ctx, typedArgs[0].FolderID)
					return
				},
			},
			"getMerkleRoot": {
				MakeArg: func() interface{} {
					var ret [1]GetMerkleRootArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetMerkleRootArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetMerkleRootArg)(nil), args)
						return
					}
					ret, err = i.GetMerkleRoot(ctx, typedArgs[0])
					return
				},
			},
			"getMerkleRootLatest": {
				MakeArg: func() interface{} {
					var ret [1]GetMerkleRootLatestArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetMerkleRootLatestArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetMerkleRootLatestArg)(nil), args)
						return
					}
					ret, err = i.GetMerkleRootLatest(ctx, typedArgs[0].TreeID)
					return
				},
			},
			"getMerkleRootSince": {
				MakeArg: func() interface{} {
					var ret [1]GetMerkleRootSinceArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetMerkleRootSinceArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetMerkleRootSinceArg)(nil), args)
						return
					}
					ret, err = i.GetMerkleRootSince(ctx, typedArgs[0])
					return
				},
			},
			"getMerkleNode": {
				MakeArg: func() interface{} {
					var ret [1]GetMerkleNodeArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetMerkleNodeArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetMerkleNodeArg)(nil), args)
						return
					}
					ret, err = i.GetMerkleNode(ctx, typedArgs[0].Hash)
					return
				},
			},
			"findNextMD": {
				MakeArg: func() interface{} {
					var ret [1]FindNextMDArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FindNextMDArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FindNextMDArg)(nil), args)
						return
					}
					ret, err = i.FindNextMD(ctx, typedArgs[0])
					return
				},
			},
			"setImplicitTeamModeForTest": {
				MakeArg: func() interface{} {
					var ret [1]SetImplicitTeamModeForTestArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetImplicitTeamModeForTestArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetImplicitTeamModeForTestArg)(nil), args)
						return
					}
					err = i.SetImplicitTeamModeForTest(ctx, typedArgs[0].ImplicitTeamMode)
					return
				},
			},
			"forceMerkleBuildForTest": {
				MakeArg: func() interface{} {
					var ret [1]ForceMerkleBuildForTestArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.ForceMerkleBuildForTest(ctx)
					return
				},
			},
		},
	}
}

type MetadataClient struct {
	Cli rpc.GenericClient
}

func (c MetadataClient) GetChallenge(ctx context.Context) (res ChallengeInfo, err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.getChallenge", []interface{}{GetChallengeArg{}}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) Authenticate(ctx context.Context, signature string) (res int, err error) {
	__arg := AuthenticateArg{Signature: signature}
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.authenticate", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) PutMetadata(ctx context.Context, __arg PutMetadataArg) (err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.putMetadata", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) GetMetadata(ctx context.Context, __arg GetMetadataArg) (res MetadataResponse, err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.getMetadata", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) GetMetadataByTimestamp(ctx context.Context, __arg GetMetadataByTimestampArg) (res MDBlock, err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.getMetadataByTimestamp", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) RegisterForUpdates(ctx context.Context, __arg RegisterForUpdatesArg) (err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.registerForUpdates", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) PruneBranch(ctx context.Context, __arg PruneBranchArg) (err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.pruneBranch", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) PutKeys(ctx context.Context, __arg PutKeysArg) (err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.putKeys", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) GetKey(ctx context.Context, __arg GetKeyArg) (res []byte, err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.getKey", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) DeleteKey(ctx context.Context, __arg DeleteKeyArg) (err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.deleteKey", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) TruncateLock(ctx context.Context, folderID string) (res bool, err error) {
	__arg := TruncateLockArg{FolderID: folderID}
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.truncateLock", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) TruncateUnlock(ctx context.Context, folderID string) (res bool, err error) {
	__arg := TruncateUnlockArg{FolderID: folderID}
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.truncateUnlock", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) GetFolderHandle(ctx context.Context, __arg GetFolderHandleArg) (res []byte, err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.getFolderHandle", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) GetFoldersForRekey(ctx context.Context, deviceKID KID) (err error) {
	__arg := GetFoldersForRekeyArg{DeviceKID: deviceKID}
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.getFoldersForRekey", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) Ping(ctx context.Context) (err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.ping", []interface{}{PingArg{}}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) Ping2(ctx context.Context) (res PingResponse, err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.ping2", []interface{}{Ping2Arg{}}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) GetLatestFolderHandle(ctx context.Context, folderID string) (res []byte, err error) {
	__arg := GetLatestFolderHandleArg{FolderID: folderID}
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.getLatestFolderHandle", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) GetKeyBundles(ctx context.Context, __arg GetKeyBundlesArg) (res KeyBundleResponse, err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.getKeyBundles", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) Lock(ctx context.Context, __arg LockArg) (err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.lock", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) ReleaseLock(ctx context.Context, __arg ReleaseLockArg) (err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.releaseLock", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) StartImplicitTeamMigration(ctx context.Context, folderID string) (err error) {
	__arg := StartImplicitTeamMigrationArg{FolderID: folderID}
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.startImplicitTeamMigration", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) GetMerkleRoot(ctx context.Context, __arg GetMerkleRootArg) (res MerkleRoot, err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.getMerkleRoot", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) GetMerkleRootLatest(ctx context.Context, treeID MerkleTreeID) (res MerkleRoot, err error) {
	__arg := GetMerkleRootLatestArg{TreeID: treeID}
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.getMerkleRootLatest", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) GetMerkleRootSince(ctx context.Context, __arg GetMerkleRootSinceArg) (res MerkleRoot, err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.getMerkleRootSince", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) GetMerkleNode(ctx context.Context, hash string) (res []byte, err error) {
	__arg := GetMerkleNodeArg{Hash: hash}
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.getMerkleNode", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) FindNextMD(ctx context.Context, __arg FindNextMDArg) (res FindNextMDResponse, err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.findNextMD", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) SetImplicitTeamModeForTest(ctx context.Context, implicitTeamMode string) (err error) {
	__arg := SetImplicitTeamModeForTestArg{ImplicitTeamMode: implicitTeamMode}
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.setImplicitTeamModeForTest", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataClient) ForceMerkleBuildForTest(ctx context.Context) (err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadata.forceMerkleBuildForTest", []interface{}{ForceMerkleBuildForTestArg{}}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}
