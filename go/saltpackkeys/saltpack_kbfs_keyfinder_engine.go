// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
//
// CORE-8423 re-enable this build tags after most clients update
// build !production,!staging

package saltpackkeys

import (
	"encoding/hex"
	"fmt"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/keybase/saltpack"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// SaltpackKBFSKeyfinderEngineForTesting is an engine to find kbfs keys to encrypt saltpack messages. These keys have been substituted with implicit team keys in the current version of the keybase app,
// so this engine is behind a devel only flag and is used only in tests to ensure backwards compatibility.
//
// This engine silently ignores teams and other kinds of keys requested, so be careful!
// This code used to be part of the SaltpackEncrypt engine in engine/saltpack_encrypt.go.
type SaltpackKBFSKeyfinderEngineForTesting struct {
	arg                   libkb.SaltpackRecipientKeyfinderArg
	SaltpackSymmetricKeys []libkb.SaltpackReceiverSymmetricKey
}

var _ libkb.Engine2 = (*SaltpackKBFSKeyfinderEngineForTesting)(nil)
var _ libkb.SaltpackRecipientKeyfinderEngineInterface = (*SaltpackKBFSKeyfinderEngineForTesting)(nil)

// NewSaltpackKBFSKeyfinderEngineForTesting creates a SaltpackKBFSKeyfinderEngineForTesting engine.
func NewSaltpackKBFSKeyfinderEngineForTesting(arg libkb.SaltpackRecipientKeyfinderArg) libkb.SaltpackRecipientKeyfinderEngineInterface {
	return &SaltpackKBFSKeyfinderEngineForTesting{
		arg: arg,
	}
}

// Name is the unique engine name.
func (e *SaltpackKBFSKeyfinderEngineForTesting) Name() string {
	return "SaltpackKBFSKeyfinderEngineForTesting"
}

// Prereqs returns the engine prereqs.
func (e *SaltpackKBFSKeyfinderEngineForTesting) Prereqs() engine.Prereqs {
	return engine.Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *SaltpackKBFSKeyfinderEngineForTesting) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *SaltpackKBFSKeyfinderEngineForTesting) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (e *SaltpackKBFSKeyfinderEngineForTesting) Run(m libkb.MetaContext) (err error) {
	defer m.Trace("SaltpackKBFSKeyfinderEngineForTesting#Run", func() error { return err })()

	e.SaltpackSymmetricKeys, err = e.makeSymmetricReceivers(m)

	return err
}

func (e *SaltpackKBFSKeyfinderEngineForTesting) GetSymmetricKeys() []libkb.SaltpackReceiverSymmetricKey {
	return e.SaltpackSymmetricKeys
}

func (e *SaltpackKBFSKeyfinderEngineForTesting) GetPublicKIDs() []keybase1.KID {
	return []keybase1.KID{}
}

// TODO: Make sure messages that encrypt only to self are working properly.
func (e *SaltpackKBFSKeyfinderEngineForTesting) makeSymmetricReceivers(m libkb.MetaContext) ([]libkb.SaltpackReceiverSymmetricKey, error) {

	// Fetch the TLF keys and assemble the pseudonym info objects.
	var cryptKeys []keybase1.CryptKey
	var pseudonymInfos []libkb.TlfPseudonymInfo
	for _, user := range e.arg.Recipients {
		tlfName := fmt.Sprintf("%s,%s", m.G().Env.GetUsername(), user)
		m.Debug("saltpack signcryption fetching TLF key for %s", tlfName)
		res, err := e.completeAndCanonicalize(m, tlfName)
		if err != nil {
			return nil, err
		}
		if len(res.TlfID) != 32 {
			return nil, fmt.Errorf("TLF ID wrong length: %d", len(res.TlfID))
		}
		var tlfID [16]byte
		tlfIDSlice, err := hex.DecodeString(string(res.TlfID))
		if err != nil {
			return nil, err
		}
		copy(tlfID[:], tlfIDSlice)
		keys, err := e.getCryptKeys(m, tlfName)
		if err != nil {
			return nil, err
		}
		maxKey := maxGenerationKey(keys.CryptKeys)
		pseudonymInfo := libkb.TlfPseudonymInfo{
			Name:    "/keybase/private/" + string(res.CanonicalName),
			ID:      tlfID,
			KeyGen:  libkb.KeyGen(maxKey.KeyGeneration),
			HmacKey: libkb.RandomHmacKey(),
		}
		cryptKeys = append(cryptKeys, maxKey)
		pseudonymInfos = append(pseudonymInfos, pseudonymInfo)
	}

	// Post the pseudonyms in a batch.
	pseudonyms, err := libkb.PostTlfPseudonyms(m.Ctx(), m.G(), pseudonymInfos)
	if err != nil {
		return nil, err
	}
	if len(pseudonyms) != len(pseudonymInfos) {
		return nil, fmt.Errorf("makeSymmetricReceivers got the wrong number of pseudonyms back (%d != %d)", len(pseudonyms), len(pseudonymInfos))
	}

	// Assemble the receivers.
	var receiverSymmetricKeys []libkb.SaltpackReceiverSymmetricKey
	for i, key := range cryptKeys {
		receiverSymmetricKeys = append(receiverSymmetricKeys, libkb.SaltpackReceiverSymmetricKey{
			Key:        saltpack.SymmetricKey(key.Key),
			Identifier: pseudonyms[i][:],
		})
	}
	return receiverSymmetricKeys, nil
}

func (e *SaltpackKBFSKeyfinderEngineForTesting) getCryptKeys(m libkb.MetaContext, name string) (keybase1.GetTLFCryptKeysRes, error) {
	xp := m.G().ConnectionManager.LookupByClientType(keybase1.ClientType_KBFS)
	if xp == nil {
		return keybase1.GetTLFCryptKeysRes{}, libkb.KBFSNotRunningError{}
	}
	cli := &keybase1.TlfKeysClient{
		Cli: rpc.NewClient(xp, libkb.NewContextifiedErrorUnwrapper(m.G()), libkb.LogTagsFromContext),
	}
	return cli.GetTLFCryptKeys(m.Ctx(), keybase1.TLFQuery{
		TlfName:          name,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_SALTPACK,
	})
}

func (e SaltpackKBFSKeyfinderEngineForTesting) completeAndCanonicalize(m libkb.MetaContext, tlfName string) (keybase1.CanonicalTLFNameAndIDWithBreaks, error) {
	username := m.G().Env.GetUsername()
	if len(username) == 0 {
		return keybase1.CanonicalTLFNameAndIDWithBreaks{}, libkb.LoginRequiredError{}
	}

	// Prepend username in case it's not present. We don't need to check if it
	// exists already since CryptKeys calls below transforms the TLF name into a
	// canonical one.
	//
	// This makes username a writer on this TLF, which might be unexpected.
	// TODO: We should think about how to handle read-only TLFs.
	tlfName = string(username) + "," + tlfName

	resp, err := e.getCryptKeys(m, tlfName)
	if err != nil {
		return keybase1.CanonicalTLFNameAndIDWithBreaks{}, err
	}

	return resp.NameIDBreaks, nil
}

func maxGenerationKey(keys []keybase1.CryptKey) keybase1.CryptKey {
	generation := -1
	var maxKey keybase1.CryptKey
	for _, key := range keys {
		if key.KeyGeneration > generation {
			generation = key.KeyGeneration
			maxKey = key
		}
	}
	return maxKey
}
