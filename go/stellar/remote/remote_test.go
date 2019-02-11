package remote

import (
	"encoding/json"
	"testing"
)

func TestAirdropDetailsDecode(t *testing.T) {
	out := `{"status":{"code":0,"name":"OK"},"details":{"header":{"title":"Get free Lumens monthly","body":"Starting March 1, Keybase will divide *50,000 XLM* (Stellar Lumens) among qualified Keybase users, every month."},"sections":[{"section":"What is this?","lines":[{"text":"See it as a Robin Hood program of crypto money.  Every month, Keybase will divide 50,000 XLM (Stellar Lumens) among a pool of qualified users.","bullet":false}]},{"section":"Who qualifies?","lines":[{"text":"Keybase users who:","bullet":false},{"text":"have at least 3 devices or paper keys","bullet":true},{"text":"have a Keybase, GitHub, or Hacker News account that was registered before July 1, 2018.","bullet":true}]},{"section":"Where are the Lumens dropped?","lines":[{"text":"Your fraction of the 50,000 XLM will fall straight into your default wallet account.","bullet":false}]}]},"csrf_token":"lgHZIGY1NWZmMTZmNjZmNDMzNjAyNjZiOTVkYjZmOGZlYzE5zlxTn4LOAIPWAMDEIPZdVC9Ntogg+aFrWMuMY12mqz+F2aO0AVmM1aUC/kLt"}`
	var d airdropDetails
	if err := json.Unmarshal([]byte(out), &d); err != nil {
		t.Fatal(err)
	}
	expected := `{"header":{"title":"Get free Lumens monthly","body":"Starting March 1, Keybase will divide *50,000 XLM* (Stellar Lumens) among qualified Keybase users, every month."},"sections":[{"section":"What is this?","lines":[{"text":"See it as a Robin Hood program of crypto money.  Every month, Keybase will divide 50,000 XLM (Stellar Lumens) among a pool of qualified users.","bullet":false}]},{"section":"Who qualifies?","lines":[{"text":"Keybase users who:","bullet":false},{"text":"have at least 3 devices or paper keys","bullet":true},{"text":"have a Keybase, GitHub, or Hacker News account that was registered before July 1, 2018.","bullet":true}]},{"section":"Where are the Lumens dropped?","lines":[{"text":"Your fraction of the 50,000 XLM will fall straight into your default wallet account.","bullet":false}]}]}`
	if string(d.Details) != expected {
		t.Errorf("details mismatch.  expected: %s, actual: %s", expected, d.Details)
	}
}
