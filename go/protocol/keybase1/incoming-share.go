// Auto-generated to Go types and interfaces using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/incoming-share.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type IncomingShareType int

const (
	IncomingShareType_FILE  IncomingShareType = 0
	IncomingShareType_TEXT  IncomingShareType = 1
	IncomingShareType_IMAGE IncomingShareType = 2
)

func (o IncomingShareType) DeepCopy() IncomingShareType { return o }

var IncomingShareTypeMap = map[string]IncomingShareType{
	"FILE":  0,
	"TEXT":  1,
	"IMAGE": 2,
}

var IncomingShareTypeRevMap = map[IncomingShareType]string{
	0: "FILE",
	1: "TEXT",
	2: "IMAGE",
}

func (e IncomingShareType) String() string {
	if v, ok := IncomingShareTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type IncomingShareItem struct {
	Type        IncomingShareType `codec:"type" json:"type"`
	PayloadPath string            `codec:"payloadPath" json:"payloadPath"`
	Filename    *string           `codec:"filename,omitempty" json:"filename,omitempty"`
}

func (o IncomingShareItem) DeepCopy() IncomingShareItem {
	return IncomingShareItem{
		Type:        o.Type.DeepCopy(),
		PayloadPath: o.PayloadPath,
		Filename: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Filename),
	}
}

type GetIncomingShareItemsArg struct {
}

type IncomingShareInterface interface {
	GetIncomingShareItems(context.Context) ([]IncomingShareItem, error)
}

func IncomingShareProtocol(i IncomingShareInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.incomingShare",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getIncomingShareItems": {
				MakeArg: func() interface{} {
					var ret [1]GetIncomingShareItemsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetIncomingShareItems(ctx)
					return
				},
			},
		},
	}
}

type IncomingShareClient struct {
	Cli rpc.GenericClient
}

func (c IncomingShareClient) GetIncomingShareItems(ctx context.Context) (res []IncomingShareItem, err error) {
	err = c.Cli.Call(ctx, "keybase.1.incomingShare.getIncomingShareItems", []interface{}{GetIncomingShareItemsArg{}}, &res, 0*time.Millisecond)
	return
}
