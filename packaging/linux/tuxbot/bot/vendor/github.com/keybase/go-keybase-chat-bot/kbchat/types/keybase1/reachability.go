// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/reachability.avdl

package keybase1

import (
	"fmt"
)

type Reachable int

const (
	Reachable_UNKNOWN Reachable = 0
	Reachable_YES     Reachable = 1
	Reachable_NO      Reachable = 2
)

func (o Reachable) DeepCopy() Reachable { return o }

var ReachableMap = map[string]Reachable{
	"UNKNOWN": 0,
	"YES":     1,
	"NO":      2,
}

var ReachableRevMap = map[Reachable]string{
	0: "UNKNOWN",
	1: "YES",
	2: "NO",
}

func (e Reachable) String() string {
	if v, ok := ReachableRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type Reachability struct {
	Reachable Reachable `codec:"reachable" json:"reachable"`
}

func (o Reachability) DeepCopy() Reachability {
	return Reachability{
		Reachable: o.Reachable.DeepCopy(),
	}
}
