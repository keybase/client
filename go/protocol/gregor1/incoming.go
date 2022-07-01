// Auto-generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/gregor1/incoming.avdl

package gregor1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type SyncResult struct {
	Msgs []InBandMessage `codec:"msgs" json:"msgs"`
	Hash []byte          `codec:"hash" json:"hash"`
}

func (o SyncResult) DeepCopy() SyncResult {
	return SyncResult{
		Msgs: (func(x []InBandMessage) []InBandMessage {
			if x == nil {
				return nil
			}
			ret := make([]InBandMessage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Msgs),
		Hash: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Hash),
	}
}

// DescribeConnectedUsers will take a list of users, and return the list of users
// which are connected to any Gregor in the cluster, and what devices (and device type)
// those users are connected with.
type ConnectedDevice struct {
	DeviceID       DeviceID `codec:"deviceID" json:"deviceID"`
	DeviceType     string   `codec:"deviceType" json:"deviceType"`
	DevicePlatform string   `codec:"devicePlatform" json:"devicePlatform"`
	UserAgent      string   `codec:"userAgent" json:"userAgent"`
}

func (o ConnectedDevice) DeepCopy() ConnectedDevice {
	return ConnectedDevice{
		DeviceID:       o.DeviceID.DeepCopy(),
		DeviceType:     o.DeviceType,
		DevicePlatform: o.DevicePlatform,
		UserAgent:      o.UserAgent,
	}
}

type ConnectedUser struct {
	Uid     UID               `codec:"uid" json:"uid"`
	Devices []ConnectedDevice `codec:"devices" json:"devices"`
}

func (o ConnectedUser) DeepCopy() ConnectedUser {
	return ConnectedUser{
		Uid: o.Uid.DeepCopy(),
		Devices: (func(x []ConnectedDevice) []ConnectedDevice {
			if x == nil {
				return nil
			}
			ret := make([]ConnectedDevice, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Devices),
	}
}

type SyncArg struct {
	Uid      UID      `codec:"uid" json:"uid"`
	Deviceid DeviceID `codec:"deviceid" json:"deviceid"`
	Ctime    Time     `codec:"ctime" json:"ctime"`
}

type ConsumeMessageArg struct {
	M Message `codec:"m" json:"m"`
}

type ConsumePublishMessageArg struct {
	M Message `codec:"m" json:"m"`
}

type ConsumeMessageMultiArg struct {
	Msg  Message `codec:"msg" json:"msg"`
	Uids []UID   `codec:"uids" json:"uids"`
}

type PingArg struct {
}

type VersionArg struct {
	Uid UID `codec:"uid" json:"uid"`
}

type StateArg struct {
	Uid          UID          `codec:"uid" json:"uid"`
	Deviceid     DeviceID     `codec:"deviceid" json:"deviceid"`
	TimeOrOffset TimeOrOffset `codec:"timeOrOffset" json:"timeOrOffset"`
}

type StateByCategoryPrefixArg struct {
	Uid            UID          `codec:"uid" json:"uid"`
	Deviceid       DeviceID     `codec:"deviceid" json:"deviceid"`
	TimeOrOffset   TimeOrOffset `codec:"timeOrOffset" json:"timeOrOffset"`
	CategoryPrefix Category     `codec:"categoryPrefix" json:"categoryPrefix"`
}

type DescribeConnectedUsersArg struct {
	Uids []UID `codec:"uids" json:"uids"`
}

type DescribeConnectedUsersInternalArg struct {
	Uids []UID `codec:"uids" json:"uids"`
}

type IncomingInterface interface {
	Sync(context.Context, SyncArg) (SyncResult, error)
	ConsumeMessage(context.Context, Message) error
	ConsumePublishMessage(context.Context, Message) error
	// consumeMessageMulti will take msg and consume it for all the users listed
	// in uids. This is so a gregor client can send the same message to many UIDs
	// with one call, as opposed to calling consumeMessage for each UID.
	ConsumeMessageMulti(context.Context, ConsumeMessageMultiArg) error
	Ping(context.Context) (string, error)
	Version(context.Context, UID) (string, error)
	State(context.Context, StateArg) (State, error)
	// StateByCategoryPrefix loads the messages of the user's state whose
	// categories are prefixed by the given prefix
	StateByCategoryPrefix(context.Context, StateByCategoryPrefixArg) (State, error)
	DescribeConnectedUsers(context.Context, []UID) ([]ConnectedUser, error)
	DescribeConnectedUsersInternal(context.Context, []UID) ([]ConnectedUser, error)
}

func IncomingProtocol(i IncomingInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "gregor.1.incoming",
		Methods: map[string]rpc.ServeHandlerDescription{
			"sync": {
				MakeArg: func() interface{} {
					var ret [1]SyncArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SyncArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SyncArg)(nil), args)
						return
					}
					ret, err = i.Sync(ctx, typedArgs[0])
					return
				},
			},
			"consumeMessage": {
				MakeArg: func() interface{} {
					var ret [1]ConsumeMessageArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ConsumeMessageArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ConsumeMessageArg)(nil), args)
						return
					}
					err = i.ConsumeMessage(ctx, typedArgs[0].M)
					return
				},
			},
			"consumePublishMessage": {
				MakeArg: func() interface{} {
					var ret [1]ConsumePublishMessageArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ConsumePublishMessageArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ConsumePublishMessageArg)(nil), args)
						return
					}
					err = i.ConsumePublishMessage(ctx, typedArgs[0].M)
					return
				},
			},
			"consumeMessageMulti": {
				MakeArg: func() interface{} {
					var ret [1]ConsumeMessageMultiArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ConsumeMessageMultiArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ConsumeMessageMultiArg)(nil), args)
						return
					}
					err = i.ConsumeMessageMulti(ctx, typedArgs[0])
					return
				},
			},
			"ping": {
				MakeArg: func() interface{} {
					var ret [1]PingArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.Ping(ctx)
					return
				},
			},
			"version": {
				MakeArg: func() interface{} {
					var ret [1]VersionArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]VersionArg)
					if !ok {
						err = rpc.NewTypeError((*[1]VersionArg)(nil), args)
						return
					}
					ret, err = i.Version(ctx, typedArgs[0].Uid)
					return
				},
			},
			"state": {
				MakeArg: func() interface{} {
					var ret [1]StateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]StateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]StateArg)(nil), args)
						return
					}
					ret, err = i.State(ctx, typedArgs[0])
					return
				},
			},
			"stateByCategoryPrefix": {
				MakeArg: func() interface{} {
					var ret [1]StateByCategoryPrefixArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]StateByCategoryPrefixArg)
					if !ok {
						err = rpc.NewTypeError((*[1]StateByCategoryPrefixArg)(nil), args)
						return
					}
					ret, err = i.StateByCategoryPrefix(ctx, typedArgs[0])
					return
				},
			},
			"describeConnectedUsers": {
				MakeArg: func() interface{} {
					var ret [1]DescribeConnectedUsersArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DescribeConnectedUsersArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DescribeConnectedUsersArg)(nil), args)
						return
					}
					ret, err = i.DescribeConnectedUsers(ctx, typedArgs[0].Uids)
					return
				},
			},
			"describeConnectedUsersInternal": {
				MakeArg: func() interface{} {
					var ret [1]DescribeConnectedUsersInternalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DescribeConnectedUsersInternalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DescribeConnectedUsersInternalArg)(nil), args)
						return
					}
					ret, err = i.DescribeConnectedUsersInternal(ctx, typedArgs[0].Uids)
					return
				},
			},
		},
	}
}

type IncomingClient struct {
	Cli rpc.GenericClient
}

func (c IncomingClient) Sync(ctx context.Context, __arg SyncArg) (res SyncResult, err error) {
	err = c.Cli.CallCompressed(ctx, "gregor.1.incoming.sync", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c IncomingClient) ConsumeMessage(ctx context.Context, m Message) (err error) {
	__arg := ConsumeMessageArg{M: m}
	err = c.Cli.CallCompressed(ctx, "gregor.1.incoming.consumeMessage", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c IncomingClient) ConsumePublishMessage(ctx context.Context, m Message) (err error) {
	__arg := ConsumePublishMessageArg{M: m}
	err = c.Cli.CallCompressed(ctx, "gregor.1.incoming.consumePublishMessage", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

// consumeMessageMulti will take msg and consume it for all the users listed
// in uids. This is so a gregor client can send the same message to many UIDs
// with one call, as opposed to calling consumeMessage for each UID.
func (c IncomingClient) ConsumeMessageMulti(ctx context.Context, __arg ConsumeMessageMultiArg) (err error) {
	err = c.Cli.CallCompressed(ctx, "gregor.1.incoming.consumeMessageMulti", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c IncomingClient) Ping(ctx context.Context) (res string, err error) {
	err = c.Cli.Call(ctx, "gregor.1.incoming.ping", []interface{}{PingArg{}}, &res, 0*time.Millisecond)
	return
}

func (c IncomingClient) Version(ctx context.Context, uid UID) (res string, err error) {
	__arg := VersionArg{Uid: uid}
	err = c.Cli.CallCompressed(ctx, "gregor.1.incoming.version", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c IncomingClient) State(ctx context.Context, __arg StateArg) (res State, err error) {
	err = c.Cli.CallCompressed(ctx, "gregor.1.incoming.state", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

// StateByCategoryPrefix loads the messages of the user's state whose
// categories are prefixed by the given prefix
func (c IncomingClient) StateByCategoryPrefix(ctx context.Context, __arg StateByCategoryPrefixArg) (res State, err error) {
	err = c.Cli.CallCompressed(ctx, "gregor.1.incoming.stateByCategoryPrefix", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c IncomingClient) DescribeConnectedUsers(ctx context.Context, uids []UID) (res []ConnectedUser, err error) {
	__arg := DescribeConnectedUsersArg{Uids: uids}
	err = c.Cli.CallCompressed(ctx, "gregor.1.incoming.describeConnectedUsers", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

func (c IncomingClient) DescribeConnectedUsersInternal(ctx context.Context, uids []UID) (res []ConnectedUser, err error) {
	__arg := DescribeConnectedUsersInternalArg{Uids: uids}
	err = c.Cli.CallCompressed(ctx, "gregor.1.incoming.describeConnectedUsersInternal", []interface{}{__arg}, &res, rpc.CompressionGzip, 0*time.Millisecond)
	return
}
