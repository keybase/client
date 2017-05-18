// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"

	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
)

// FakeInitialRekey fakes the initial rekey for the given
// BareRootMetadata. This is necessary since newly-created
// BareRootMetadata objects don't have enough data to build a
// TlfHandle from until the first rekey. pubKey is non-empty only for
// server-side tests.
func FakeInitialRekey(md MutableBareRootMetadata,
	h tlf.Handle, pubKey kbfscrypto.TLFPublicKey) ExtraMetadata {
	if md.LatestKeyGeneration() >= FirstValidKeyGen {
		panic(fmt.Errorf("FakeInitialRekey called on MD with existing key generations"))
	}

	wKeys := make(UserDevicePublicKeys)
	for _, w := range h.Writers {
		k := kbfscrypto.MakeFakeCryptPublicKeyOrBust(string(w))
		wKeys[w.AsUserOrBust()] = DevicePublicKeys{
			k: true,
		}
	}

	rKeys := make(UserDevicePublicKeys)
	for _, r := range h.Readers {
		k := kbfscrypto.MakeFakeCryptPublicKeyOrBust(string(r))
		rKeys[r.AsUserOrBust()] = DevicePublicKeys{
			k: true,
		}
	}

	codec := kbfscodec.NewMsgpack()
	// TODO: Consider making crypto a parameter once we remove all
	// uses of mocked-out crypto.
	crypto := MakeCryptoCommon(codec)
	tlfCryptKey := kbfscrypto.MakeTLFCryptKey([32]byte{0x1})
	extra, _, err := md.AddKeyGeneration(
		codec, crypto, nil, wKeys, rKeys,
		kbfscrypto.TLFEphemeralPublicKey{},
		kbfscrypto.TLFEphemeralPrivateKey{},
		pubKey, kbfscrypto.TLFCryptKey{}, tlfCryptKey)
	if err != nil {
		panic(err)
	}
	err = md.FinalizeRekey(crypto, extra)
	if err != nil {
		panic(err)
	}
	return extra
}
