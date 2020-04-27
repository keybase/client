// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_tracking.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type TrackingChangedArg struct {
	Uid        UID    `codec:"uid" json:"uid"`
	Username   string `codec:"username" json:"username"`
	IsTracking bool   `codec:"isTracking" json:"isTracking"`
}

type TrackingInfoArg struct {
	Uid       UID      `codec:"uid" json:"uid"`
	Followers []string `codec:"followers" json:"followers"`
	Followees []string `codec:"followees" json:"followees"`
}

type NotifyUserBlockedArg struct {
	B UserBlockedSummary `codec:"b" json:"b"`
}

type NotifyTrackingInterface interface {
	TrackingChanged(context.Context, TrackingChangedArg) error
	TrackingInfo(context.Context, TrackingInfoArg) error
	NotifyUserBlocked(context.Context, UserBlockedSummary) error
}

func NotifyTrackingProtocol(i NotifyTrackingInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyTracking",
		Methods: map[string]rpc.ServeHandlerDescription{
			"trackingChanged": {
				MakeArg: func() interface{} {
					var ret [1]TrackingChangedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TrackingChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TrackingChangedArg)(nil), args)
						return
					}
					err = i.TrackingChanged(ctx, typedArgs[0])
					return
				},
			},
			"trackingInfo": {
				MakeArg: func() interface{} {
					var ret [1]TrackingInfoArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TrackingInfoArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TrackingInfoArg)(nil), args)
						return
					}
					err = i.TrackingInfo(ctx, typedArgs[0])
					return
				},
			},
			"notifyUserBlocked": {
				MakeArg: func() interface{} {
					var ret [1]NotifyUserBlockedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]NotifyUserBlockedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]NotifyUserBlockedArg)(nil), args)
						return
					}
					err = i.NotifyUserBlocked(ctx, typedArgs[0].B)
					return
				},
			},
		},
	}
}

type NotifyTrackingClient struct {
	Cli rpc.GenericClient
}

func (c NotifyTrackingClient) TrackingChanged(ctx context.Context, __arg TrackingChangedArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyTracking.trackingChanged", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyTrackingClient) TrackingInfo(ctx context.Context, __arg TrackingInfoArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyTracking.trackingInfo", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyTrackingClient) NotifyUserBlocked(ctx context.Context, b UserBlockedSummary) (err error) {
	__arg := NotifyUserBlockedArg{B: b}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyTracking.notifyUserBlocked", []interface{}{__arg}, 0*time.Millisecond)
	return
}
