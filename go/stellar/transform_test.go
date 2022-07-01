package stellar

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
)

type atest struct {
	name   string
	json   string
	status stellar1.AirdropStatus
}

var atests = []atest{
	{
		name: "unqualified new account no proofs",
		json: `{"status":{"code":0,"name":"OK"},"already_registered":false,"qualifications":{"has_stellar_key":true,"has_enough_devices":false,"service_checks":{"keybase":{"service_username":"a1","account_created":1543864123,"is_old_enough":false,"is_used_already":false,"qualifies":false},"github":{"service_username":null,"account_created":null,"is_old_enough":false,"is_used_already":true,"qualifies":false},"hackernews":{"service_username":null,"account_created":null,"is_old_enough":false,"is_used_already":true,"qualifies":false}},"qualifies_overall":false,"is_before_registration_deadline":true},"airdrop_cfg":{"min_active_devices":3,"min_active_devices_title":"3 installed devices or paper keys","registration_deadline":1571633999,"account_creation_title":"Old enough Keybase, GitHub, or Hacker News account","account_creation_subtitle":"You can connect a GitHub or Hacker News account created before January 1, 2017 to qualify.","account_used":"Note that %s was already used to qualifiy a different account for the airdrop.","account_creation_deadlines":{"keybase":1514786400,"github":1483250400,"hackernews":1483250400}},"csrf_token":"lgHZIGY1NWZmMTZmNjZmNDMzNjAyNjZiOTVkYjZmOGZlYzE5zlxSWdXOAIPWAMDEILqynj/ovmhytFw+m8Xr3ns5UJ18X//dNSQe4gZwtDK/"}`,
		status: stellar1.AirdropStatus{
			State: stellar1.AirdropUnqualified,
			Rows: []stellar1.AirdropQualification{
				{
					Title: "3 installed devices or paper keys",
					Valid: false,
				},
				{
					Title:    "Old enough Keybase, GitHub, or Hacker News account",
					Subtitle: "You can connect a GitHub or Hacker News account created before January 1, 2017 to qualify.",
					Valid:    false,
				},
			},
		},
	},
	{
		name: "unqualified new account used proof",
		json: `{"status":{"code":0,"name":"OK"},"already_registered":false,"qualifications":{"has_stellar_key":true,"has_enough_devices":false,"service_checks":{"keybase":{"service_username":"a1","account_created":1543864123,"is_old_enough":false,"is_used_already":false,"qualifies":false},"github":{"service_username":"patrickxb","account_created":1000,"is_old_enough":true,"is_used_already":true,"qualifies":false},"hackernews":{"service_username":null,"account_created":null,"is_old_enough":false,"is_used_already":true,"qualifies":false}},"qualifies_overall":false,"is_before_registration_deadline":true},"airdrop_cfg":{"min_active_devices":3,"min_active_devices_title":"3 installed devices or paper keys","registration_deadline":1571633999,"account_creation_title":"Old enough Keybase, GitHub, or Hacker News account","account_creation_subtitle":"You can connect a GitHub or Hacker News account created before January 1, 2017 to qualify.","account_used":"Note that %s was already used to qualifiy a different account for the airdrop.","account_creation_deadlines":{"keybase":1514786400,"github":1483250400,"hackernews":1483250400}},"csrf_token":"lgHZIGY1NWZmMTZmNjZmNDMzNjAyNjZiOTVkYjZmOGZlYzE5zlxSWdXOAIPWAMDEILqynj/ovmhytFw+m8Xr3ns5UJ18X//dNSQe4gZwtDK/"}`,
		status: stellar1.AirdropStatus{
			State: stellar1.AirdropUnqualified,
			Rows: []stellar1.AirdropQualification{
				{
					Title: "3 installed devices or paper keys",
					Valid: false,
				},
				{
					Title:    "Old enough Keybase, GitHub, or Hacker News account",
					Subtitle: "You can connect a GitHub or Hacker News account created before January 1, 2017 to qualify. Note that patrickxb@github was already used to qualifiy a different account for the airdrop.",
					Valid:    false,
				},
			},
		},
	},
	{
		name: "new account qualifying proof",
		json: `{"status":{"code":0,"name":"OK"},"already_registered":false,"qualifications":{"has_stellar_key":true,"has_enough_devices":false,"service_checks":{"keybase":{"service_username":"a1","account_created":1543864123,"is_old_enough":false,"is_used_already":false,"qualifies":false},"github":{"service_username":"patrickxb","account_created":1000,"is_old_enough":true,"is_used_already":false,"qualifies":true},"hackernews":{"service_username":null,"account_created":null,"is_old_enough":false,"is_used_already":true,"qualifies":false}},"qualifies_overall":false,"is_before_registration_deadline":true},"airdrop_cfg":{"min_active_devices":3,"min_active_devices_title":"3 installed devices or paper keys","registration_deadline":1571633999,"account_creation_title":"Old enough Keybase, GitHub, or Hacker News account","account_creation_subtitle":"You can connect a GitHub or Hacker News account created before January 1, 2017 to qualify.","account_used":"Note that %s was already used to qualifiy a different account for the airdrop.","account_creation_deadlines":{"keybase":1514786400,"github":1483250400,"hackernews":1483250400}},"csrf_token":"lgHZIGY1NWZmMTZmNjZmNDMzNjAyNjZiOTVkYjZmOGZlYzE5zlxSWdXOAIPWAMDEILqynj/ovmhytFw+m8Xr3ns5UJ18X//dNSQe4gZwtDK/"}`,
		status: stellar1.AirdropStatus{
			State: stellar1.AirdropUnqualified,
			Rows: []stellar1.AirdropQualification{
				{
					Title: "3 installed devices or paper keys",
					Valid: false,
				},
				{
					Title: "Old enough Keybase, GitHub, or Hacker News account",
					Valid: true,
				},
			},
		},
	},
	{
		name: "new account qualifying proof, enough devices",
		json: `{"status":{"code":0,"name":"OK"},"already_registered":false,"qualifications":{"has_stellar_key":true,"has_enough_devices":true,"service_checks":{"keybase":{"service_username":"a1","account_created":1543864123,"is_old_enough":false,"is_used_already":false,"qualifies":false},"github":{"service_username":"patrickxb","account_created":1000,"is_old_enough":true,"is_used_already":false,"qualifies":true},"hackernews":{"service_username":null,"account_created":null,"is_old_enough":false,"is_used_already":true,"qualifies":false}},"qualifies_overall":true,"is_before_registration_deadline":true},"airdrop_cfg":{"min_active_devices":3,"min_active_devices_title":"3 installed devices or paper keys","registration_deadline":1571633999,"account_creation_title":"Old enough Keybase, GitHub, or Hacker News account","account_creation_subtitle":"You can connect a GitHub or Hacker News account created before January 1, 2017 to qualify.","account_used":"Note that %s was already used to qualifiy a different account for the airdrop.","account_creation_deadlines":{"keybase":1514786400,"github":1483250400,"hackernews":1483250400}},"csrf_token":"lgHZIGY1NWZmMTZmNjZmNDMzNjAyNjZiOTVkYjZmOGZlYzE5zlxSWdXOAIPWAMDEILqynj/ovmhytFw+m8Xr3ns5UJ18X//dNSQe4gZwtDK/"}`,
		status: stellar1.AirdropStatus{
			State: stellar1.AirdropQualified,
			Rows: []stellar1.AirdropQualification{
				{
					Title: "3 installed devices or paper keys",
					Valid: true,
				},
				{
					Title: "Old enough Keybase, GitHub, or Hacker News account",
					Valid: true,
				},
			},
		},
	},
}

func TestTransformToAirdropStatus(t *testing.T) {
	for _, test := range atests {
		var api remote.AirdropStatusAPI
		if err := json.Unmarshal([]byte(test.json), &api); err != nil {
			t.Errorf("%s: error: %s", test.name, err)
			continue
		}
		out := TransformToAirdropStatus(api)
		if !reflect.DeepEqual(out, test.status) {
			t.Errorf("%s: transform output didn't match, expected %+v, got %+v", test.name, test.status, out)
		}
	}
}
