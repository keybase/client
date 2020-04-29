// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/implicit_team_migration.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type StartMigrationArg struct {
	Folder Folder `codec:"folder" json:"folder"`
}

type FinalizeMigrationArg struct {
	Folder Folder `codec:"folder" json:"folder"`
}

type ImplicitTeamMigrationInterface interface {
	StartMigration(context.Context, Folder) error
	FinalizeMigration(context.Context, Folder) error
}

func ImplicitTeamMigrationProtocol(i ImplicitTeamMigrationInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.implicitTeamMigration",
		Methods: map[string]rpc.ServeHandlerDescription{
			"startMigration": {
				MakeArg: func() interface{} {
					var ret [1]StartMigrationArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]StartMigrationArg)
					if !ok {
						err = rpc.NewTypeError((*[1]StartMigrationArg)(nil), args)
						return
					}
					err = i.StartMigration(ctx, typedArgs[0].Folder)
					return
				},
			},
			"finalizeMigration": {
				MakeArg: func() interface{} {
					var ret [1]FinalizeMigrationArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FinalizeMigrationArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FinalizeMigrationArg)(nil), args)
						return
					}
					err = i.FinalizeMigration(ctx, typedArgs[0].Folder)
					return
				},
			},
		},
	}
}

type ImplicitTeamMigrationClient struct {
	Cli rpc.GenericClient
}

func (c ImplicitTeamMigrationClient) StartMigration(ctx context.Context, folder Folder) (err error) {
	__arg := StartMigrationArg{Folder: folder}
	err = c.Cli.Call(ctx, "keybase.1.implicitTeamMigration.startMigration", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c ImplicitTeamMigrationClient) FinalizeMigration(ctx context.Context, folder Folder) (err error) {
	__arg := FinalizeMigrationArg{Folder: folder}
	err = c.Cli.Call(ctx, "keybase.1.implicitTeamMigration.finalizeMigration", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
