package teams

import (
	"encoding/json"
	"testing"

	"golang.org/x/net/context"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/stretchr/testify/require"
)

// A chain with a stubbed link
// Output of `rotate_root_team_key` test in team_integration.iced
const teamChain1 = `
{"status":{"code":0,"name":"OK"},"chain":[{"seqno":1,"sig":"g6Rib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEgewPUgFaXvAjHWBC4BnTzSdMT3izYy89VX+4rjh2NlMkKp3BheWxvYWTEJ5UCAcDEIL95/rs8CFK3VSp4W4nYmxAdatMKJf+BB1xWH3eB/K7vIaNzaWfEQAez3e1PlPXJUg2vITA8/ZKeIKBp67DQQaNSKchzpPaMN8BFtvlY2qQStmk5Jn9mcN7m5x7xGBvRLksLkz4fOQSoc2lnX3R5cGUgo3RhZ80CAqd2ZXJzaW9uAQ==","payload_json":"{\"body\":{\"key\":{\"eldest_kid\":\"01207b03d4805697bc08c75810b80674f349d313de2cd8cbcf555fee2b8e1d8d94c90a\",\"host\":\"keybase.io\",\"kid\":\"01207b03d4805697bc08c75810b80674f349d313de2cd8cbcf555fee2b8e1d8d94c90a\",\"uid\":\"5bf82de4331b50b32cbbcfeadc2f3119\",\"username\":\"d_af8eac8c\"},\"team\":{\"id\":\"64d27654bef64bdb3d78d84f186c4224\",\"members\":{\"admin\":[\"53e315afb4b419931b0a6a1eaa09e219\"],\"owner\":[\"5bf82de4331b50b32cbbcfeadc2f3119\"],\"reader\":[\"13e18aeafa4df6c94bf6af7d7bb98d19\"],\"writer\":[\"4bf92804c02fb7d2cd36a6d420d6f619\"]},\"name\":\"t_9d6d1e37\",\"per_team_key\":{\"encryption_kid\":\"0121bf2085a5f1b4f8e0ad5095fb29ae65f7e52a4fa5d9bc90757515c7dd860767020a\",\"generation\":1,\"reverse_sig\":\"g6Rib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEgYr3LeU54Mu4AdjeZ3bG+7c0yEL51p2dfHxneCIxTVPEKp3BheWxvYWTFA3R7ImJvZHkiOnsia2V5Ijp7ImVsZGVzdF9raWQiOiIwMTIwN2IwM2Q0ODA1Njk3YmMwOGM3NTgxMGI4MDY3NGYzNDlkMzEzZGUyY2Q4Y2JjZjU1NWZlZTJiOGUxZDhkOTRjOTBhIiwiaG9zdCI6ImtleWJhc2UuaW8iLCJraWQiOiIwMTIwN2IwM2Q0ODA1Njk3YmMwOGM3NTgxMGI4MDY3NGYzNDlkMzEzZGUyY2Q4Y2JjZjU1NWZlZTJiOGUxZDhkOTRjOTBhIiwidWlkIjoiNWJmODJkZTQzMzFiNTBiMzJjYmJjZmVhZGMyZjMxMTkiLCJ1c2VybmFtZSI6ImRfYWY4ZWFjOGMifSwidGVhbSI6eyJpZCI6IjY0ZDI3NjU0YmVmNjRiZGIzZDc4ZDg0ZjE4NmM0MjI0IiwibWVtYmVycyI6eyJhZG1pbiI6WyI1M2UzMTVhZmI0YjQxOTkzMWIwYTZhMWVhYTA5ZTIxOSJdLCJvd25lciI6WyI1YmY4MmRlNDMzMWI1MGIzMmNiYmNmZWFkYzJmMzExOSJdLCJyZWFkZXIiOlsiMTNlMThhZWFmYTRkZjZjOTRiZjZhZjdkN2JiOThkMTkiXSwid3JpdGVyIjpbIjRiZjkyODA0YzAyZmI3ZDJjZDM2YTZkNDIwZDZmNjE5Il19LCJuYW1lIjoidF85ZDZkMWUzNyIsInBlcl90ZWFtX2tleSI6eyJlbmNyeXB0aW9uX2tpZCI6IjAxMjFiZjIwODVhNWYxYjRmOGUwYWQ1MDk1ZmIyOWFlNjVmN2U1MmE0ZmE1ZDliYzkwNzU3NTE1YzdkZDg2MDc2NzAyMGEiLCJnZW5lcmF0aW9uIjoxLCJyZXZlcnNlX3NpZyI6bnVsbCwic2lnbmluZ19raWQiOiIwMTIwNjJiZGNiNzk0ZTc4MzJlZTAwNzYzNzk5ZGRiMWJlZWRjZDMyMTBiZTc1YTc2NzVmMWYxOWRlMDg4YzUzNTRmMTBhIn19LCJ0eXBlIjoidGVhbS5yb290IiwidmVyc2lvbiI6Mn0sImN0aW1lIjoxNDk3MjM4NTMyLCJleHBpcmVfaW4iOjE1NzY4MDAwMCwicHJldiI6bnVsbCwic2VxX3R5cGUiOjMsInNlcW5vIjoxLCJ0YWciOiJzaWduYXR1cmUifaNzaWfEQLrzfIl+c/rDlaTL9hW5emLJSJOoyhWw0gKnShh4v5FzX0tunexOId0U87etEgT1P+uJ6KYCSQTh8ZdCmDWJ7Q6oc2lnX3R5cGUgo3RhZ80CAqd2ZXJzaW9uAQ==\",\"signing_kid\":\"012062bdcb794e7832ee00763799ddb1beedcd3210be75a7675f1f19de088c5354f10a\"}},\"type\":\"team.root\",\"version\":2},\"ctime\":1497238532,\"expire_in\":157680000,\"prev\":null,\"seq_type\":3,\"seqno\":1,\"tag\":\"signature\"}","version":2,"uid":"5bf82de4331b50b32cbbcfeadc2f3119"},{"seqno":2,"sig":"g6Rib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEgewPUgFaXvAjHWBC4BnTzSdMT3izYy89VX+4rjh2NlMkKp3BheWxvYWTESJUCAsQgYst2GtNGo9KL4e7RB8NVSKLdb63pIZo4WRhB9i1YbP7EICPQdqUmdeZU/gRJXd5+gUP8HSxtn4xMeZ7lssS3Pm+8IqNzaWfEQHkBp46skYqz62rMjoxZGq4HVjhJHCS4zYjmrMDhQQrl3fu76HeRqTeuLWCh0741OyvwXTjGNY7oCJiT5YvZSw+oc2lnX3R5cGUgo3RhZ80CAqd2ZXJzaW9uAQ==","version":2,"uid":"5bf82de4331b50b32cbbcfeadc2f3119"},{"seqno":3,"sig":"g6Rib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEgTqfhtGmmOGhixMw9YsHIrmrk0txnZBM4A/hqS1gWbzUKp3BheWxvYWTESJUCA8Qgg2TPT1Vbq+1yiOlYEFHqQYcccB4W6bevJFRK1jc1ov7EIHbADJMePlGQ1+JCJe9AQiftKeKwAIKLYLC1pPvcWyZmJKNzaWfEQPNVaBljU0mSO/27FfQDZiNaNYfbZ+lG1QF2WaOoUBgtChMxEek+3jKWTGkfWSvjL+MynM8ve+egRteBY8jhoQioc2lnX3R5cGUgo3RhZ80CAqd2ZXJzaW9uAQ==","payload_json":"{\"body\":{\"key\":{\"eldest_kid\":\"01204ea7e1b469a6386862c4cc3d62c1c8ae6ae4d2dc6764133803f86a4b58166f350a\",\"host\":\"keybase.io\",\"kid\":\"01204ea7e1b469a6386862c4cc3d62c1c8ae6ae4d2dc6764133803f86a4b58166f350a\",\"uid\":\"4bf92804c02fb7d2cd36a6d420d6f619\",\"username\":\"b_7804991a\"},\"team\":{\"id\":\"64d27654bef64bdb3d78d84f186c4224\",\"per_team_key\":{\"encryption_kid\":\"0121e2511cbfb0418187a8e19183a1cd92637bc83fe116d1eb8984f52394495b5f120a\",\"generation\":2,\"reverse_sig\":\"g6Rib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEggC9V7V4U9hxzCHG16Z1jcFT/f1ugwbLMUrFU47r4CgAKp3BheWxvYWTFAuJ7ImJvZHkiOnsia2V5Ijp7ImVsZGVzdF9raWQiOiIwMTIwNGVhN2UxYjQ2OWE2Mzg2ODYyYzRjYzNkNjJjMWM4YWU2YWU0ZDJkYzY3NjQxMzM4MDNmODZhNGI1ODE2NmYzNTBhIiwiaG9zdCI6ImtleWJhc2UuaW8iLCJraWQiOiIwMTIwNGVhN2UxYjQ2OWE2Mzg2ODYyYzRjYzNkNjJjMWM4YWU2YWU0ZDJkYzY3NjQxMzM4MDNmODZhNGI1ODE2NmYzNTBhIiwidWlkIjoiNGJmOTI4MDRjMDJmYjdkMmNkMzZhNmQ0MjBkNmY2MTkiLCJ1c2VybmFtZSI6ImJfNzgwNDk5MWEifSwidGVhbSI6eyJpZCI6IjY0ZDI3NjU0YmVmNjRiZGIzZDc4ZDg0ZjE4NmM0MjI0IiwicGVyX3RlYW1fa2V5Ijp7ImVuY3J5cHRpb25fa2lkIjoiMDEyMWUyNTExY2JmYjA0MTgxODdhOGUxOTE4M2ExY2Q5MjYzN2JjODNmZTExNmQxZWI4OTg0ZjUyMzk0NDk1YjVmMTIwYSIsImdlbmVyYXRpb24iOjIsInJldmVyc2Vfc2lnIjpudWxsLCJzaWduaW5nX2tpZCI6IjAxMjA4MDJmNTVlZDVlMTRmNjFjNzMwODcxYjVlOTlkNjM3MDU0ZmY3ZjViYTBjMWIyY2M1MmIxNTRlM2JhZjgwYTAwMGEifX0sInR5cGUiOiJ0ZWFtLnJvdGF0ZV9rZXkiLCJ2ZXJzaW9uIjoyfSwiY3RpbWUiOjE0OTcyMzg1MzUsImV4cGlyZV9pbiI6MTU3NjgwMDAwLCJwcmV2IjoiODM2NGNmNGY1NTViYWJlZDcyODhlOTU4MTA1MWVhNDE4NzFjNzAxZTE2ZTliN2FmMjQ1NDRhZDYzNzM1YTJmZSIsInNlcV90eXBlIjozLCJzZXFubyI6MywidGFnIjoic2lnbmF0dXJlIn2jc2lnxECfcafw2CoIzFKtmN2nt3A28wYS7clrmEZvjLEziNmoWy525gvyxJEHiENfxQ5kt9Uxb0cCDChlktHvz23my6QAqHNpZ190eXBlIKN0YWfNAgKndmVyc2lvbgE=\",\"signing_kid\":\"0120802f55ed5e14f61c730871b5e99d637054ff7f5ba0c1b2cc52b154e3baf80a000a\"}},\"type\":\"team.rotate_key\",\"version\":2},\"ctime\":1497238535,\"expire_in\":157680000,\"prev\":\"8364cf4f555babed7288e9581051ea41871c701e16e9b7af24544ad63735a2fe\",\"seq_type\":3,\"seqno\":3,\"tag\":\"signature\"}","version":2,"uid":"4bf92804c02fb7d2cd36a6d420d6f619"}],"box":{"nonce":"5VPBQypqrcLiuW1i6fVROxmuBQUAAAAD","sender_kid":"012112f29aa42e14053a057a790a198a5b7fb25512c8458b4b32d7bbd04c0d52093b0a","generation":2,"ctext":"HgbVY5cswOvxu9PMOP75NdYqftGtgenRABKtjHgervLK6/oaF1vTW2U9vt+0JixD","per_user_key_seqno":3},"prevs":{"2":"9301c418e553c1432a6aadc2e2b96d62e9f5513b19ae050500000000c4304e966d60d2ccee5433fa1cf08f11de02b0d4e749798925d925896edc6c0b12288a975db3b29f6efed165b38775b64d42"},"reader_key_masks":[{"mask":"gKBbFV3J3L0j/gFtruyCKpZHf7Y837Q2ezFtrAK6xIE=","application":1,"generation":1},{"mask":"ZYdXI0jfXscYwgXO3J3A1T9YRJ+GlkNvtEZJ4nvmKbk=","application":2,"generation":1},{"mask":"Dq4iXhUs9BxX1DHYP7wE/vFOpG4SABwzHZRQeavnKjM=","application":1,"generation":2},{"mask":"AEedcZX7wZyvyAOyc9EQINr3MyqbKMKXLfZVHHZqz7U=","application":2,"generation":2}],"id":"64d27654bef64bdb3d78d84f186c4224","name":{"parts":["t_9d6d1e37"]},"csrf_token":"lgHZIDRiZjkyODA0YzAyZmI3ZDJjZDM2YTZkNDIwZDZmNjE5zlk+C/7OAAFRgMDEIFLYZSdoOin9JRKgyjN8z/JMVQ4Az3O1ZcUyT43DTlXV"}
`

// A chain with a change_membership link, generated via: `change_membership_promote_to_writer_happy_path`
const teamChain2 = `
{"status":{"code":0,"name":"OK"},"chain":[{"seqno":1,"sig":"g6Rib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEg0n4BukVK2MAN0FR3OKg2LjyIRb927JAVdNeKFKxDRTsKp3BheWxvYWTEJ5UCAcDEIKkpvmNu1RlxqBwYtqk4eG/jKv7KD/GllQ23k/Dd6VB1IaNzaWfEQCNHcFQwf9uDBjhzyXDydfUn/7QK1MgC4T2xW/4hywf9vXdVLJ3sPWb+gvk2ZoPCdiwmiAl3CCMiUIuaZrEIawSoc2lnX3R5cGUgo3RhZ80CAqd2ZXJzaW9uAQ==","payload_json":"{\"body\":{\"key\":{\"eldest_kid\":\"0120d27e01ba454ad8c00dd0547738a8362e3c8845bf76ec901574d78a14ac43453b0a\",\"host\":\"keybase.io\",\"kid\":\"0120d27e01ba454ad8c00dd0547738a8362e3c8845bf76ec901574d78a14ac43453b0a\",\"uid\":\"99759da4f968b16121ece44652f01a19\",\"username\":\"d_6d4e925d\"},\"team\":{\"id\":\"5d2c9db17c2309bf818ceefece77b624\",\"members\":{\"admin\":[\"b720a648e02b99c10d50de0c4f265419\"],\"owner\":[\"99759da4f968b16121ece44652f01a19\"],\"reader\":[\"c8f463c79c83fec675c398b6aa3fa719\"],\"writer\":[\"921f0e1f2632277cc1fa6600e0906819\"]},\"name\":\"t_bfaadb41\",\"per_team_key\":{\"encryption_kid\":\"01218ca00b08b4ee5729d957cf14155098b74199588bb5eee778ad1eae58bce26c370a\",\"generation\":1,\"reverse_sig\":\"g6Rib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEgiyRSCOiVHN56vT9eusVXlCTlHtCVH+FKyKeZbJzPiuUKp3BheWxvYWTFA3R7ImJvZHkiOnsia2V5Ijp7ImVsZGVzdF9raWQiOiIwMTIwZDI3ZTAxYmE0NTRhZDhjMDBkZDA1NDc3MzhhODM2MmUzYzg4NDViZjc2ZWM5MDE1NzRkNzhhMTRhYzQzNDUzYjBhIiwiaG9zdCI6ImtleWJhc2UuaW8iLCJraWQiOiIwMTIwZDI3ZTAxYmE0NTRhZDhjMDBkZDA1NDc3MzhhODM2MmUzYzg4NDViZjc2ZWM5MDE1NzRkNzhhMTRhYzQzNDUzYjBhIiwidWlkIjoiOTk3NTlkYTRmOTY4YjE2MTIxZWNlNDQ2NTJmMDFhMTkiLCJ1c2VybmFtZSI6ImRfNmQ0ZTkyNWQifSwidGVhbSI6eyJpZCI6IjVkMmM5ZGIxN2MyMzA5YmY4MThjZWVmZWNlNzdiNjI0IiwibWVtYmVycyI6eyJhZG1pbiI6WyJiNzIwYTY0OGUwMmI5OWMxMGQ1MGRlMGM0ZjI2NTQxOSJdLCJvd25lciI6WyI5OTc1OWRhNGY5NjhiMTYxMjFlY2U0NDY1MmYwMWExOSJdLCJyZWFkZXIiOlsiYzhmNDYzYzc5YzgzZmVjNjc1YzM5OGI2YWEzZmE3MTkiXSwid3JpdGVyIjpbIjkyMWYwZTFmMjYzMjI3N2NjMWZhNjYwMGUwOTA2ODE5Il19LCJuYW1lIjoidF9iZmFhZGI0MSIsInBlcl90ZWFtX2tleSI6eyJlbmNyeXB0aW9uX2tpZCI6IjAxMjE4Y2EwMGIwOGI0ZWU1NzI5ZDk1N2NmMTQxNTUwOThiNzQxOTk1ODhiYjVlZWU3NzhhZDFlYWU1OGJjZTI2YzM3MGEiLCJnZW5lcmF0aW9uIjoxLCJyZXZlcnNlX3NpZyI6bnVsbCwic2lnbmluZ19raWQiOiIwMTIwOGIyNDUyMDhlODk1MWNkZTdhYmQzZjVlYmFjNTU3OTQyNGU1MWVkMDk1MWZlMTRhYzhhNzk5NmM5Y2NmOGFlNTBhIn19LCJ0eXBlIjoidGVhbS5yb290IiwidmVyc2lvbiI6Mn0sImN0aW1lIjoxNDk3MjM5NTY2LCJleHBpcmVfaW4iOjE1NzY4MDAwMCwicHJldiI6bnVsbCwic2VxX3R5cGUiOjMsInNlcW5vIjoxLCJ0YWciOiJzaWduYXR1cmUifaNzaWfEQIhIqjwqQQFY8WglSLtvZu1hpncnMutA/jLaFmQJWcjdoMilr4ttLg3wlxKm6m+zWJC0Y9tiYBeHqGLYj5Mmkgaoc2lnX3R5cGUgo3RhZ80CAqd2ZXJzaW9uAQ==\",\"signing_kid\":\"01208b245208e8951cde7abd3f5ebac5579424e51ed0951fe14ac8a7996c9ccf8ae50a\"}},\"type\":\"team.root\",\"version\":2},\"ctime\":1497239566,\"expire_in\":157680000,\"prev\":null,\"seq_type\":3,\"seqno\":1,\"tag\":\"signature\"}","version":2,"uid":"99759da4f968b16121ece44652f01a19"},{"seqno":2,"sig":"g6Rib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEg0n4BukVK2MAN0FR3OKg2LjyIRb927JAVdNeKFKxDRTsKp3BheWxvYWTESJUCAsQgaCisMgGb2MAyfqV80hthgsO25NQIAYK7ARn5pjCDP1HEIKj3ZEpkyhQYH2mYtiHiXQVe7V5D4qgNwupJ5Nr/2nhcI6NzaWfEQNKql5dvPsQJK+pZKVGiLWS723t9SgaaDFx6NicXJzOM0VnLHKnql50wUcY/KsJOCqUIpKvJmNj6ogbwN/ljTwaoc2lnX3R5cGUgo3RhZ80CAqd2ZXJzaW9uAQ==","payload_json":"{\"body\":{\"key\":{\"eldest_kid\":\"0120d27e01ba454ad8c00dd0547738a8362e3c8845bf76ec901574d78a14ac43453b0a\",\"host\":\"keybase.io\",\"kid\":\"0120d27e01ba454ad8c00dd0547738a8362e3c8845bf76ec901574d78a14ac43453b0a\",\"uid\":\"99759da4f968b16121ece44652f01a19\",\"username\":\"d_6d4e925d\"},\"team\":{\"id\":\"5d2c9db17c2309bf818ceefece77b624\",\"members\":{\"writer\":[\"c8f463c79c83fec675c398b6aa3fa719\"]}},\"type\":\"team.change_membership\",\"version\":2},\"ctime\":1497239567,\"expire_in\":157680000,\"prev\":\"6828ac32019bd8c0327ea57cd21b6182c3b6e4d4080182bb0119f9a630833f51\",\"seq_type\":3,\"seqno\":2,\"tag\":\"signature\"}","version":2,"uid":"99759da4f968b16121ece44652f01a19"}],"box":{"nonce":"hdDTz9Scb6dWbe+BZsyZaXx76aQAAAAB","sender_kid":"0121a4f15b1009430ff69224c0c659eba66d61ca743b0d661a79075c8ca63a6e535d0a","generation":1,"ctext":"4Dz4i3Wzdj/BdH/kYCXvFnl1XKCqhxc58Z53j9VDloy/KG2ZzH204Sw5Q1xkzFkV","per_user_key_seqno":3},"prevs":{},"reader_key_masks":[{"mask":"tewSORjnVoyuHKR6ztsND+MNP2Pp9skEEEYmMBIQ5cY=","application":1,"generation":1},{"mask":"x7ZvY+WfK6WaJOCulxfOpdLgBEyuzSc8KgyIQGxT2uQ=","application":2,"generation":1}],"id":"5d2c9db17c2309bf818ceefece77b624","name":{"parts":["t_bfaadb41"]},"csrf_token":"lgHZIDk5NzU5ZGE0Zjk2OGIxNjEyMWVjZTQ0NjUyZjAxYTE5zlk+EA3OAAFRgMDEIKCIaEA5GV5wng89rpM0UlLiqxcOyNIVk8KdsEjQpmAm"}
`

type DeconstructJig struct {
	Chain []json.RawMessage `json:"chain"`
}

func TestTeamSigChainParse(t *testing.T) {
	tc := SetupTest(t, "test_team_chains", 1)
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
	tc := SetupTest(t, "test_team_chains", 1)
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

	player := NewTeamSigChainPlayer(tc.G, NewUserVersion(keybase1.UID("4bf92804c02fb7d2cd36a6d420d6f619"), 1), true)
	err = player.AddChainLinks(context.TODO(), chainLinks)
	require.NoError(t, err)

	// Check once before and after serializing and deserializing
	state, err := player.GetState()
	require.NoError(t, err)
	for i := 0; i < 2; i++ {
		if i == 0 {
			t.Logf("testing fresh")
		} else {
			t.Logf("testing serde")
		}

		require.Equal(t, "t_9d6d1e37", string(state.GetName()))
		require.False(t, state.IsSubteam())
		ptk, err := state.GetLatestPerTeamKey()
		require.NoError(t, err)
		require.Equal(t, keybase1.PerTeamKeyGeneration(2), ptk.Gen)
		require.Equal(t, keybase1.Seqno(3), ptk.Seqno)
		require.Equal(t, "0120802f55ed5e14f61c730871b5e99d637054ff7f5ba0c1b2cc52b154e3baf80a000a", string(ptk.SigKID))
		require.Equal(t, "0121e2511cbfb0418187a8e19183a1cd92637bc83fe116d1eb8984f52394495b5f120a", string(ptk.EncKID))
		require.Equal(t, keybase1.Seqno(3), state.GetLatestSeqno())

		checkRole := func(uid keybase1.UID, role keybase1.TeamRole) {
			uv := NewUserVersion(uid, 1)
			r, err := state.GetUserRole(uv)
			require.NoError(t, err)
			require.Equal(t, role, r)
		}

		checkRole("5bf82de4331b50b32cbbcfeadc2f3119", keybase1.TeamRole_OWNER)  // the "doug" user
		checkRole("53e315afb4b419931b0a6a1eaa09e219", keybase1.TeamRole_ADMIN)  // the "charlie" user
		checkRole("4bf92804c02fb7d2cd36a6d420d6f619", keybase1.TeamRole_WRITER) // the "bob" user
		checkRole("13e18aeafa4df6c94bf6af7d7bb98d19", keybase1.TeamRole_READER) // the "alice" user
		checkRole("popeye", keybase1.TeamRole_NONE)

		linkIDProto := state.GetLatestLinkID()
		require.Equal(t, "c94234a4855e47d5833a7f43b221ca5e5ccf9970465b77167a793366acf39b16", string(linkIDProto))
		linkIDLibkb, err := libkb.ImportLinkID(linkIDProto)
		require.NoError(t, err)
		require.Equal(t, linkIDProto, linkIDLibkb.Export())

		// Reserialize
		bs, err := encode(state.inner)
		require.NoError(t, err, "encode")
		state = TeamSigChainState{}
		err = decode(bs, &state.inner)
		require.NoError(t, err, "decode")
	}
}

func TestTeamSigChainPlay2(t *testing.T) {
	tc := SetupTest(t, "test_team_chains", 1)
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

	player := NewTeamSigChainPlayer(tc.G, NewUserVersion("99759da4f968b16121ece44652f01a19", 1), true)
	err = player.AddChainLinks(context.TODO(), chainLinks)
	require.NoError(t, err)

	// Check once before and after serializing and deserializing
	state, err := player.GetState()
	require.NoError(t, err)
	for i := 0; i < 2; i++ {
		require.Equal(t, "t_bfaadb41", string(state.GetName()))
		require.False(t, state.IsSubteam())
		ptk, err := state.GetLatestPerTeamKey()
		require.NoError(t, err)
		require.Equal(t, keybase1.PerTeamKeyGeneration(1), ptk.Gen)
		require.Equal(t, keybase1.Seqno(1), ptk.Seqno)
		require.Equal(t, "01208b245208e8951cde7abd3f5ebac5579424e51ed0951fe14ac8a7996c9ccf8ae50a", string(ptk.SigKID))
		require.Equal(t, "01218ca00b08b4ee5729d957cf14155098b74199588bb5eee778ad1eae58bce26c370a", string(ptk.EncKID))
		require.Equal(t, keybase1.Seqno(2), state.GetLatestSeqno())

		checkRole := func(uid keybase1.UID, role keybase1.TeamRole) {
			uv := NewUserVersion(uid, 1)
			r, err := state.GetUserRole(uv)
			require.NoError(t, err)
			require.Equal(t, role, r)
		}

		checkRole(keybase1.UID("99759da4f968b16121ece44652f01a19"), keybase1.TeamRole_OWNER)  // the 'doug' user
		checkRole(keybase1.UID("b720a648e02b99c10d50de0c4f265419"), keybase1.TeamRole_ADMIN)  // the 'charlie' user
		checkRole(keybase1.UID("921f0e1f2632277cc1fa6600e0906819"), keybase1.TeamRole_WRITER) // the 'bob' user
		checkRole(keybase1.UID("c8f463c79c83fec675c398b6aa3fa719"), keybase1.TeamRole_WRITER) // changed role for 'alice'; used to be a reader

		xs, err := state.GetUsersWithRole(keybase1.TeamRole_OWNER)
		require.NoError(t, err)
		require.Len(t, xs, 1)
		xs, err = state.GetUsersWithRole(keybase1.TeamRole_WRITER)
		require.NoError(t, err)
		require.Len(t, xs, 2)
		xs, err = state.GetUsersWithRole(keybase1.TeamRole_READER)
		require.Len(t, xs, 0)

		// Reserialize
		bs, err := encode(state.inner)
		require.NoError(t, err, "encode")
		state = TeamSigChainState{}
		err = decode(bs, &state.inner)
		require.NoError(t, err, "decode")
	}
}

func encode(input interface{}) ([]byte, error) {
	mh := codec.MsgpackHandle{WriteExt: true}
	var data []byte
	enc := codec.NewEncoderBytes(&data, &mh)
	if err := enc.Encode(input); err != nil {
		return nil, err
	}
	return data, nil
}

func decode(data []byte, res interface{}) error {
	mh := codec.MsgpackHandle{WriteExt: true}
	dec := codec.NewDecoderBytes(data, &mh)
	err := dec.Decode(res)
	return err
}
