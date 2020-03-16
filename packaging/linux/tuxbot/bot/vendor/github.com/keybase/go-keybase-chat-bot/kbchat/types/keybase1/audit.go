// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/audit.avdl

package keybase1

import (
	"fmt"
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
