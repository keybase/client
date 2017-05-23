package team

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// A chain with a stubbed link
const teamChain1 = `
{"status":{"code":0,"name":"OK"},"chain":[{"seqno":1,"sig":"g6Rib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEga6ttFJBQ4zcepPjjJNThT5zdiQqc8iLI0pFhVp0A57UKp3BheWxvYWTEJ5UCAcDEIOG5uUfGdP6m/3eDgDUVxssa2ismMBjbUuf0Sm/bfjlpIaNzaWfEQBOwbBmriWBOkf2FPZUcvi23R2fzLcmRQa/xb9Yf1u7C9FW+d/SMhD8X3hlS8Cd3Nf6AAzzkkTcXufyRnJhcIweoc2lnX3R5cGUgo3RhZ80CAqd2ZXJzaW9uAQ==","payload_json":"{\"body\":{\"key\":{\"eldest_kid\":\"01206bab6d149050e3371ea4f8e324d4e14f9cdd890a9cf222c8d29161569d00e7b50a\",\"host\":\"keybase.io\",\"kid\":\"01206bab6d149050e3371ea4f8e324d4e14f9cdd890a9cf222c8d29161569d00e7b50a\",\"uid\":\"e552cbc9f6951c2ea414cf098adbfa19\",\"username\":\"d_08827f78\"},\"team\":{\"id\":\"70b0e55838d4a3da62ef40b207e57b24\",\"members\":{\"admin\":[\"c_61002771\"],\"owner\":[\"d_08827f78\"],\"reader\":[\"a_1585f13b\"],\"writer\":[\"b_4a45388c\"]},\"name\":\"t_79351477\",\"per_team_key\":{\"encryption_kid\":\"012155545f16950e7fed04076b9e2f51bd53cd72e4abd1845c261ef9dcb581df67500a\",\"generation\":1,\"reverse_sig\":\"g6Rib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEgzXJbQHV7+E7N263CerYXxSdZuCU/wVjc1Sz/u94J92wKp3BheWxvYWTFAxx7ImJvZHkiOnsia2V5Ijp7ImVsZGVzdF9raWQiOiIwMTIwNmJhYjZkMTQ5MDUwZTMzNzFlYTRmOGUzMjRkNGUxNGY5Y2RkODkwYTljZjIyMmM4ZDI5MTYxNTY5ZDAwZTdiNTBhIiwiaG9zdCI6ImtleWJhc2UuaW8iLCJraWQiOiIwMTIwNmJhYjZkMTQ5MDUwZTMzNzFlYTRmOGUzMjRkNGUxNGY5Y2RkODkwYTljZjIyMmM4ZDI5MTYxNTY5ZDAwZTdiNTBhIiwidWlkIjoiZTU1MmNiYzlmNjk1MWMyZWE0MTRjZjA5OGFkYmZhMTkiLCJ1c2VybmFtZSI6ImRfMDg4MjdmNzgifSwidGVhbSI6eyJpZCI6IjcwYjBlNTU4MzhkNGEzZGE2MmVmNDBiMjA3ZTU3YjI0IiwibWVtYmVycyI6eyJhZG1pbiI6WyJjXzYxMDAyNzcxIl0sIm93bmVyIjpbImRfMDg4MjdmNzgiXSwicmVhZGVyIjpbImFfMTU4NWYxM2IiXSwid3JpdGVyIjpbImJfNGE0NTM4OGMiXX0sIm5hbWUiOiJ0Xzc5MzUxNDc3IiwicGVyX3RlYW1fa2V5Ijp7ImVuY3J5cHRpb25fa2lkIjoiMDEyMTU1NTQ1ZjE2OTUwZTdmZWQwNDA3NmI5ZTJmNTFiZDUzY2Q3MmU0YWJkMTg0NWMyNjFlZjlkY2I1ODFkZjY3NTAwYSIsImdlbmVyYXRpb24iOjEsInJldmVyc2Vfc2lnIjpudWxsLCJzaWduaW5nX2tpZCI6IjAxMjBjZDcyNWI0MDc1N2JmODRlY2RkYmFkYzI3YWI2MTdjNTI3NTliODI1M2ZjMTU4ZGNkNTJjZmZiYmRlMDlmNzZjMGEifX0sInR5cGUiOiJ0ZWFtLnJvb3QiLCJ2ZXJzaW9uIjoyfSwiY3RpbWUiOjE0OTUyMjkwMjYsImV4cGlyZV9pbiI6MTU3NjgwMDAwLCJwcmV2IjpudWxsLCJzZXFfdHlwZSI6Mywic2Vxbm8iOjEsInRhZyI6InNpZ25hdHVyZSJ9o3NpZ8RAwSxEArnauq5CfnQkf1pqJ3FPN7ebCTzcLex1xNBP/Kqp222xXaW9ZxcjeCbJqSJzFkzDa+emd1tSLreTK8rcCahzaWdfdHlwZSCjdGFnzQICp3ZlcnNpb24B\",\"signing_kid\":\"0120cd725b40757bf84ecddbadc27ab617c52759b8253fc158dcd52cffbbde09f76c0a\"}},\"type\":\"team.root\",\"version\":2},\"ctime\":1495229026,\"expire_in\":157680000,\"prev\":null,\"seq_type\":3,\"seqno\":1,\"tag\":\"signature\"}","version":2,"uid":"e552cbc9f6951c2ea414cf098adbfa19"},{"seqno":2,"sig":"g6Rib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEga6ttFJBQ4zcepPjjJNThT5zdiQqc8iLI0pFhVp0A57UKp3BheWxvYWTESJUCAsQgA5+oRvY4N+bV0j/Vb2tX65GOSG80ym8mRTqm/HVIj8vEIGFT/kXt6yq/sGf3MYjAFxl4ltZBh3xcC87MRX7kcVXkIqNzaWfEQJoKuDq+l0bapy47n4V+40/GmrihsZMDXk9aenmvrmqqI4sePcVpA6yE1H0Rhbdm1E5BPkqpODbaLxp9OOIQeAqoc2lnX3R5cGUgo3RhZ80CAqd2ZXJzaW9uAQ==","version":2,"uid":"e552cbc9f6951c2ea414cf098adbfa19"},{"seqno":3,"sig":"g6Rib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEg8E2SNuLyUHJAPCht43Htz5qwBmq084vUp6FaQc/BRIQKp3BheWxvYWTESJUCA8QgFAAdOlIqTvIFnNfsExgbDI1/BxWVS0w/bpB/DyscOCjEIDRb+fKIthdc8xHtXmpfK/2aMjipgIq9n+6IN2+Y+pWBJKNzaWfEQFypth82iu+gAkeo15m9vpobO1+gA+Kf/sE0mnLXkWoDTr17LaYwljebkj/VlqDP1NIAIRgMSeRfzVNaAPS4Pguoc2lnX3R5cGUgo3RhZ80CAqd2ZXJzaW9uAQ==","payload_json":"{\"body\":{\"key\":{\"eldest_kid\":\"0120f04d9236e2f25072403c286de371edcf9ab0066ab4f38bd4a7a15a41cfc144840a\",\"host\":\"keybase.io\",\"kid\":\"0120f04d9236e2f25072403c286de371edcf9ab0066ab4f38bd4a7a15a41cfc144840a\",\"uid\":\"130ea880070624ba5e0f0a6032cf0f19\",\"username\":\"b_4a45388c\"},\"team\":{\"id\":\"70b0e55838d4a3da62ef40b207e57b24\",\"per_team_key\":{\"encryption_kid\":\"0121015351e68bc98d256c190fbca5608c2b04a36d15f5e95896385f1b5b0c6dc1260a\",\"generation\":2,\"reverse_sig\":\"g6Rib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEg8Ug8hRXQisnsuKku7LoXzDXjEystpUgatdpjTaJ+jQ4Kp3BheWxvYWTFAuJ7ImJvZHkiOnsia2V5Ijp7ImVsZGVzdF9raWQiOiIwMTIwZjA0ZDkyMzZlMmYyNTA3MjQwM2MyODZkZTM3MWVkY2Y5YWIwMDY2YWI0ZjM4YmQ0YTdhMTVhNDFjZmMxNDQ4NDBhIiwiaG9zdCI6ImtleWJhc2UuaW8iLCJraWQiOiIwMTIwZjA0ZDkyMzZlMmYyNTA3MjQwM2MyODZkZTM3MWVkY2Y5YWIwMDY2YWI0ZjM4YmQ0YTdhMTVhNDFjZmMxNDQ4NDBhIiwidWlkIjoiMTMwZWE4ODAwNzA2MjRiYTVlMGYwYTYwMzJjZjBmMTkiLCJ1c2VybmFtZSI6ImJfNGE0NTM4OGMifSwidGVhbSI6eyJpZCI6IjcwYjBlNTU4MzhkNGEzZGE2MmVmNDBiMjA3ZTU3YjI0IiwicGVyX3RlYW1fa2V5Ijp7ImVuY3J5cHRpb25fa2lkIjoiMDEyMTAxNTM1MWU2OGJjOThkMjU2YzE5MGZiY2E1NjA4YzJiMDRhMzZkMTVmNWU5NTg5NjM4NWYxYjViMGM2ZGMxMjYwYSIsImdlbmVyYXRpb24iOjIsInJldmVyc2Vfc2lnIjpudWxsLCJzaWduaW5nX2tpZCI6IjAxMjBmMTQ4M2M4NTE1ZDA4YWM5ZWNiOGE5MmVlY2JhMTdjYzM1ZTMxMzJiMmRhNTQ4MWFiNWRhNjM0ZGEyN2U4ZDBlMGEifX0sInR5cGUiOiJ0ZWFtLnJvdGF0ZV9rZXkiLCJ2ZXJzaW9uIjoyfSwiY3RpbWUiOjE0OTUyMjkwMjksImV4cGlyZV9pbiI6MTU3NjgwMDAwLCJwcmV2IjoiMTQwMDFkM2E1MjJhNGVmMjA1OWNkN2VjMTMxODFiMGM4ZDdmMDcxNTk1NGI0YzNmNmU5MDdmMGYyYjFjMzgyOCIsInNlcV90eXBlIjozLCJzZXFubyI6MywidGFnIjoic2lnbmF0dXJlIn2jc2lnxEDBThqkZK4icWICDx/RLh7+KxANdojKETZX3Jl2KYG12PqDG7x9fZFbRVPSzOzY3UzPleQ0eUPAfIU4+DICnCIBqHNpZ190eXBlIKN0YWfNAgKndmVyc2lvbgE=\",\"signing_kid\":\"0120f1483c8515d08ac9ecb8a92eecba17cc35e3132b2da5481ab5da634da27e8d0e0a\"}},\"type\":\"team.rotate_key\",\"version\":2},\"ctime\":1495229029,\"expire_in\":157680000,\"prev\":\"14001d3a522a4ef2059cd7ec13181b0c8d7f0715954b4c3f6e907f0f2b1c3828\",\"seq_type\":3,\"seqno\":3,\"tag\":\"signature\"}","version":2,"uid":"130ea880070624ba5e0f0a6032cf0f19"}],"box":{"nonce":"pQSb5q+bdU8FALOApgtwaPrRgN8AAAAD","sender_kid":"01211520f0f37e835e8d98b4d19226a2632c0335b4cdc17273274f17fbdc2393f8240a","generation":2,"ctext":"0Tmgo0rWAYfug+X8V/EulDjGuYZeX5KowDifynQifDUjtDgZW21QSRHil+y4T/88","per_user_key_seqno":3},"prevs":{"2":"9301c418a5049be6af9b754f0500b380a60b7068fad180df00000000c43044eb2fdf163454eefb7caef5ed27c4e849d2ea2add23c4804247d1d3adb42997403a0d7aeb602f978d9c11338549ef9f"},"csrf_token":"lgHZIDEzMGVhODgwMDcwNjI0YmE1ZTBmMGE2MDMyY2YwZjE5zlkfYl7OAAFRgMDEIA/v+ErxmQdePfcGB8XrTKXEnrAZ7DUCr/tYuHWo3igE"}
`

// A chain with a change_membership link
const teamChain2 = `
{"status":{"code":0,"name":"OK"},"chain":[{"uid":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa19","seqno":1,"sig":"g6Rib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEgv8ORwb4IEcmx7hmp41snRd/lzamUgH3mDM/aZHzDQzIKp3BheWxvYWTEJ5UCAcDEIPdH/BvDT4wMchkyNbjL+CX30c+BcbpVJuzya06WYZ00IaNzaWfEQN/H6KW8RVFBQ9VRSwdY5b0bGD24sUOXeMama3A0iQVInX3zumc8ga7OkiFebOu/d23fci+PfcbJ8SBMQenMYQuoc2lnX3R5cGUgo3RhZ80CAqd2ZXJzaW9uAQ==","payload_json":"{\"body\":{\"key\":{\"eldest_kid\":\"0120bfc391c1be0811c9b1ee19a9e35b2745dfe5cda994807de60ccfda647cc343320a\",\"host\":\"keybase.io\",\"kid\":\"0120bfc391c1be0811c9b1ee19a9e35b2745dfe5cda994807de60ccfda647cc343320a\",\"uid\":\"13172150f9b0885abf4b576fdcf59019\",\"username\":\"d_b2809af7\"},\"team\":{\"id\":\"79715edef9320c851e50d44d52f4b324\",\"members\":{\"admin\":[\"c_ac088470\"],\"owner\":[\"d_b2809af7\"],\"reader\":[\"a_f0259e08\"],\"writer\":[\"b_ee111192\"]},\"name\":\"t_913dfbc3\",\"per_team_key\":{\"encryption_kid\":\"01212337961af637143545aa512b63393cd92c588d3e153fbd8c4c5c923c76cc410d0a\",\"generation\":1,\"reverse_sig\":\"g6Rib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEgjHQy6NZaSqWeZm5V7oVqj6QaIL3D7bW7B6t8rEojChcKp3BheWxvYWTFAxx7ImJvZHkiOnsia2V5Ijp7ImVsZGVzdF9raWQiOiIwMTIwYmZjMzkxYzFiZTA4MTFjOWIxZWUxOWE5ZTM1YjI3NDVkZmU1Y2RhOTk0ODA3ZGU2MGNjZmRhNjQ3Y2MzNDMzMjBhIiwiaG9zdCI6ImtleWJhc2UuaW8iLCJraWQiOiIwMTIwYmZjMzkxYzFiZTA4MTFjOWIxZWUxOWE5ZTM1YjI3NDVkZmU1Y2RhOTk0ODA3ZGU2MGNjZmRhNjQ3Y2MzNDMzMjBhIiwidWlkIjoiMTMxNzIxNTBmOWIwODg1YWJmNGI1NzZmZGNmNTkwMTkiLCJ1c2VybmFtZSI6ImRfYjI4MDlhZjcifSwidGVhbSI6eyJpZCI6Ijc5NzE1ZWRlZjkzMjBjODUxZTUwZDQ0ZDUyZjRiMzI0IiwibWVtYmVycyI6eyJhZG1pbiI6WyJjX2FjMDg4NDcwIl0sIm93bmVyIjpbImRfYjI4MDlhZjciXSwicmVhZGVyIjpbImFfZjAyNTllMDgiXSwid3JpdGVyIjpbImJfZWUxMTExOTIiXX0sIm5hbWUiOiJ0XzkxM2RmYmMzIiwicGVyX3RlYW1fa2V5Ijp7ImVuY3J5cHRpb25fa2lkIjoiMDEyMTIzMzc5NjFhZjYzNzE0MzU0NWFhNTEyYjYzMzkzY2Q5MmM1ODhkM2UxNTNmYmQ4YzRjNWM5MjNjNzZjYzQxMGQwYSIsImdlbmVyYXRpb24iOjEsInJldmVyc2Vfc2lnIjpudWxsLCJzaWduaW5nX2tpZCI6IjAxMjA4Yzc0MzJlOGQ2NWE0YWE1OWU2NjZlNTVlZTg1NmE4ZmE0MWEyMGJkYzNlZGI1YmIwN2FiN2NhYzRhMjMwYTE3MGEifX0sInR5cGUiOiJ0ZWFtLnJvb3QiLCJ2ZXJzaW9uIjoyfSwiY3RpbWUiOjE0OTU0NjU2MDMsImV4cGlyZV9pbiI6MTU3NjgwMDAwLCJwcmV2IjpudWxsLCJzZXFfdHlwZSI6Mywic2Vxbm8iOjEsInRhZyI6InNpZ25hdHVyZSJ9o3NpZ8RAPV+uLLbPofl4eDHceJwbEFpSD0244Rk621nX75hmZm0v72jcuEmULQS8KNS+03jm2qIJ/W/+uPYqjllR7A8hB6hzaWdfdHlwZSCjdGFnzQICp3ZlcnNpb24B\",\"signing_kid\":\"01208c7432e8d65a4aa59e666e55ee856a8fa41a20bdc3edb5bb07ab7cac4a230a170a\"}},\"type\":\"team.root\",\"version\":2},\"ctime\":1495465603,\"expire_in\":157680000,\"prev\":null,\"seq_type\":3,\"seqno\":1,\"tag\":\"signature\"}","version":2},{"uid":"bbbbbbbbbbbabbbbbbabbbbbbbabbb19","seqno":2,"sig":"g6Rib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEgv8ORwb4IEcmx7hmp41snRd/lzamUgH3mDM/aZHzDQzIKp3BheWxvYWTESJUCAsQgrfOWo7kRn9lXTll80AvHDYtRhNnYW3rOBHOWIuD7s9HEIFfJNYgYkmkf+ajkgryGkptpYGlBL8R9BqddzZhAZXcNI6NzaWfEQLu54sP2MVKNdxI/N3hnzfZiAg/Fdvi+Hn50LFr5iQunrlpiwnBrIIbF77drIr8ije+aEGvxFSqrU9AQYK3oGgaoc2lnX3R5cGUgo3RhZ80CAqd2ZXJzaW9uAQ==","payload_json":"{\"body\":{\"key\":{\"eldest_kid\":\"0120bfc391c1be0811c9b1ee19a9e35b2745dfe5cda994807de60ccfda647cc343320a\",\"host\":\"keybase.io\",\"kid\":\"0120bfc391c1be0811c9b1ee19a9e35b2745dfe5cda994807de60ccfda647cc343320a\",\"uid\":\"13172150f9b0885abf4b576fdcf59019\",\"username\":\"d_b2809af7\"},\"team\":{\"id\":\"79715edef9320c851e50d44d52f4b324\",\"members\":{\"writer\":[\"a_f0259e08\"]}},\"type\":\"team.change_membership\",\"version\":2},\"ctime\":1495465604,\"expire_in\":157680000,\"prev\":\"adf396a3b9119fd9574e597cd00bc70d8b5184d9d85b7ace04739622e0fbb3d1\",\"seq_type\":3,\"seqno\":2,\"tag\":\"signature\"}","version":2}],"box":{"nonce":"Hd/H/iI2Psy0CzsUliNwx2Jphy0AAAAB","sender_kid":"0121c85c6392c5071f938d7208ad04f8f47d24f1928fc6490bf1ad42078e67d2a7250a","generation":1,"ctext":"dY3olcXhVqfu0Xje+XEtsmKhygZf5AAxNOem8mPAe9GhjF5ZIbK6S7gdhfZAYaON","per_user_key_seqno":3},"prevs":{},"reader_key_masks":[{"mask":"Nbrttk8zZFA31vFu79A26nM2BR6hpCO+g9w7lW0K8/I=","application":1,"generation":1},{"mask":"6c9mAbxLz07Y6JN4t8xWDe+XZh7IDL8ACvtvRh3/hss=","application":2,"generation":1}],"csrf_token":"lgHZIDEzMTcyMTUwZjliMDg4NWFiZjRiNTc2ZmRjZjU5MDE5zlki/oLOAAFRgMDEIBYG/lf5vEPS1cj7x0lw0eO2lsU25CW9HOrwDnFcHE2Z"}
`

type DeconstructJig struct {
	Chain []json.RawMessage `json:"chain"`
}

func TestTeamSigChainParse(t *testing.T) {
	tc := libkb.SetupTest(t, "test_team_chains", 1)
	defer tc.Cleanup()

	var jig DeconstructJig
	err := json.Unmarshal([]byte(teamChain1), &jig)
	require.NoError(t, err)

	for _, link := range jig.Chain {
		// t.Logf("link: %v", string(link))

		chainLink, err := ParseTeamChainLink(string(link))
		require.NoError(t, err)

		t.Logf("chainLink: %v", spew.Sdump(chainLink))

		if len(chainLink.Payload) > 0 {
			payload, err := chainLink.UnmarshalPayload()
			require.NoError(t, err)
			t.Logf("payload: %v", spew.Sdump(payload))
		} else {
			t.Logf("payload stubbed")
		}

	}
}

func TestTeamSigChainPlay1(t *testing.T) {
	tc := libkb.SetupTest(t, "test_team_chains", 1)
	defer tc.Cleanup()

	var jig DeconstructJig
	err := json.Unmarshal([]byte(teamChain1), &jig)
	require.NoError(t, err)

	var chainLinks []SCChainLink
	for i, link := range jig.Chain {
		// t.Logf("link: %v", string(link))

		chainLink, err := ParseTeamChainLink(string(link))
		require.NoError(t, err)

		t.Logf("%v chainLink: %v", i, spew.Sdump(chainLink))
		chainLinks = append(chainLinks, chainLink)
	}

	helper := &chainHelper{}
	player := NewTeamSigChainPlayer(helper, NewUserVersion("a_1585f13b", 1), true)
	err = player.AddChainLinks(context.TODO(), chainLinks)
	require.NoError(t, err)

	state, err := player.GetState()
	require.NoError(t, err)
	require.Equal(t, "t_79351477", string(state.GetName()))
	require.False(t, state.IsSubteam())
	ptk, err := state.GetLatestPerTeamKey()
	require.NoError(t, err)
	require.Equal(t, 2, ptk.Gen)
	require.Equal(t, keybase1.Seqno(3), ptk.Seqno)
	require.Equal(t, "0120f1483c8515d08ac9ecb8a92eecba17cc35e3132b2da5481ab5da634da27e8d0e0a", string(ptk.SigKID))
	require.Equal(t, "0121015351e68bc98d256c190fbca5608c2b04a36d15f5e95896385f1b5b0c6dc1260a", string(ptk.EncKID))
	require.Equal(t, keybase1.Seqno(3), state.GetLatestSeqno())

	checkRole := func(username string, role keybase1.TeamRole) {
		uv := NewUserVersion(username, 1)
		r, err := state.GetUserRole(uv)
		require.NoError(t, err)
		require.Equal(t, role, r)
	}

	checkRole("d_08827f78", keybase1.TeamRole_OWNER)
	checkRole("c_61002771", keybase1.TeamRole_ADMIN)
	checkRole("b_4a45388c", keybase1.TeamRole_WRITER)
	checkRole("a_1585f13b", keybase1.TeamRole_READER)
	checkRole("popeye", keybase1.TeamRole_NONE)
}

func TestTeamSigChainPlay2(t *testing.T) {
	tc := libkb.SetupTest(t, "test_team_chains", 1)
	defer tc.Cleanup()

	var jig DeconstructJig
	err := json.Unmarshal([]byte(teamChain2), &jig)
	require.NoError(t, err)

	var chainLinks []SCChainLink
	for i, link := range jig.Chain {
		// t.Logf("link: %v", string(link))

		chainLink, err := ParseTeamChainLink(string(link))
		require.NoError(t, err)

		t.Logf("%v chainLink: %v", i, spew.Sdump(chainLink))
		chainLinks = append(chainLinks, chainLink)
	}

	player := NewTeamSigChainPlayer(&chainHelper{}, NewUserVersion("a_f0259e08", 1), true)
	err = player.AddChainLinks(context.TODO(), chainLinks)
	require.NoError(t, err)

	state, err := player.GetState()
	require.NoError(t, err)
	require.Equal(t, "t_913dfbc3", string(state.GetName()))
	require.False(t, state.IsSubteam())
	ptk, err := state.GetLatestPerTeamKey()
	require.NoError(t, err)
	require.Equal(t, 1, ptk.Gen)
	require.Equal(t, keybase1.Seqno(1), ptk.Seqno)
	require.Equal(t, "01208c7432e8d65a4aa59e666e55ee856a8fa41a20bdc3edb5bb07ab7cac4a230a170a", string(ptk.SigKID))
	require.Equal(t, "01212337961af637143545aa512b63393cd92c588d3e153fbd8c4c5c923c76cc410d0a", string(ptk.EncKID))
	require.Equal(t, keybase1.Seqno(2), state.GetLatestSeqno())

	checkRole := func(username string, role keybase1.TeamRole) {
		uv := NewUserVersion(username, 1)
		r, err := state.GetUserRole(uv)
		require.NoError(t, err)
		require.Equal(t, role, r)
	}

	checkRole("d_b2809af7", keybase1.TeamRole_OWNER)
	checkRole("c_ac088470", keybase1.TeamRole_ADMIN)
	checkRole("b_ee111192", keybase1.TeamRole_NONE)   // removed
	checkRole("a_f0259e08", keybase1.TeamRole_WRITER) // changed role

	xs, err := state.GetUsersWithRole(keybase1.TeamRole_OWNER)
	require.NoError(t, err)
	require.Len(t, xs, 1)
	xs, err = state.GetUsersWithRole(keybase1.TeamRole_WRITER)
	require.NoError(t, err)
	require.Len(t, xs, 1)
	xs, err = state.GetUsersWithRole(keybase1.TeamRole_READER)
	require.Len(t, xs, 0)
}

type chainHelper struct{}

func (c *chainHelper) UsernameForUID(ctx context.Context, uid keybase1.UID) (string, error) {
	switch uid {
	case "e552cbc9f6951c2ea414cf098adbfa19":
		return "d_08827f78", nil
	case "130ea880070624ba5e0f0a6032cf0f19":
		return "b_4a45388c", nil
	case "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa19":
		return "d_b2809af7", nil
	case "bbbbbbbbbbbabbbbbbabbbbbbbabbb19":
		return "c_ac088470", nil
	default:
		return "", errors.New("testing hit unknown uid")
	}
}
