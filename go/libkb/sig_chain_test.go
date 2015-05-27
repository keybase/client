package libkb

import (
	// "fmt"
	"encoding/json"
	"io/ioutil"
	"path"
	"reflect"
	"sort"
	"testing"
	"time"

	jsonw "github.com/keybase/go-jsonw"
)

// TODO: For now the tests have all been given strict error types. In the
// future we will probably want something a little looser, to accommodate
// implementation differences (usually the order in which different checks
// happen).
func getErrorTypesMap() map[string]reflect.Type {
	return map[string]reflect.Type{
		"BAD_LINK_FORMAT":           nil,
		"NONEXISTENT_KID":           reflect.TypeOf(KeyFamilyError{}),
		"VERIFY_FAILED":             reflect.TypeOf(BadSigError{}),
		"REVERSE_SIG_VERIFY_FAILED": reflect.TypeOf(ReverseSigError{}),
		"KID_MISMATCH":              reflect.TypeOf(ChainLinkKIDMismatchError{}),
		"FINGERPRINT_MISMATCH":      reflect.TypeOf(ChainLinkFingerprintMismatchError{}),
		"CTIME_MISMATCH":            reflect.TypeOf(CtimeMismatchError{}),
		"INVALID_SIBKEY":            reflect.TypeOf(KeyRevokedError{}),
		"EXPIRED_SIBKEY":            reflect.TypeOf(KeyExpiredError{}),
		"WRONG_UID":                 reflect.TypeOf(UidMismatchError{}),
		"WRONG_USERNAME":            reflect.TypeOf(BadUsernameError{}),
		"WRONG_SEQNO":               reflect.TypeOf(ChainLinkWrongSeqnoError{}),
		"WRONG_PREV":                reflect.TypeOf(ChainLinkPrevHashMismatchError{}),
	}
}

// One of the test cases from the JSON list of all tests.
type TestCase struct {
	Input   string `json:"input"`
	Len     int    `json:"len"`
	Sibkeys int    `json:"sibkeys"`
	Subkeys int    `json:"subkeys"`
	ErrType string `json:"err_type"`
	Eldest  string `json:"eldest"`
}

// The JSON list of all test cases.
type TestList struct {
	Tests      map[string]TestCase `json:"tests"`
	ErrorTypes []string            `json:"error_types"`
}

// The input data for a single test. Each tests has its own input JSON file.
type TestInput struct {
	// We omit the "chain" member here, because we need it in blob form.
	Username  string            `json:"username"`
	UID       string            `json:"uid"`
	Keys      []string          `json:"keys"`
	LabelKids map[string]string `json:"label_kids"`
	LabelSigs map[string]string `json:"label_sigs"`
}

func TestAllChains(t *testing.T) {
	tc := SetupTest(t, "test_all_chains")
	defer tc.Cleanup()

	testChainsJson, _ := ioutil.ReadFile("test_chains.json")
	var testList TestList
	json.Unmarshal([]byte(testChainsJson), &testList)
	// Always do the tests in alphabetical order.
	testNames := []string{}
	for name := range testList.Tests {
		testNames = append(testNames, name)
	}
	sort.Strings(testNames)
	for _, name := range testNames {
		testCase := testList.Tests[name]
		G.Log.Info("starting sigchain test case %s (%s)", name, testCase.Input)
		doChainTest(t, testCase)
	}
}

func doChainTest(t *testing.T, testCase TestCase) {
	inputJSON, err := ioutil.ReadFile(path.Join("test_chains", testCase.Input))
	if err != nil {
		t.Fatal(err)
	}
	// Unmarshal test input in two ways: once for the structured data and once
	// for the chain link blobs.
	var input TestInput
	err = json.Unmarshal([]byte(inputJSON), &input)
	if err != nil {
		t.Fatal(err)
	}
	inputBlob, err := jsonw.Unmarshal([]byte(inputJSON))
	if err != nil {
		t.Fatal(err)
	}
	uid, err := UidFromHex(input.UID)
	if err != nil {
		t.Fatal(err)
	}
	sigchain := SigChain{username: input.Username, uid: uid}
	chainLen, err := inputBlob.AtKey("chain").Len()
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < chainLen; i++ {
		linkBlob := inputBlob.AtKey("chain").AtIndex(i)
		link, err := ImportLinkFromServer(&sigchain, linkBlob, uid)
		if err != nil {
			t.Fatal(err)
		}
		sigchain.chainLinks = append(sigchain.chainLinks, link)
	}

	// Get the eldest key. This is assumed to be the first key in the list of
	// bundles, unless the "eldest" field is given in the test description, in
	// which case the eldest key is specified by name.
	var eldestKID KID
	if testCase.Eldest == "" {
		eldestKey, err := ParseGenericKey(input.Keys[0], G)
		if err != nil {
			t.Fatal(err)
		}
		eldestKID = eldestKey.GetKid()
	} else {
		eldestKIDStr, found := input.LabelKids[testCase.Eldest]
		if !found {
			t.Fatalf("No KID found for label %s", testCase.Eldest)
		}
		eldestKID, err = ImportKID(eldestKIDStr)
		if err != nil {
			t.Fatal(err)
		}
	}

	// Parse all the bundles.
	keyFamily, err := createKeyFamily(input.Keys)
	if err != nil {
		t.Fatal(err)
	}

	// Run the actual sigchain verification. This is most of the code that's
	// actually being tested.
	ckf := ComputedKeyFamily{kf: keyFamily}
	_, sigchainErr := sigchain.VerifySigsAndComputeKeys(&eldestKID, &ckf)

	// Some tests expect an error. If we get one, make sure it's the right
	// type.
	if testCase.ErrType != "" {
		if sigchainErr == nil {
			t.Fatal("Expected error from VerifySigsAndComputeKeys.")
		}
		expectedType := getErrorTypesMap()[testCase.ErrType]
		foundType := reflect.TypeOf(sigchainErr)
		if expectedType == foundType {
			// Success! We found the error we expected. This test is done.
			G.Log.Debug("EXPECTED error encountered", sigchainErr)
			return
		} else {
			// Got an error, but one of the wrong type. Tests with error names
			// that are missing from the map (maybe because we add new test
			// cases in the future) will also hit this branch.
			t.Fatalf("Wrong error type encountered. Expected %s (%s), got %s: %s",
				expectedType, testCase.ErrType, foundType, sigchainErr)
		}
	}

	// Tests that expected an error terminated above. Tests that get here
	// should succeed without errors.
	if sigchainErr != nil {
		t.Fatal(err)
	}

	// Check the expected results: total unrevoked links, sibkeys, and subkeys.
	unrevokedCount := 0
	idtable := NewIdentityTable(FOKID{Kid: eldestKID}, &sigchain, nil)
	for _, link := range idtable.links {
		if !link.IsRevoked() {
			unrevokedCount++
		}
	}
	if unrevokedCount != testCase.Len {
		t.Fatalf("Expected %d unrevoked links, but found %d.", testCase.Len, unrevokedCount)
	}
	// Don't use the current time to get keys, because that will cause test
	// failures 5 years from now :-D
	testTime := time.Unix(sigchain.chainLinks[len(sigchain.chainLinks)-1].unpacked.ctime, 0)
	numSibkeys := len(ckf.GetAllActiveSibkeysAtTime(testTime))
	if numSibkeys != testCase.Sibkeys {
		t.Fatalf("Expected %d sibkeys, got %d", testCase.Sibkeys, numSibkeys)
	}
	numSubkeys := len(ckf.GetAllActiveSubkeysAtTime(testTime))
	if numSubkeys != testCase.Subkeys {
		t.Fatalf("Expected %d subkeys, got %d", testCase.Subkeys, numSubkeys)
	}

	// Success!
}

func createKeyFamily(bundles []string) (*KeyFamily, error) {
	allKeys := jsonw.NewArray(len(bundles))
	for i, bundle := range bundles {
		err := allKeys.SetIndex(i, jsonw.NewString(bundle))
		if err != nil {
			return nil, err
		}
	}
	publicKeys := jsonw.NewDictionary()
	publicKeys.SetKey("all_bundles", allKeys)
	return ParseKeyFamily(publicKeys)
}
