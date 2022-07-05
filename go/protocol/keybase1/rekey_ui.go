// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/rekey_ui.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type RekeyEventType int

const (
	RekeyEventType_NONE                     RekeyEventType = 0
	RekeyEventType_NOT_LOGGED_IN            RekeyEventType = 1
	RekeyEventType_API_ERROR                RekeyEventType = 2
	RekeyEventType_NO_PROBLEMS              RekeyEventType = 3
	RekeyEventType_LOAD_ME_ERROR            RekeyEventType = 4
	RekeyEventType_CURRENT_DEVICE_CAN_REKEY RekeyEventType = 5
	RekeyEventType_DEVICE_LOAD_ERROR        RekeyEventType = 6
	RekeyEventType_HARASS                   RekeyEventType = 7
	RekeyEventType_NO_GREGOR_MESSAGES       RekeyEventType = 8
)

func (o RekeyEventType) DeepCopy() RekeyEventType { return o }

var RekeyEventTypeMap = map[string]RekeyEventType{
	"NONE":                     0,
	"NOT_LOGGED_IN":            1,
	"API_ERROR":                2,
	"NO_PROBLEMS":              3,
	"LOAD_ME_ERROR":            4,
	"CURRENT_DEVICE_CAN_REKEY": 5,
	"DEVICE_LOAD_ERROR":        6,
	"HARASS":                   7,
	"NO_GREGOR_MESSAGES":       8,
}

var RekeyEventTypeRevMap = map[RekeyEventType]string{
	0: "NONE",
	1: "NOT_LOGGED_IN",
	2: "API_ERROR",
	3: "NO_PROBLEMS",
	4: "LOAD_ME_ERROR",
	5: "CURRENT_DEVICE_CAN_REKEY",
	6: "DEVICE_LOAD_ERROR",
	7: "HARASS",
	8: "NO_GREGOR_MESSAGES",
}

func (e RekeyEventType) String() string {
	if v, ok := RekeyEventTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type RekeyEvent struct {
	EventType     RekeyEventType `codec:"eventType" json:"eventType"`
	InterruptType int            `codec:"interruptType" json:"interruptType"`
}

func (o RekeyEvent) DeepCopy() RekeyEvent {
	return RekeyEvent{
		EventType:     o.EventType.DeepCopy(),
		InterruptType: o.InterruptType,
	}
}

type DelegateRekeyUIArg struct {
}

type RefreshArg struct {
	SessionID         int               `codec:"sessionID" json:"sessionID"`
	ProblemSetDevices ProblemSetDevices `codec:"problemSetDevices" json:"problemSetDevices"`
}

type RekeySendEventArg struct {
	SessionID int        `codec:"sessionID" json:"sessionID"`
	Event     RekeyEvent `codec:"event" json:"event"`
}

type RekeyUIInterface interface {
	DelegateRekeyUI(context.Context) (int, error)
	// Refresh is called whenever Electron should refresh the UI, either
	// because a change came in, or because there was a timeout poll.
	Refresh(context.Context, RefreshArg) error
	// RekeySendEvent sends updates as to what's going on in the rekey
	// thread. This is mainly useful in testing.
	RekeySendEvent(context.Context, RekeySendEventArg) error
}

func RekeyUIProtocol(i RekeyUIInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.rekeyUI",
		Methods: map[string]rpc.ServeHandlerDescription{
			"delegateRekeyUI": {
				MakeArg: func() interface{} {
					var ret [1]DelegateRekeyUIArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.DelegateRekeyUI(ctx)
					return
				},
			},
			"refresh": {
				MakeArg: func() interface{} {
					var ret [1]RefreshArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RefreshArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RefreshArg)(nil), args)
						return
					}
					err = i.Refresh(ctx, typedArgs[0])
					return
				},
			},
			"rekeySendEvent": {
				MakeArg: func() interface{} {
					var ret [1]RekeySendEventArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RekeySendEventArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RekeySendEventArg)(nil), args)
						return
					}
					err = i.RekeySendEvent(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type RekeyUIClient struct {
	Cli rpc.GenericClient
}

func (c RekeyUIClient) DelegateRekeyUI(ctx context.Context) (res int, err error) {
	err = c.Cli.Call(ctx, "keybase.1.rekeyUI.delegateRekeyUI", []interface{}{DelegateRekeyUIArg{}}, &res, 0*time.Millisecond)
	return
}

// Refresh is called whenever Electron should refresh the UI, either
// because a change came in, or because there was a timeout poll.
func (c RekeyUIClient) Refresh(ctx context.Context, __arg RefreshArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.rekeyUI.refresh", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// RekeySendEvent sends updates as to what's going on in the rekey
// thread. This is mainly useful in testing.
func (c RekeyUIClient) RekeySendEvent(ctx context.Context, __arg RekeySendEventArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.rekeyUI.rekeySendEvent", []interface{}{__arg}, 0*time.Millisecond)
	return
}
