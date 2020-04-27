// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/metadata_update.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type RekeyRequest struct {
	FolderID string `codec:"folderID" json:"folderID"`
	Revision int64  `codec:"revision" json:"revision"`
}

func (o RekeyRequest) DeepCopy() RekeyRequest {
	return RekeyRequest{
		FolderID: o.FolderID,
		Revision: o.Revision,
	}
}

type MetadataUpdateArg struct {
	FolderID string `codec:"folderID" json:"folderID"`
	Revision int64  `codec:"revision" json:"revision"`
}

type FolderNeedsRekeyArg struct {
	FolderID string `codec:"folderID" json:"folderID"`
	Revision int64  `codec:"revision" json:"revision"`
}

type FoldersNeedRekeyArg struct {
	Requests []RekeyRequest `codec:"requests" json:"requests"`
}

type MetadataUpdateInterface interface {
	MetadataUpdate(context.Context, MetadataUpdateArg) error
	FolderNeedsRekey(context.Context, FolderNeedsRekeyArg) error
	FoldersNeedRekey(context.Context, []RekeyRequest) error
}

func MetadataUpdateProtocol(i MetadataUpdateInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.metadataUpdate",
		Methods: map[string]rpc.ServeHandlerDescription{
			"metadataUpdate": {
				MakeArg: func() interface{} {
					var ret [1]MetadataUpdateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]MetadataUpdateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]MetadataUpdateArg)(nil), args)
						return
					}
					err = i.MetadataUpdate(ctx, typedArgs[0])
					return
				},
			},
			"folderNeedsRekey": {
				MakeArg: func() interface{} {
					var ret [1]FolderNeedsRekeyArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FolderNeedsRekeyArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FolderNeedsRekeyArg)(nil), args)
						return
					}
					err = i.FolderNeedsRekey(ctx, typedArgs[0])
					return
				},
			},
			"foldersNeedRekey": {
				MakeArg: func() interface{} {
					var ret [1]FoldersNeedRekeyArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FoldersNeedRekeyArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FoldersNeedRekeyArg)(nil), args)
						return
					}
					err = i.FoldersNeedRekey(ctx, typedArgs[0].Requests)
					return
				},
			},
		},
	}
}

type MetadataUpdateClient struct {
	Cli rpc.GenericClient
}

func (c MetadataUpdateClient) MetadataUpdate(ctx context.Context, __arg MetadataUpdateArg) (err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadataUpdate.metadataUpdate", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataUpdateClient) FolderNeedsRekey(ctx context.Context, __arg FolderNeedsRekeyArg) (err error) {
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadataUpdate.folderNeedsRekey", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c MetadataUpdateClient) FoldersNeedRekey(ctx context.Context, requests []RekeyRequest) (err error) {
	__arg := FoldersNeedRekeyArg{Requests: requests}
	err = c.Cli.CallCompressed(ctx, "keybase.1.metadataUpdate.foldersNeedRekey", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}
