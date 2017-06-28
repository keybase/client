package teams

import (
	"fmt"
	"github.com/keybase/client/go/protocol/keybase1"
)

func NewStubbedError(l *chainLinkUnpacked) StubbedError {
	return StubbedError{l}
}

type StubbedError struct {
	l *chainLinkUnpacked
}

func (e StubbedError) Error() string {
	return fmt.Sprintf("stubbed link when not expected (seqno %d)", int(e.l.outerLink.Seqno))
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
