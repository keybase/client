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

type InvalidLink struct {
	l    *chainLinkUnpacked
	note string
}

func (e InvalidLink) Error() string {
	return fmt.Sprintf("invalid link (seqno %d): %s", e.l.Seqno(), e.note)
}

func NewInvalidLink(l *chainLinkUnpacked, format string, args ...interface{}) InvalidLink {
	return InvalidLink{l, fmt.Sprintf(format, args...)}
}

type AppendLinkError struct {
	prevSeqno keybase1.Seqno
	l         *chainLinkUnpacked
	inner     error
}

func (e AppendLinkError) Error() string {
	return fmt.Sprintf("appending %v->%v: %v", e.prevSeqno, e.l.Seqno(), e.inner)
}

func NewAppendLinkError(l *chainLinkUnpacked, prevSeqno keybase1.Seqno, inner error) AppendLinkError {
	return AppendLinkError{prevSeqno, l, inner}
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

func NewInflateError(l *chainLinkUnpacked) InflateError {
	return InflateError{l: l, note: nil}
}

func NewInflateErrorWithNote(l *chainLinkUnpacked, note string) InflateError {
	return InflateError{l: l, note: &note}
}

type UnexpectedSeqnoError struct {
	expected keybase1.Seqno
	actual   keybase1.Seqno
}

func (e UnexpectedSeqnoError) Error() string {
	return fmt.Sprintf("expected seqno:%v but got %v", e.expected, e.actual)
}

func NewUnexpectedSeqnoError(expected, actual keybase1.Seqno) UnexpectedSeqnoError {
	return UnexpectedSeqnoError{expected, actual}
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

type ProofError struct {
	p   proof
	msg string
}

func NewProofError(p proof, s string) ProofError {
	return ProofError{p, s}
}

func (p ProofError) Error() string {
	return fmt.Sprintf("proof error for proof %+v: %s", p.p, p.msg)
}

type PermissionError struct {
	TeamID      keybase1.TeamID
	UserVersion keybase1.UserVersion
	Desc        string
}

func NewPermissionError(t keybase1.TeamID, uv keybase1.UserVersion, d string) PermissionError {
	return PermissionError{t, uv, d}
}

func (e PermissionError) Error() string {
	return fmt.Sprintf("For team %s, user %s: %s", e.TeamID, e.UserVersion.PercentForm(), e.Desc)
}

type InviteError struct {
	msg string
}

func NewInviteError(m string) InviteError {
	return InviteError{m}
}

func (i InviteError) Error() string {
	return fmt.Sprintf("Invite error: %s", i.msg)
}
