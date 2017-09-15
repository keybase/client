package teams

import (
	"context"
	"encoding/json"
	"io/ioutil"
	"os"
	"path/filepath"
	"reflect"
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
		ID           keybase1.TeamID   `json:"id"`
		Links        []json.RawMessage `json:"links"`
		TeamKeyBoxes []struct {
			Seqno   keybase1.Seqno        `json:"seqno"` // the team seqno at which the box was added
			TeamBox TeamBox               `json:"box"`
			Prev    *prevKeySealedEncoded `json:"prev"`
		} `json:"team_key_boxes"`
	} `json:"teams"`
	Users map[string] /*user label*/ struct {
		UID               keybase1.UID                       `json:"uid"`
		EldestSeqno       keybase1.Seqno                     `json:"eldest_seqno"`
		LinkMap           map[keybase1.Seqno]keybase1.LinkID `json:"link_map"`
		PerUserKeySecrets map[keybase1.Seqno]string/*hex of PerUserKeySeed*/ `json:"puk_secrets"`
	} `json:"users"`
	KeyOwners        map[keybase1.KID] /*kid*/ string/*username*/ `json:"key_owners"`
	KeyPubKeyV2NaCls map[keybase1.KID]json.RawMessage `json:"key_pubkeyv2nacls"`
	TeamMerkle       map[string] /*TeamID AND TeamID-seqno:Seqno*/ struct {
		Seqno  keybase1.Seqno  `json:"seqno"`
		LinkID keybase1.LinkID `json:"link_id"`
	} `json:"team_merkle"`
	MerkleTriples map[string] /*LeafID-HashMeta*/ libkb.MerkleTriple `json:"merkle_triples"`

	// A session is a series of Load operations sharing a cache.
	Sessions []struct {
		Loads []TestCaseLoad `json:"loads"`
	} `json:"sessions"`

	Todo bool `json:"todo"`
}

type TestCaseLoad struct {
	// Client behavior
	NeedAdmin         bool `json:"need_admin"`
	NeedKeyGeneration int  `json:"need_keygen"`

	// Server behavior
	Stub          []keybase1.Seqno              `json:"stub"`           // Stub out these links.
	Omit          []keybase1.Seqno              `json:"omit"`           // Do not return these links.
	Upto          keybase1.Seqno                `json:"upto"`           // Load up to this seqno inclusive.
	SubteamReader bool                          `json:"subteam_reader"` // Whether to say the response is for the purpose of loading a subteam
	OmitPrevs     keybase1.PerTeamKeyGeneration `json:"omit_prevs"`     // Do not return prevs that contain the secret for <= this number
	ForceLastBox  bool                          `json:"force_last_box"` // Send the last known box no matter what
	OmitBox       bool                          `json:"omit_box"`       // Send no box

	// Expected result
	Error       bool   `json:"error"`
	ErrorSubstr string `json:"error_substr"`
	ErrorType   string `json:"error_type"`
	NStubbed    *int   `json:"n_stubbed"`
	ThenGetKey  int    `json:"then_get_key"`
}

func TestUnits(t *testing.T) {
	t.Logf("running units")
	cwd, err := os.Getwd()
	require.NoError(t, err)
	jsonDir := filepath.Join(cwd, "../vendor/github.com/keybase/keybase-test-vectors/teamchains")
	if os.Getenv("KEYBASE_TEAM_TEST_NOVENDOR") == "1" {
		jsonDir = filepath.Join(cwd, "../../../keybase-test-vectors/teamchains")
	}
	files, err := ioutil.ReadDir(jsonDir)
	require.NoError(t, err)
	selectUnit := os.Getenv("KEYBASE_TEAM_TEST_SELECT")
	var runLog []string
	for _, f := range files {
		if !f.IsDir() && strings.HasSuffix(f.Name(), ".json") {
			if len(selectUnit) > 0 && f.Name() != selectUnit && f.Name() != selectUnit+".json" {
				continue
			}
			runUnitFile(t, filepath.Join(jsonDir, f.Name()))
			runLog = append(runLog, f.Name())
		}
	}
	require.NotZero(t, runLog, "found no test units")
	t.Logf("ran %v units", len(runLog))
	for _, name := range runLog {
		t.Logf("  ✓ %v", name)
	}
	if len(selectUnit) > 0 {
		t.Fatalf("test passed but only ran selected unit: %v", runLog)
	}
}

func runUnitFile(t *testing.T, jsonPath string) {
	fileName := filepath.Base(jsonPath)
	t.Logf("reading test json file: %v", fileName)
	data, err := ioutil.ReadFile(jsonPath)
	require.NoError(t, err)
	var unit TestCase
	err = json.Unmarshal(data, &unit)
	require.NoError(t, err, "reading unit file json")
	unit.FileName = fileName
	runUnit(t, unit)
}

func runUnit(t *testing.T, unit TestCase) {
	t.Logf("starting unit: %v", unit.FileName)
	defer t.Logf("exit unit: %v", unit.FileName)

	// Print the link payloads
	for teamLabel, team := range unit.Teams {
		for i, link := range team.Links {
			var outer struct {
				PayloadJSON string `json:"payload_json"`
			}
			err := json.Unmarshal(link, &outer)
			require.NoError(t, err)
			var inner interface{}
			err = json.Unmarshal([]byte(outer.PayloadJSON), &inner)
			if err != nil {
				t.Logf("team link '%v' #'%v': corrupted: %v", err)
			} else {
				bs, err := json.MarshalIndent(inner, "", "  ")
				require.NoError(t, err)
				t.Logf("team link '%v' #'%v': %v", teamLabel, i+1, string(bs))
			}
		}
	}

	require.NotNil(t, unit.Sessions, "unit has no sessions")
	for iSession, session := range unit.Sessions {
		require.NotNil(t, session.Loads, "unit has no loads in session %v", iSession)

		tc := SetupTest(t, "team", 1)
		defer tc.Cleanup()

		// Install a loader with a mock interface to the outside world.
		t.Logf("install mock loader")
		mock := NewMockLoaderContext(t, tc.G, unit)
		storage := NewStorage(tc.G)
		loader := NewTeamLoader(tc.G, mock, storage)
		tc.G.SetTeamLoader(loader)

		for iLoad, loadSpec := range session.Loads {
			t.Logf("load the team session:%v load:%v", iSession, iLoad)
			mock.state = MockLoaderContextState{
				loadSpec: loadSpec,
			}
			loadArg := keybase1.LoadTeamArg{
				NeedAdmin:   loadSpec.NeedAdmin,
				ForceRepoll: iLoad > 0,
				Name:        mock.defaultTeamName.String(),
			}
			if loadSpec.NeedKeyGeneration > 0 {
				loadArg.Refreshers = keybase1.TeamRefreshers{
					NeedKeyGeneration: keybase1.PerTeamKeyGeneration(loadSpec.NeedKeyGeneration),
				}
			}
			team, err := Load(context.TODO(), tc.G, loadArg)
			if err != nil {
				t.Logf("got error: [%T] %v", err, err)
			}
			if !loadSpec.Error {
				require.NoError(t, err, "unit: %v", unit.FileName)
				for _, teamDesc := range unit.Teams {
					if loadSpec.Upto == 0 {
						require.Len(t, team.chain().inner.LinkIDs, len(teamDesc.Links))
					}
					if loadSpec.NStubbed != nil {
						require.Len(t, team.chain().inner.StubbedLinks, *loadSpec.NStubbed, "number of stubbed links in load result")
					}
					if loadSpec.ThenGetKey != 0 {
						gen := keybase1.PerTeamKeyGeneration(loadSpec.ThenGetKey)
						_, err := team.ApplicationKeyAtGeneration(keybase1.TeamApplication_KBFS, gen)
						require.NoError(t, err, "getting application key at gen: %v", gen)
					}
				}
			} else {
				require.Errorf(t, err, "unexpected team load success in %v", unit.FileName)
				errstr := err.Error()
				if len(loadSpec.ErrorSubstr) > 0 {
					require.Contains(t, errstr, loadSpec.ErrorSubstr)
				}
				if len(loadSpec.ErrorType) > 0 {
					require.Equal(t, loadSpec.ErrorType, reflect.TypeOf(err).Name(), "unexpected error type")
				}
			}
		}
	}

	require.False(t, unit.Todo, "test marked as TODO")
}
