// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/rekey.avdl

package keybase1

import (
	"fmt"
)

type TLF struct {
	Id        TLFID    `codec:"id" json:"id"`
	Name      string   `codec:"name" json:"name"`
	Writers   []string `codec:"writers" json:"writers"`
	Readers   []string `codec:"readers" json:"readers"`
	IsPrivate bool     `codec:"isPrivate" json:"isPrivate"`
}

func (o TLF) DeepCopy() TLF {
	return TLF{
		Id:   o.Id.DeepCopy(),
		Name: o.Name,
		Writers: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Writers),
		Readers: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Readers),
		IsPrivate: o.IsPrivate,
	}
}

type ProblemTLF struct {
	Tlf           TLF   `codec:"tlf" json:"tlf"`
	Score         int   `codec:"score" json:"score"`
	Solution_kids []KID `codec:"solution_kids" json:"solution_kids"`
}

func (o ProblemTLF) DeepCopy() ProblemTLF {
	return ProblemTLF{
		Tlf:   o.Tlf.DeepCopy(),
		Score: o.Score,
		Solution_kids: (func(x []KID) []KID {
			if x == nil {
				return nil
			}
			ret := make([]KID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Solution_kids),
	}
}

// ProblemSet is for a particular (user,kid) that initiated a rekey problem.
// This problem consists of one or more problem TLFs, which are individually scored
// and have attendant solutions --- devices that if they came online can rekey and
// solve the ProblemTLF.
type ProblemSet struct {
	User User         `codec:"user" json:"user"`
	Kid  KID          `codec:"kid" json:"kid"`
	Tlfs []ProblemTLF `codec:"tlfs" json:"tlfs"`
}

func (o ProblemSet) DeepCopy() ProblemSet {
	return ProblemSet{
		User: o.User.DeepCopy(),
		Kid:  o.Kid.DeepCopy(),
		Tlfs: (func(x []ProblemTLF) []ProblemTLF {
			if x == nil {
				return nil
			}
			ret := make([]ProblemTLF, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Tlfs),
	}
}

type ProblemSetDevices struct {
	ProblemSet ProblemSet `codec:"problemSet" json:"problemSet"`
	Devices    []Device   `codec:"devices" json:"devices"`
}

func (o ProblemSetDevices) DeepCopy() ProblemSetDevices {
	return ProblemSetDevices{
		ProblemSet: o.ProblemSet.DeepCopy(),
		Devices: (func(x []Device) []Device {
			if x == nil {
				return nil
			}
			ret := make([]Device, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Devices),
	}
}

type Outcome int

const (
	Outcome_NONE    Outcome = 0
	Outcome_FIXED   Outcome = 1
	Outcome_IGNORED Outcome = 2
)

func (o Outcome) DeepCopy() Outcome { return o }

var OutcomeMap = map[string]Outcome{
	"NONE":    0,
	"FIXED":   1,
	"IGNORED": 2,
}

var OutcomeRevMap = map[Outcome]string{
	0: "NONE",
	1: "FIXED",
	2: "IGNORED",
}

func (e Outcome) String() string {
	if v, ok := OutcomeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type RevokeWarning struct {
	EndangeredTLFs []TLF `codec:"endangeredTLFs" json:"endangeredTLFs"`
}

func (o RevokeWarning) DeepCopy() RevokeWarning {
	return RevokeWarning{
		EndangeredTLFs: (func(x []TLF) []TLF {
			if x == nil {
				return nil
			}
			ret := make([]TLF, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.EndangeredTLFs),
	}
}
