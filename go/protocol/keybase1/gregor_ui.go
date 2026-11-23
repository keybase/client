// Code generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler). DO NOT EDIT.
//   Input file: avdl/keybase1/gregor_ui.avdl

package keybase1

import (
	"context"
	"fmt"
	"time"

	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type PushReason int

const (
	PushReason_NONE        PushReason = 0
	PushReason_RECONNECTED PushReason = 1
	PushReason_NEW_DATA    PushReason = 2
)

func (o PushReason) DeepCopy() PushReason { return o }

var PushReasonMap = map[string]PushReason{
	"NONE":        0,
	"RECONNECTED": 1,
	"NEW_DATA":    2,
}

var PushReasonRevMap = map[PushReason]string{
	0: "NONE",
	1: "RECONNECTED",
	2: "NEW_DATA",
}

func (o PushReason) String() string {
	if v, ok := PushReasonRevMap[o]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(o))
}

type GregorUIPrefs struct {
	PinnedConvs             []string            `codec:"pinnedConvs" json:"pinnedConvs"`
	ExplodingModes          map[string]int      `codec:"explodingModes" json:"explodingModes"`
	ChosenChannelsTeamnames []string            `codec:"chosenChannelsTeamnames" json:"chosenChannelsTeamnames"`
	BlockButtonsAdders      map[string]string   `codec:"blockButtonsAdders" json:"blockButtonsAdders"`
	TeamAccessRequests      map[string][]string `codec:"teamAccessRequests" json:"teamAccessRequests"`
	AllowAnimatedEmojis     bool                `codec:"allowAnimatedEmojis" json:"allowAnimatedEmojis"`
}

func (o GregorUIPrefs) DeepCopy() GregorUIPrefs {
	return GregorUIPrefs{
		PinnedConvs: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.PinnedConvs),
		ExplodingModes: (func(x map[string]int) map[string]int {
			if x == nil {
				return nil
			}
			ret := make(map[string]int, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := v
				ret[kCopy] = vCopy
			}
			return ret
		})(o.ExplodingModes),
		ChosenChannelsTeamnames: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.ChosenChannelsTeamnames),
		BlockButtonsAdders: (func(x map[string]string) map[string]string {
			if x == nil {
				return nil
			}
			ret := make(map[string]string, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := v
				ret[kCopy] = vCopy
			}
			return ret
		})(o.BlockButtonsAdders),
		TeamAccessRequests: (func(x map[string][]string) map[string][]string {
			if x == nil {
				return nil
			}
			ret := make(map[string][]string, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := (func(x []string) []string {
					if x == nil {
						return nil
					}
					ret := make([]string, len(x))
					for i, v := range x {
						vCopy := v
						ret[i] = vCopy
					}
					return ret
				})(v)
				ret[kCopy] = vCopy
			}
			return ret
		})(o.TeamAccessRequests),
		AllowAnimatedEmojis: o.AllowAnimatedEmojis,
	}
}

type PushStateArg struct {
	State  gregor1.State `codec:"state" json:"state"`
	Reason PushReason    `codec:"reason" json:"reason"`
}

type PushUIPrefsArg struct {
	Prefs GregorUIPrefs `codec:"prefs" json:"prefs"`
}

type PushOutOfBandMessagesArg struct {
	Oobm []gregor1.OutOfBandMessage `codec:"oobm" json:"oobm"`
}

type GregorUIInterface interface {
	PushState(context.Context, PushStateArg) error
	PushUIPrefs(context.Context, GregorUIPrefs) error
	PushOutOfBandMessages(context.Context, []gregor1.OutOfBandMessage) error
}

func GregorUIProtocol(i GregorUIInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.gregorUI",
		Methods: map[string]rpc.ServeHandlerDescription{
			"pushState": {
				MakeArg: func() any {
					var ret [1]PushStateArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					typedArgs, ok := args.(*[1]PushStateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PushStateArg)(nil), args)
						return
					}
					err = i.PushState(ctx, typedArgs[0])
					return
				},
			},
			"pushUIPrefs": {
				MakeArg: func() any {
					var ret [1]PushUIPrefsArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					typedArgs, ok := args.(*[1]PushUIPrefsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PushUIPrefsArg)(nil), args)
						return
					}
					err = i.PushUIPrefs(ctx, typedArgs[0].Prefs)
					return
				},
			},
			"pushOutOfBandMessages": {
				MakeArg: func() any {
					var ret [1]PushOutOfBandMessagesArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					typedArgs, ok := args.(*[1]PushOutOfBandMessagesArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PushOutOfBandMessagesArg)(nil), args)
						return
					}
					err = i.PushOutOfBandMessages(ctx, typedArgs[0].Oobm)
					return
				},
			},
		},
	}
}

type GregorUIClient struct {
	Cli rpc.GenericClient
}

func (c GregorUIClient) PushState(ctx context.Context, __arg PushStateArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.gregorUI.pushState", []any{__arg}, 0*time.Millisecond)
	return
}

func (c GregorUIClient) PushUIPrefs(ctx context.Context, prefs GregorUIPrefs) (err error) {
	__arg := PushUIPrefsArg{Prefs: prefs}
	err = c.Cli.Notify(ctx, "keybase.1.gregorUI.pushUIPrefs", []any{__arg}, 0*time.Millisecond)
	return
}

func (c GregorUIClient) PushOutOfBandMessages(ctx context.Context, oobm []gregor1.OutOfBandMessage) (err error) {
	__arg := PushOutOfBandMessagesArg{Oobm: oobm}
	err = c.Cli.Notify(ctx, "keybase.1.gregorUI.pushOutOfBandMessages", []any{__arg}, 0*time.Millisecond)
	return
}
