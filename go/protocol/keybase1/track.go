// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/track.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type TrackArg struct {
	SessionID        int          `codec:"sessionID" json:"sessionID"`
	UserAssertion    string       `codec:"userAssertion" json:"userAssertion"`
	Options          TrackOptions `codec:"options" json:"options"`
	ForceRemoteCheck bool         `codec:"forceRemoteCheck" json:"forceRemoteCheck"`
}

type TrackWithTokenArg struct {
	SessionID  int          `codec:"sessionID" json:"sessionID"`
	TrackToken TrackToken   `codec:"trackToken" json:"trackToken"`
	Options    TrackOptions `codec:"options" json:"options"`
}

type DismissWithTokenArg struct {
	SessionID  int        `codec:"sessionID" json:"sessionID"`
	TrackToken TrackToken `codec:"trackToken" json:"trackToken"`
}

type UntrackArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
}

type CheckTrackingArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type FakeTrackingChangedArg struct {
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	Username   string `codec:"username" json:"username"`
	IsTracking bool   `codec:"isTracking" json:"isTracking"`
}

type TrackInterface interface {
	// This will perform identify and track.
	// If forceRemoteCheck is true, we force all remote proofs to be checked
	// (otherwise a cache is used).
	Track(context.Context, TrackArg) (ConfirmResult, error)
	// Track with token returned from identify.
	TrackWithToken(context.Context, TrackWithTokenArg) error
	// Called by the UI when the user decides *not* to track, to e.g. dismiss gregor items.
	DismissWithToken(context.Context, DismissWithTokenArg) error
	Untrack(context.Context, UntrackArg) error
	CheckTracking(context.Context, int) error
	FakeTrackingChanged(context.Context, FakeTrackingChangedArg) error
}

func TrackProtocol(i TrackInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.track",
		Methods: map[string]rpc.ServeHandlerDescription{
			"track": {
				MakeArg: func() interface{} {
					var ret [1]TrackArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TrackArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TrackArg)(nil), args)
						return
					}
					ret, err = i.Track(ctx, typedArgs[0])
					return
				},
			},
			"trackWithToken": {
				MakeArg: func() interface{} {
					var ret [1]TrackWithTokenArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TrackWithTokenArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TrackWithTokenArg)(nil), args)
						return
					}
					err = i.TrackWithToken(ctx, typedArgs[0])
					return
				},
			},
			"dismissWithToken": {
				MakeArg: func() interface{} {
					var ret [1]DismissWithTokenArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DismissWithTokenArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DismissWithTokenArg)(nil), args)
						return
					}
					err = i.DismissWithToken(ctx, typedArgs[0])
					return
				},
			},
			"untrack": {
				MakeArg: func() interface{} {
					var ret [1]UntrackArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UntrackArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UntrackArg)(nil), args)
						return
					}
					err = i.Untrack(ctx, typedArgs[0])
					return
				},
			},
			"checkTracking": {
				MakeArg: func() interface{} {
					var ret [1]CheckTrackingArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CheckTrackingArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CheckTrackingArg)(nil), args)
						return
					}
					err = i.CheckTracking(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"fakeTrackingChanged": {
				MakeArg: func() interface{} {
					var ret [1]FakeTrackingChangedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FakeTrackingChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FakeTrackingChangedArg)(nil), args)
						return
					}
					err = i.FakeTrackingChanged(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type TrackClient struct {
	Cli rpc.GenericClient
}

// This will perform identify and track.
// If forceRemoteCheck is true, we force all remote proofs to be checked
// (otherwise a cache is used).
func (c TrackClient) Track(ctx context.Context, __arg TrackArg) (res ConfirmResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.track.track", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// Track with token returned from identify.
func (c TrackClient) TrackWithToken(ctx context.Context, __arg TrackWithTokenArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.track.trackWithToken", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// Called by the UI when the user decides *not* to track, to e.g. dismiss gregor items.
func (c TrackClient) DismissWithToken(ctx context.Context, __arg DismissWithTokenArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.track.dismissWithToken", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c TrackClient) Untrack(ctx context.Context, __arg UntrackArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.track.untrack", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c TrackClient) CheckTracking(ctx context.Context, sessionID int) (err error) {
	__arg := CheckTrackingArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.track.checkTracking", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c TrackClient) FakeTrackingChanged(ctx context.Context, __arg FakeTrackingChangedArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.track.fakeTrackingChanged", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
