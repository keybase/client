// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/identify3_ui.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type Identify3RowState int

const (
	Identify3RowState_CHECKING Identify3RowState = 1
	Identify3RowState_VALID    Identify3RowState = 2
	Identify3RowState_ERROR    Identify3RowState = 3
	Identify3RowState_WARNING  Identify3RowState = 4
	Identify3RowState_REVOKED  Identify3RowState = 5
)

func (o Identify3RowState) DeepCopy() Identify3RowState { return o }

var Identify3RowStateMap = map[string]Identify3RowState{
	"CHECKING": 1,
	"VALID":    2,
	"ERROR":    3,
	"WARNING":  4,
	"REVOKED":  5,
}

var Identify3RowStateRevMap = map[Identify3RowState]string{
	1: "CHECKING",
	2: "VALID",
	3: "ERROR",
	4: "WARNING",
	5: "REVOKED",
}

func (e Identify3RowState) String() string {
	if v, ok := Identify3RowStateRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type Identify3RowColor int

const (
	Identify3RowColor_BLUE   Identify3RowColor = 1
	Identify3RowColor_RED    Identify3RowColor = 2
	Identify3RowColor_BLACK  Identify3RowColor = 3
	Identify3RowColor_GREEN  Identify3RowColor = 4
	Identify3RowColor_GRAY   Identify3RowColor = 5
	Identify3RowColor_YELLOW Identify3RowColor = 6
	Identify3RowColor_ORANGE Identify3RowColor = 7
)

func (o Identify3RowColor) DeepCopy() Identify3RowColor { return o }

var Identify3RowColorMap = map[string]Identify3RowColor{
	"BLUE":   1,
	"RED":    2,
	"BLACK":  3,
	"GREEN":  4,
	"GRAY":   5,
	"YELLOW": 6,
	"ORANGE": 7,
}

var Identify3RowColorRevMap = map[Identify3RowColor]string{
	1: "BLUE",
	2: "RED",
	3: "BLACK",
	4: "GREEN",
	5: "GRAY",
	6: "YELLOW",
	7: "ORANGE",
}

func (e Identify3RowColor) String() string {
	if v, ok := Identify3RowColorRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type Identify3ResultType int

const (
	Identify3ResultType_OK            Identify3ResultType = 0
	Identify3ResultType_BROKEN        Identify3ResultType = 1
	Identify3ResultType_NEEDS_UPGRADE Identify3ResultType = 2
	Identify3ResultType_CANCELED      Identify3ResultType = 3
)

func (o Identify3ResultType) DeepCopy() Identify3ResultType { return o }

var Identify3ResultTypeMap = map[string]Identify3ResultType{
	"OK":            0,
	"BROKEN":        1,
	"NEEDS_UPGRADE": 2,
	"CANCELED":      3,
}

var Identify3ResultTypeRevMap = map[Identify3ResultType]string{
	0: "OK",
	1: "BROKEN",
	2: "NEEDS_UPGRADE",
	3: "CANCELED",
}

func (e Identify3ResultType) String() string {
	if v, ok := Identify3ResultTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type Identify3RowMeta struct {
	Color Identify3RowColor `codec:"color" json:"color"`
	Label string            `codec:"label" json:"label"`
}

func (o Identify3RowMeta) DeepCopy() Identify3RowMeta {
	return Identify3RowMeta{
		Color: o.Color.DeepCopy(),
		Label: o.Label,
	}
}

type Identify3Row struct {
	GuiID                Identify3GUIID     `codec:"guiID" json:"guiID"`
	Key                  string             `codec:"key" json:"key"`
	Value                string             `codec:"value" json:"value"`
	Priority             int                `codec:"priority" json:"priority"`
	SiteURL              string             `codec:"siteURL" json:"siteURL"`
	SiteIcon             []SizedImage       `codec:"siteIcon" json:"siteIcon"`
	SiteIconDarkmode     []SizedImage       `codec:"siteIconDarkmode" json:"siteIconDarkmode"`
	SiteIconFull         []SizedImage       `codec:"siteIconFull" json:"siteIconFull"`
	SiteIconFullDarkmode []SizedImage       `codec:"siteIconFullDarkmode" json:"siteIconFullDarkmode"`
	ProofURL             string             `codec:"proofURL" json:"proofURL"`
	SigID                SigID              `codec:"sigID" json:"sigID"`
	Ctime                Time               `codec:"ctime" json:"ctime"`
	State                Identify3RowState  `codec:"state" json:"state"`
	Metas                []Identify3RowMeta `codec:"metas" json:"metas"`
	Color                Identify3RowColor  `codec:"color" json:"color"`
	Kid                  *KID               `codec:"kid,omitempty" json:"kid,omitempty"`
	WotProof             *WotProof          `codec:"wotProof,omitempty" json:"wotProof,omitempty"`
}

func (o Identify3Row) DeepCopy() Identify3Row {
	return Identify3Row{
		GuiID:    o.GuiID.DeepCopy(),
		Key:      o.Key,
		Value:    o.Value,
		Priority: o.Priority,
		SiteURL:  o.SiteURL,
		SiteIcon: (func(x []SizedImage) []SizedImage {
			if x == nil {
				return nil
			}
			ret := make([]SizedImage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.SiteIcon),
		SiteIconDarkmode: (func(x []SizedImage) []SizedImage {
			if x == nil {
				return nil
			}
			ret := make([]SizedImage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.SiteIconDarkmode),
		SiteIconFull: (func(x []SizedImage) []SizedImage {
			if x == nil {
				return nil
			}
			ret := make([]SizedImage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.SiteIconFull),
		SiteIconFullDarkmode: (func(x []SizedImage) []SizedImage {
			if x == nil {
				return nil
			}
			ret := make([]SizedImage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.SiteIconFullDarkmode),
		ProofURL: o.ProofURL,
		SigID:    o.SigID.DeepCopy(),
		Ctime:    o.Ctime.DeepCopy(),
		State:    o.State.DeepCopy(),
		Metas: (func(x []Identify3RowMeta) []Identify3RowMeta {
			if x == nil {
				return nil
			}
			ret := make([]Identify3RowMeta, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Metas),
		Color: o.Color.DeepCopy(),
		Kid: (func(x *KID) *KID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Kid),
		WotProof: (func(x *WotProof) *WotProof {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.WotProof),
	}
}

type Identify3Summary struct {
	GuiID            Identify3GUIID `codec:"guiID" json:"guiID"`
	NumProofsToCheck int            `codec:"numProofsToCheck" json:"numProofsToCheck"`
}

func (o Identify3Summary) DeepCopy() Identify3Summary {
	return Identify3Summary{
		GuiID:            o.GuiID.DeepCopy(),
		NumProofsToCheck: o.NumProofsToCheck,
	}
}

type Identify3ShowTrackerArg struct {
	GuiID        Identify3GUIID     `codec:"guiID" json:"guiID"`
	Assertion    Identify3Assertion `codec:"assertion" json:"assertion"`
	Reason       IdentifyReason     `codec:"reason" json:"reason"`
	ForceDisplay bool               `codec:"forceDisplay" json:"forceDisplay"`
}

type Identify3SummaryArg struct {
	Summary Identify3Summary `codec:"summary" json:"summary"`
}

type Identify3UpdateRowArg struct {
	Row Identify3Row `codec:"row" json:"row"`
}

type Identify3UserResetArg struct {
	GuiID Identify3GUIID `codec:"guiID" json:"guiID"`
}

type Identify3UpdateUserCardArg struct {
	GuiID Identify3GUIID `codec:"guiID" json:"guiID"`
	Card  UserCard       `codec:"card" json:"card"`
}

type Identify3TrackerTimedOutArg struct {
	GuiID Identify3GUIID `codec:"guiID" json:"guiID"`
}

type Identify3ResultArg struct {
	GuiID  Identify3GUIID      `codec:"guiID" json:"guiID"`
	Result Identify3ResultType `codec:"result" json:"result"`
}

type Identify3UiInterface interface {
	Identify3ShowTracker(context.Context, Identify3ShowTrackerArg) error
	Identify3Summary(context.Context, Identify3Summary) error
	Identify3UpdateRow(context.Context, Identify3Row) error
	Identify3UserReset(context.Context, Identify3GUIID) error
	Identify3UpdateUserCard(context.Context, Identify3UpdateUserCardArg) error
	Identify3TrackerTimedOut(context.Context, Identify3GUIID) error
	Identify3Result(context.Context, Identify3ResultArg) error
}

func Identify3UiProtocol(i Identify3UiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.identify3Ui",
		Methods: map[string]rpc.ServeHandlerDescription{
			"identify3ShowTracker": {
				MakeArg: func() interface{} {
					var ret [1]Identify3ShowTrackerArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]Identify3ShowTrackerArg)
					if !ok {
						err = rpc.NewTypeError((*[1]Identify3ShowTrackerArg)(nil), args)
						return
					}
					err = i.Identify3ShowTracker(ctx, typedArgs[0])
					return
				},
			},
			"identify3Summary": {
				MakeArg: func() interface{} {
					var ret [1]Identify3SummaryArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]Identify3SummaryArg)
					if !ok {
						err = rpc.NewTypeError((*[1]Identify3SummaryArg)(nil), args)
						return
					}
					err = i.Identify3Summary(ctx, typedArgs[0].Summary)
					return
				},
			},
			"identify3UpdateRow": {
				MakeArg: func() interface{} {
					var ret [1]Identify3UpdateRowArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]Identify3UpdateRowArg)
					if !ok {
						err = rpc.NewTypeError((*[1]Identify3UpdateRowArg)(nil), args)
						return
					}
					err = i.Identify3UpdateRow(ctx, typedArgs[0].Row)
					return
				},
			},
			"identify3UserReset": {
				MakeArg: func() interface{} {
					var ret [1]Identify3UserResetArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]Identify3UserResetArg)
					if !ok {
						err = rpc.NewTypeError((*[1]Identify3UserResetArg)(nil), args)
						return
					}
					err = i.Identify3UserReset(ctx, typedArgs[0].GuiID)
					return
				},
			},
			"identify3UpdateUserCard": {
				MakeArg: func() interface{} {
					var ret [1]Identify3UpdateUserCardArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]Identify3UpdateUserCardArg)
					if !ok {
						err = rpc.NewTypeError((*[1]Identify3UpdateUserCardArg)(nil), args)
						return
					}
					err = i.Identify3UpdateUserCard(ctx, typedArgs[0])
					return
				},
			},
			"identify3TrackerTimedOut": {
				MakeArg: func() interface{} {
					var ret [1]Identify3TrackerTimedOutArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]Identify3TrackerTimedOutArg)
					if !ok {
						err = rpc.NewTypeError((*[1]Identify3TrackerTimedOutArg)(nil), args)
						return
					}
					err = i.Identify3TrackerTimedOut(ctx, typedArgs[0].GuiID)
					return
				},
			},
			"identify3Result": {
				MakeArg: func() interface{} {
					var ret [1]Identify3ResultArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]Identify3ResultArg)
					if !ok {
						err = rpc.NewTypeError((*[1]Identify3ResultArg)(nil), args)
						return
					}
					err = i.Identify3Result(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type Identify3UiClient struct {
	Cli rpc.GenericClient
}

func (c Identify3UiClient) Identify3ShowTracker(ctx context.Context, __arg Identify3ShowTrackerArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identify3Ui.identify3ShowTracker", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c Identify3UiClient) Identify3Summary(ctx context.Context, summary Identify3Summary) (err error) {
	__arg := Identify3SummaryArg{Summary: summary}
	err = c.Cli.Notify(ctx, "keybase.1.identify3Ui.identify3Summary", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c Identify3UiClient) Identify3UpdateRow(ctx context.Context, row Identify3Row) (err error) {
	__arg := Identify3UpdateRowArg{Row: row}
	err = c.Cli.Notify(ctx, "keybase.1.identify3Ui.identify3UpdateRow", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c Identify3UiClient) Identify3UserReset(ctx context.Context, guiID Identify3GUIID) (err error) {
	__arg := Identify3UserResetArg{GuiID: guiID}
	err = c.Cli.Notify(ctx, "keybase.1.identify3Ui.identify3UserReset", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c Identify3UiClient) Identify3UpdateUserCard(ctx context.Context, __arg Identify3UpdateUserCardArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.identify3Ui.identify3UpdateUserCard", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c Identify3UiClient) Identify3TrackerTimedOut(ctx context.Context, guiID Identify3GUIID) (err error) {
	__arg := Identify3TrackerTimedOutArg{GuiID: guiID}
	err = c.Cli.Notify(ctx, "keybase.1.identify3Ui.identify3TrackerTimedOut", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c Identify3UiClient) Identify3Result(ctx context.Context, __arg Identify3ResultArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.identify3Ui.identify3Result", []interface{}{__arg}, 0*time.Millisecond)
	return
}
