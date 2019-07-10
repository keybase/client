package hidden

import (
	"fmt"
	"github.com/keybase/client/go/protocol/keybase1"
)

type ManagerError struct {
	note string
}

func (e ManagerError) Error() string {
	return fmt.Sprintf("hidden team manager error: %s", e.note)
}

func NewManagerError(format string, args ...interface{}) ManagerError {
	return ManagerError{fmt.Sprintf(format, args...)}
}

var _ error = ManagerError{}

type LoaderError struct {
	note string
}

func (e LoaderError) Error() string {
	return fmt.Sprintf("hidden team loader error: %s", e.note)
}

func NewLoaderError(format string, args ...interface{}) LoaderError {
	return LoaderError{fmt.Sprintf(format, args...)}
}

var _ error = LoaderError{}

type GenerateError struct {
	note string
}

func (e GenerateError) Error() string {
	return fmt.Sprintf("hidden team generate error: %s", e.note)
}

func NewGenerateError(format string, args ...interface{}) GenerateError {
	return GenerateError{fmt.Sprintf(format, args...)}
}

var _ error = GenerateError{}

type RatchetError struct {
	note string
}

func (e RatchetError) Error() string {
	return fmt.Sprintf("hidden team ratchet error: %s", e.note)
}

func newRatchetError(format string, args ...interface{}) RatchetError {
	return RatchetError{fmt.Sprintf(format, args...)}
}

type HiddenRotationNotSupportedError struct {
	teamID keybase1.TeamID
}

func NewHiddenRotationNotSupportedError(teamID keybase1.TeamID) HiddenRotationNotSupportedError {
	return HiddenRotationNotSupportedError{teamID: teamID}
}

func (e HiddenRotationNotSupportedError) Error() string {
	return fmt.Sprintf("hidden team rotation is not enabled for team %s", e.teamID)
}
