// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/appstate.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type MobileAppState int

const (
	MobileAppState_FOREGROUND       MobileAppState = 0
	MobileAppState_BACKGROUND       MobileAppState = 1
	MobileAppState_INACTIVE         MobileAppState = 2
	MobileAppState_BACKGROUNDACTIVE MobileAppState = 3
)

func (o MobileAppState) DeepCopy() MobileAppState { return o }

var MobileAppStateMap = map[string]MobileAppState{
	"FOREGROUND":       0,
	"BACKGROUND":       1,
	"INACTIVE":         2,
	"BACKGROUNDACTIVE": 3,
}

var MobileAppStateRevMap = map[MobileAppState]string{
	0: "FOREGROUND",
	1: "BACKGROUND",
	2: "INACTIVE",
	3: "BACKGROUNDACTIVE",
}

func (e MobileAppState) String() string {
	if v, ok := MobileAppStateRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type MobileNetworkState int

const (
	MobileNetworkState_NONE         MobileNetworkState = 0
	MobileNetworkState_WIFI         MobileNetworkState = 1
	MobileNetworkState_CELLULAR     MobileNetworkState = 2
	MobileNetworkState_UNKNOWN      MobileNetworkState = 3
	MobileNetworkState_NOTAVAILABLE MobileNetworkState = 4
)

func (o MobileNetworkState) DeepCopy() MobileNetworkState { return o }

var MobileNetworkStateMap = map[string]MobileNetworkState{
	"NONE":         0,
	"WIFI":         1,
	"CELLULAR":     2,
	"UNKNOWN":      3,
	"NOTAVAILABLE": 4,
}

var MobileNetworkStateRevMap = map[MobileNetworkState]string{
	0: "NONE",
	1: "WIFI",
	2: "CELLULAR",
	3: "UNKNOWN",
	4: "NOTAVAILABLE",
}

func (e MobileNetworkState) String() string {
	if v, ok := MobileNetworkStateRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UpdateMobileNetStateArg struct {
	State string `codec:"state" json:"state"`
}

type PowerMonitorEventArg struct {
	Event string `codec:"event" json:"event"`
}

type AppStateInterface interface {
	UpdateMobileNetState(context.Context, string) error
	PowerMonitorEvent(context.Context, string) error
}

func AppStateProtocol(i AppStateInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.appState",
		Methods: map[string]rpc.ServeHandlerDescription{
			"updateMobileNetState": {
				MakeArg: func() interface{} {
					var ret [1]UpdateMobileNetStateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UpdateMobileNetStateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UpdateMobileNetStateArg)(nil), args)
						return
					}
					err = i.UpdateMobileNetState(ctx, typedArgs[0].State)
					return
				},
			},
			"powerMonitorEvent": {
				MakeArg: func() interface{} {
					var ret [1]PowerMonitorEventArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PowerMonitorEventArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PowerMonitorEventArg)(nil), args)
						return
					}
					err = i.PowerMonitorEvent(ctx, typedArgs[0].Event)
					return
				},
			},
		},
	}
}

type AppStateClient struct {
	Cli rpc.GenericClient
}

func (c AppStateClient) UpdateMobileNetState(ctx context.Context, state string) (err error) {
	__arg := UpdateMobileNetStateArg{State: state}
	err = c.Cli.Call(ctx, "keybase.1.appState.updateMobileNetState", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c AppStateClient) PowerMonitorEvent(ctx context.Context, event string) (err error) {
	__arg := PowerMonitorEventArg{Event: event}
	err = c.Cli.Call(ctx, "keybase.1.appState.powerMonitorEvent", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
