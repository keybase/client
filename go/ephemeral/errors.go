package ephemeral

import (
	"fmt"
	"strings"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
)

type EphemeralKeyKind string

const (
	DeviceEKKind  EphemeralKeyKind = "deviceEK"
	UserEKKind    EphemeralKeyKind = "userEK"
	TeamEKKind    EphemeralKeyKind = "teamEK"
	TeambotEKKind EphemeralKeyKind = "teambotEK"
)

type EphemeralKeyErrorKind int

const (
	EphemeralKeyErrorKind_DEVICENOTAUTHENTICATED EphemeralKeyErrorKind = iota
	EphemeralKeyErrorKind_UNBOX
	EphemeralKeyErrorKind_MISSINGBOX
	EphemeralKeyErrorKind_WRONGKID
	EphemeralKeyErrorKind_CORRUPTEDGEN
	EphemeralKeyErrorKind_DEVICEAFTEREK
	EphemeralKeyErrorKind_MEMBERAFTEREK
	EphemeralKeyErrorKind_DEVICESTALE
	EphemeralKeyErrorKind_USERSTALE
)

type EphemeralKeyError struct {
	DebugMsg    string
	HumanMsg    string
	StatusCode  int
	Ctime       gregor1.Time
	ErrKind     EphemeralKeyErrorKind
	EKKind      EphemeralKeyKind
	IsTransient bool
}

func (e EphemeralKeyError) HumanError() string {
	return e.HumanMsg
}

func (e EphemeralKeyError) Error() string {
	return e.DebugMsg
}

// AllowTransient determines if we allow the given error to be downgraded to a
// transient error. If we encounter a MISSINGBOX  error for a TeambotEK we
// allow this to be marked as transient for a 24 hour window. The intention is
// to allow a chat message to be retried on send for this period instead of
// permanently failing.
func (e EphemeralKeyError) AllowTransient() bool {
	return (e.EKKind == TeambotEKKind &&
		e.ErrKind == EphemeralKeyErrorKind_MISSINGBOX &&
		time.Since(e.Ctime.Time()) < time.Hour*24)
}

func (e EphemeralKeyError) IsPermanent() bool {
	return !e.IsTransient
}

func newTransientEphemeralKeyError(err EphemeralKeyError) EphemeralKeyError {
	return EphemeralKeyError{
		DebugMsg:    err.DebugMsg,
		HumanMsg:    err.HumanMsg,
		StatusCode:  err.StatusCode,
		Ctime:       err.Ctime,
		ErrKind:     err.ErrKind,
		EKKind:      err.EKKind,
		IsTransient: true,
	}
}

const (
	DefaultHumanErrMsg                          = "This exploding message is not available to you"
	DeviceProvisionedAfterContentCreationErrMsg = "this device was created after the message was sent"
	MemberAddedAfterContentCreationErrMsg       = "you were added to the team after this message was sent"
	DeviceCloneErrMsg                           = "cloned devices do not support exploding messages"
)

type IncorrectTeamEphemeralKeyTypeError struct {
	expected, actual keybase1.TeamEphemeralKeyType
}

func (e IncorrectTeamEphemeralKeyTypeError) Error() string {
	return fmt.Sprintf("Incorrect team ephemeral key type received. Expected: %v, actual %v", e.expected, e.actual)
}

func NewIncorrectTeamEphemeralKeyTypeError(expected, actual keybase1.TeamEphemeralKeyType) IncorrectTeamEphemeralKeyTypeError {
	return IncorrectTeamEphemeralKeyTypeError{
		expected: expected,
		actual:   actual,
	}
}

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
	return newEphemeralKeyError("message not authenticated for device", humanMsg,
		EphemeralKeyErrorKind_DEVICENOTAUTHENTICATED, DeviceEKKind)
}

func memberCtime(mctx libkb.MetaContext, tlfID chat1.TLFID) (*keybase1.Time, error) {
	teamID, err := keybase1.TeamIDFromString(tlfID.String())
	if err != nil {
		return nil, err
	}
	team, err := teams.Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
		ID: teamID,
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

func newEKUnboxErr(mctx libkb.MetaContext, ekKind EphemeralKeyKind, boxGeneration keybase1.EkGeneration,
	missingKind EphemeralKeyKind, missingGeneration keybase1.EkGeneration, contentCtime *gregor1.Time) EphemeralKeyError {
	debugMsg := fmt.Sprintf("Error unboxing %s@generation:%v missing %s@generation:%v", ekKind, boxGeneration, missingKind, missingGeneration)
	var humanMsg string
	if deviceProvisionedAfterContentCreation(mctx, contentCtime) {
		humanMsg = DeviceProvisionedAfterContentCreationErrMsg
	} else if deviceIsCloned(mctx) {
		humanMsg = DeviceCloneErrMsg
	}
	return newEphemeralKeyError(debugMsg, humanMsg,
		EphemeralKeyErrorKind_UNBOX, missingKind)
}

func newEKMissingBoxErr(mctx libkb.MetaContext, ekKind EphemeralKeyKind, boxGeneration keybase1.EkGeneration) EphemeralKeyError {
	debugMsg := fmt.Sprintf("Missing box for %s@generation:%v", ekKind, boxGeneration)
	return newEphemeralKeyError(debugMsg, "", EphemeralKeyErrorKind_MISSINGBOX, ekKind)
}

func newTeambotEKWrongKIDErr(mctx libkb.MetaContext, ctime, now keybase1.Time) EphemeralKeyError {
	debugMsg := fmt.Sprintf("Wrong KID for %v, first seen at %v, now %v", TeambotEKKind, ctime.Time(), now.Time())
	return newEphemeralKeyError(debugMsg, "", EphemeralKeyErrorKind_WRONGKID, TeambotEKKind)
}

func newEKCorruptedErr(mctx libkb.MetaContext, ekKind EphemeralKeyKind,
	expectedGeneration, boxGeneration keybase1.EkGeneration) EphemeralKeyError {
	debugMsg := fmt.Sprintf("Storage error for %s@generation:%v, got generation %v instead", ekKind, boxGeneration, expectedGeneration)
	return newEphemeralKeyError(debugMsg, "", EphemeralKeyErrorKind_CORRUPTEDGEN, ekKind)
}

func humanMsgWithPrefix(humanMsg string) string {
	if humanMsg == "" {
		humanMsg = DefaultHumanErrMsg
	} else if !strings.Contains(humanMsg, DefaultHumanErrMsg) {
		humanMsg = fmt.Sprintf("%s, %s", DefaultHumanErrMsg, humanMsg)
	}
	return humanMsg
}

func newEphemeralKeyError(debugMsg, humanMsg string, errKind EphemeralKeyErrorKind,
	ekKind EphemeralKeyKind) EphemeralKeyError {
	humanMsg = humanMsgWithPrefix(humanMsg)
	return EphemeralKeyError{
		DebugMsg: debugMsg,
		HumanMsg: humanMsg,
		Ctime:    gregor1.ToTime(time.Now()),
		ErrKind:  errKind,
		EKKind:   ekKind,
	}
}
func newEphemeralKeyErrorFromStatus(e libkb.AppStatusError) EphemeralKeyError {
	humanMsg := humanMsgWithPrefix(e.Desc)
	var errKind EphemeralKeyErrorKind
	var ekKind EphemeralKeyKind
	switch e.Code {
	case libkb.SCEphemeralDeviceAfterEK:
		errKind = EphemeralKeyErrorKind_DEVICEAFTEREK
		ekKind = DeviceEKKind
	case libkb.SCEphemeralMemberAfterEK:
		ekKind = TeamEKKind
	case libkb.SCEphemeralDeviceStale:
		errKind = EphemeralKeyErrorKind_DEVICESTALE
		ekKind = DeviceEKKind
	case libkb.SCEphemeralUserStale:
		errKind = EphemeralKeyErrorKind_USERSTALE
		ekKind = UserEKKind
	}
	return EphemeralKeyError{
		DebugMsg:   e.Desc,
		HumanMsg:   humanMsg,
		StatusCode: e.Code,
		Ctime:      gregor1.ToTime(time.Now()),
		ErrKind:    errKind,
		EKKind:     ekKind,
	}
}

func errFromAppStatus(e error) error {
	switch e := e.(type) {
	case nil:
		return nil
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
