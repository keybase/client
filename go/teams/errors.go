package teams

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func NewStubbedError(l *ChainLinkUnpacked) StubbedError {
	return StubbedError{l: l, note: nil}
}

func NewStubbedErrorWithNote(l *ChainLinkUnpacked, note string) StubbedError {
	return StubbedError{l: l, note: &note}
}

type StubbedError struct {
	l    *ChainLinkUnpacked
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
	l    *ChainLinkUnpacked
	note string
}

func (e InvalidLink) Error() string {
	return fmt.Sprintf("invalid link (seqno %d): %s", e.l.Seqno(), e.note)
}

func NewInvalidLink(l *ChainLinkUnpacked, format string, args ...interface{}) InvalidLink {
	return InvalidLink{l, fmt.Sprintf(format, args...)}
}

type AppendLinkError struct {
	prevSeqno keybase1.Seqno
	l         *ChainLinkUnpacked
	inner     error
}

func (e AppendLinkError) Error() string {
	return fmt.Sprintf("appending %v->%v: %v", e.prevSeqno, e.l.Seqno(), e.inner)
}

func NewAppendLinkError(l *ChainLinkUnpacked, prevSeqno keybase1.Seqno, inner error) AppendLinkError {
	return AppendLinkError{prevSeqno, l, inner}
}

type InflateError struct {
	l    *ChainLinkUnpacked
	note *string
}

func (e InflateError) Error() string {
	if e.note == nil {
		return fmt.Sprintf("error inflating previously-stubbed link (seqno %d)", int(e.l.outerLink.Seqno))
	}
	return fmt.Sprintf("error inflating previously-stubbed link (seqno %d) (%s)",
		int(e.l.outerLink.Seqno), *e.note)
}

func NewInflateError(l *ChainLinkUnpacked) InflateError {
	return InflateError{l: l, note: nil}
}

func NewInflateErrorWithNote(l *ChainLinkUnpacked, note string) InflateError {
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

type ExplicitTeamOperationError struct {
	msg string
}

func (e ExplicitTeamOperationError) Error() string {
	return fmt.Sprintf("Operation only allowed on implicit teams: %s", e.msg)
}

func NewImplicitTeamOperationError(format string, args ...interface{}) error {
	return &ImplicitTeamOperationError{msg: fmt.Sprintf(format, args...)}
}

func NewExplicitTeamOperationError(m string) error {
	return &ExplicitTeamOperationError{msg: m}
}

func IsTeamReadError(err error) bool {
	switch e := err.(type) {
	case libkb.AppStatusError:
		switch keybase1.StatusCode(e.Code) {
		case keybase1.StatusCode_SCTeamReadError:
			return true
		}
	}
	return false
}

func FixupTeamGetError(ctx context.Context, g *libkb.GlobalContext, e error, teamDescriptor string, publicTeam bool) error {
	return fixupTeamGetError(ctx, g, e, teamDescriptor, publicTeam)
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
			return e
		case keybase1.StatusCode_SCTeamNotFound:
			g.Log.CDebugf(ctx, "replacing error: %v", e)
			return NewTeamDoesNotExistError(publicTeam, teamDescriptor)
		}
	case TeamDoesNotExistError:
		// Replace the not found error so that it has a name instead of team ID.
		// If subteams are involved the name might not correspond to the ID
		// but it's better to have this understandable error message that's accurate
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

type AdminPermissionRequiredError struct{}

func NewAdminPermissionRequiredError() error { return &AdminPermissionRequiredError{} }

func (e AdminPermissionRequiredError) Error() string {
	return "Only admins can perform this operation."
}

type ImplicitAdminCannotLeaveError struct{}

func NewImplicitAdminCannotLeaveError() error { return &ImplicitAdminCannotLeaveError{} }

func (e ImplicitAdminCannotLeaveError) Error() string {
	return "You cannot leave this team. You are an implicit admin (admin of a parent team) but not an explicit member."
}

type TeamDeletedError struct{}

func NewTeamDeletedError() error { return &TeamDeletedError{} }

func (e TeamDeletedError) Error() string {
	return "team has been deleted"
}

type SubteamOwnersError struct{}

func NewSubteamOwnersError() error { return &SubteamOwnersError{} }

func (e SubteamOwnersError) Error() string {
	return "Subteams cannot have owners. Try admin instead."
}

// The sigchain link is problematically new.
type GreenLinkError struct{ seqno keybase1.Seqno }

func NewGreenLinkError(seqno keybase1.Seqno) error {
	return GreenLinkError{seqno: seqno}
}

func (e GreenLinkError) Error() string {
	// Report the probable cause for this error.
	return fmt.Sprintf("team sigchain is being rapidly updated (seqno: %v)", e.seqno)
}

type UnsupportedLinkTypeError struct {
	outerType libkb.SigchainV2Type
	innerType string
}

func NewUnsupportedLinkTypeError(outerType libkb.SigchainV2Type, innerType string) error {
	return UnsupportedLinkTypeError{
		outerType: outerType,
		innerType: innerType,
	}
}

func (e UnsupportedLinkTypeError) Error() string {
	return fmt.Sprintf("unsupported team link type: %v (%v)", e.outerType, e.innerType)
}

type PrecheckAppendError struct {
	Inner error
}

func NewPrecheckAppendError(inner error) error { return PrecheckAppendError{Inner: inner} }

func (e PrecheckAppendError) Error() string {
	return fmt.Sprintf("Precheck append error: %v", e.Inner)
}

type PrecheckStructuralError struct {
	Inner error
	Msg   string
}

func NewPrecheckStructuralError(message string, inner error) error {
	return PrecheckStructuralError{Inner: inner, Msg: message}
}

func (e PrecheckStructuralError) Error() string {
	if e.Inner != nil {
		return fmt.Sprintf("Precheck structural error: %s: %v", e.Msg, e.Inner)
	}
	return e.Msg
}

type AttemptedInviteSocialOwnerError struct{ Msg string }

func NewAttemptedInviteSocialOwnerError(assertion string) error {
	them := assertion
	if assertion == "" {
		them = "That user"
	}
	return AttemptedInviteSocialOwnerError{Msg: fmt.Sprintf("%v doesn't have a Keybase account yet, so you can't add them"+
		" as an owner; you can add them as reader or writer.", them)}
}

func (e AttemptedInviteSocialOwnerError) Error() string { return e.Msg }

type UserHasNotResetError struct{ Msg string }

func NewUserHasNotResetError(format string, args ...interface{}) error {
	return UserHasNotResetError{Msg: fmt.Sprintf(format, args...)}
}

func (e UserHasNotResetError) Error() string { return e.Msg }

type AddMembersError struct {
	Assertion string
	Err       error
}

func NewAddMembersError(a string, e error) AddMembersError {
	return AddMembersError{a, e}
}

func (a AddMembersError) Error() string {
	return fmt.Sprintf("Error adding user '%v': %v", a.Assertion, a.Err)
}

type BadNameError struct {
	Msg string
}

func (b BadNameError) Error() string {
	return fmt.Sprintf("bad name error: %s", b.Msg)
}

func NewBadNameError(s string) BadNameError {
	return BadNameError{Msg: s}
}

type FastLoadError struct {
	Msg string
}

func (f FastLoadError) Error() string {
	return fmt.Sprintf("fast load error: %s", f.Msg)
}

func NewFastLoadError(format string, args ...interface{}) error {
	return FastLoadError{Msg: fmt.Sprintf(format, args...)}
}

type BadPublicError struct {
	id       keybase1.TeamID
	isPublic bool
}

func NewBadPublicError(id keybase1.TeamID, isPublic bool) error {
	return BadPublicError{id, isPublic}
}

func (e BadPublicError) Error() string {
	return fmt.Sprintf("Public bit for team %s is wrong (%v)", e.id, e.isPublic)
}

type AuditError struct {
	Msg string
}

func NewAuditError(format string, args ...interface{}) error {
	return AuditError{Msg: fmt.Sprintf(format, args...)}
}

func (e AuditError) Error() string {
	return fmt.Sprintf("Audit error: %s", e.Msg)
}

type KBFSKeyGenerationError struct {
	Required, Exists int
}

func NewKBFSKeyGenerationError(required, exists int) KBFSKeyGenerationError {
	return KBFSKeyGenerationError{
		Required: required,
		Exists:   exists,
	}
}

func (e KBFSKeyGenerationError) Error() string {
	return fmt.Sprintf("KBFS key generation too low: %v < %v", e.Exists, e.Required)
}

type FTLMissingSeedError struct {
	gen keybase1.PerTeamKeyGeneration
}

func NewFTLMissingSeedError(g keybase1.PerTeamKeyGeneration) error {
	return FTLMissingSeedError{gen: g}
}

func (e FTLMissingSeedError) Error() string {
	return fmt.Sprintf("FTL Missing seed at generation: %d", e.gen)
}

type MixedEmailAssertionError struct{}

func NewMixedEmailAssertionError() error {
	return MixedEmailAssertionError{}
}

func (e MixedEmailAssertionError) Error() string {
	return "cannot add team members with mixed trust"
}
