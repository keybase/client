package ephemeral

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/libkb"
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

const (
	defaultHumanErr                             = "This exploding message is not available to you."
	deviceProvisionedAfterContentCreationErrMsg = "This exploding message is not available to you, this device was created after the message was sent."
	deviceCloneErrMsg                           = "This exploding message is not available to you, cloned devices do not support exploding messages."
)

func newEKUnboxErr(ctx context.Context, g *libkb.GlobalContext, boxType EKType, boxGeneration keybase1.EkGeneration,
	missingType EKType, missingGeneration keybase1.EkGeneration, contentCtime *gregor1.Time) EphemeralKeyError {
	debugMsg := fmt.Sprintf("Error unboxing %s@generation:%v missing %s@generation:%v", boxType, boxGeneration, missingType, missingGeneration)
	humanMsg := defaultHumanErr
	if deviceProvisionedAfterContentCreation(ctx, g, contentCtime) {
		humanMsg = deviceProvisionedAfterContentCreationErrMsg
	} else if deviceIsCloned(ctx, g) {
		humanMsg = deviceCloneErrMsg
	}
	return newEphemeralKeyError(debugMsg, humanMsg)
}

func newEKMissingBoxErr(ctx context.Context, g *libkb.GlobalContext,
	boxType EKType, boxGeneration keybase1.EkGeneration) EphemeralKeyError {
	debugMsg := fmt.Sprintf("Missing box for %s@generation:%v", boxType, boxGeneration)
	return newEphemeralKeyError(debugMsg, "")
}

func newEKCorruptedErr(ctx context.Context, g *libkb.GlobalContext, boxType EKType,
	expectedGeneration, boxGeneration keybase1.EkGeneration) EphemeralKeyError {
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

func deviceProvisionedAfterContentCreation(ctx context.Context, g *libkb.GlobalContext, contentCtime *gregor1.Time) bool {
	// some callers may not specify a creation time if they aren't trying to
	// decrypt a specific piece of content.
	if contentCtime == nil {
		return false
	}
	m := libkb.NewMetaContext(ctx, g)
	deviceCtime, err := g.ActiveDevice.Ctime(m)
	if err != nil {
		return false
	}
	return contentCtime.Time().Before(deviceCtime.Time())
}

func deviceIsCloned(ctx context.Context, g *libkb.GlobalContext) bool {
	m := libkb.NewMetaContext(ctx, g)
	cloneState, err := libkb.GetDeviceCloneState(m)
	if err != nil {
		return false
	}
	return cloneState.IsClone()
}
