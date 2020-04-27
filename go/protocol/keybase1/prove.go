// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/prove.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type CheckProofStatus struct {
	Found     bool        `codec:"found" json:"found"`
	Status    ProofStatus `codec:"status" json:"status"`
	ProofText string      `codec:"proofText" json:"proofText"`
	State     ProofState  `codec:"state" json:"state"`
}

func (o CheckProofStatus) DeepCopy() CheckProofStatus {
	return CheckProofStatus{
		Found:     o.Found,
		Status:    o.Status.DeepCopy(),
		ProofText: o.ProofText,
		State:     o.State.DeepCopy(),
	}
}

type StartProofResult struct {
	SigID SigID `codec:"sigID" json:"sigID"`
}

func (o StartProofResult) DeepCopy() StartProofResult {
	return StartProofResult{
		SigID: o.SigID.DeepCopy(),
	}
}

type StartProofArg struct {
	SessionID    int         `codec:"sessionID" json:"sessionID"`
	Service      string      `codec:"service" json:"service"`
	Username     string      `codec:"username" json:"username"`
	Force        bool        `codec:"force" json:"force"`
	PromptPosted bool        `codec:"promptPosted" json:"promptPosted"`
	Auto         bool        `codec:"auto" json:"auto"`
	SigVersion   *SigVersion `codec:"sigVersion,omitempty" json:"sigVersion,omitempty"`
}

type CheckProofArg struct {
	SessionID int   `codec:"sessionID" json:"sessionID"`
	SigID     SigID `codec:"sigID" json:"sigID"`
}

type ListSomeProofServicesArg struct {
}

type ListProofServicesArg struct {
}

type ValidateUsernameArg struct {
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	Service    string `codec:"service" json:"service"`
	Remotename string `codec:"remotename" json:"remotename"`
}

type ProveInterface interface {
	StartProof(context.Context, StartProofArg) (StartProofResult, error)
	CheckProof(context.Context, CheckProofArg) (CheckProofStatus, error)
	ListSomeProofServices(context.Context) ([]string, error)
	ListProofServices(context.Context) ([]string, error)
	ValidateUsername(context.Context, ValidateUsernameArg) error
}

func ProveProtocol(i ProveInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.prove",
		Methods: map[string]rpc.ServeHandlerDescription{
			"startProof": {
				MakeArg: func() interface{} {
					var ret [1]StartProofArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]StartProofArg)
					if !ok {
						err = rpc.NewTypeError((*[1]StartProofArg)(nil), args)
						return
					}
					ret, err = i.StartProof(ctx, typedArgs[0])
					return
				},
			},
			"checkProof": {
				MakeArg: func() interface{} {
					var ret [1]CheckProofArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CheckProofArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CheckProofArg)(nil), args)
						return
					}
					ret, err = i.CheckProof(ctx, typedArgs[0])
					return
				},
			},
			"listSomeProofServices": {
				MakeArg: func() interface{} {
					var ret [1]ListSomeProofServicesArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.ListSomeProofServices(ctx)
					return
				},
			},
			"listProofServices": {
				MakeArg: func() interface{} {
					var ret [1]ListProofServicesArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.ListProofServices(ctx)
					return
				},
			},
			"validateUsername": {
				MakeArg: func() interface{} {
					var ret [1]ValidateUsernameArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ValidateUsernameArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ValidateUsernameArg)(nil), args)
						return
					}
					err = i.ValidateUsername(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type ProveClient struct {
	Cli rpc.GenericClient
}

func (c ProveClient) StartProof(ctx context.Context, __arg StartProofArg) (res StartProofResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.prove.startProof", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ProveClient) CheckProof(ctx context.Context, __arg CheckProofArg) (res CheckProofStatus, err error) {
	err = c.Cli.Call(ctx, "keybase.1.prove.checkProof", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ProveClient) ListSomeProofServices(ctx context.Context) (res []string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.prove.listSomeProofServices", []interface{}{ListSomeProofServicesArg{}}, &res, 0*time.Millisecond)
	return
}

func (c ProveClient) ListProofServices(ctx context.Context) (res []string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.prove.listProofServices", []interface{}{ListProofServicesArg{}}, &res, 0*time.Millisecond)
	return
}

func (c ProveClient) ValidateUsername(ctx context.Context, __arg ValidateUsernameArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.prove.validateUsername", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
