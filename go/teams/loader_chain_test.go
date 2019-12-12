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
	"github.com/keybase/client/go/sig3"
	"github.com/keybase/client/go/teams/hidden"
	storage "github.com/keybase/client/go/teams/storage"

	jsonw "github.com/keybase/go-jsonw"
)

type TestCase struct {
	FileName string
	Log      []string `json:"log"`
	Teams    map[string] /*team label*/ struct {
		ID           keybase1.TeamID   `json:"id"`
		Links        []json.RawMessage `json:"links"`
		Hidden       []sig3.ExportJSON `json:"hidden"`
		TeamKeyBoxes []struct {
			ChainType keybase1.SeqType      `json:"chain_type"`
			Seqno     keybase1.Seqno        `json:"seqno"` // the team seqno at which the box was added
			TeamBox   TeamBox               `json:"box"`
			Prev      *prevKeySealedEncoded `json:"prev"`
		} `json:"team_key_boxes"`
		RatchetBlindingKeySet *hidden.RatchetBlindingKeySet `json:"ratchet_blinding_keys"`
	} `json:"teams"`
	Users map[string] /*user label*/ struct {
		UID               keybase1.UID   `json:"uid"`
		EldestSeqno       keybase1.Seqno `json:"eldest_seqno"`
		LinkMap           linkMapT       `json:"link_map"`
		PerUserKeySecrets map[keybase1.Seqno]string/*hex of PerUserKeySeed*/ `json:"puk_secrets"`
	} `json:"users"`
	KeyOwners        map[keybase1.KID] /*kid*/ string/*username*/ `json:"key_owners"`
	KeyPubKeyV2NaCls map[keybase1.KID]json.RawMessage `json:"key_pubkeyv2nacls"`
	TeamMerkle       map[string] /*TeamID AND TeamID-seqno:Seqno*/ struct {
		Seqno      keybase1.Seqno             `json:"seqno"`
		LinkID     keybase1.LinkID            `json:"link_id"`
		HiddenResp libkb.MerkleHiddenResponse `json:"hidden_response"`
	} `json:"team_merkle"`
	MerkleTriples map[string] /*LeafID-HashMeta*/ libkb.MerkleTriple `json:"merkle_triples"`

	// A session is a series of Load operations sharing a cache.
	Sessions []struct {
		Loads []TestCaseLoad `json:"loads"`
	} `json:"sessions"`

	Skip bool `json:"skip"`
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
	HiddenUpto    keybase1.Seqno                `json:"hidden_upto"`    // Load up to this seqno inclusive (for hidden chains)

	// Expected result
	Error            bool   `json:"error"`
	ErrorSubstr      string `json:"error_substr"`
	ErrorType        string `json:"error_type"`
	ErrorTypeFull    string `json:"error_type_full"`
	ErrorAfterGetKey bool   `json:"error_after_get_key"`
	NStubbed         *int   `json:"n_stubbed"`
	ThenGetKey       int    `json:"then_get_key"`
}

func getTeamchainJSONDir(t *testing.T) string {
	cwd, err := os.Getwd()
	require.NoError(t, err)
	jsonDir := filepath.Join(cwd, "../vendor/github.com/keybase/keybase-test-vectors/teamchains")
	if os.Getenv("KEYBASE_TEAM_TEST_NOVENDOR") == "1" {
		t.Log("Ignoring vendored keybase-test-vectors/teamchains test cases due to env variable (using the local copy at ../../../keybase-test-vectors/teamchains instead)")
		jsonDir = filepath.Join(cwd, "../../../keybase-test-vectors/teamchains")
	}
	return jsonDir
}

func TestUnits(t *testing.T) {
	t.Logf("running units")
	jsonDir := getTeamchainJSONDir(t)
	files, err := ioutil.ReadDir(jsonDir)
	require.NoError(t, err)
	selectUnit := os.Getenv("KEYBASE_TEAM_TEST_SELECT")
	var runLog []string
	var skipLog []string
	for _, f := range files {
		if !f.IsDir() && strings.HasSuffix(f.Name(), ".json") {
			if len(selectUnit) > 0 && f.Name() != selectUnit && f.Name() != selectUnit+".json" {
				continue
			}
			_, didRun := runUnitFile(t, filepath.Join(jsonDir, f.Name()))
			if didRun {
				runLog = append(runLog, f.Name())
			} else {
				skipLog = append(skipLog, f.Name())
			}
		}
	}
	require.NotZero(t, runLog, "found no test units")
	t.Logf("ran %v units", len(runLog))
	for _, name := range runLog {
		t.Logf("  ✓ %v", name)
	}
	if len(skipLog) > 0 {
		s := ""
		if len(skipLog) != 1 {
			s = "s"
		}
		t.Logf("skipped %d unit%s", len(skipLog), s)
		for _, name := range skipLog {
			t.Logf("  ⏭️ %s", name)
		}
	}
	if len(selectUnit) > 0 {
		t.Fatalf("test passed but only ran selected unit: %v", runLog)
	}
}

func runUnitFile(t *testing.T, jsonPath string) (*Team, bool) {
	fileName := filepath.Base(jsonPath)
	t.Logf("reading test json file: %v", fileName)
	data, err := ioutil.ReadFile(jsonPath)
	require.NoError(t, err)
	var unit TestCase
	err = json.Unmarshal(data, &unit)
	if err != nil {
		handleTestCaseLoadFailure(t, data, err)
		return nil, true
	}
	unit.FileName = fileName
	return runUnit(t, unit)
}

type loadFailure struct {
	Failure struct {
		Error         bool   `json:"error"`
		ErrorTypeFull string `json:"error_type_full"`
		ErrorSubstr   string `json:"error_substr"`
	} `json:"load_failure"`
}

func handleTestCaseLoadFailure(t *testing.T, data []byte, loadErr error) {
	var unit loadFailure
	err := json.Unmarshal(data, &unit)
	require.NoError(t, err, "reading unit file json (after failure)")
	require.True(t, unit.Failure.Error, "unexpected failure in test load: %v", loadErr)
	require.Equal(t, unit.Failure.ErrorTypeFull, reflect.TypeOf(loadErr).String())
	require.Contains(t, loadErr.Error(), unit.Failure.ErrorSubstr)
}

func runUnitFromFilename(t *testing.T, filename string) (*Team, bool) {
	jsonDir := getTeamchainJSONDir(t)
	return runUnitFile(t, filepath.Join(jsonDir, filename))
}

func runUnit(t *testing.T, unit TestCase) (lastLoadRet *Team, didRun bool) {
	t.Logf("starting unit: %v", unit.FileName)
	defer t.Logf("exit unit: %v", unit.FileName)

	if unit.Skip {
		t.Logf("Marked 'skip' so skipping")
		return nil, false
	}

	// Print the link payloads
	for teamLabel, team := range unit.Teams {
		for i, link := range team.Links {
			var outer struct {
				PayloadJSON string `json:"payload_json"`
			}
			err := json.Unmarshal(link, &outer)
			require.NoError(t, err)
			var inner interface{}

			err = jsonw.EnsureMaxDepthBytesDefault([]byte(outer.PayloadJSON))
			if err != nil {
				t.Logf("team link '%v' #'%v': JSON exceeds max depth permissable: %v", teamLabel, i+1, err)
			}
			require.NoError(t, err)
			err = json.Unmarshal([]byte(outer.PayloadJSON), &inner)
			if err != nil {
				t.Logf("team link '%v' #'%v': corrupted: %v", teamLabel, i+1, err)
			} else {
				bs, err := json.MarshalIndent(inner, "", "  ")
				require.NoError(t, err)
				t.Logf("team link '%v' #'%v': %v", teamLabel, i+1, string(bs))
			}
		}
		for i, bundle := range team.Hidden {
			t.Logf("team hidden'%v' #'%v': %+v", teamLabel, i+1, bundle)
		}
	}

	require.NotNil(t, unit.Sessions, "unit has no sessions")
	for iSession, session := range unit.Sessions {
		require.NotNil(t, session.Loads, "unit has no loads in session %v", iSession)

		tc := SetupTest(t, "team", 1)
		defer tc.Cleanup()

		// The auditor won't work in this case, since we have fake links that won't match the
		// local database. In particular, the head merkle seqno might be off the right end
		// of the merkle sequence in the DB.
		tc.G.Env.Test.TeamSkipAudit = true

		// Install a loader with a mock interface to the outside world.
		t.Logf("install mock loader")
		mock := NewMockLoaderContext(t, tc.G, unit)
		merkleStorage := storage.NewMerkle()
		storage := storage.NewStorage(tc.G)
		loader := NewTeamLoader(tc.G, mock, storage, merkleStorage)
		tc.G.SetTeamLoader(loader)

		for iLoad, loadSpec := range session.Loads {
			t.Logf("load the team session:%v load:%v", iSession, iLoad)
			mock.state = MockLoaderContextState{
				loadSpec: loadSpec,
			}
			loadArg := keybase1.LoadTeamArg{
				NeedAdmin:                 loadSpec.NeedAdmin,
				ForceRepoll:               iLoad > 0,
				Name:                      mock.defaultTeamName.String(),
				SkipNeedHiddenRotateCheck: true,
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
						_, err := team.ApplicationKeyAtGeneration(context.Background(), keybase1.TeamApplication_KBFS, gen)
						if !loadSpec.ErrorAfterGetKey {
							require.NoError(t, err, "getting application key at gen: %v", gen)
						} else {
							require.Errorf(t, err, "unexpected get key success in %v", unit.FileName)
							errstr := err.Error()
							if len(loadSpec.ErrorSubstr) > 0 {
								require.Contains(t, errstr, loadSpec.ErrorSubstr)
							}
							if len(loadSpec.ErrorType) > 0 {
								require.Equal(t, loadSpec.ErrorType, reflect.TypeOf(err).Name(), "unexpected error type [%T]", err)
							}
							if len(loadSpec.ErrorTypeFull) > 0 {
								require.Equal(t, loadSpec.ErrorTypeFull, reflect.TypeOf(err).String(), "unexpected error type [%T]", err)
							}
						}
					} else {
						require.False(t, loadSpec.ErrorAfterGetKey, "test does not make sense: ErrorAfterGetKey but no ThenGetKey")
					}
				}
			} else {
				require.Errorf(t, err, "unexpected team load success in %v", unit.FileName)
				errstr := err.Error()
				if len(loadSpec.ErrorSubstr) > 0 {
					require.Contains(t, errstr, loadSpec.ErrorSubstr)
				}
				if len(loadSpec.ErrorType) > 0 {
					require.Equal(t, loadSpec.ErrorType, reflect.TypeOf(err).Name(), "unexpected error type [%T]", err)
				}
				if len(loadSpec.ErrorTypeFull) > 0 {
					require.Equal(t, loadSpec.ErrorTypeFull, reflect.TypeOf(err).String(), "unexpected error type [%T]", err)
				}
			}

			lastLoadRet = team
		}
	}

	require.False(t, unit.Todo, "test marked as TODO")
	return lastLoadRet, true
}
