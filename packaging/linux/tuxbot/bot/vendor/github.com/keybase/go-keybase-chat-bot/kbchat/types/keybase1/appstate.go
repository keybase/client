// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/appstate.avdl

package keybase1

import (
	"fmt"
)

type MobileAppState int

const (
	MobileAppState_FOREGROUND       MobileAppState = 0
	MobileAppState_BACKGROUND       MobileAppState = 1
	MobileAppState_INACTIVE         MobileAppState = 2
	MobileAppState_BACKGROUNDACTIVE MobileAppState = 3
)

func (o MobileAppState) DeepCopy() MobileAppState { return o }

var MobileAppStateMap = map[string]MobileAppState{
	"FOREGROUND":       0,
	"BACKGROUND":       1,
	"INACTIVE":         2,
	"BACKGROUNDACTIVE": 3,
}

var MobileAppStateRevMap = map[MobileAppState]string{
	0: "FOREGROUND",
	1: "BACKGROUND",
	2: "INACTIVE",
	3: "BACKGROUNDACTIVE",
}

func (e MobileAppState) String() string {
	if v, ok := MobileAppStateRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type MobileNetworkState int

const (
	MobileNetworkState_NONE         MobileNetworkState = 0
	MobileNetworkState_WIFI         MobileNetworkState = 1
	MobileNetworkState_CELLULAR     MobileNetworkState = 2
	MobileNetworkState_UNKNOWN      MobileNetworkState = 3
	MobileNetworkState_NOTAVAILABLE MobileNetworkState = 4
)

func (o MobileNetworkState) DeepCopy() MobileNetworkState { return o }

var MobileNetworkStateMap = map[string]MobileNetworkState{
	"NONE":         0,
	"WIFI":         1,
	"CELLULAR":     2,
	"UNKNOWN":      3,
	"NOTAVAILABLE": 4,
}

var MobileNetworkStateRevMap = map[MobileNetworkState]string{
	0: "NONE",
	1: "WIFI",
	2: "CELLULAR",
	3: "UNKNOWN",
	4: "NOTAVAILABLE",
}

func (e MobileNetworkState) String() string {
	if v, ok := MobileNetworkStateRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}
