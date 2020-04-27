// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/kbfsmount.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type GetCurrentMountDirArg struct {
}

type WaitForMountsArg struct {
}

type GetPreferredMountDirsArg struct {
}

type GetAllAvailableMountDirsArg struct {
}

type SetCurrentMountDirArg struct {
	Dir string `codec:"dir" json:"dir"`
}

type GetKBFSPathInfoArg struct {
	StandardPath string `codec:"standardPath" json:"standardPath"`
}

type KbfsMountInterface interface {
	GetCurrentMountDir(context.Context) (string, error)
	WaitForMounts(context.Context) (bool, error)
	GetPreferredMountDirs(context.Context) ([]string, error)
	GetAllAvailableMountDirs(context.Context) ([]string, error)
	SetCurrentMountDir(context.Context, string) error
	GetKBFSPathInfo(context.Context, string) (KBFSPathInfo, error)
}

func KbfsMountProtocol(i KbfsMountInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.kbfsMount",
		Methods: map[string]rpc.ServeHandlerDescription{
			"GetCurrentMountDir": {
				MakeArg: func() interface{} {
					var ret [1]GetCurrentMountDirArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetCurrentMountDir(ctx)
					return
				},
			},
			"WaitForMounts": {
				MakeArg: func() interface{} {
					var ret [1]WaitForMountsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.WaitForMounts(ctx)
					return
				},
			},
			"GetPreferredMountDirs": {
				MakeArg: func() interface{} {
					var ret [1]GetPreferredMountDirsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetPreferredMountDirs(ctx)
					return
				},
			},
			"GetAllAvailableMountDirs": {
				MakeArg: func() interface{} {
					var ret [1]GetAllAvailableMountDirsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetAllAvailableMountDirs(ctx)
					return
				},
			},
			"SetCurrentMountDir": {
				MakeArg: func() interface{} {
					var ret [1]SetCurrentMountDirArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetCurrentMountDirArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetCurrentMountDirArg)(nil), args)
						return
					}
					err = i.SetCurrentMountDir(ctx, typedArgs[0].Dir)
					return
				},
			},
			"GetKBFSPathInfo": {
				MakeArg: func() interface{} {
					var ret [1]GetKBFSPathInfoArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetKBFSPathInfoArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetKBFSPathInfoArg)(nil), args)
						return
					}
					ret, err = i.GetKBFSPathInfo(ctx, typedArgs[0].StandardPath)
					return
				},
			},
		},
	}
}

type KbfsMountClient struct {
	Cli rpc.GenericClient
}

func (c KbfsMountClient) GetCurrentMountDir(ctx context.Context) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.kbfsMount.GetCurrentMountDir", []interface{}{GetCurrentMountDirArg{}}, &res, 0*time.Millisecond)
	return
}

func (c KbfsMountClient) WaitForMounts(ctx context.Context) (res bool, err error) {
	err = c.Cli.Call(ctx, "keybase.1.kbfsMount.WaitForMounts", []interface{}{WaitForMountsArg{}}, &res, 0*time.Millisecond)
	return
}

func (c KbfsMountClient) GetPreferredMountDirs(ctx context.Context) (res []string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.kbfsMount.GetPreferredMountDirs", []interface{}{GetPreferredMountDirsArg{}}, &res, 0*time.Millisecond)
	return
}

func (c KbfsMountClient) GetAllAvailableMountDirs(ctx context.Context) (res []string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.kbfsMount.GetAllAvailableMountDirs", []interface{}{GetAllAvailableMountDirsArg{}}, &res, 0*time.Millisecond)
	return
}

func (c KbfsMountClient) SetCurrentMountDir(ctx context.Context, dir string) (err error) {
	__arg := SetCurrentMountDirArg{Dir: dir}
	err = c.Cli.Call(ctx, "keybase.1.kbfsMount.SetCurrentMountDir", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c KbfsMountClient) GetKBFSPathInfo(ctx context.Context, standardPath string) (res KBFSPathInfo, err error) {
	__arg := GetKBFSPathInfoArg{StandardPath: standardPath}
	err = c.Cli.Call(ctx, "keybase.1.kbfsMount.GetKBFSPathInfo", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
