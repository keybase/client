// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_device_clone.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type DeviceCloneCountChangedArg struct {
	NewClones int `codec:"newClones" json:"newClones"`
}

type NotifyDeviceCloneInterface interface {
	DeviceCloneCountChanged(context.Context, int) error
}

func NotifyDeviceCloneProtocol(i NotifyDeviceCloneInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyDeviceClone",
		Methods: map[string]rpc.ServeHandlerDescription{
			"deviceCloneCountChanged": {
				MakeArg: func() interface{} {
					var ret [1]DeviceCloneCountChangedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DeviceCloneCountChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DeviceCloneCountChangedArg)(nil), args)
						return
					}
					err = i.DeviceCloneCountChanged(ctx, typedArgs[0].NewClones)
					return
				},
			},
		},
	}
}

type NotifyDeviceCloneClient struct {
	Cli rpc.GenericClient
}

func (c NotifyDeviceCloneClient) DeviceCloneCountChanged(ctx context.Context, newClones int) (err error) {
	__arg := DeviceCloneCountChangedArg{NewClones: newClones}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyDeviceClone.deviceCloneCountChanged", []interface{}{__arg}, 0*time.Millisecond)
	return
}
