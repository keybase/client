// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/notify_saltpack.avdl

package keybase1

import (
	"fmt"
)

type SaltpackOperationType int

const (
	SaltpackOperationType_ENCRYPT SaltpackOperationType = 0
	SaltpackOperationType_DECRYPT SaltpackOperationType = 1
	SaltpackOperationType_SIGN    SaltpackOperationType = 2
	SaltpackOperationType_VERIFY  SaltpackOperationType = 3
)

func (o SaltpackOperationType) DeepCopy() SaltpackOperationType { return o }

var SaltpackOperationTypeMap = map[string]SaltpackOperationType{
	"ENCRYPT": 0,
	"DECRYPT": 1,
	"SIGN":    2,
	"VERIFY":  3,
}

var SaltpackOperationTypeRevMap = map[SaltpackOperationType]string{
	0: "ENCRYPT",
	1: "DECRYPT",
	2: "SIGN",
	3: "VERIFY",
}

func (e SaltpackOperationType) String() string {
	if v, ok := SaltpackOperationTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}
