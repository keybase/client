// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/audit.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type BoxAuditAttemptResult int

const (
	BoxAuditAttemptResult_FAILURE_RETRYABLE         BoxAuditAttemptResult = 0
	BoxAuditAttemptResult_FAILURE_MALICIOUS_SERVER  BoxAuditAttemptResult = 1
	BoxAuditAttemptResult_OK_VERIFIED               BoxAuditAttemptResult = 2
	BoxAuditAttemptResult_OK_NOT_ATTEMPTED_ROLE     BoxAuditAttemptResult = 3
	BoxAuditAttemptResult_OK_NOT_ATTEMPTED_OPENTEAM BoxAuditAttemptResult = 4
	BoxAuditAttemptResult_OK_NOT_ATTEMPTED_SUBTEAM  BoxAuditAttemptResult = 5
)

func (o BoxAuditAttemptResult) DeepCopy() BoxAuditAttemptResult { return o }

var BoxAuditAttemptResultMap = map[string]BoxAuditAttemptResult{
	"FAILURE_RETRYABLE":         0,
	"FAILURE_MALICIOUS_SERVER":  1,
	"OK_VERIFIED":               2,
	"OK_NOT_ATTEMPTED_ROLE":     3,
	"OK_NOT_ATTEMPTED_OPENTEAM": 4,
	"OK_NOT_ATTEMPTED_SUBTEAM":  5,
}

var BoxAuditAttemptResultRevMap = map[BoxAuditAttemptResult]string{
	0: "FAILURE_RETRYABLE",
	1: "FAILURE_MALICIOUS_SERVER",
	2: "OK_VERIFIED",
	3: "OK_NOT_ATTEMPTED_ROLE",
	4: "OK_NOT_ATTEMPTED_OPENTEAM",
	5: "OK_NOT_ATTEMPTED_SUBTEAM",
}

func (e BoxAuditAttemptResult) String() string {
	if v, ok := BoxAuditAttemptResultRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type BoxAuditAttempt struct {
	Ctime      UnixTime              `codec:"ctime" json:"ctime"`
	Error      *string               `codec:"error,omitempty" json:"error,omitempty"`
	Result     BoxAuditAttemptResult `codec:"result" json:"result"`
	Generation *PerTeamKeyGeneration `codec:"generation,omitempty" json:"generation,omitempty"`
	Rotated    bool                  `codec:"rotated" json:"rotated"`
}

func (o BoxAuditAttempt) DeepCopy() BoxAuditAttempt {
	return BoxAuditAttempt{
		Ctime: o.Ctime.DeepCopy(),
		Error: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Error),
		Result: o.Result.DeepCopy(),
		Generation: (func(x *PerTeamKeyGeneration) *PerTeamKeyGeneration {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Generation),
		Rotated: o.Rotated,
	}
}

type IsInJailArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	TeamID    TeamID `codec:"teamID" json:"teamID"`
}

type BoxAuditTeamArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	TeamID    TeamID `codec:"teamID" json:"teamID"`
}

type AttemptBoxAuditArg struct {
	SessionID         int    `codec:"sessionID" json:"sessionID"`
	TeamID            TeamID `codec:"teamID" json:"teamID"`
	RotateBeforeAudit bool   `codec:"rotateBeforeAudit" json:"rotateBeforeAudit"`
}

type KnownTeamIDsArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type AuditInterface interface {
	IsInJail(context.Context, IsInJailArg) (bool, error)
	BoxAuditTeam(context.Context, BoxAuditTeamArg) (*BoxAuditAttempt, error)
	AttemptBoxAudit(context.Context, AttemptBoxAuditArg) (BoxAuditAttempt, error)
	KnownTeamIDs(context.Context, int) ([]TeamID, error)
}

func AuditProtocol(i AuditInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.audit",
		Methods: map[string]rpc.ServeHandlerDescription{
			"isInJail": {
				MakeArg: func() interface{} {
					var ret [1]IsInJailArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]IsInJailArg)
					if !ok {
						err = rpc.NewTypeError((*[1]IsInJailArg)(nil), args)
						return
					}
					ret, err = i.IsInJail(ctx, typedArgs[0])
					return
				},
			},
			"boxAuditTeam": {
				MakeArg: func() interface{} {
					var ret [1]BoxAuditTeamArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]BoxAuditTeamArg)
					if !ok {
						err = rpc.NewTypeError((*[1]BoxAuditTeamArg)(nil), args)
						return
					}
					ret, err = i.BoxAuditTeam(ctx, typedArgs[0])
					return
				},
			},
			"attemptBoxAudit": {
				MakeArg: func() interface{} {
					var ret [1]AttemptBoxAuditArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AttemptBoxAuditArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AttemptBoxAuditArg)(nil), args)
						return
					}
					ret, err = i.AttemptBoxAudit(ctx, typedArgs[0])
					return
				},
			},
			"knownTeamIDs": {
				MakeArg: func() interface{} {
					var ret [1]KnownTeamIDsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]KnownTeamIDsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]KnownTeamIDsArg)(nil), args)
						return
					}
					ret, err = i.KnownTeamIDs(ctx, typedArgs[0].SessionID)
					return
				},
			},
		},
	}
}

type AuditClient struct {
	Cli rpc.GenericClient
}

func (c AuditClient) IsInJail(ctx context.Context, __arg IsInJailArg) (res bool, err error) {
	err = c.Cli.Call(ctx, "keybase.1.audit.isInJail", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c AuditClient) BoxAuditTeam(ctx context.Context, __arg BoxAuditTeamArg) (res *BoxAuditAttempt, err error) {
	err = c.Cli.Call(ctx, "keybase.1.audit.boxAuditTeam", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c AuditClient) AttemptBoxAudit(ctx context.Context, __arg AttemptBoxAuditArg) (res BoxAuditAttempt, err error) {
	err = c.Cli.Call(ctx, "keybase.1.audit.attemptBoxAudit", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c AuditClient) KnownTeamIDs(ctx context.Context, sessionID int) (res []TeamID, err error) {
	__arg := KnownTeamIDsArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.audit.knownTeamIDs", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
