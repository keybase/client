package client

import (
	"errors"
	"io"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type teamAPIHandler struct {
	libkb.Contextified
	cli    keybase1.TeamsClient
	indent bool
}

func newTeamAPIHandler(g *libkb.GlobalContext, indentOutput bool) *teamAPIHandler {
	return &teamAPIHandler{Contextified: libkb.NewContextified(g), indent: indentOutput}
}

func (t *teamAPIHandler) handle(ctx context.Context, c Call, w io.Writer) error {
	switch c.Params.Version {
	case 0, 1:
		return t.handleV1(ctx, c, w)
	default:
		return ErrInvalidVersion{version: c.Params.Version}
	}
}

const (
	addMembersMethod    = "add-members"
	createTeamMethod    = "create-team"
	editMemberMethod    = "edit-member"
	leaveTeamMethod     = "leave-team"
	listSelfMethod      = "list-self-memberships"
	listTeamMethod      = "list-team-memberships"
	listUserMethod      = "list-user-memberships"
	removeMemberMethod  = "remove-member"
	renameSubteamMethod = "rename-subteam"
	listRequestsMethod  = "list-requests"
)

var validMethodsV1 = map[string]bool{
	addMembersMethod:    true,
	createTeamMethod:    true,
	editMemberMethod:    true,
	leaveTeamMethod:     true,
	listSelfMethod:      true,
	listTeamMethod:      true,
	listUserMethod:      true,
	removeMemberMethod:  true,
	renameSubteamMethod: true,
	listRequestsMethod:  true,
}

func (t *teamAPIHandler) handleV1(ctx context.Context, c Call, w io.Writer) error {
	if !validMethodsV1[c.Method] {
		return ErrInvalidMethod{name: c.Method, version: 1}
	}

	if err := t.requireOptionsV1(c); err != nil {
		return err
	}

	cli, err := GetTeamsClient(t.G())
	if err != nil {
		return err
	}
	t.cli = cli

	switch c.Method {
	case addMembersMethod:
		return t.addMembers(ctx, c, w)
	case createTeamMethod:
		return t.createTeam(ctx, c, w)
	case editMemberMethod:
		return t.editMember(ctx, c, w)
	case leaveTeamMethod:
		return t.leaveTeam(ctx, c, w)
	case listSelfMethod:
		return t.listSelfMemberships(ctx, c, w)
	case listTeamMethod:
		return t.listTeamMemberships(ctx, c, w)
	case listUserMethod:
		return t.listUserMemberships(ctx, c, w)
	case removeMemberMethod:
		return t.removeMember(ctx, c, w)
	case renameSubteamMethod:
		return t.renameSubteam(ctx, c, w)
	case listRequestsMethod:
		return t.listRequests(ctx, c, w)
	default:
		return ErrInvalidMethod{name: c.Method, version: 1}
	}
}

type memberEmail struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

type memberUsername struct {
	Username string `json:"username"`
	Role     string `json:"role"`
}

type addMembersOptions struct {
	Team      string           `json:"team"`
	Emails    []memberEmail    `json:"emails"`
	Usernames []memberUsername `json:"usernames"`
}

func (a *addMembersOptions) Check() error {
	if len(a.Team) == 0 {
		return errors.New("`team` field required")
	}

	if len(a.Emails) == 0 && len(a.Usernames) == 0 {
		return errors.New("no emails or usernames specified")
	}

	for _, e := range a.Emails {
		if len(e.Email) == 0 {
			return errors.New("empty email address")
		}
		if len(e.Role) == 0 {
			return errors.New("empty role")
		}
		if _, err := mapRole(e.Role); err != nil {
			return err
		}
	}

	for _, u := range a.Usernames {
		if len(u.Username) == 0 {
			return errors.New("empty username")
		}
		if len(u.Role) == 0 {
			return errors.New("empty role")
		}
		if _, err := mapRole(u.Role); err != nil {
			return err
		}
	}

	return nil
}

func (t *teamAPIHandler) addMembers(ctx context.Context, c Call, w io.Writer) error {
	var opts addMembersOptions
	if err := t.unmarshalOptions(c, &opts); err != nil {
		return t.encodeErr(c, err, w)
	}

	// currently service endpoint can only handle one at a time
	// can improve this when CORE-6172 is complete
	var args []keybase1.TeamAddMemberArg
	for _, e := range opts.Emails {
		role, err := mapRole(e.Role)
		if err != nil {
			return t.encodeErr(c, err, w)
		}
		arg := keybase1.TeamAddMemberArg{
			Name:  opts.Team,
			Email: e.Email,
			Role:  role,
		}
		args = append(args, arg)
	}
	for _, u := range opts.Usernames {
		role, err := mapRole(u.Role)
		if err != nil {
			return t.encodeErr(c, err, w)
		}
		arg := keybase1.TeamAddMemberArg{
			Name:     opts.Team,
			Username: u.Username,
			Role:     role,
		}
		args = append(args, arg)
	}

	var all []keybase1.TeamAddMemberResult
	for _, arg := range args {
		res, err := t.cli.TeamAddMember(ctx, arg)
		if err != nil {
			return t.encodeErr(c, err, w)
		}
		all = append(all, res)
	}

	return t.encodeResult(c, all, w)
}

type createTeamOptions struct {
	Team string `json:"team"`
}

func (c *createTeamOptions) Check() error {
	_, err := keybase1.TeamNameFromString(c.Team)
	return err
}

func (t *teamAPIHandler) createTeam(ctx context.Context, c Call, w io.Writer) error {
	var opts createTeamOptions
	if err := t.unmarshalOptions(c, &opts); err != nil {
		return t.encodeErr(c, err, w)
	}

	name, err := keybase1.TeamNameFromString(opts.Team)
	if err != nil {
		return t.encodeErr(c, err, w)
	}

	type createResExportT struct {
		ChatSent     bool `codec:"chatSent" json:"chatSent"`
		CreatorAdded bool `codec:"creatorAdded" json:"creatorAdded"`
	}
	createRes, err := t.cli.TeamCreate(context.TODO(), keybase1.TeamCreateArg{
		Name: name.String(),
	})
	if err != nil {
		return t.encodeErr(c, err, w)
	}
	createResExport := createResExportT{
		ChatSent:     createRes.ChatSent,
		CreatorAdded: createRes.CreatorAdded,
	}

	return t.encodeResult(c, createResExport, w)
}

type editMemberOptions struct {
	Team     string `json:"team"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

func (e *editMemberOptions) Check() error {
	_, err := keybase1.TeamNameFromString(e.Team)
	if err != nil {
		return err
	}
	if len(e.Username) == 0 {
		return errors.New("empty username")
	}
	if len(e.Role) == 0 {
		return errors.New("empty role")
	}
	if _, err := mapRole(e.Role); err != nil {
		return err
	}

	return nil
}

func (t *teamAPIHandler) editMember(ctx context.Context, c Call, w io.Writer) error {
	var opts editMemberOptions
	if err := t.unmarshalOptions(c, &opts); err != nil {
		return t.encodeErr(c, err, w)
	}

	role, err := mapRole(opts.Role)
	if err != nil {
		return t.encodeErr(c, err, w)
	}
	arg := keybase1.TeamEditMemberArg{
		Name:     opts.Team,
		Username: opts.Username,
		Role:     role,
	}
	if err := t.cli.TeamEditMember(ctx, arg); err != nil {
		return t.encodeErr(c, err, w)
	}

	return t.encodeResult(c, nil, w)
}

type leaveTeamOptions struct {
	Team      string `json:"team"`
	Permanent bool   `json:"permanent"`
}

func (c *leaveTeamOptions) Check() error {
	_, err := keybase1.TeamNameFromString(c.Team)
	return err
}

func (t *teamAPIHandler) leaveTeam(ctx context.Context, c Call, w io.Writer) error {
	var opts leaveTeamOptions
	if err := t.unmarshalOptions(c, &opts); err != nil {
		return t.encodeErr(c, err, w)
	}

	arg := keybase1.TeamLeaveArg{
		Name:      opts.Team,
		Permanent: opts.Permanent,
	}
	if err := t.cli.TeamLeave(ctx, arg); err != nil {
		return t.encodeErr(c, err, w)
	}
	return t.encodeResult(c, nil, w)
}

func (t *teamAPIHandler) listSelfMemberships(ctx context.Context, c Call, w io.Writer) error {
	list, err := t.cli.TeamListTeammates(ctx, keybase1.TeamListTeammatesArg{})
	if err != nil {
		return t.encodeErr(c, err, w)
	}
	return t.encodeResult(c, list, w)
}

type listTeamOptions struct {
	Team      string `json:"team"`
	ForcePoll bool   `json:"force-poll"`
}

func (c *listTeamOptions) Check() error {
	_, err := keybase1.TeamNameFromString(c.Team)
	return err
}

func (t *teamAPIHandler) listTeamMemberships(ctx context.Context, c Call, w io.Writer) error {
	var opts listTeamOptions
	if err := t.unmarshalOptions(c, &opts); err != nil {
		return t.encodeErr(c, err, w)
	}

	arg := keybase1.TeamGetArg{
		Name: opts.Team,
	}
	details, err := t.cli.TeamGet(ctx, arg)
	if err != nil {
		return t.encodeErr(c, err, w)
	}

	return t.encodeResult(c, details, w)
}

type listUserOptions struct {
	UserAssertion        string `json:"username"`
	IncludeImplicitTeams bool   `json:"include-implicit-teams"`
}

func (o *listUserOptions) Check() error {
	if len(o.UserAssertion) == 0 {
		return errors.New("list-user-memberships: \"user\" required")
	}

	return nil
}

func (t *teamAPIHandler) listUserMemberships(ctx context.Context, c Call, w io.Writer) error {
	var opts listUserOptions
	if err := t.unmarshalOptions(c, &opts); err != nil {
		return t.encodeErr(c, err, w)
	}

	arg := keybase1.TeamListUnverifiedArg{
		UserAssertion:        opts.UserAssertion,
		IncludeImplicitTeams: opts.IncludeImplicitTeams,
	}
	list, err := t.cli.TeamListUnverified(ctx, arg)
	if err != nil {
		return t.encodeErr(c, err, w)
	}

	return t.encodeResult(c, list, w)
}

type removeMemberOptions struct {
	Team     string `json:"team"`
	Username string `json:"username"`
}

func (c *removeMemberOptions) Check() error {
	if _, err := keybase1.TeamNameFromString(c.Team); err != nil {
		return err
	}
	if len(c.Username) == 0 {
		return errors.New("remove-member: specify username to remove")
	}

	return nil
}

func (t *teamAPIHandler) removeMember(ctx context.Context, c Call, w io.Writer) error {
	var opts removeMemberOptions
	if err := t.unmarshalOptions(c, &opts); err != nil {
		return t.encodeErr(c, err, w)
	}

	arg := keybase1.TeamRemoveMemberArg{
		Name:     opts.Team,
		Username: opts.Username,
	}
	if err := t.cli.TeamRemoveMember(ctx, arg); err != nil {
		return t.encodeErr(c, err, w)
	}
	return t.encodeResult(c, nil, w)
}

type renameOptions struct {
	Team        string `json:"team"`
	NewTeamName string `json:"new-team-name"`
}

func (c *renameOptions) Check() error {
	if err := checkSubteam(c.Team); err != nil {
		return err
	}
	return checkSubteam(c.NewTeamName)
}

func (t *teamAPIHandler) renameSubteam(ctx context.Context, c Call, w io.Writer) error {
	var opts renameOptions
	if err := t.unmarshalOptions(c, &opts); err != nil {
		return t.encodeErr(c, err, w)
	}

	name, err := keybase1.TeamNameFromString(opts.Team)
	if err != nil {
		return t.encodeErr(c, err, w)
	}
	newName, err := keybase1.TeamNameFromString(opts.NewTeamName)
	if err != nil {
		return t.encodeErr(c, err, w)
	}

	arg := keybase1.TeamRenameArg{
		PrevName: name,
		NewName:  newName,
	}
	if err := t.cli.TeamRename(ctx, arg); err != nil {
		return t.encodeErr(c, err, w)
	}
	return t.encodeResult(c, nil, w)
}

type listRequestsOptions struct {
	Team string `json:"team"`
}

func (c *listRequestsOptions) Check() error {
	if c.Team == "" {
		return nil
	}

	_, err := keybase1.TeamNameFromString(c.Team)
	return err
}

func (t *teamAPIHandler) listRequests(ctx context.Context, c Call, w io.Writer) error {
	var opts listRequestsOptions
	if err := t.unmarshalOptions(c, &opts); err != nil {
		return t.encodeErr(c, err, w)
	}

	arg := keybase1.TeamListRequestsArg{}
	if opts.Team != "" {
		arg.TeamName = &opts.Team
	}

	reqs, err := t.cli.TeamListRequests(ctx, arg)
	if err != nil {
		return t.encodeErr(c, err, w)
	}

	return t.encodeResult(c, reqs, w)
}

func (t *teamAPIHandler) requireOptionsV1(c Call) error {
	if len(c.Params.Options) == 0 {
		if c.Method != "list-self-memberships" {
			return ErrInvalidOptions{version: 1, method: c.Method, err: errors.New("empty options")}
		}
	}
	return nil

}

func (t *teamAPIHandler) encodeResult(call Call, result interface{}, w io.Writer) error {
	return encodeResult(call, result, w, t.indent)
}

func (t *teamAPIHandler) encodeErr(call Call, err error, w io.Writer) error {
	return encodeErr(call, err, w, t.indent)
}

func (t *teamAPIHandler) unmarshalOptions(c Call, opts Checker) error {
	// Note: keeping this len check here because unmarshalOptions behaves differently:
	// it runs opts.Check() when len(c.Params.Options) == 0 and unclear if
	// that is the desired behavior for team API, so leaving this here for now.
	if len(c.Params.Options) == 0 {
		return nil
	}
	return unmarshalOptions(c, opts)
}

func mapRole(srole string) (keybase1.TeamRole, error) {
	role, ok := keybase1.TeamRoleMap[strings.ToUpper(srole)]
	if !ok {
		return 0, errors.New("invalid team role, please use owner, admin, writer, or reader")
	}

	return role, nil

}

func checkSubteam(name string) error {
	n, err := keybase1.TeamNameFromString(name)
	if err != nil {
		return err
	}
	if n.IsRootTeam() {
		return errors.New("can only rename subteams")
	}
	return nil
}
