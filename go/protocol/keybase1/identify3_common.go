// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/identify3_common.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type Identify3Assertion string

func (o Identify3Assertion) DeepCopy() Identify3Assertion {
	return o
}

type Identify3GUIID string

func (o Identify3GUIID) DeepCopy() Identify3GUIID {
	return o
}

type Identify3CommonInterface interface {
}

func Identify3CommonProtocol(i Identify3CommonInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "keybase.1.identify3Common",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type Identify3CommonClient struct {
	Cli rpc.GenericClient
}
