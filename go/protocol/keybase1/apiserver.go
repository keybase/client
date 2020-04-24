// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/apiserver.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type APIRes struct {
	Status     string `codec:"status" json:"status"`
	Body       string `codec:"body" json:"body"`
	HttpStatus int    `codec:"httpStatus" json:"httpStatus"`
	AppStatus  string `codec:"appStatus" json:"appStatus"`
}

func (o APIRes) DeepCopy() APIRes {
	return APIRes{
		Status:     o.Status,
		Body:       o.Body,
		HttpStatus: o.HttpStatus,
		AppStatus:  o.AppStatus,
	}
}

type GetArg struct {
	Endpoint      string         `codec:"endpoint" json:"endpoint"`
	Args          []StringKVPair `codec:"args" json:"args"`
	HttpStatus    []int          `codec:"httpStatus" json:"httpStatus"`
	AppStatusCode []int          `codec:"appStatusCode" json:"appStatusCode"`
}

type DeleteArg struct {
	Endpoint      string         `codec:"endpoint" json:"endpoint"`
	Args          []StringKVPair `codec:"args" json:"args"`
	HttpStatus    []int          `codec:"httpStatus" json:"httpStatus"`
	AppStatusCode []int          `codec:"appStatusCode" json:"appStatusCode"`
}

type GetWithSessionArg struct {
	Endpoint      string         `codec:"endpoint" json:"endpoint"`
	Args          []StringKVPair `codec:"args" json:"args"`
	HttpStatus    []int          `codec:"httpStatus" json:"httpStatus"`
	AppStatusCode []int          `codec:"appStatusCode" json:"appStatusCode"`
	UseText       *bool          `codec:"useText,omitempty" json:"useText,omitempty"`
}

type PostArg struct {
	Endpoint      string         `codec:"endpoint" json:"endpoint"`
	Args          []StringKVPair `codec:"args" json:"args"`
	HttpStatus    []int          `codec:"httpStatus" json:"httpStatus"`
	AppStatusCode []int          `codec:"appStatusCode" json:"appStatusCode"`
}

type PostJSONArg struct {
	Endpoint      string         `codec:"endpoint" json:"endpoint"`
	Args          []StringKVPair `codec:"args" json:"args"`
	JSONPayload   []StringKVPair `codec:"JSONPayload" json:"JSONPayload"`
	HttpStatus    []int          `codec:"httpStatus" json:"httpStatus"`
	AppStatusCode []int          `codec:"appStatusCode" json:"appStatusCode"`
}

type ApiserverInterface interface {
	Get(context.Context, GetArg) (APIRes, error)
	Delete(context.Context, DeleteArg) (APIRes, error)
	GetWithSession(context.Context, GetWithSessionArg) (APIRes, error)
	Post(context.Context, PostArg) (APIRes, error)
	PostJSON(context.Context, PostJSONArg) (APIRes, error)
}

func ApiserverProtocol(i ApiserverInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.apiserver",
		Methods: map[string]rpc.ServeHandlerDescription{
			"Get": {
				MakeArg: func() interface{} {
					var ret [1]GetArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetArg)(nil), args)
						return
					}
					ret, err = i.Get(ctx, typedArgs[0])
					return
				},
			},
			"Delete": {
				MakeArg: func() interface{} {
					var ret [1]DeleteArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DeleteArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DeleteArg)(nil), args)
						return
					}
					ret, err = i.Delete(ctx, typedArgs[0])
					return
				},
			},
			"GetWithSession": {
				MakeArg: func() interface{} {
					var ret [1]GetWithSessionArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetWithSessionArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetWithSessionArg)(nil), args)
						return
					}
					ret, err = i.GetWithSession(ctx, typedArgs[0])
					return
				},
			},
			"Post": {
				MakeArg: func() interface{} {
					var ret [1]PostArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PostArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PostArg)(nil), args)
						return
					}
					ret, err = i.Post(ctx, typedArgs[0])
					return
				},
			},
			"PostJSON": {
				MakeArg: func() interface{} {
					var ret [1]PostJSONArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PostJSONArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PostJSONArg)(nil), args)
						return
					}
					ret, err = i.PostJSON(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type ApiserverClient struct {
	Cli rpc.GenericClient
}

func (c ApiserverClient) Get(ctx context.Context, __arg GetArg) (res APIRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.apiserver.Get", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ApiserverClient) Delete(ctx context.Context, __arg DeleteArg) (res APIRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.apiserver.Delete", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ApiserverClient) GetWithSession(ctx context.Context, __arg GetWithSessionArg) (res APIRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.apiserver.GetWithSession", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ApiserverClient) Post(ctx context.Context, __arg PostArg) (res APIRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.apiserver.Post", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ApiserverClient) PostJSON(ctx context.Context, __arg PostJSONArg) (res APIRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.apiserver.PostJSON", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
