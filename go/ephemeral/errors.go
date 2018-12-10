package ephemeral

import (
	"fmt"

	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type EKType string

const (
	DeviceEKStr EKType = "deviceEK"
	UserEKStr   EKType = "userEK"
	TeamEKStr   EKType = "teamEK"
)

type EphemeralKeyError struct {
	DebugMsg string
	HumanMsg string
}

const defaultHumanErr = "This exploding message is not available to you."

func newEKUnboxErr(boxType EKType, boxGeneration keybase1.EkGeneration,
	missingType EKType, missingGeneration keybase1.EkGeneration, contentCtime *gregor1.Time) EphemeralKeyError {
	debugMsg := fmt.Sprintf("Error unboxing %s@generation:%v missing %s@generation:%v", boxType, boxGeneration, missingType, missingGeneration)
	return newEphemeralKeyError(debugMsg, "")
}

func newEKMissingBoxErr(boxType EKType, boxGeneration keybase1.EkGeneration) EphemeralKeyError {
	debugMsg := fmt.Sprintf("Missing box for %s@generation:%v", boxType, boxGeneration)
	return newEphemeralKeyError(debugMsg, "")
}

func newEKCorruptedErr(boxType EKType, expectedGeneration, boxGeneration keybase1.EkGeneration) EphemeralKeyError {
	debugMsg := fmt.Sprintf("Storage error for %s@generation:%v, got generation %v instead", boxType, boxGeneration, expectedGeneration)
	return newEphemeralKeyError(debugMsg, "")
}

func newEphemeralKeyError(debugMsg, humanMsg string) EphemeralKeyError {
	if humanMsg == "" {
		humanMsg = defaultHumanErr
	}
	return EphemeralKeyError{
		DebugMsg: debugMsg,
		HumanMsg: humanMsg,
	}
}

func (e EphemeralKeyError) HumanError() string {
	return e.HumanMsg
}

func (e EphemeralKeyError) Error() string {
	return e.DebugMsg
}
