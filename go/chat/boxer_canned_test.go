// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// This file contains canned messages for use in testing.

package chat

import (
	"encoding/hex"
	"fmt"
	"testing"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/stretchr/testify/require"
)

type cannedMessage struct {
	tag                     string
	encryptionKeyGeneration int
	encryptionKey           string // hex
	verifyKey               string // hex
	senderUsername          string
	senderUID               string // hex
	senderDeviceID          string // hex
	senderDeviceName        string
	senderDeviceType        string
	headerHash              string
	boxed                   string // hex
}

var cannedMessages = []cannedMessage{
	{
		tag: "alice25-bob25-1",
		// Sent some time before 0148400
		encryptionKeyGeneration: 1,
		encryptionKey:           `087655cbd18e65e4722127485d65ab70edcc7eddeddbb557e033254ebd325f32`,
		verifyKey:               `0120eacbc5f111b40a19d848c083dbff0cfb1fb43d5f041f74f48636e884d3a474a00a`,
		senderUsername:          "alice25",
		senderUID:               "5adac0bd7275ab390dd409114c7fb919",
		senderDeviceID:          `4243553a60e774592cf0ffa508f07318`,
		senderDeviceName:        `home thing`,
		senderDeviceType:        `desktop`,
		headerHash:              `c96e286d882efc44db80e51d8e08f1de28b4934cc8491fbe88420f31106514be`,
		boxed:                   `85ae626f64794369706865727465787483a165c43884b869638e5654e0279c34cb97785f4d66bf306b7756d99ec692c95d418fc72ff7b90ede73ec4547e8697ff8c3e26d6ec46b3538cf5fa015a16ec418926965ce4c661f56a5053e0456359e6c0951402c5d15e5b1a17601ac636c69656e744865616465728aa4636f6e7683a5746c666964c410d1fec1a2287b473206e282f4d4f30116a7746f7069634944c4101fb5a5e7585a43aba1a59520939e2420a9746f7069635479706501a764656c65746573c0aa6d65726b6c65526f6f7482a468617368c4402262d87f2115b8e3ba3280ed9f535b9d6a169cec07fd50547daa2efad4a3ac837b00cbe99a0d42798a677cad8090200bc6ed0caed492630520100f73b9fe040ba57365716e6fcd60ccab6d6573736167655479706506a470726576c0a673656e646572c4105adac0bd7275ab390dd409114c7fb919ac73656e646572446576696365c4104243553a60e774592cf0ffa508f07318aa7375706572736564657300a7746c664e616d65ad616c69636532352c626f623235a9746c665075626c6963c2b06865616465724369706865727465787483a165c50177b62f90b49847ef03323e8b3f3f3007bcded0ccdae26a4d88a6cc73634f4339fbbf092fdb244d7febc42fec689ed7f1051b9999924ae20c66cc95f577d20168fc9c9a2e8999d22606de26742f9435eee2845759a071ea9f1c0cd6331970c339e30ce320fad869128766aaa7e0fba4684a7272ecac3c2f3c06d76d1884f8d316b82e1413c9ab1804e148744a078eff123f18affb51748cd1339eac62214d04d37ef4dc43b54a39de17d0d3e1f6a44ad9dc7070697cf14fa7363215c3bd9f6c76b12e74d568f0c167ab4b9df6c001e9e87e6b7731506efb06beb50a014657500f8bf94aa9507e22506901d8e15750aa39bb729d9f57cdac64bd43fd6eba81f18998a34c7b6f662d19eecb4bcd8214294123f5de58382cee42facba4aac6fd8d70f89cba1042559f5326fd4a14b8bc01caf3febddbd9c8400032ab9c8db59b229f9ee31a3ba173529d342cb5e88575bb887bee59a8fe2adb4afd567b5c1afe64dc1036e0076c9f58d02059c18004264d2b899b5408aaa98072a16ec418e752771b2921eb1e7fcdcc39f7f22f176a5518f3639b6dd5a17601ad6b657947656e65726174696f6e01ac73657276657248656164657283a56374696d65cf0000015a48b2be27a96d657373616765494401ac73757065727365646564427900`,
	},
	{
		tag: "alice25-bob25-2",
		// Sent some time before 0148400
		encryptionKeyGeneration: 1,
		encryptionKey:           `087655cbd18e65e4722127485d65ab70edcc7eddeddbb557e033254ebd325f32`,
		verifyKey:               `0120eacbc5f111b40a19d848c083dbff0cfb1fb43d5f041f74f48636e884d3a474a00a`,
		senderUsername:          "alice25",
		senderUID:               "5adac0bd7275ab390dd409114c7fb919",
		senderDeviceID:          `4243553a60e774592cf0ffa508f07318`,
		senderDeviceName:        `home thing`,
		senderDeviceType:        `desktop`,
		headerHash:              `beb27c41dbeb2e9004f248f278243ade5e120cb7c41f40e847a2e22fe82cd3b4`,
		boxed:                   `85ae626f64794369706865727465787483a165c449ee8c699e1cb07be3b2ff1a898a06dbe202dbff79fbeb10d0fdba0cb37eb0daf039db77a237f5af9bc120537d6d973652a8bfb0b3c378f5fd3e407788d3de68eafa83b7f35408239aeea16ec4181e2cb19b55387de6f4d70ea0c2e4608e8117a8c515561f9ca17601ac636c69656e744865616465728aa4636f6e7683a5746c666964c410d1fec1a2287b473206e282f4d4f30116a7746f7069634944c4101fb5a5e7585a43aba1a59520939e2420a9746f7069635479706501a764656c65746573c0aa6d65726b6c65526f6f7482a468617368c4402262d87f2115b8e3ba3280ed9f535b9d6a169cec07fd50547daa2efad4a3ac837b00cbe99a0d42798a677cad8090200bc6ed0caed492630520100f73b9fe040ba57365716e6fcd60ccab6d6573736167655479706501a4707265769182a468617368c420c96e286d882efc44db80e51d8e08f1de28b4934cc8491fbe88420f31106514bea2696401a673656e646572c4105adac0bd7275ab390dd409114c7fb919ac73656e646572446576696365c4104243553a60e774592cf0ffa508f07318aa7375706572736564657300a7746c664e616d65ad616c69636532352c626f623235a9746c665075626c6963c2b06865616465724369706865727465787483a165c501a34974213f7ea848cf9b9b45edacc1610482d82a71b440e7ba037f4713f5e668689857c553ac52c663e74a78e75bd15788606184741d14cabcbcbeb4741b028bd27468cec658ba1c068681e1bf35566735b1124ea98fdee0633b08a52fb969b5423366d7530bb2675f60efe951e915a19ac9d1c8e95b2b40a078e9fe0de671062b3d1f780cd41794755dbdf5e1f2fe9f29fa4a578a9fc5bcb37a9f1a4e7cd55c5d7309660e0ab722b7fa1a9c499eca678e82e51c8cbf5d0d0b2f9d6e8268afc750fb2b5a6a21151db5733b5d9330d5a2dd6608e6c79cabf3bd5ae5412d844eb6fe7ce5764116dc2a5005ef407194676be1ec10a34d8b57083b808949b08d31fa74536031279ac76801922b691fd91b3ea1e7c3de8224ce1fd7e96b5560355ec67330cb3ecfc5383a9e3cb9615450a0741a0bcba2f5dada19636f8385b4d0eb75d4a0220b69dde9f0921ae58e124b8755021ac900afcedd1172c0491fb99aa6fbcf3017136298f1fb885da21ad08e55e2b583e80cdbd6c8377d53e5eb78548173360ff9d3a3b63cb6dfe799011e80c5564e93f42c120000ec0e6e66448144287d0b261b54a16ec418a5e2b86f62d26c2ed41e27b1e1c619c35aa87b4ab9e167e8a17601ad6b657947656e65726174696f6e01ac73657276657248656164657283a56374696d65cf0000015a48b2bec2a96d657373616765494402ac73757065727365646564427900`,
	},
}

func getCannedMessage(t *testing.T, tag string) cannedMessage {
	for _, cm := range cannedMessages {
		if cm.tag == tag {
			return cm
		}
	}
	errStr := fmt.Sprintf("Cannot find canned message: %q", tag)
	t.Fatalf(errStr)
	panic(errStr)
}

func (cm cannedMessage) AsBoxed(t *testing.T) (res chat1.MessageBoxed) {
	cm.unhex(t, &res, cm.boxed)
	return res
}

func (cm cannedMessage) EncryptionKey(t *testing.T) *keybase1.CryptKey {
	keyBytes, err := hex.DecodeString(cm.encryptionKey)
	require.NoError(t, err)

	var keyBytes32 keybase1.Bytes32
	copy(keyBytes32[:], keyBytes)
	res := keybase1.CryptKey{
		KeyGeneration: cm.encryptionKeyGeneration,
		Key:           keyBytes32,
	}
	require.NotNil(t, res, "nil canned encryption key")
	require.Equal(t, len(res.Key), 32, "non-32 byte encryption key")
	return &res
}

func (cm cannedMessage) VerifyKey(t *testing.T) []byte {
	keyBytes, err := hex.DecodeString(cm.verifyKey)
	require.NoError(t, err)
	require.NotNil(t, keyBytes)
	return keyBytes
}

func (cm cannedMessage) SenderUID(t *testing.T) gregor1.UID {
	uid, err := hex.DecodeString(cm.senderUID)
	require.NoError(t, err)
	require.NotNil(t, uid)
	return uid
}

func (cm cannedMessage) SenderDeviceID(t *testing.T) gregor1.DeviceID {
	did, err := hex.DecodeString(cm.senderDeviceID)
	require.NoError(t, err)
	require.NotNil(t, did)
	return did
}

func (cm cannedMessage) unhex(t *testing.T, out interface{}, inHex string) {
	bytes, err := hex.DecodeString(inHex)
	require.NoError(t, err)
	mh := codec.MsgpackHandle{WriteExt: true}
	dec := codec.NewDecoderBytes(bytes, &mh)
	err = dec.Decode(&out)
	require.NoError(t, err)
}
