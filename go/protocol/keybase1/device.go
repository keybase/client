// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/device.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type DeviceDetail struct {
	Device          Device  `codec:"device" json:"device"`
	Eldest          bool    `codec:"eldest" json:"eldest"`
	Provisioner     *Device `codec:"provisioner,omitempty" json:"provisioner,omitempty"`
	ProvisionedAt   *Time   `codec:"provisionedAt,omitempty" json:"provisionedAt,omitempty"`
	RevokedAt       *Time   `codec:"revokedAt,omitempty" json:"revokedAt,omitempty"`
	RevokedBy       KID     `codec:"revokedBy" json:"revokedBy"`
	RevokedByDevice *Device `codec:"revokedByDevice,omitempty" json:"revokedByDevice,omitempty"`
	CurrentDevice   bool    `codec:"currentDevice" json:"currentDevice"`
}

func (o DeviceDetail) DeepCopy() DeviceDetail {
	return DeviceDetail{
		Device: o.Device.DeepCopy(),
		Eldest: o.Eldest,
		Provisioner: (func(x *Device) *Device {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Provisioner),
		ProvisionedAt: (func(x *Time) *Time {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ProvisionedAt),
		RevokedAt: (func(x *Time) *Time {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RevokedAt),
		RevokedBy: o.RevokedBy.DeepCopy(),
		RevokedByDevice: (func(x *Device) *Device {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RevokedByDevice),
		CurrentDevice: o.CurrentDevice,
	}
}

type DeviceListArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type DeviceHistoryListArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type DeviceAddArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type CheckDeviceNameFormatArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Name      string `codec:"name" json:"name"`
}

type DismissDeviceChangeNotificationsArg struct {
}

type CheckDeviceNameForUserArg struct {
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	Username   string `codec:"username" json:"username"`
	Devicename string `codec:"devicename" json:"devicename"`
}

type DeviceInterface interface {
	// List devices for the user.
	DeviceList(context.Context, int) ([]Device, error)
	// List all devices with detailed history and status information.
	DeviceHistoryList(context.Context, int) ([]DeviceDetail, error)
	// Starts the process of adding a new device using an existing
	// device.  It is called on the existing device.
	// This is for kex2.
	DeviceAdd(context.Context, int) error
	// Checks the device name format.
	CheckDeviceNameFormat(context.Context, CheckDeviceNameFormatArg) (bool, error)
	// Dismisses the notifications for a new or revoked device
	// assuming this is not that device.
	DismissDeviceChangeNotifications(context.Context) error
	// Checks a given device against all of user's past devices,
	// including those that predate a reset. It will also check a device name
	// for proper formatting. Return null error on success, and a non-null
	// error otherwise.
	CheckDeviceNameForUser(context.Context, CheckDeviceNameForUserArg) error
}

func DeviceProtocol(i DeviceInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.device",
		Methods: map[string]rpc.ServeHandlerDescription{
			"deviceList": {
				MakeArg: func() interface{} {
					var ret [1]DeviceListArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DeviceListArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DeviceListArg)(nil), args)
						return
					}
					ret, err = i.DeviceList(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"deviceHistoryList": {
				MakeArg: func() interface{} {
					var ret [1]DeviceHistoryListArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DeviceHistoryListArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DeviceHistoryListArg)(nil), args)
						return
					}
					ret, err = i.DeviceHistoryList(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"deviceAdd": {
				MakeArg: func() interface{} {
					var ret [1]DeviceAddArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DeviceAddArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DeviceAddArg)(nil), args)
						return
					}
					err = i.DeviceAdd(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"checkDeviceNameFormat": {
				MakeArg: func() interface{} {
					var ret [1]CheckDeviceNameFormatArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CheckDeviceNameFormatArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CheckDeviceNameFormatArg)(nil), args)
						return
					}
					ret, err = i.CheckDeviceNameFormat(ctx, typedArgs[0])
					return
				},
			},
			"dismissDeviceChangeNotifications": {
				MakeArg: func() interface{} {
					var ret [1]DismissDeviceChangeNotificationsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.DismissDeviceChangeNotifications(ctx)
					return
				},
			},
			"checkDeviceNameForUser": {
				MakeArg: func() interface{} {
					var ret [1]CheckDeviceNameForUserArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CheckDeviceNameForUserArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CheckDeviceNameForUserArg)(nil), args)
						return
					}
					err = i.CheckDeviceNameForUser(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type DeviceClient struct {
	Cli rpc.GenericClient
}

// List devices for the user.
func (c DeviceClient) DeviceList(ctx context.Context, sessionID int) (res []Device, err error) {
	__arg := DeviceListArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.device.deviceList", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// List all devices with detailed history and status information.
func (c DeviceClient) DeviceHistoryList(ctx context.Context, sessionID int) (res []DeviceDetail, err error) {
	__arg := DeviceHistoryListArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.device.deviceHistoryList", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// Starts the process of adding a new device using an existing
// device.  It is called on the existing device.
// This is for kex2.
func (c DeviceClient) DeviceAdd(ctx context.Context, sessionID int) (err error) {
	__arg := DeviceAddArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.device.deviceAdd", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// Checks the device name format.
func (c DeviceClient) CheckDeviceNameFormat(ctx context.Context, __arg CheckDeviceNameFormatArg) (res bool, err error) {
	err = c.Cli.Call(ctx, "keybase.1.device.checkDeviceNameFormat", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// Dismisses the notifications for a new or revoked device
// assuming this is not that device.
func (c DeviceClient) DismissDeviceChangeNotifications(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.device.dismissDeviceChangeNotifications", []interface{}{DismissDeviceChangeNotificationsArg{}}, nil, 0*time.Millisecond)
	return
}

// Checks a given device against all of user's past devices,
// including those that predate a reset. It will also check a device name
// for proper formatting. Return null error on success, and a non-null
// error otherwise.
func (c DeviceClient) CheckDeviceNameForUser(ctx context.Context, __arg CheckDeviceNameForUserArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.device.checkDeviceNameForUser", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
