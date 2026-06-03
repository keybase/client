// Code generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler). DO NOT EDIT.
//   Input file: avdl/keybase1/notify_device_history.avdl

package keybase1

import (
	"context"
	"time"

	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type DeviceHistoryChangedArg struct {
}

type NotifyDeviceHistoryInterface interface {
	DeviceHistoryChanged(context.Context) error
}

func NotifyDeviceHistoryProtocol(i NotifyDeviceHistoryInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyDeviceHistory",
		Methods: map[string]rpc.ServeHandlerDescription{
			"deviceHistoryChanged": {
				MakeArg: func() any {
					var ret [1]DeviceHistoryChangedArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					err = i.DeviceHistoryChanged(ctx)
					return
				},
			},
		},
	}
}

type NotifyDeviceHistoryClient struct {
	Cli rpc.GenericClient
}

func (c NotifyDeviceHistoryClient) DeviceHistoryChanged(ctx context.Context) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyDeviceHistory.deviceHistoryChanged", []any{DeviceHistoryChangedArg{}}, 0*time.Millisecond)
	return
}
