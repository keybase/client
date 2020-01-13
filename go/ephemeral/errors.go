package ephemeral

import (
	"fmt"
	"strings"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
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
	EphemeralKeyErrorKindDEVICENOTAUTHENTICATED EphemeralKeyErrorKind = iota
	EphemeralKeyErrorKindUNBOX
	EphemeralKeyErrorKindMISSINGBOX
	EphemeralKeyErrorKindWRONGKID
	EphemeralKeyErrorKindCORRUPTEDGEN
	EphemeralKeyErrorKindDEVICEAFTEREK
	EphemeralKeyErrorKindMEMBERAFTEREK
	EphemeralKeyErrorKindDEVICESTALE
	EphemeralKeyErrorKindUSERSTALE
	EphemeralKeyErrorKindUNKNOWN
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
		e.ErrKind == EphemeralKeyErrorKindMISSINGBOX &&
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
	DefaultHumanErrMsg           = "This exploding message is not available"
	DefaultPluralHumanErrMsg     = "%d exploding messages are not available"
	DeviceCloneErrMsg            = "cloned devices do not support exploding messages"
	DeviceCloneWithOneshotErrMsg = "to support exploding messages in `oneshot` mode, you need a separate paper key for each running instance"
	DeviceAfterEKErrMsg          = "because this device was created after it was sent"
	MemberAfterEKErrMsg          = "because you joined the team after it was sent"
	DeviceStaleErrMsg            = "because this device wasn't online to generate an exploding key"
	UserStaleErrMsg              = "because you weren't online to generate new exploding keys"
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

func NewNotAuthenticatedForThisDeviceError(mctx libkb.MetaContext, memberCtime *keybase1.Time, contentCtime gregor1.Time) EphemeralKeyError {
	var humanMsg string
	if deviceProvisionedAfterContentCreation(mctx, &contentCtime) {
		humanMsg = DeviceAfterEKErrMsg
	} else if memberCtime != nil {
		mctx.Debug("NotAuthenticatedForThisDeviceError: memberCtime: %v, contentCtime: %v", memberCtime.Time(), contentCtime.Time())
		if contentCtime.Before(gregor1.Time(*memberCtime)) {
			humanMsg = MemberAfterEKErrMsg
		}
	}
	return newEphemeralKeyError("message not authenticated for device", humanMsg,
		EphemeralKeyErrorKindDEVICENOTAUTHENTICATED, DeviceEKKind)
}

func newEKUnboxErr(mctx libkb.MetaContext, ekKind EphemeralKeyKind, boxGeneration keybase1.EkGeneration,
	missingKind EphemeralKeyKind, missingGeneration keybase1.EkGeneration, contentCtime *gregor1.Time) EphemeralKeyError {
	debugMsg := fmt.Sprintf("Error unboxing %s@generation:%v missing %s@generation:%v", ekKind, boxGeneration, missingKind, missingGeneration)
	var humanMsg string
	if deviceProvisionedAfterContentCreation(mctx, contentCtime) {
		humanMsg = DeviceAfterEKErrMsg
	} else if deviceIsCloned(mctx) {
		humanMsg = DeviceCloneErrMsg
		if isOneshot, err := mctx.G().IsOneshot(mctx.Ctx()); err != nil {
			mctx.Debug("unable to check IsOneshot %v", err)
		} else if isOneshot {
			humanMsg = DeviceCloneWithOneshotErrMsg
		}
	}
	return newEphemeralKeyError(debugMsg, humanMsg,
		EphemeralKeyErrorKindUNBOX, missingKind)
}

func newEKMissingBoxErr(mctx libkb.MetaContext, ekKind EphemeralKeyKind, boxGeneration keybase1.EkGeneration) EphemeralKeyError {
	debugMsg := fmt.Sprintf("Missing box for %s@generation:%v", ekKind, boxGeneration)
	return newEphemeralKeyError(debugMsg, "", EphemeralKeyErrorKindMISSINGBOX, ekKind)
}

func newTeambotEKWrongKIDErr(mctx libkb.MetaContext, ctime, now keybase1.Time) EphemeralKeyError {
	debugMsg := fmt.Sprintf("Wrong KID for %v, first seen at %v, now %v", TeambotEKKind, ctime.Time(), now.Time())
	return newEphemeralKeyError(debugMsg, "", EphemeralKeyErrorKindWRONGKID, TeambotEKKind)
}

func newEKCorruptedErr(mctx libkb.MetaContext, ekKind EphemeralKeyKind,
	expectedGeneration, boxGeneration keybase1.EkGeneration) EphemeralKeyError {
	debugMsg := fmt.Sprintf("Storage error for %s@generation:%v, got generation %v instead", ekKind, boxGeneration, expectedGeneration)
	return newEphemeralKeyError(debugMsg, "", EphemeralKeyErrorKindCORRUPTEDGEN, ekKind)
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
	var errKind EphemeralKeyErrorKind
	var ekKind EphemeralKeyKind
	var humanMsg string
	switch e.Code {
	case libkb.SCEphemeralDeviceAfterEK:
		errKind = EphemeralKeyErrorKindDEVICEAFTEREK
		ekKind = DeviceEKKind
		humanMsg = DeviceAfterEKErrMsg
	case libkb.SCEphemeralMemberAfterEK:
		ekKind = TeamEKKind
		humanMsg = MemberAfterEKErrMsg
	case libkb.SCEphemeralDeviceStale:
		errKind = EphemeralKeyErrorKindDEVICESTALE
		ekKind = DeviceEKKind
		humanMsg = DeviceStaleErrMsg
	case libkb.SCEphemeralUserStale:
		errKind = EphemeralKeyErrorKindUSERSTALE
		ekKind = UserEKKind
		humanMsg = UserStaleErrMsg
	}

	humanMsg = humanMsgWithPrefix(humanMsg)
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

func PluralizeErrorMessage(msg string, count int) string {
	if count <= 1 {
		return msg
	}
	msg = strings.Replace(msg, DefaultHumanErrMsg, fmt.Sprintf(DefaultPluralHumanErrMsg, count), 1)
	// Backwards compatibility with old server based message which clients may
	// have in cache.
	msg = strings.Replace(msg, "this message was", "the messages were", 1)
	msg = strings.Replace(msg, "the message was", "the messages were", 1)
	return msg
}
