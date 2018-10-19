package libkb

import (
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"testing"
)

func importExportLink(tc TestContext, data []byte, uid keybase1.UID) {
	m := NewMetaContextForTest(tc)
	linkServer, err := ImportLinkFromServer(m, nil, data, uid)
	require.NoError(tc.T, err)
	packed, err := linkServer.Pack()
	require.NoError(tc.T, err)
	packedBytes, err := packed.Marshal()
	require.NoError(tc.T, err)
	unpacked := NewChainLink(tc.G, nil, linkServer.id)
	err = unpacked.Unpack(m, true, uid, packedBytes)
	require.NoError(tc.T, err)
	repacked, err := unpacked.Pack()
	require.NoError(tc.T, err)
	repackedBytes, err := repacked.Marshal()
	require.NoError(tc.T, err)
	require.True(tc.T, FastByteArrayEq(packedBytes, repackedBytes))
}

func TestChainLinkImport(t *testing.T) {
	tc := SetupTest(t, "chainlinkimport", 1)
	defer tc.Cleanup()

	importExportLink(tc, []byte(linkVer1), linkUID)
	importExportLink(tc, []byte(linkVer2), linkUID)
}

var linkUID = keybase1.UID("38566cd216a6c42c33134c5229452c19")

const linkVer1 = `{
      "seqno": 5,
      "payload_hash": "d8c707d2f253b2bd50ed75764cf404bbbcc58ccb7246f3d6ae17828dae57f332",
      "merkle_seqno": 98495,
      "sig_id": "535c9f11743bc307bc6c82721f36afa519a554dd7ec36a7b7ceb77ac7d82ded70f",
      "sig_id_short": "U1yfEXQ7wwe8bIJyHzavpRmlVN1-w2p7fOt3",
      "kid": "0120e5b206afdd8ad09f527e79721e21024237d31db98e6cb4038d5bcc785b68b6130a",
      "sig": "hKRib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEg5bIGr92K0J9SfnlyHiECQjfTHbmObLQDjVvMeFtothMKp3BheWxvYWTFBDx7ImJvZHkiOnsiZGV2aWNlIjp7ImlkIjoiZGQ4MzBmYmNhZjkyYWMzODUzMDk5M2Q3NjkzNmNlMTgiLCJraWQiOiIwMTIxNDQxZTZkOWJmYTFlYzdmMmM5ZTI0NWIzYzIzZjZmZDk1NDRhOTA1MGI4NmE1NGNmYjgyYzVjZDJjNGIwOTkzMDBhIiwic3RhdHVzIjoxfSwia2V5Ijp7ImVsZGVzdF9raWQiOiIwMTIwNTdiZDg2YTVjMmE4ZTVlMGJhMjI4MDIxYjQ5MjE2ZTM4MTU4Y2UwNGFiYmEwNjlmZTliM2MyMjk4ZDI4M2E2MDBhIiwiaG9zdCI6ImtleWJhc2UuaW8iLCJraWQiOiIwMTIwZTViMjA2YWZkZDhhZDA5ZjUyN2U3OTcyMWUyMTAyNDIzN2QzMWRiOThlNmNiNDAzOGQ1YmNjNzg1YjY4YjYxMzBhIiwidWlkIjoiMzg1NjZjZDIxNmE2YzQyYzMzMTM0YzUyMjk0NTJjMTkiLCJ1c2VybmFtZSI6InRlc3R1c2VyMTg3NCJ9LCJtZXJrbGVfcm9vdCI6eyJjdGltZSI6MTUxOTMxNjAwOSwiaGFzaCI6ImQ3MjMxMGVmMmY3MmZmMDM4YzA5YThmYTdkYjYxZjg4ZDFiNzdkNGMzZGRjMzgxNDI1NDcxOTQ5YzI5OGMyMjJmNzFjZmVlODA5NjYzZjQyNzgxNDRlZmE2ZjU4YWYyOGM3NjNlOWYzNGU0YWM1Mzg0MDRkYTNkMmU5N2YyZmM5IiwiaGFzaF9tZXRhIjoiNjcyMzE3ODU0ZGUwYTgyOGIyMzg5Yzg3MTYxMmZkMDAyMjJmMDM3YmRjYjMzNTFlZTVhNjQzODVmMWUwZmFjYiIsInNlcW5vIjo5ODQ5NH0sInN1YmtleSI6eyJraWQiOiIwMTIxNDQxZTZkOWJmYTFlYzdmMmM5ZTI0NWIzYzIzZjZmZDk1NDRhOTA1MGI4NmE1NGNmYjgyYzVjZDJjNGIwOTkzMDBhIiwicGFyZW50X2tpZCI6IjAxMjBlNWIyMDZhZmRkOGFkMDlmNTI3ZTc5NzIxZTIxMDI0MjM3ZDMxZGI5OGU2Y2I0MDM4ZDViY2M3ODViNjhiNjEzMGEifSwidHlwZSI6InN1YmtleSIsInZlcnNpb24iOjF9LCJjbGllbnQiOnsibmFtZSI6ImtleWJhc2UuaW8gZ28gY2xpZW50IiwidmVyc2lvbiI6IjEuMC40MSJ9LCJjdGltZSI6MTUxOTMxNjAwOSwiZXhwaXJlX2luIjo1MDQ1NzYwMDAsInByZXYiOiIyNzhmOWZhZmE5MTc5YWE0OWY4NTJlZTI5ODhlOTI1NWUwZjMyYmM5MjEyZTNiMTI3OWU5YTMzNmQxYTZmNTYwIiwic2Vxbm8iOjUsInRhZyI6InNpZ25hdHVyZSJ9o3NpZ8RAaFWjav1+kGe8j73ulzmDTJYSPlD2VQsRXUzX2Ch628qdnVzbg24ZuOgwPMKt8RENC9O6VCnPAhSnMfuYO86lAKhzaWdfdHlwZSCkaGFzaIKkdHlwZQildmFsdWXEICg/YL04OBin+W3+BrM9GNwSVHg9fegkZUhrARIc1tSxo3RhZ80CAqd2ZXJzaW9uAQ==",
      "payload_json": "{\"body\":{\"device\":{\"id\":\"dd830fbcaf92ac38530993d76936ce18\",\"kid\":\"0121441e6d9bfa1ec7f2c9e245b3c23f6fd9544a9050b86a54cfb82c5cd2c4b099300a\",\"status\":1},\"key\":{\"eldest_kid\":\"012057bd86a5c2a8e5e0ba228021b49216e38158ce04abba069fe9b3c2298d283a600a\",\"host\":\"keybase.io\",\"kid\":\"0120e5b206afdd8ad09f527e79721e21024237d31db98e6cb4038d5bcc785b68b6130a\",\"uid\":\"38566cd216a6c42c33134c5229452c19\",\"username\":\"testuser1874\"},\"merkle_root\":{\"ctime\":1519316009,\"hash\":\"d72310ef2f72ff038c09a8fa7db61f88d1b77d4c3ddc381425471949c298c222f71cfee809663f4278144efa6f58af28c763e9f34e4ac538404da3d2e97f2fc9\",\"hash_meta\":\"672317854de0a828b2389c871612fd00222f037bdcb3351ee5a64385f1e0facb\",\"seqno\":98494},\"subkey\":{\"kid\":\"0121441e6d9bfa1ec7f2c9e245b3c23f6fd9544a9050b86a54cfb82c5cd2c4b099300a\",\"parent_kid\":\"0120e5b206afdd8ad09f527e79721e21024237d31db98e6cb4038d5bcc785b68b6130a\"},\"type\":\"subkey\",\"version\":1},\"client\":{\"name\":\"keybase.io go client\",\"version\":\"1.0.41\"},\"ctime\":1519316009,\"expire_in\":504576000,\"prev\":\"278f9fafa9179aa49f852ee2988e9255e0f32bc9212e3b1279e9a336d1a6f560\",\"seqno\":5,\"tag\":\"signature\"}",
      "sig_type": 1,
      "sig_version": 1,
      "ctime": 1519316009,
      "etime": 2023892009,
      "rtime": null,
      "eldest_seqno": 1,
      "sig_status": 0,
      "prev": "278f9fafa9179aa49f852ee2988e9255e0f32bc9212e3b1279e9a336d1a6f560",
      "proof_id": null,
      "proof_type": null,
      "proof_text_check": null,
      "proof_text_full": null,
      "check_data_json": null,
      "remote_id": null,
      "api_url": null,
      "human_url": null,
      "proof_state": null,
      "proof_status": null,
      "retry_count": null,
      "hard_fail_count": null,
      "last_check": null,
      "last_success": null,
      "version": null,
      "fingerprint": ""
    }`

const linkVer2 = `{
      "seqno": 6,
      "payload_hash": "63a09ace5f83816e96ae96f9d2869912987ffd62bd3fab6f256fc873f01f4205",
      "merkle_seqno": 98496,
      "sig_id": "28335497e87230131e3f1473dd98accd21d4329a420bf970833fa5a60127d1610f",
      "sig_id_short": "KDNUl-hyMBMePxRz3ZiszSHUMppCC_lwgz-l",
      "kid": "012057bd86a5c2a8e5e0ba228021b49216e38158ce04abba069fe9b3c2298d283a600a",
      "sig": "hKRib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEgV72GpcKo5eC6IoAhtJIW44FYzgSrugaf6bPCKY0oOmAKp3BheWxvYWTESpcCBsQg2McH0vJTsr1Q7XV2TPQEu7zFjMtyRvPWrheCja5X8zLEIPqyUjccwO63+bVojYys2Jy6K1c1d5BdO5LuwfloA8MxAwHCo3NpZ8RAg38rHEmvaUJHc3QGMqx8tZCDjxi2z1e7c+9brX1WWbqSHOLXDY+hRsnSkPNv7MfnrOK6hjzww/udG30iQYvEDqhzaWdfdHlwZSCkaGFzaIKkdHlwZQildmFsdWXEIFyjQhLjrdVvb2nv98JI5/nebzxDH17MpGIEZ0dleTJko3RhZ80CAqd2ZXJzaW9uAQ==",
      "payload_json": "{\"body\":{\"key\":{\"eldest_kid\":\"012057bd86a5c2a8e5e0ba228021b49216e38158ce04abba069fe9b3c2298d283a600a\",\"host\":\"keybase.io\",\"kid\":\"012057bd86a5c2a8e5e0ba228021b49216e38158ce04abba069fe9b3c2298d283a600a\",\"uid\":\"38566cd216a6c42c33134c5229452c19\",\"username\":\"testuser1874\"},\"merkle_root\":{\"ctime\":1519316009,\"hash\":\"b8447dbc02e6e58a69827207c5d7aa09bb77b5cf0129a49e39738c96d9ad757434249d610b2b9099f2c3385c249bdce0fb27b27e661f527e20ad083742000cc3\",\"hash_meta\":\"4eb194235868bbdc2eb2416d4365bc70378ce7edbc132dcc5b37b8c2cc79fa54\",\"seqno\":98495},\"track\":{\"basics\":{\"id_version\":0,\"last_id_change\":1519314299,\"username\":\"followtest92652\"},\"id\":\"6c01fd886268fd6df8185cac265ca819\",\"remote_proofs\":[],\"seq_tail\":null},\"type\":\"track\",\"version\":2},\"client\":{\"name\":\"keybase.io go client\",\"version\":\"1.0.41\"},\"ctime\":1519316042,\"expire_in\":504576000,\"prev\":\"d8c707d2f253b2bd50ed75764cf404bbbcc58ccb7246f3d6ae17828dae57f332\",\"seqno\":6,\"tag\":\"signature\"}",
      "sig_type": 3,
      "sig_version": 2,
      "ctime": 1519316042,
      "etime": 2023892042,
      "rtime": null,
      "eldest_seqno": 1,
      "sig_status": 0,
      "prev": "d8c707d2f253b2bd50ed75764cf404bbbcc58ccb7246f3d6ae17828dae57f332",
      "proof_id": null,
      "proof_type": null,
      "proof_text_check": null,
      "proof_text_full": null,
      "check_data_json": null,
      "remote_id": null,
      "api_url": null,
      "human_url": null,
      "proof_state": null,
      "proof_status": null,
      "retry_count": null,
      "hard_fail_count": null,
      "last_check": null,
      "last_success": null,
      "version": null,
      "fingerprint": ""
    }`
