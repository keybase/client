// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/gregor_ui.avdl

package keybase1

import (
	"fmt"
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

func (e PushReason) String() string {
	if v, ok := PushReasonRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}
