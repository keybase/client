package kbchat

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/keybase/go-keybase-chat-bot/kbchat/types/keybase1"
)

type ListTeamMembers struct {
	Result keybase1.TeamDetails `json:"result"`
	Error  Error                `json:"error"`
}

type ListMembersOutputMembersCategory struct {
	Username string `json:"username"`
	FullName string `json:"fullName"`
}

type ListUserMemberships struct {
	Result keybase1.AnnotatedTeamList `json:"result"`
	Error  Error                      `json:"error"`
}

func (a *API) ListMembersOfTeam(teamName string) (res keybase1.TeamMembersDetails, err error) {
	apiInput := fmt.Sprintf(`{"method": "list-team-memberships", "params": {"options": {"team": "%s"}}}`, teamName)
	cmd := a.runOpts.Command("team", "api")
	cmd.Stdin = strings.NewReader(apiInput)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	output, err := cmd.Output()
	if err != nil {
		return res, APIError{err}
	}
	if stderr.Len() != 0 {
		log.Printf("ListMembersOfTeam error: %s", stderr.String())
	}

	members := ListTeamMembers{}
	err = json.Unmarshal(output, &members)
	if err != nil {
		return res, UnmarshalError{err}
	}
	if members.Error.Message != "" {
		return res, members.Error
	}
	return members.Result.Members, nil
}

func (a *API) ListUserMemberships(username string) ([]keybase1.AnnotatedMemberInfo, error) {
	apiInput := fmt.Sprintf(`{"method": "list-user-memberships", "params": {"options": {"username": "%s"}}}`, username)
	cmd := a.runOpts.Command("team", "api")
	cmd.Stdin = strings.NewReader(apiInput)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	output, err := cmd.Output()
	if err != nil {
		return nil, APIError{err}
	}
	if stderr.Len() != 0 {
		log.Printf("ListUserMemberships error: %s", stderr.String())
	}

	members := ListUserMemberships{}
	err = json.Unmarshal(output, &members)
	if err != nil {
		return nil, UnmarshalError{err}
	}
	if members.Error.Message != "" {
		return nil, members.Error
	}
	return members.Result.Teams, nil
}
