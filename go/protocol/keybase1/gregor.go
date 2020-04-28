// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/gregor.avdl

package keybase1

import (
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type GetStateArg struct {
}

type InjectItemArg struct {
	Cat   string               `codec:"cat" json:"cat"`
	Body  string               `codec:"body" json:"body"`
	Dtime gregor1.TimeOrOffset `codec:"dtime" json:"dtime"`
}

type DismissCategoryArg struct {
	Category gregor1.Category `codec:"category" json:"category"`
}

type DismissItemArg struct {
	Id gregor1.MsgID `codec:"id" json:"id"`
}

type UpdateItemArg struct {
	MsgID gregor1.MsgID        `codec:"msgID" json:"msgID"`
	Cat   string               `codec:"cat" json:"cat"`
	Body  string               `codec:"body" json:"body"`
	Dtime gregor1.TimeOrOffset `codec:"dtime" json:"dtime"`
}

type UpdateCategoryArg struct {
	Category string               `codec:"category" json:"category"`
	Body     string               `codec:"body" json:"body"`
	Dtime    gregor1.TimeOrOffset `codec:"dtime" json:"dtime"`
}

type GregorInterface interface {
	GetState(context.Context) (gregor1.State, error)
	InjectItem(context.Context, InjectItemArg) (gregor1.MsgID, error)
	DismissCategory(context.Context, gregor1.Category) error
	DismissItem(context.Context, gregor1.MsgID) error
	UpdateItem(context.Context, UpdateItemArg) (gregor1.MsgID, error)
	UpdateCategory(context.Context, UpdateCategoryArg) (gregor1.MsgID, error)
}

func GregorProtocol(i GregorInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.gregor",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getState": {
				MakeArg: func() interface{} {
					var ret [1]GetStateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetState(ctx)
					return
				},
			},
			"injectItem": {
				MakeArg: func() interface{} {
					var ret [1]InjectItemArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]InjectItemArg)
					if !ok {
						err = rpc.NewTypeError((*[1]InjectItemArg)(nil), args)
						return
					}
					ret, err = i.InjectItem(ctx, typedArgs[0])
					return
				},
			},
			"dismissCategory": {
				MakeArg: func() interface{} {
					var ret [1]DismissCategoryArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DismissCategoryArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DismissCategoryArg)(nil), args)
						return
					}
					err = i.DismissCategory(ctx, typedArgs[0].Category)
					return
				},
			},
			"dismissItem": {
				MakeArg: func() interface{} {
					var ret [1]DismissItemArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DismissItemArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DismissItemArg)(nil), args)
						return
					}
					err = i.DismissItem(ctx, typedArgs[0].Id)
					return
				},
			},
			"updateItem": {
				MakeArg: func() interface{} {
					var ret [1]UpdateItemArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UpdateItemArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UpdateItemArg)(nil), args)
						return
					}
					ret, err = i.UpdateItem(ctx, typedArgs[0])
					return
				},
			},
			"updateCategory": {
				MakeArg: func() interface{} {
					var ret [1]UpdateCategoryArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UpdateCategoryArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UpdateCategoryArg)(nil), args)
						return
					}
					ret, err = i.UpdateCategory(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type GregorClient struct {
	Cli rpc.GenericClient
}

func (c GregorClient) GetState(ctx context.Context) (res gregor1.State, err error) {
	err = c.Cli.Call(ctx, "keybase.1.gregor.getState", []interface{}{GetStateArg{}}, &res, 0*time.Millisecond)
	return
}

func (c GregorClient) InjectItem(ctx context.Context, __arg InjectItemArg) (res gregor1.MsgID, err error) {
	err = c.Cli.Call(ctx, "keybase.1.gregor.injectItem", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c GregorClient) DismissCategory(ctx context.Context, category gregor1.Category) (err error) {
	__arg := DismissCategoryArg{Category: category}
	err = c.Cli.Call(ctx, "keybase.1.gregor.dismissCategory", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c GregorClient) DismissItem(ctx context.Context, id gregor1.MsgID) (err error) {
	__arg := DismissItemArg{Id: id}
	err = c.Cli.Call(ctx, "keybase.1.gregor.dismissItem", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c GregorClient) UpdateItem(ctx context.Context, __arg UpdateItemArg) (res gregor1.MsgID, err error) {
	err = c.Cli.Call(ctx, "keybase.1.gregor.updateItem", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c GregorClient) UpdateCategory(ctx context.Context, __arg UpdateCategoryArg) (res gregor1.MsgID, err error) {
	err = c.Cli.Call(ctx, "keybase.1.gregor.updateCategory", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
