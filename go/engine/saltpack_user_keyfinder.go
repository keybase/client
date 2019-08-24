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

var _ libkb.Engine2 = (*SaltpackUserKeyfinder)(nil)
var _ libkb.SaltpackRecipientKeyfinderEngineInterface = (*SaltpackUserKeyfinder)(nil)

// NewSaltpackUserKeyfinderAsInterface creates a SaltpackUserKeyfinder engine.
func NewSaltpackUserKeyfinderAsInterface(Arg libkb.SaltpackRecipientKeyfinderArg) libkb.SaltpackRecipientKeyfinderEngineInterface {
	return NewSaltpackUserKeyfinder(Arg)
}

func NewSaltpackUserKeyfinder(Arg libkb.SaltpackRecipientKeyfinderArg) *SaltpackUserKeyfinder {
	return &SaltpackUserKeyfinder{
		Arg:                           Arg,
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
	defer m.Trace("SaltpackUserKeyfinder#Run", func() error { return err })()

	if len(e.Arg.TeamRecipients) != 0 {
		m.Debug("tried to use SaltpackUserKeyfinder for a team. This should never happen")
		return fmt.Errorf("cannot find keys for teams")
	}

	err = e.AddOwnKeysIfNeeded(m)
	if err != nil {
		return err
	}

	err = e.identifyAndAddRecipients(m)
	if err != nil {
		return err
	}
	return nil
}

func (e *SaltpackUserKeyfinder) AddOwnKeysIfNeeded(m libkb.MetaContext) error {
	if e.Arg.NoSelfEncrypt {
		return nil
	}
	if !m.ActiveDevice().Valid() {
		return libkb.NewLoginRequiredError("need to be logged in or use --no-self-encrypt")
	}
	arg := libkb.NewLoadUserArgWithMetaContext(m).WithUID(m.ActiveDevice().UID()).WithForcePoll(true)
	upak, _, err := m.G().GetUPAKLoader().LoadV2(arg)
	if err != nil {
		return err
	}
	return e.AddUserRecipient(m, &upak.Current)
}

// identifyAndAddRecipients adds the KID corresponding to each recipient to the recipientMap
func (e *SaltpackUserKeyfinder) identifyAndAddRecipients(m libkb.MetaContext) error {
	for _, u := range e.Arg.Recipients {
		// TODO make these lookups in parallel (maybe using sync.WaitGroup)
		upk, err := e.IdentifyUser(m, u) // For existing users
		switch {
		case err == nil:
			// nothing to do here
		case libkb.IsIdentifyProofError(err):
			return fmt.Errorf("Cannot encrypt for %v as their account has changed since you last followed them (it might have been compromised!): please review their identity (with `keybase follow %v`) and then try again (err = %v)", u, u, err)
		case libkb.IsNotFoundError(err) || libkb.IsResolutionError(err):
			return fmt.Errorf("Cannot find keys for %v: it is not an assertion for a registered user (err = %v)", u, err)
		default:
			return fmt.Errorf("Error while adding keys for %v: %v", u, err)
		}
		err = e.AddUserRecipient(m, upk)
		if err != nil {
			return err
		}
	}
	return nil
}

func (e *SaltpackUserKeyfinder) IdentifyUser(m libkb.MetaContext, user string) (upk *keybase1.UserPlusKeysV2, err error) {

	Arg := keybase1.Identify2Arg{
		UserAssertion: user,
		Reason: keybase1.IdentifyReason{
			Type: keybase1.IdentifyReasonType_ENCRYPT,
		},
		AlwaysBlock:      true,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_SALTPACK,
	}
	eng := NewResolveThenIdentify2(m.G(), &Arg)
	if err := RunEngine2(m, eng); err != nil {
		return nil, err
	}

	engRes, err := eng.Result(m)
	if err != nil {
		return nil, err
	}

	return &engRes.Upk.Current, nil
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
	err := e.AddDeviceAndPaperKeys(m, upk)
	err2 := e.AddPUK(m, upk)

	// If we managed to add at least one key for upk, we are happy.
	if (!(e.Arg.UseDeviceKeys || e.Arg.UsePaperKeys) || err != nil) && (!e.Arg.UseEntityKeys || err2 != nil) {
		return libkb.PickFirstError(err, err2)
	}
	return nil
}

func (e *SaltpackUserKeyfinder) isPaperEncryptionKey(key *keybase1.PublicKeyV2NaCl, deviceKeys *(map[keybase1.KID]keybase1.PublicKeyV2NaCl)) bool {
	return libkb.KIDIsDeviceEncrypt(key.Base.Kid) && key.Parent != nil && (*deviceKeys)[*key.Parent].DeviceType == libkb.DeviceTypePaper
}

// AddPUK returns no error if it adds at least one key (or no paper keys and device keys were requested), otherwise it returns a libkb.NoNaClEncryptionKeyError
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
				m.Debug("adding user %v's paper key", upk.Username)
			}
		}

		if libkb.KIDIsDeviceEncrypt(KID) && !e.isPaperEncryptionKey(&key, &upk.DeviceKeys) {
			hasDeviceKey = true
			if e.Arg.UseDeviceKeys {
				keys = append(keys, KID)
				m.Debug("adding user %v's device key", upk.Username)
			}
		}
	}

	e.RecipientDeviceAndPaperKeyMap[upk.Uid] = keys

	if len(keys) == 0 {
		m.Debug("did not add any device or paper keys for %v", upk.Username)
		return libkb.NoNaClEncryptionKeyError{
			Username:     upk.Username,
			HasPGPKey:    len(upk.PGPKeys) > 0,
			HasPUK:       hasPUK,
			HasDeviceKey: hasDeviceKey,
			HasPaperKey:  hasPaperKey,
		}
	}

	return nil
}

// AddPUK returns no error unless the user has no PUK, in which case it returns a libkb.NoNaClEncryptionKeyError
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

		m.Debug("did not add any per user keys for %v", upk.Username)
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

	m.Debug("adding user %v's latest per user key", upk.Username)
	e.RecipientEntityKeyMap[upk.Uid.AsUserOrTeam()] = []keybase1.KID{lk}

	return nil
}
