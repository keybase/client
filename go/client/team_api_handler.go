package client

import (
	"encoding/json"
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

func (t *teamAPIHandler) handleV1(ctx context.Context, c Call, w io.Writer) error {
	if err := t.requireOptionsV1(c); err != nil {
		return err
	}

	cli, err := GetTeamsClient(t.G())
	if err != nil {
		return err
	}
	t.cli = cli

	switch c.Method {
	case "add-members":
		return t.addMembers(ctx, c, w)
	case "create-team":
		return t.createTeam(ctx, c, w)
	case "delete-team":
		return t.deleteTeam(ctx, c, w)
	case "edit-member":
		return t.editMember(ctx, c, w)
	case "leave-team":
		return t.leaveTeam(ctx, c, w)
	case "list-self-memberships":
		return t.listSelfMemberships(ctx, c, w)
	case "list-team-memberships":
		return t.listTeamMemberships(ctx, c, w)
	case "list-user-memberships":
		return t.listUserMemberships(ctx, c, w)
	case "remove-member":
		return t.removeMember(ctx, c, w)
	case "rename-subteam":
		return t.renameSubteam(ctx, c, w)
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
	sendChatNotification := name.IsRootTeam()

	createRes, err := t.cli.TeamCreate(context.TODO(), keybase1.TeamCreateArg{
		Name:                 name.String(),
		SendChatNotification: sendChatNotification,
	})
	if err != nil {
		return t.encodeErr(c, err, w)
	}

	return t.encodeResult(c, createRes, w)
}

func (t *teamAPIHandler) deleteTeam(ctx context.Context, c Call, w io.Writer) error {
	return nil
}

func (t *teamAPIHandler) editMember(ctx context.Context, c Call, w io.Writer) error {
	return nil
}

func (t *teamAPIHandler) leaveTeam(ctx context.Context, c Call, w io.Writer) error {
	return nil
}

func (t *teamAPIHandler) listSelfMemberships(ctx context.Context, c Call, w io.Writer) error {
	arg := keybase1.TeamListArg{
		All: true,
	}
	list, err := t.cli.TeamList(ctx, arg)
	if err != nil {
		return t.encodeErr(c, err, w)
	}
	return t.encodeResult(c, list, w)
}

type listTeamOptions struct {
	Team            string `json:"team"`
	IncludeSubteams bool   `json:"include-subteams"`
	ForcePoll       bool   `json:"force-poll"`
}

func (t *teamAPIHandler) listTeamMemberships(ctx context.Context, c Call, w io.Writer) error {
	return nil
}

type listUserOptions struct {
	UserAssertion string `json:"user"`
}

func (t *teamAPIHandler) listUserMemberships(ctx context.Context, c Call, w io.Writer) error {
	return nil
}

func (t *teamAPIHandler) removeMember(ctx context.Context, c Call, w io.Writer) error {
	return nil
}

func (t *teamAPIHandler) renameSubteam(ctx context.Context, c Call, w io.Writer) error {
	return nil
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
	reply := Reply{
		Result: result,
	}
	return t.encodeReply(call, reply, w)
}

func (t *teamAPIHandler) encodeErr(call Call, err error, w io.Writer) error {
	reply := Reply{Error: &CallError{Message: err.Error()}}
	return t.encodeReply(call, reply, w)
}

func (t *teamAPIHandler) encodeReply(call Call, reply Reply, w io.Writer) error {
	reply.Jsonrpc = call.Jsonrpc
	reply.ID = call.ID

	enc := json.NewEncoder(w)
	if t.indent {
		enc.SetIndent("", "    ")
	}
	return enc.Encode(reply)
}

func (t *teamAPIHandler) unmarshalOptions(c Call, opts Checker) error {
	if len(c.Params.Options) == 0 {
		return nil
	}
	if err := json.Unmarshal(c.Params.Options, opts); err != nil {
		return err
	}
	return opts.Check()
}

func mapRole(srole string) (keybase1.TeamRole, error) {
	role, ok := keybase1.TeamRoleMap[strings.ToUpper(srole)]
	if !ok {
		return 0, errors.New("invalid team role, please use owner, admin, writer, or reader")
	}

	return role, nil

}

type Checker interface {
	Check() error
}
