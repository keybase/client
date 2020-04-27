// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/ui.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type PromptDefault int

const (
	PromptDefault_NONE PromptDefault = 0
	PromptDefault_YES  PromptDefault = 1
	PromptDefault_NO   PromptDefault = 2
)

func (o PromptDefault) DeepCopy() PromptDefault { return o }

var PromptDefaultMap = map[string]PromptDefault{
	"NONE": 0,
	"YES":  1,
	"NO":   2,
}

var PromptDefaultRevMap = map[PromptDefault]string{
	0: "NONE",
	1: "YES",
	2: "NO",
}

func (e PromptDefault) String() string {
	if v, ok := PromptDefaultRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type PromptYesNoArg struct {
	SessionID     int           `codec:"sessionID" json:"sessionID"`
	Text          Text          `codec:"text" json:"text"`
	PromptDefault PromptDefault `codec:"promptDefault" json:"promptDefault"`
}

type UiInterface interface {
	PromptYesNo(context.Context, PromptYesNoArg) (bool, error)
}

func UiProtocol(i UiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.ui",
		Methods: map[string]rpc.ServeHandlerDescription{
			"promptYesNo": {
				MakeArg: func() interface{} {
					var ret [1]PromptYesNoArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PromptYesNoArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PromptYesNoArg)(nil), args)
						return
					}
					ret, err = i.PromptYesNo(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type UiClient struct {
	Cli rpc.GenericClient
}

func (c UiClient) PromptYesNo(ctx context.Context, __arg PromptYesNoArg) (res bool, err error) {
	err = c.Cli.Call(ctx, "keybase.1.ui.promptYesNo", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
