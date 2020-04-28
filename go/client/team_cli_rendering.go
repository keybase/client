package client

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"text/tabwriter"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type teamMembersRenderer struct {
	libkb.Contextified
	json, showInviteID bool
	tabw               *tabwriter.Writer
}

func newTeamMembersRenderer(g *libkb.GlobalContext, json, showInviteID bool) *teamMembersRenderer {
	return &teamMembersRenderer{
		Contextified: libkb.NewContextified(g),
		json:         json,
		showInviteID: showInviteID,
	}
}

func (c *teamMembersRenderer) output(t keybase1.AnnotatedTeam, team string, verbose bool) error {
	if c.json {
		return c.outputJSON(t.ToLegacyTeamDetails())
	}

	return c.outputTerminal(t, team, verbose)
}

func (c *teamMembersRenderer) outputJSON(t keybase1.TeamDetails) error {
	b, err := json.MarshalIndent(t, "", "    ")
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	_, err = dui.Printf(string(b) + "\n")
	return err
}

func (c *teamMembersRenderer) outputTerminal(t keybase1.AnnotatedTeam, team string, verbose bool) error {
	dui := c.G().UI.GetTerminalUI()
	c.tabw = new(tabwriter.Writer)
	c.tabw.Init(dui.OutputWriter(), 0, 8, 2, ' ', 0)

	for _, member := range t.Members {
		var status string
		switch member.Status {
		case keybase1.TeamMemberStatus_RESET:
			status = " (inactive due to account reset)"
		case keybase1.TeamMemberStatus_DELETED:
			status = " (inactive due to account delete)"
		}
		fmt.Fprintf(c.tabw, "%s\t%s\t%s\t%s%s\n", team, member.Role.HumanString(), member.Username, member.FullName, status)
	}
	c.outputInvites(t.Invites)
	c.tabw.Flush()

	if verbose {
		dui.Printf("At team key generation: %d\n", t.KeyGeneration)
	}

	return nil
}

func (c *teamMembersRenderer) outputInvites(annotatedInvites []keybase1.AnnotatedTeamInvite) {
	sort.SliceStable(annotatedInvites, func(i, j int) bool {
		a, aErr := annotatedInvites[i].InviteMetadata.Invite.Type.C()
		b, bErr := annotatedInvites[j].InviteMetadata.Invite.Type.C()
		if aErr != nil || bErr != nil {
			return bErr != nil
		}
		return a.String() < b.String()
	})
	for _, annotatedInvite := range annotatedInvites {
		inviteMD := annotatedInvite.InviteMetadata
		invite := inviteMD.Invite
		category, err := invite.Type.C()
		if err != nil {
			fmt.Fprintf(c.tabw, "failed to parse invite; try updating your app\n")
			continue
		}
		switch category {
		case keybase1.TeamInviteCategory_UNKNOWN:
			fmt.Fprintf(c.tabw, "got unknown invite; try updating your app\n")
			continue
		case keybase1.TeamInviteCategory_KEYBASE:
			// skip keybase-type invites that will be shown in members view
			continue
		}

		trailer := fmt.Sprintf("(* invited by %s)", annotatedInvite.InviterUsername)
		inviteIDTrailer := ""
		if c.showInviteID {
			// Show invite IDs for SEITAN tokens, which can be used to cancel the invite.
			inviteIDTrailer = fmt.Sprintf(" (Invite ID: %s)", invite.Id)
		}
		switch category {
		case keybase1.TeamInviteCategory_EMAIL:
			trailer = fmt.Sprintf("(* invited via email by %s)", annotatedInvite.InviterUsername)
		case keybase1.TeamInviteCategory_PHONE:
			trailer = fmt.Sprintf("(* invited via phone by %s)", annotatedInvite.InviterUsername)
		case keybase1.TeamInviteCategory_SEITAN:
			trailer = fmt.Sprintf("(* invited via secret token by %s)%s",
				annotatedInvite.InviterUsername, inviteIDTrailer)
		case keybase1.TeamInviteCategory_INVITELINK:
			trailer = fmt.Sprintf("(* invite link created by %s)%s",
				annotatedInvite.InviterUsername, inviteIDTrailer)
		}

		fmtstring := "%s\t%s*\t%s\t%s\t%s\t\n"
		fmt.Fprintf(c.tabw, fmtstring,
			annotatedInvite.TeamName,
			strings.ToLower(invite.Role.String()),
			annotatedInvite.DisplayName,
			annotatedInvite.ValidityDescription,
			trailer,
		)
	}
}

func (c *teamMembersRenderer) outputTeams(list keybase1.AnnotatedTeamList, showAll bool) error {

	sort.Slice(list.Teams, func(i, j int) bool {
		if list.Teams[i].FqName == list.Teams[j].FqName {
			return list.Teams[i].Username < list.Teams[j].Username
		}
		return list.Teams[i].FqName < list.Teams[j].FqName
	})

	if c.json {
		b, err := json.Marshal(list)
		if err != nil {
			return err
		}
		tui := c.G().UI.GetTerminalUI()
		err = tui.OutputDesc(OutputDescriptorTeamList, string(b)+"\n")
		return err
	}

	dui := c.G().UI.GetTerminalUI()
	c.tabw = new(tabwriter.Writer)
	c.tabw.Init(dui.OutputWriter(), 0, 8, 4, ' ', 0)

	// Only print the username and full name columns when we're showing other users.
	if showAll {
		fmt.Fprintf(c.tabw, "Team\tRole\tUsername\tFull name\n")
	} else {
		fmt.Fprintf(c.tabw, "Team\tRole\tMembers\n")
	}
	for _, t := range list.Teams {
		var role string
		if t.Implicit != nil {
			role += "implied admin"
		}
		if t.Role != keybase1.TeamRole_NONE {
			if t.Implicit != nil {
				role += ", "
			}
			role += strings.ToLower(t.Role.String())
		}
		if showAll {
			var status string
			switch t.Status {
			case keybase1.TeamMemberStatus_RESET:
				status = " (inactive due to account reset)"
			case keybase1.TeamMemberStatus_DELETED:
				status = " (inactive due to account delete)"
			}
			if len(t.FullName) > 0 && len(status) > 0 {
				status = " " + status
			}
			fmt.Fprintf(c.tabw, "%s\t%s\t%s\t%s%s\n", t.FqName, role, t.Username, t.FullName, status)
		} else {
			fmt.Fprintf(c.tabw, "%s\t%s\t%d\n", t.FqName, role, t.MemberCount)
		}
	}

	c.tabw.Flush()
	return nil
}
