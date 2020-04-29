// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/ctl.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type ExitCode int

const (
	ExitCode_OK      ExitCode = 0
	ExitCode_NOTOK   ExitCode = 2
	ExitCode_RESTART ExitCode = 4
)

func (o ExitCode) DeepCopy() ExitCode { return o }

var ExitCodeMap = map[string]ExitCode{
	"OK":      0,
	"NOTOK":   2,
	"RESTART": 4,
}

var ExitCodeRevMap = map[ExitCode]string{
	0: "OK",
	2: "NOTOK",
	4: "RESTART",
}

func (e ExitCode) String() string {
	if v, ok := ExitCodeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type DbType int

const (
	DbType_MAIN                     DbType = 0
	DbType_CHAT                     DbType = 1
	DbType_FS_BLOCK_CACHE           DbType = 2
	DbType_FS_BLOCK_CACHE_META      DbType = 3
	DbType_FS_SYNC_BLOCK_CACHE      DbType = 4
	DbType_FS_SYNC_BLOCK_CACHE_META DbType = 5
)

func (o DbType) DeepCopy() DbType { return o }

var DbTypeMap = map[string]DbType{
	"MAIN":                     0,
	"CHAT":                     1,
	"FS_BLOCK_CACHE":           2,
	"FS_BLOCK_CACHE_META":      3,
	"FS_SYNC_BLOCK_CACHE":      4,
	"FS_SYNC_BLOCK_CACHE_META": 5,
}

var DbTypeRevMap = map[DbType]string{
	0: "MAIN",
	1: "CHAT",
	2: "FS_BLOCK_CACHE",
	3: "FS_BLOCK_CACHE_META",
	4: "FS_SYNC_BLOCK_CACHE",
	5: "FS_SYNC_BLOCK_CACHE_META",
}

func (e DbType) String() string {
	if v, ok := DbTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type DbKey struct {
	DbType  DbType `codec:"dbType" json:"dbType"`
	ObjType int    `codec:"objType" json:"objType"`
	Key     string `codec:"key" json:"key"`
}

func (o DbKey) DeepCopy() DbKey {
	return DbKey{
		DbType:  o.DbType.DeepCopy(),
		ObjType: o.ObjType,
		Key:     o.Key,
	}
}

type DbValue []byte

func (o DbValue) DeepCopy() DbValue {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type OnLoginStartupStatus int

const (
	OnLoginStartupStatus_UNKNOWN  OnLoginStartupStatus = 0
	OnLoginStartupStatus_DISABLED OnLoginStartupStatus = 1
	OnLoginStartupStatus_ENABLED  OnLoginStartupStatus = 2
)

func (o OnLoginStartupStatus) DeepCopy() OnLoginStartupStatus { return o }

var OnLoginStartupStatusMap = map[string]OnLoginStartupStatus{
	"UNKNOWN":  0,
	"DISABLED": 1,
	"ENABLED":  2,
}

var OnLoginStartupStatusRevMap = map[OnLoginStartupStatus]string{
	0: "UNKNOWN",
	1: "DISABLED",
	2: "ENABLED",
}

func (e OnLoginStartupStatus) String() string {
	if v, ok := OnLoginStartupStatusRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type StopArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	ExitCode  ExitCode `codec:"exitCode" json:"exitCode"`
}

type StopServiceArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	ExitCode  ExitCode `codec:"exitCode" json:"exitCode"`
}

type LogRotateArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type ReloadArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type DbNukeArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type DbCleanArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Force     bool   `codec:"force" json:"force"`
	DbType    DbType `codec:"dbType" json:"dbType"`
}

type AppExitArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type DbDeleteArg struct {
	SessionID int   `codec:"sessionID" json:"sessionID"`
	Key       DbKey `codec:"key" json:"key"`
}

type DbPutArg struct {
	SessionID int     `codec:"sessionID" json:"sessionID"`
	Key       DbKey   `codec:"key" json:"key"`
	Value     DbValue `codec:"value" json:"value"`
}

type DbGetArg struct {
	SessionID int   `codec:"sessionID" json:"sessionID"`
	Key       DbKey `codec:"key" json:"key"`
}

type DbKeysWithPrefixesArg struct {
	SessionID int   `codec:"sessionID" json:"sessionID"`
	Prefix    DbKey `codec:"prefix" json:"prefix"`
}

type SetOnLoginStartupArg struct {
	Enabled bool `codec:"enabled" json:"enabled"`
}

type GetOnLoginStartupArg struct {
}

type CtlInterface interface {
	Stop(context.Context, StopArg) error
	StopService(context.Context, StopServiceArg) error
	LogRotate(context.Context, int) error
	Reload(context.Context, int) error
	DbNuke(context.Context, int) error
	DbClean(context.Context, DbCleanArg) error
	AppExit(context.Context, int) error
	DbDelete(context.Context, DbDeleteArg) error
	DbPut(context.Context, DbPutArg) error
	DbGet(context.Context, DbGetArg) (*DbValue, error)
	DbKeysWithPrefixes(context.Context, DbKeysWithPrefixesArg) ([]DbKey, error)
	SetOnLoginStartup(context.Context, bool) error
	GetOnLoginStartup(context.Context) (OnLoginStartupStatus, error)
}

func CtlProtocol(i CtlInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.ctl",
		Methods: map[string]rpc.ServeHandlerDescription{
			"stop": {
				MakeArg: func() interface{} {
					var ret [1]StopArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]StopArg)
					if !ok {
						err = rpc.NewTypeError((*[1]StopArg)(nil), args)
						return
					}
					err = i.Stop(ctx, typedArgs[0])
					return
				},
			},
			"stopService": {
				MakeArg: func() interface{} {
					var ret [1]StopServiceArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]StopServiceArg)
					if !ok {
						err = rpc.NewTypeError((*[1]StopServiceArg)(nil), args)
						return
					}
					err = i.StopService(ctx, typedArgs[0])
					return
				},
			},
			"logRotate": {
				MakeArg: func() interface{} {
					var ret [1]LogRotateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LogRotateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LogRotateArg)(nil), args)
						return
					}
					err = i.LogRotate(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"reload": {
				MakeArg: func() interface{} {
					var ret [1]ReloadArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ReloadArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ReloadArg)(nil), args)
						return
					}
					err = i.Reload(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"dbNuke": {
				MakeArg: func() interface{} {
					var ret [1]DbNukeArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DbNukeArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DbNukeArg)(nil), args)
						return
					}
					err = i.DbNuke(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"dbClean": {
				MakeArg: func() interface{} {
					var ret [1]DbCleanArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DbCleanArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DbCleanArg)(nil), args)
						return
					}
					err = i.DbClean(ctx, typedArgs[0])
					return
				},
			},
			"appExit": {
				MakeArg: func() interface{} {
					var ret [1]AppExitArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AppExitArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AppExitArg)(nil), args)
						return
					}
					err = i.AppExit(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"dbDelete": {
				MakeArg: func() interface{} {
					var ret [1]DbDeleteArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DbDeleteArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DbDeleteArg)(nil), args)
						return
					}
					err = i.DbDelete(ctx, typedArgs[0])
					return
				},
			},
			"dbPut": {
				MakeArg: func() interface{} {
					var ret [1]DbPutArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DbPutArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DbPutArg)(nil), args)
						return
					}
					err = i.DbPut(ctx, typedArgs[0])
					return
				},
			},
			"dbGet": {
				MakeArg: func() interface{} {
					var ret [1]DbGetArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DbGetArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DbGetArg)(nil), args)
						return
					}
					ret, err = i.DbGet(ctx, typedArgs[0])
					return
				},
			},
			"dbKeysWithPrefixes": {
				MakeArg: func() interface{} {
					var ret [1]DbKeysWithPrefixesArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DbKeysWithPrefixesArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DbKeysWithPrefixesArg)(nil), args)
						return
					}
					ret, err = i.DbKeysWithPrefixes(ctx, typedArgs[0])
					return
				},
			},
			"setOnLoginStartup": {
				MakeArg: func() interface{} {
					var ret [1]SetOnLoginStartupArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetOnLoginStartupArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetOnLoginStartupArg)(nil), args)
						return
					}
					err = i.SetOnLoginStartup(ctx, typedArgs[0].Enabled)
					return
				},
			},
			"getOnLoginStartup": {
				MakeArg: func() interface{} {
					var ret [1]GetOnLoginStartupArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetOnLoginStartup(ctx)
					return
				},
			},
		},
	}
}

type CtlClient struct {
	Cli rpc.GenericClient
}

func (c CtlClient) Stop(ctx context.Context, __arg StopArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.ctl.stop", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c CtlClient) StopService(ctx context.Context, __arg StopServiceArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.ctl.stopService", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c CtlClient) LogRotate(ctx context.Context, sessionID int) (err error) {
	__arg := LogRotateArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.ctl.logRotate", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c CtlClient) Reload(ctx context.Context, sessionID int) (err error) {
	__arg := ReloadArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.ctl.reload", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c CtlClient) DbNuke(ctx context.Context, sessionID int) (err error) {
	__arg := DbNukeArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.ctl.dbNuke", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c CtlClient) DbClean(ctx context.Context, __arg DbCleanArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.ctl.dbClean", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c CtlClient) AppExit(ctx context.Context, sessionID int) (err error) {
	__arg := AppExitArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.ctl.appExit", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c CtlClient) DbDelete(ctx context.Context, __arg DbDeleteArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.ctl.dbDelete", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c CtlClient) DbPut(ctx context.Context, __arg DbPutArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.ctl.dbPut", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c CtlClient) DbGet(ctx context.Context, __arg DbGetArg) (res *DbValue, err error) {
	err = c.Cli.Call(ctx, "keybase.1.ctl.dbGet", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c CtlClient) DbKeysWithPrefixes(ctx context.Context, __arg DbKeysWithPrefixesArg) (res []DbKey, err error) {
	err = c.Cli.Call(ctx, "keybase.1.ctl.dbKeysWithPrefixes", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c CtlClient) SetOnLoginStartup(ctx context.Context, enabled bool) (err error) {
	__arg := SetOnLoginStartupArg{Enabled: enabled}
	err = c.Cli.Call(ctx, "keybase.1.ctl.setOnLoginStartup", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c CtlClient) GetOnLoginStartup(ctx context.Context) (res OnLoginStartupStatus, err error) {
	err = c.Cli.Call(ctx, "keybase.1.ctl.getOnLoginStartup", []interface{}{GetOnLoginStartupArg{}}, &res, 0*time.Millisecond)
	return
}
