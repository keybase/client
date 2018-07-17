// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// SaltpackUserKeyfinder is an engine to find Per User Keys (PUK). Users can also be loaded by assertions, possibly tracking them if necessary.
// This engine does not find per team keys, which capability is implemented by SaltpackRecipientKeyfinder in the saltpackKeyHelpers package.
type SaltpackUserKeyfinder struct {
	Arg                           libkb.SaltpackRecipientKeyfinderArg
	RecipientEntityKeyMap         map[keybase1.UserOrTeamID]([]keybase1.KID)
	RecipientDeviceAndPaperKeyMap map[keybase1.UID]([]keybase1.KID)
}

// NewSaltpackUserKeyfinderAsInterface creates a SaltpackUserKeyfinder engine.
func NewSaltpackUserKeyfinderAsInterface(Arg libkb.SaltpackRecipientKeyfinderArg) libkb.SaltpackRecipientKeyfinderEngineInterface {
	return &SaltpackUserKeyfinder{
		Arg: Arg,
		RecipientEntityKeyMap:         make(map[keybase1.UserOrTeamID]([]keybase1.KID)),
		RecipientDeviceAndPaperKeyMap: make(map[keybase1.UID]([]keybase1.KID)),
	}
}

func NewSaltpackUserKeyfinder(Arg libkb.SaltpackRecipientKeyfinderArg) *SaltpackUserKeyfinder {
	return &SaltpackUserKeyfinder{
		Arg: Arg,
		RecipientEntityKeyMap:         make(map[keybase1.UserOrTeamID]([]keybase1.KID)),
		RecipientDeviceAndPaperKeyMap: make(map[keybase1.UID]([]keybase1.KID)),
	}
}

// Name is the unique engine name.
func (e *SaltpackUserKeyfinder) Name() string {
	return "SaltpackUserKeyfinder"
}

// Prereqs returns the engine prereqs.
func (e *SaltpackUserKeyfinder) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *SaltpackUserKeyfinder) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *SaltpackUserKeyfinder) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (e *SaltpackUserKeyfinder) GetPublicKIDs() []keybase1.KID {
	var r []keybase1.KID
	for _, keys := range e.RecipientDeviceAndPaperKeyMap {
		r = append(r, keys...)
	}
	for _, keys := range e.RecipientEntityKeyMap {
		r = append(r, keys...)
	}

	return r
}

func (e *SaltpackUserKeyfinder) GetSymmetricKeys() []libkb.SaltpackReceiverSymmetricKey {
	return []libkb.SaltpackReceiverSymmetricKey{}
}

func (e *SaltpackUserKeyfinder) Run(m libkb.MetaContext) (err error) {
	defer m.CTrace("SaltpackUserKeyfinder#Run", func() error { return err })()

	err = e.AddOwnKeysIfNeeded(m)
	if err != nil {
		return err
	}

	err = e.lookupRecipients(m)
	if err != nil {
		return err
	}
	return nil
}

func (e *SaltpackUserKeyfinder) AddOwnKeysIfNeeded(m libkb.MetaContext) error {
	if !e.Arg.NoSelfEncrypt {
		if !m.ActiveDevice().Valid() {
			return libkb.NewLoginRequiredError("need to be logged in or use --no-self-encrypt")
		}
		arg := libkb.NewLoadUserArgWithMetaContext(m).WithUID(m.ActiveDevice().UID()).WithForcePoll(true)
		upak, _, err := m.G().GetUPAKLoader().LoadV2(arg)
		if err != nil {
			return err
		}
		e.AddUserRecipient(m, &upak.Current)
	}
	return nil
}

// lookupRecipients adds the KID corresponding to each recipient to the recipientMap
func (e *SaltpackUserKeyfinder) lookupRecipients(m libkb.MetaContext) error {
	for _, u := range e.Arg.Recipients {
		// TODO make these lookups in parallel (maybe using sync.WaitGroup)
		err := e.LookupUser(m, u) // For existing users
		if err == nil {
			continue
		} else if _, isIdentifyFailedError := err.(libkb.IdentifyFailedError); !isIdentifyFailedError {
			return err
		}
		return fmt.Errorf("Cannot find keys for %v: it is not an assertion for a registered user (err = %v)", u, err)
	}
	return nil
}

func (e *SaltpackUserKeyfinder) LookupUser(m libkb.MetaContext, user string) error {

	Arg := keybase1.Identify2Arg{
		UserAssertion: user,
		Reason: keybase1.IdentifyReason{
			Type: keybase1.IdentifyReasonType_ENCRYPT,
		},
		AlwaysBlock:      true,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CLI,
	}
	eng := NewResolveThenIdentify2(m.G(), &Arg)
	if err := RunEngine2(m, eng); err != nil {
		return libkb.IdentifyFailedError{Assertion: user, Reason: err.Error()}
	}

	engRes := eng.Result()
	if engRes == nil {
		return fmt.Errorf("Null result from Identify2")
	}
	arg := libkb.NewLoadUserArgWithMetaContext(m).WithUID(engRes.Upk.GetUID()).WithForcePoll(true)
	upak, _, err := m.G().GetUPAKLoader().LoadV2(arg)
	if err != nil {
		return err
	}

	return e.AddUserRecipient(m, &upak.Current)
}

func (e *SaltpackUserKeyfinder) hasRecipientDeviceOrPaperKeys(id keybase1.UID) bool {
	_, ok := e.RecipientDeviceAndPaperKeyMap[id]
	return ok
}

func (e *SaltpackUserKeyfinder) hasRecipientEntityKeys(id keybase1.UserOrTeamID) bool {
	_, ok := e.RecipientEntityKeyMap[id]
	return ok
}

func (e *SaltpackUserKeyfinder) AddUserRecipient(m libkb.MetaContext, upk *keybase1.UserPlusKeysV2) error {
	if err := e.AddDeviceAndPaperKeys(m, upk); err != nil {
		return err
	}
	return e.AddPUK(m, upk)
}

func (e *SaltpackUserKeyfinder) isPaperEncryptionKey(key *keybase1.PublicKeyV2NaCl, deviceKeys *(map[keybase1.KID]keybase1.PublicKeyV2NaCl)) bool {
	return libkb.KIDIsDeviceEncrypt(key.Base.Kid) && key.Parent != nil && (*deviceKeys)[key.Base.Kid].DeviceType == libkb.DeviceTypePaper
}

func (e *SaltpackUserKeyfinder) AddDeviceAndPaperKeys(m libkb.MetaContext, upk *keybase1.UserPlusKeysV2) error {
	if !e.Arg.UsePaperKeys && !e.Arg.UseDeviceKeys {
		// No need to add anything
		return nil
	}

	if e.hasRecipientDeviceOrPaperKeys(upk.Uid) {
		// This user's keys were already added
		return nil
	}

	var keys []keybase1.KID
	hasPaperKey := false
	hasDeviceKey := false

	hasPUK := len(upk.PerUserKeys) > 0

	for KID, key := range upk.DeviceKeys {
		// Note: for Nacl encryption keys, the DeviceType field is not set, so we need to look at the "parent" signing key
		if e.isPaperEncryptionKey(&key, &upk.DeviceKeys) {
			hasPaperKey = true
			if e.Arg.UsePaperKeys {
				keys = append(keys, KID)
				m.CDebugf("adding user %v's paper key", upk.Username)
			}
		}

		if libkb.KIDIsDeviceEncrypt(KID) && !e.isPaperEncryptionKey(&key, &upk.DeviceKeys) {
			hasDeviceKey = true
			if e.Arg.UseDeviceKeys {
				keys = append(keys, KID)
				m.CDebugf("adding user %v's device key", upk.Username)
			}
		}
	}

	// If the recipient has no suitable keys at all (either device or paper keys), we return an error. However, if the user requested both device and paper keys for encryption,
	// and this recipient only has one kind, we just show a warning. This is because this command might be called with a list of many users, and we do not want to abort
	// if just one of these users happens to be missing one of the two key types.
	// However, note that are more conservative and do error out if the recipient doesn't have a per user key (even if it instead has a device key), as per user keys are
	// of a different `quality` as they allow to decrypt with devices that do not yet exist, while the former keys don't.
	if len(keys) == 0 {
		return libkb.NoNaClEncryptionKeyError{
			Username:     upk.Username,
			HasPGPKey:    len(upk.PGPKeys) > 0,
			HasPUK:       hasPUK,
			HasDeviceKey: hasDeviceKey,
			HasPaperKey:  hasPaperKey,
		}
	}
	if e.Arg.UseDeviceKeys && !hasDeviceKey {
		m.CWarningf("User %v does not have a device key (they can still decrypt the message with a paper key).", upk.Username)
	}
	if e.Arg.UsePaperKeys && !hasPaperKey {
		m.CWarningf("User %v does not have a paper key (they can still decrypt the message with a non paper device key).", upk.Username)
	}

	e.RecipientDeviceAndPaperKeyMap[upk.Uid] = keys

	return nil
}

func (e *SaltpackUserKeyfinder) AddPUK(m libkb.MetaContext, upk *keybase1.UserPlusKeysV2) error {
	if !e.Arg.UseEntityKeys {
		// No need to add anything
		return nil
	}

	if e.hasRecipientEntityKeys(upk.Uid.AsUserOrTeam()) {
		// This user's keys were already added
		return nil
	}

	hasPUK := len(upk.PerUserKeys) > 0

	if !hasPUK {
		hasPaperKey := false
		hasDeviceKey := false
		for KID, key := range upk.DeviceKeys {
			if e.isPaperEncryptionKey(&key, &upk.DeviceKeys) {
				hasPaperKey = true
			}
			if libkb.KIDIsDeviceEncrypt(KID) && !e.isPaperEncryptionKey(&key, &upk.DeviceKeys) {
				hasDeviceKey = true
			}
		}

		return libkb.NoNaClEncryptionKeyError{
			Username:     upk.Username,
			HasPGPKey:    len(upk.PGPKeys) > 0,
			HasPUK:       hasPUK,
			HasDeviceKey: hasDeviceKey,
			HasPaperKey:  hasPaperKey,
		}
	}

	// We ensured above that the user has a PUK, so the loop below will be executed at least once
	maxGen := -1
	var lk keybase1.KID
	for _, k := range upk.PerUserKeys {
		if k.Gen > maxGen {
			maxGen = k.Gen
			lk = k.EncKID
		}
	}
	if lk == "" {
		panic("This should never happen, user has a PUK with a nil KID")
	}

	m.CDebugf("adding user %v's latest per user key", upk.Username)
	e.RecipientEntityKeyMap[upk.Uid.AsUserOrTeam()] = []keybase1.KID{lk}

	return nil
}
