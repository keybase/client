// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/rekey_ui.avdl

package keybase1

import (
	"fmt"
)

type RekeyEventType int

const (
	RekeyEventType_NONE                     RekeyEventType = 0
	RekeyEventType_NOT_LOGGED_IN            RekeyEventType = 1
	RekeyEventType_API_ERROR                RekeyEventType = 2
	RekeyEventType_NO_PROBLEMS              RekeyEventType = 3
	RekeyEventType_LOAD_ME_ERROR            RekeyEventType = 4
	RekeyEventType_CURRENT_DEVICE_CAN_REKEY RekeyEventType = 5
	RekeyEventType_DEVICE_LOAD_ERROR        RekeyEventType = 6
	RekeyEventType_HARASS                   RekeyEventType = 7
	RekeyEventType_NO_GREGOR_MESSAGES       RekeyEventType = 8
)

func (o RekeyEventType) DeepCopy() RekeyEventType { return o }

var RekeyEventTypeMap = map[string]RekeyEventType{
	"NONE":                     0,
	"NOT_LOGGED_IN":            1,
	"API_ERROR":                2,
	"NO_PROBLEMS":              3,
	"LOAD_ME_ERROR":            4,
	"CURRENT_DEVICE_CAN_REKEY": 5,
	"DEVICE_LOAD_ERROR":        6,
	"HARASS":                   7,
	"NO_GREGOR_MESSAGES":       8,
}

var RekeyEventTypeRevMap = map[RekeyEventType]string{
	0: "NONE",
	1: "NOT_LOGGED_IN",
	2: "API_ERROR",
	3: "NO_PROBLEMS",
	4: "LOAD_ME_ERROR",
	5: "CURRENT_DEVICE_CAN_REKEY",
	6: "DEVICE_LOAD_ERROR",
	7: "HARASS",
	8: "NO_GREGOR_MESSAGES",
}

func (e RekeyEventType) String() string {
	if v, ok := RekeyEventTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type RekeyEvent struct {
	EventType     RekeyEventType `codec:"eventType" json:"eventType"`
	InterruptType int            `codec:"interruptType" json:"interruptType"`
}

func (o RekeyEvent) DeepCopy() RekeyEvent {
	return RekeyEvent{
		EventType:     o.EventType.DeepCopy(),
		InterruptType: o.InterruptType,
	}
}
