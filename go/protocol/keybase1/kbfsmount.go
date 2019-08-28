// Auto-generated types and interfaces using avdl-compiler v1.4.1 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/kbfsmount.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
)

type GetCurrentMountDirArg struct {
}

type GetPreferredMountDirsArg struct {
}

type GetAllAvailableMountDirsArg struct {
}

type SetCurrentMountDirArg struct {
	Dir string `codec:"dir" json:"dir"`
}

type KbfsMountInterface interface {
	GetCurrentMountDir(context.Context) (string, error)
	GetPreferredMountDirs(context.Context) ([]string, error)
	GetAllAvailableMountDirs(context.Context) ([]string, error)
	SetCurrentMountDir(context.Context, string) error
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
		},
	}
}

type KbfsMountClient struct {
	Cli rpc.GenericClient
}

func (c KbfsMountClient) GetCurrentMountDir(ctx context.Context) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.kbfsMount.GetCurrentMountDir", []interface{}{GetCurrentMountDirArg{}}, &res)
	return
}

func (c KbfsMountClient) GetPreferredMountDirs(ctx context.Context) (res []string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.kbfsMount.GetPreferredMountDirs", []interface{}{GetPreferredMountDirsArg{}}, &res)
	return
}

func (c KbfsMountClient) GetAllAvailableMountDirs(ctx context.Context) (res []string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.kbfsMount.GetAllAvailableMountDirs", []interface{}{GetAllAvailableMountDirsArg{}}, &res)
	return
}

func (c KbfsMountClient) SetCurrentMountDir(ctx context.Context, dir string) (err error) {
	__arg := SetCurrentMountDirArg{Dir: dir}
	err = c.Cli.Call(ctx, "keybase.1.kbfsMount.SetCurrentMountDir", []interface{}{__arg}, nil)
	return
}
