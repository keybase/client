package ephemeral

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
)

type EKType string

const (
	DeviceEKStr EKType = "deviceEK"
	UserEKStr   EKType = "userEK"
	TeamEKStr   EKType = "teamEK"
)

type EphemeralKeyError struct {
	DebugMsg   string
	HumanMsg   string
	StatusCode int
}

const (
	DefaultHumanErrMsg                          = "This exploding message is not available to you"
	DeviceProvisionedAfterContentCreationErrMsg = "this device was created after the message was sent"
	MemberAddedAfterContentCreationErrMsg       = "you were added to the team after this message was sent"
	DeviceCloneErrMsg                           = "cloned devices do not support exploding messages"
)

func NewNotAuthenticatedForThisDeviceError(mctx libkb.MetaContext, tlfID chat1.TLFID, contentCtime gregor1.Time) EphemeralKeyError {
	var humanMsg string
	memberCtime, err := memberCtime(mctx, tlfID)
	if err != nil {
		mctx.Debug("unable to get member ctime: %v", err)
	} else if memberCtime != nil {
		mctx.Debug("NotAuthenticatedForThisDeviceError: tlfID %v, memberCtime: %v, contentCtime: %v", tlfID, memberCtime.Time(), contentCtime.Time())
		if contentCtime.Before(gregor1.Time(*memberCtime)) {
			humanMsg = MemberAddedAfterContentCreationErrMsg
		}
	}
	return newEphemeralKeyError("message not authenticated for device", humanMsg)
}

func memberCtime(mctx libkb.MetaContext, tlfID chat1.TLFID) (*keybase1.Time, error) {
	teamID, err := keybase1.TeamIDFromString(tlfID.String())
	if err != nil {
		return nil, err
	}
	team, err := teams.Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
		ID: keybase1.TeamID(teamID),
	})
	if err != nil {
		return nil, err
	}
	uv, err := mctx.G().GetMeUV(mctx.Ctx())
	if err != nil {
		return nil, err
	}
	return team.MemberCtime(mctx.Ctx(), uv), nil
}

func newEKUnboxErr(mctx libkb.MetaContext, boxType EKType, boxGeneration keybase1.EkGeneration,
	missingType EKType, missingGeneration keybase1.EkGeneration, contentCtime *gregor1.Time) EphemeralKeyError {
	debugMsg := fmt.Sprintf("Error unboxing %s@generation:%v missing %s@generation:%v", boxType, boxGeneration, missingType, missingGeneration)
	var humanMsg string
	if deviceProvisionedAfterContentCreation(mctx, contentCtime) {
		humanMsg = DeviceProvisionedAfterContentCreationErrMsg
	} else if deviceIsCloned(mctx) {
		humanMsg = DeviceCloneErrMsg
	}
	return newEphemeralKeyError(debugMsg, humanMsg)
}

func newEKMissingBoxErr(mctx libkb.MetaContext, boxType EKType, boxGeneration keybase1.EkGeneration) EphemeralKeyError {
	debugMsg := fmt.Sprintf("Missing box for %s@generation:%v", boxType, boxGeneration)
	return newEphemeralKeyError(debugMsg, "")
}

func newEKCorruptedErr(mctx libkb.MetaContext, boxType EKType,
	expectedGeneration, boxGeneration keybase1.EkGeneration) EphemeralKeyError {
	debugMsg := fmt.Sprintf("Storage error for %s@generation:%v, got generation %v instead", boxType, boxGeneration, expectedGeneration)
	return newEphemeralKeyError(debugMsg, "")
}

func humanMsgWithPrefix(humanMsg string) string {
	if humanMsg == "" {
		humanMsg = DefaultHumanErrMsg
	} else if !strings.Contains(humanMsg, DefaultHumanErrMsg) {
		humanMsg = fmt.Sprintf("%s, %s", DefaultHumanErrMsg, humanMsg)
	}
	return humanMsg
}

func newEphemeralKeyError(debugMsg, humanMsg string) EphemeralKeyError {
	humanMsg = humanMsgWithPrefix(humanMsg)
	return EphemeralKeyError{
		DebugMsg: debugMsg,
		HumanMsg: humanMsg,
	}
}
func newEphemeralKeyErrorFromStatus(e libkb.AppStatusError) EphemeralKeyError {
	humanMsg := humanMsgWithPrefix(e.Desc)
	return EphemeralKeyError{
		DebugMsg:   e.Desc,
		HumanMsg:   humanMsg,
		StatusCode: e.Code,
	}
}

func (e EphemeralKeyError) HumanError() string {
	return e.HumanMsg
}

func (e EphemeralKeyError) Error() string {
	return e.DebugMsg
}

func errFromAppStatus(e error) error {
	if e == nil {
		return nil
	}
	switch e := e.(type) {
	case libkb.AppStatusError:
		switch e.Code {
		case libkb.SCEphemeralDeviceAfterEK,
			libkb.SCEphemeralMemberAfterEK,
			libkb.SCEphemeralDeviceStale,
			libkb.SCEphemeralUserStale:
			return newEphemeralKeyErrorFromStatus(e)
		}
	}
	return e
}

func deviceProvisionedAfterContentCreation(mctx libkb.MetaContext, contentCtime *gregor1.Time) bool {
	// some callers may not specify a creation time if they aren't trying to
	// decrypt a specific piece of content.
	if contentCtime == nil {
		return false
	}
	deviceCtime, err := mctx.ActiveDevice().Ctime(mctx)
	if err != nil {
		return false
	}
	return contentCtime.Time().Before(deviceCtime.Time())
}

func deviceIsCloned(mctx libkb.MetaContext) bool {
	cloneState, err := libkb.GetDeviceCloneState(mctx)
	if err != nil {
		return false
	}
	return cloneState.IsClone()
}
