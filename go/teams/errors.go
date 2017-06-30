package teams

import (
	"fmt"

	"github.com/keybase/client/go/protocol/keybase1"
)

func NewStubbedError(l *chainLinkUnpacked) StubbedError {
	return StubbedError{l: l, note: nil}
}

func NewStubbedErrorWithNote(l *chainLinkUnpacked, note string) StubbedError {
	return StubbedError{l: l, note: &note}
}

type StubbedError struct {
	l    *chainLinkUnpacked
	note *string
}

func (e StubbedError) Error() string {
	if e.note == nil {
		return fmt.Sprintf("stubbed link when not expected (seqno %d)", int(e.l.outerLink.Seqno))
	}
	return fmt.Sprintf("stubbed link when not expected (seqno %d) (%s)",
		int(e.l.outerLink.Seqno), *e.note)
}

func NewInflateError(l *chainLinkUnpacked) InflateError {
	return InflateError{l: l, note: nil}
}

func NewInflateErrorWithNote(l *chainLinkUnpacked, note string) InflateError {
	return InflateError{l: l, note: &note}
}

type InflateError struct {
	l    *chainLinkUnpacked
	note *string
}

func (e InflateError) Error() string {
	if e.note == nil {
		return fmt.Sprintf("error inflating previously-stubbed link (seqno %d)", int(e.l.outerLink.Seqno))
	}
	return fmt.Sprintf("error inflating previously-stubbed link (seqno %d) (%s)",
		int(e.l.outerLink.Seqno), *e.note)
}

type AdminPermissionError struct {
	TeamID      keybase1.TeamID
	UserVersion keybase1.UserVersion
	Desc        string
}

func (e AdminPermissionError) Error() string {
	return fmt.Sprintf("For team %s, user %s: %s", e.TeamID, e.UserVersion.PercentForm(), e.Desc)
}

func NewAdminPermissionError(t keybase1.TeamID, uv keybase1.UserVersion, d string) AdminPermissionError {
	return AdminPermissionError{t, uv, d}
}

type AdminNotFoundError struct {
	Admin SCTeamAdmin
}

func (e AdminNotFoundError) Error() string {
	return fmt.Sprintf("Admin permission specified in %+v wasn't found", e.Admin)
}

func NewAdminNotFoundError(a SCTeamAdmin) AdminNotFoundError {
	return AdminNotFoundError{a}
}
