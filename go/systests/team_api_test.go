package systests

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestTeamAPI(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUser("onr")
	tt.addUser("wtr")
	tt.addUser("botua")
	tt.addUser("rbot")

	assertTeamAPIOutput(t, tt.users[0],
		`{"method": "list-self-memberships"}`,
		`{"result":{"teams":null,"annotatedActiveInvites":{}}}`)

	teamName, err := libkb.RandHexString("t", 6)
	require.NoError(t, err)

	assertTeamAPIOutput(t, tt.users[0],
		`{"method": "create-team", "params": {"options": {"team": "`+teamName+`"}}}`,
		`{"result":{"chatSent":true,"creatorAdded":true}}`)

	assertTeamAPIOutput(t, tt.users[0],
		`{"method": "add-members", "params": {"options": {"team": "`+teamName+`", "usernames": [{"username": "`+tt.users[1].username+`", "role": "reader"}]}}}`,
		`{"result":[{"invited":false,"user":{"uid":"`+tt.users[1].uid.String()+`","username":"`+tt.users[1].username+`"},"emailSent":false,"chatSending":false}]}`)
	assertTeamAPIOutput(t, tt.users[0],
		`{"method": "add-members", "params": {"options": {"team": "`+teamName+`", "usernames": [{"username": "`+tt.users[2].username+`", "role": "bot"}]}}}`,
		`{"result":[{"invited":false,"user":{"uid":"`+tt.users[2].uid.String()+`","username":"`+tt.users[2].username+`"},"emailSent":false,"chatSending":false}]}`)
	// TODO HOTPOT-227 reenable
	//assertTeamAPIOutput(t, tt.users[0],
	//	`{"method": "add-members", "params": {"options": {"team": "`+teamName+`", "usernames": [{"username": "`+tt.users[3].username+`", "role": "restrictedbot"}]}}}`,
	//	`{"result":[{"invited":false,"user":{"uid":"`+tt.users[3].uid.String()+`","username":"`+tt.users[3].username+`"},"emailSent":false,"chatSending":false}]}`)

	assertTeamAPIOutput(t, tt.users[0],
		`{"method": "create-team", "params": {"options": {"team": "`+teamName+`.sub"}}}`,
		`{"result":{"chatSent":true,"creatorAdded":false}}`)

	assertTeamAPIOutput(t, tt.users[0],
		`{"method": "rename-subteam", "params": {"options": {"team": "`+teamName+`.sub", "new-team-name": "`+teamName+`.sub2"}}}`,
		`{}`)

	assertTeamAPIOutput(t, tt.users[0],
		`{"method": "edit-member", "params": {"options": {"team": "`+teamName+`", "username": "`+tt.users[1].username+`", "role": "writer"}}}`,
		`{}`)

	assertTeamAPIOutput(t, tt.users[0],
		`{"method": "remove-member", "params": {"options": {"team": "`+teamName+`", "username": "`+tt.users[1].username+`"}}}`,
		`{}`)
	assertTeamAPIOutput(t, tt.users[0],
		`{"method": "remove-member", "params": {"options": {"team": "`+teamName+`", "username": "`+tt.users[2].username+`"}}}`,
		`{}`)
	// TODO HOTPOT-227 reenable
	//assertTeamAPIOutput(t, tt.users[0],
	//	`{"method": "remove-member", "params": {"options": {"team": "`+teamName+`", "username": "`+tt.users[3].username+`"}}}`,
	//	`{}`)
}

func assertTeamAPIOutput(t *testing.T, u *userPlusDevice, in, expectedOut string) {
	out, err := runTeamAPI(t, u, in)
	require.NoError(t, err)

	out = strings.TrimSpace(out)
	require.Equal(t, expectedOut, out)
}

func runTeamAPI(t *testing.T, u *userPlusDevice, json string) (string, error) {
	cmd := client.NewCmdTeamAPIRunner(u.tc.G)
	cmd.SetMessage(json)
	r, err := libkb.RandString("teamapi", 4)
	if err != nil {
		return "", err
	}
	filename := filepath.Join(os.TempDir(), r+".json")
	cmd.SetOutputFile(filename)
	defer os.Remove(filename)
	if err := cmd.Run(); err != nil {
		return "", err
	}
	out, err := ioutil.ReadFile(filename)
	if err != nil {
		return "", err
	}
	return string(out), nil
}
