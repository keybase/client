package teams

import (
	"context"
	"encoding/json"
	"io/ioutil"
	"os"
	"path"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type TestCase struct {
	FileName string
	Log      []string `json:"log"`
	Teams    map[string] /*team label*/ struct {
		Links      []json.RawMessage `json:"links"`
		TeamKeyBox *TeamBox          `json:"team_key_box"`
	} `json:"teams"`
	Users map[string] /*user label*/ struct {
		UID               keybase1.UID                       `json:"uid"`
		EldestSeqno       keybase1.Seqno                     `json:"eldest_seqno"`
		LinkMap           map[keybase1.Seqno]keybase1.LinkID `json:"link_map"`
		PerUserKeySecrets map[keybase1.Seqno]string/*hex of PerUserKeySeed*/ `json:"puk_secrets"`
	} `json:"users"`
	KeyOwners        map[keybase1.KID] /*kid*/ string/*username*/ `json:"key_owners"`
	KeyPubKeyV2NaCls map[keybase1.KID]json.RawMessage `json:"key_pubkeyv2nacls"`
	TeamMerkle       map[keybase1.TeamID]struct {
		Seqno  keybase1.Seqno  `json:"seqno"`
		LinkID keybase1.LinkID `json:"link_id"`
	} `json:"team_merkle"`
	MerkleTriples map[string] /*LeafID-HashMeta*/ libkb.MerkleTriple `json:"merkle_triples"`

	Expect struct {
		Error       bool   `json:"error"`
		ErrorSubstr string `json:"error_substr"`
	} `json:"expect"`
}

func TestUnits(t *testing.T) {
	t.Logf("running units")
	cwd, err := os.Getwd()
	require.NoError(t, err)
	jsonDir := path.Join(cwd, "../vendor/github.com/keybase/keybase-test-vectors/teamchains")
	files, err := ioutil.ReadDir(jsonDir)
	require.NoError(t, err)
	var nRun int
	for _, f := range files {
		if !f.IsDir() && strings.HasSuffix(f.Name(), ".json") {
			runUnitFile(t, path.Join(jsonDir, f.Name()))
			nRun++
		}
	}
	t.Logf("ran %v units", nRun)
	require.NotZero(t, nRun, "found no test units")
}

func runUnitFile(t *testing.T, jsonPath string) {
	fileName := path.Base(jsonPath)
	t.Logf("reading test json file: %v", fileName)
	data, err := ioutil.ReadFile(jsonPath)
	require.NoError(t, err)
	var unit TestCase
	err = json.Unmarshal(data, &unit)
	require.NoError(t, err)
	unit.FileName = fileName
	runUnit(t, unit)
}

func runUnit(t *testing.T, unit TestCase) {
	t.Logf("starting unit: %v", unit.FileName)

	for teamLabel, team := range unit.Teams {
		for i, link := range team.Links {
			var outer struct {
				PayloadJSON string `json:"payload_json"`
			}
			err := json.Unmarshal(link, &outer)
			require.NoError(t, err)
			var inner interface{}
			err = json.Unmarshal([]byte(outer.PayloadJSON), &inner)
			require.NoError(t, err)
			bs, err := json.MarshalIndent(inner, "", "  ")
			require.NoError(t, err)
			t.Logf("team link '%v' #'%v': %v", teamLabel, i+1, string(bs))
		}
	}

	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	// Install a loader with a mock interface to the outside world.
	t.Logf("install mock loader")
	mock := NewMockLoaderContext(t, tc.G, unit)
	storage := NewStorage(tc.G)
	loader := NewTeamLoader(tc.G, mock, storage)
	tc.G.SetTeamLoader(loader)

	// TODO replace this with data from the unit
	teamName, err := keybase1.TeamNameFromString("cabal")
	require.NoError(t, err)
	mock.state.teamIDs = make(map[string] /*TeamName*/ keybase1.TeamID)
	mock.state.teamIDs[teamName.String()] = teamName.ToTeamID()
	mock.state.teamNames = make(map[keybase1.TeamID]keybase1.TeamName)
	mock.state.teamNames[teamName.ToTeamID()] = teamName

	t.Logf("load the team")
	team, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name: "cabal",
	})
	expect := unit.Expect
	if !expect.Error {
		require.NoError(t, err, "unit: %v", unit.FileName)
		for _, teamDesc := range unit.Teams {
			require.Len(t, team.chain().inner.LinkIDs, len(teamDesc.Links))
		}
	} else {
		require.Error(t, err, "unexpected team load success")
		errstr := err.Error()
		if len(expect.ErrorSubstr) > 0 {
			require.Contains(t, errstr, expect.ErrorSubstr)
		}
	}
}
