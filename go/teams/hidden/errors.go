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

type HiddenChainNotSupportedError struct {
	teamID keybase1.TeamID
}

func NewHiddenChainNotSupportedError(teamID keybase1.TeamID) HiddenChainNotSupportedError {
	return HiddenChainNotSupportedError{teamID: teamID}
}

func (e HiddenChainNotSupportedError) Error() string {
	return fmt.Sprintf("hidden team chain is not enabled for team %s", e.teamID)
}

type RepeatPTKGenerationError struct {
	q   keybase1.PerTeamKeyGeneration
	msg string
}

func newRepeatPTKGenerationError(q keybase1.PerTeamKeyGeneration, msg string) RepeatPTKGenerationError {
	return RepeatPTKGenerationError{q, msg}
}

func (e RepeatPTKGenerationError) Error() string {
	return fmt.Sprintf("Repeated PTK Generation found at %d (%s)", e.q, e.msg)
}

type ParentPointerError struct {
	q   keybase1.Seqno
	msg string
}

func newParentPointerError(q keybase1.Seqno, msg string) ParentPointerError {
	return ParentPointerError{q, msg}
}

func (e ParentPointerError) Error() string {
	return fmt.Sprintf("hidden team parent pointer error (to visible %d): %s", e.q, e.msg)
}

type TombstonedError struct {
	note string
}

func (e TombstonedError) Error() string {
	return fmt.Sprintf("hidden team tombstoned error: %s", e.note)
}

func NewTombstonedError(format string, args ...interface{}) TombstonedError {
	return TombstonedError{fmt.Sprintf(format, args...)}
}

var _ error = TombstonedError{}
