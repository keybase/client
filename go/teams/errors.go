package teams

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
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
	return fmt.Sprintf("%s (stubbed link when not expected; at seqno %d)",
		*e.note, int(e.l.outerLink.Seqno))
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
	return fmt.Sprintf("proof error for proof '%s': %s", p.p.reason, p.msg)
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

type PrevError struct {
	Msg string
}

func NewPrevError(format string, args ...interface{}) error {
	return PrevError{fmt.Sprintf(format, args...)}
}

func (e PrevError) Error() string {
	return e.Msg
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

type ResolveError struct {
	name keybase1.TeamName
	id   keybase1.TeamID
}

func (e ResolveError) Error() string {
	return fmt.Sprintf("mismatched team name and id: %v <-/-> %v", e.name.String(), e.id.String())
}

func NewResolveError(name keybase1.TeamName, id keybase1.TeamID) ResolveError {
	return ResolveError{name, id}
}

type TeamDoesNotExistError struct {
	descriptor string
	public     bool // Whether this is about the public version of the team
}

func (e TeamDoesNotExistError) Error() string {
	if e.public {
		return fmt.Sprintf("Team %q (public) does not exist", e.descriptor)
	}
	return fmt.Sprintf("Team %q does not exist", e.descriptor)
}

func NewTeamDoesNotExistError(public bool, format string, args ...interface{}) error {
	return TeamDoesNotExistError{
		descriptor: fmt.Sprintf(format, args...),
		public:     public,
	}
}

type ImplicitTeamOperationError struct {
	msg string
}

func (e ImplicitTeamOperationError) Error() string {
	return fmt.Sprintf("Implicit team operation not allowed: %v", e.msg)
}

func NewImplicitTeamOperationError(format string, args ...interface{}) error {
	return &ImplicitTeamOperationError{msg: fmt.Sprintf(format, args...)}
}

func fixupTeamGetError(ctx context.Context, g *libkb.GlobalContext, e error, teamDescriptor string, publicTeam bool) error {
	if e == nil {
		return nil
	}
	switch e := e.(type) {
	case libkb.AppStatusError:
		switch keybase1.StatusCode(e.Code) {
		case keybase1.StatusCode_SCTeamReadError:
			g.Log.CDebugf(ctx, "replacing error: %v", e)
			e.Desc = fmt.Sprintf("You are not a member of team %q; try `keybase team request-access %s` for access", teamDescriptor, teamDescriptor)
		case keybase1.StatusCode_SCTeamNotFound:
			return NewTeamDoesNotExistError(publicTeam, teamDescriptor)
		default:
		}
	case TeamDoesNotExistError:
		// Replace the not found error so that it has a name instead of team ID.
		// If subteams are involved the name might not correspond to the ID
		// but it's better to have this undertandable error message that's accurate
		// most of the time than one with an ID that's always accurate.
		g.Log.CDebugf(ctx, "replacing error: %v", e)
		return NewTeamDoesNotExistError(publicTeam, teamDescriptor)
	}
	return e
}

func NewKeyMaskNotFoundErrorForApplication(a keybase1.TeamApplication) libkb.KeyMaskNotFoundError {
	return libkb.KeyMaskNotFoundError{App: a}
}

func NewKeyMaskNotFoundErrorForApplicationAndGeneration(a keybase1.TeamApplication, g keybase1.PerTeamKeyGeneration) libkb.KeyMaskNotFoundError {
	return libkb.KeyMaskNotFoundError{App: a, Gen: g}
}
