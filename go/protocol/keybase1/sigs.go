// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/sigs.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type Sig struct {
	Seqno        Seqno  `codec:"seqno" json:"seqno"`
	SigID        SigID  `codec:"sigID" json:"sigID"`
	SigIDDisplay string `codec:"sigIDDisplay" json:"sigIDDisplay"`
	Type         string `codec:"type" json:"type"`
	CTime        Time   `codec:"cTime" json:"cTime"`
	Revoked      bool   `codec:"revoked" json:"revoked"`
	Active       bool   `codec:"active" json:"active"`
	Key          string `codec:"key" json:"key"`
	Body         string `codec:"body" json:"body"`
}

func (o Sig) DeepCopy() Sig {
	return Sig{
		Seqno:        o.Seqno.DeepCopy(),
		SigID:        o.SigID.DeepCopy(),
		SigIDDisplay: o.SigIDDisplay,
		Type:         o.Type,
		CTime:        o.CTime.DeepCopy(),
		Revoked:      o.Revoked,
		Active:       o.Active,
		Key:          o.Key,
		Body:         o.Body,
	}
}

type SigTypes struct {
	Track          bool `codec:"track" json:"track"`
	Proof          bool `codec:"proof" json:"proof"`
	Cryptocurrency bool `codec:"cryptocurrency" json:"cryptocurrency"`
	IsSelf         bool `codec:"isSelf" json:"isSelf"`
}

func (o SigTypes) DeepCopy() SigTypes {
	return SigTypes{
		Track:          o.Track,
		Proof:          o.Proof,
		Cryptocurrency: o.Cryptocurrency,
		IsSelf:         o.IsSelf,
	}
}

type SigListArgs struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	Username  string    `codec:"username" json:"username"`
	AllKeys   bool      `codec:"allKeys" json:"allKeys"`
	Types     *SigTypes `codec:"types,omitempty" json:"types,omitempty"`
	Filterx   string    `codec:"filterx" json:"filterx"`
	Verbose   bool      `codec:"verbose" json:"verbose"`
	Revoked   bool      `codec:"revoked" json:"revoked"`
}

func (o SigListArgs) DeepCopy() SigListArgs {
	return SigListArgs{
		SessionID: o.SessionID,
		Username:  o.Username,
		AllKeys:   o.AllKeys,
		Types: (func(x *SigTypes) *SigTypes {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Types),
		Filterx: o.Filterx,
		Verbose: o.Verbose,
		Revoked: o.Revoked,
	}
}

type SigListArg struct {
	SessionID int         `codec:"sessionID" json:"sessionID"`
	Arg       SigListArgs `codec:"arg" json:"arg"`
}

type SigListJSONArg struct {
	SessionID int         `codec:"sessionID" json:"sessionID"`
	Arg       SigListArgs `codec:"arg" json:"arg"`
}

type SigsInterface interface {
	SigList(context.Context, SigListArg) ([]Sig, error)
	SigListJSON(context.Context, SigListJSONArg) (string, error)
}

func SigsProtocol(i SigsInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.sigs",
		Methods: map[string]rpc.ServeHandlerDescription{
			"sigList": {
				MakeArg: func() interface{} {
					var ret [1]SigListArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SigListArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SigListArg)(nil), args)
						return
					}
					ret, err = i.SigList(ctx, typedArgs[0])
					return
				},
			},
			"sigListJSON": {
				MakeArg: func() interface{} {
					var ret [1]SigListJSONArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SigListJSONArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SigListJSONArg)(nil), args)
						return
					}
					ret, err = i.SigListJSON(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type SigsClient struct {
	Cli rpc.GenericClient
}

func (c SigsClient) SigList(ctx context.Context, __arg SigListArg) (res []Sig, err error) {
	err = c.Cli.Call(ctx, "keybase.1.sigs.sigList", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c SigsClient) SigListJSON(ctx context.Context, __arg SigListJSONArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.sigs.sigListJSON", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
