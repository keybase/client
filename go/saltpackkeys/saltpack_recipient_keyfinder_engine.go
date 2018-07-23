// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpackkeys

import (
	"fmt"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/saltpack"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// SaltpackRecipientKeyfinderEngine is an engine to find Per User/Per Team Keys.
// Users can also be loaded by assertions, possibly tracking them if necessary.
//
// SaltpackRecipientKeyfinderEngine extends the functionality of engine.SaltpackUserKeyfinder (which can only find user keys but not team keys).
// This is a separate object (and also not part of the engine package) to avoid circular dependencies (as teams depends on engine).
type SaltpackRecipientKeyfinderEngine struct {
	engine.SaltpackUserKeyfinder
	SymmetricEntityKeyMap map[keybase1.TeamID](keybase1.TeamApplicationKey)
	SaltpackSymmetricKeys []libkb.SaltpackReceiverSymmetricKey
}

// SaltpackRecipientKeyfinderEngine creates a SaltpackRecipientKeyfinderEngine engine.
func NewSaltpackRecipientKeyfinderEngine(arg libkb.SaltpackRecipientKeyfinderArg) libkb.SaltpackRecipientKeyfinderEngineInterface {
	return &SaltpackRecipientKeyfinderEngine{
		SaltpackUserKeyfinder: *engine.NewSaltpackUserKeyfinder(arg),
		SymmetricEntityKeyMap: make(map[keybase1.TeamID](keybase1.TeamApplicationKey)),
	}
}

// Name is the unique engine name.
func (e *SaltpackRecipientKeyfinderEngine) Name() string {
	return "SaltpackRecipientKeyfinder"
}

func (e *SaltpackRecipientKeyfinderEngine) Run(m libkb.MetaContext) (err error) {
	defer m.CTrace("SaltpackRecipientKeyfinder#Run", func() error { return err })()

	err = e.AddOwnKeysIfNeeded(m)
	if err != nil {
		return err
	}

	err = e.lookupAndAddRecipients(m)
	if err != nil {
		return err
	}

	err = e.uploadKeyPseudonymsAndGenerateSymmetricKeys(m)

	return err
}

func (e *SaltpackRecipientKeyfinderEngine) GetSymmetricKeys() []libkb.SaltpackReceiverSymmetricKey {
	return e.SaltpackSymmetricKeys
}

func (e *SaltpackRecipientKeyfinderEngine) uploadKeyPseudonymsAndGenerateSymmetricKeys(m libkb.MetaContext) error {
	// Fetch the keys and assemble the pseudonym info objects.
	var pseudonymInfos []libkb.KeyPseudonymInfo
	for teamID, appKey := range e.SymmetricEntityKeyMap {
		pseudonymInfo := libkb.KeyPseudonymInfo{
			ID:          teamID.AsUserOrTeam(),
			Application: appKey.Application,
			KeyGen:      libkb.KeyGen(appKey.KeyGeneration),
			Nonce:       libkb.RandomPseudonymNonce(),
		}
		pseudonymInfos = append(pseudonymInfos, pseudonymInfo)
	}

	// Post the pseudonyms in a batch. This will populate the KeyPseudonym field of each element of pseudonymInfos
	err := libkb.MakeAndPostKeyPseudonyms(m, &pseudonymInfos)
	if err != nil {
		return err
	}

	for _, pseudonymInfo := range pseudonymInfos {
		e.SaltpackSymmetricKeys = append(e.SaltpackSymmetricKeys, libkb.SaltpackReceiverSymmetricKey{
			Key:        saltpack.SymmetricKey(e.SymmetricEntityKeyMap[keybase1.TeamID(pseudonymInfo.ID)].Key),
			Identifier: pseudonymInfo.KeyPseudonym[:],
		})
	}

	return nil
}

// lookupAndAddRecipients adds the KID corresponding to each recipient to the recipientMap
func (e *SaltpackRecipientKeyfinderEngine) lookupAndAddRecipients(m libkb.MetaContext) error {
	// TODO make these lookups in parallel (maybe using sync.WaitGroup)
	for _, u := range e.Arg.Recipients {
		err := e.lookupAndAddUserRecipient(m, u)
		if err != nil {
			return err
		}
	}
	for _, u := range e.Arg.TeamRecipients {
		err := e.lookupAndAddTeam(m, u)
		if err != nil {
			return err
		}
	}
	return nil
}

func (e *SaltpackRecipientKeyfinderEngine) AddPUKOrImplicitTeamKeys(m libkb.MetaContext, upk *keybase1.UserPlusKeysV2) error {
	err := e.AddPUK(m, upk)
	if err == nil {
		return nil
	}
	if m.ActiveDevice().Valid() {
		m.CDebugf("user %v (%v) does not have a PUK, adding the implicit team key instead", upk.Username, upk.Uid)
		err = e.lookupAndAddImplicitTeamKeys(m, upk.Username)
		return err
	}
	m.CDebugf("user %v (%v) does not have a PUK, and there is no logged in user, so we cannot resort to implicit teams", upk.Username, upk.Uid)
	noekErr := err.(libkb.NoNaClEncryptionKeyError)
	var s string
	if noekErr.HasDeviceKey {
		s = ". As an alternative, you can encrypt for them with both --no-entity-keys and --use-device-keys instead"
	} else if noekErr.HasPaperKey {
		s = ". As an alternative, you can encrypt for them with both --no-entity-keys and --use-paper-keys instead"
	}

	return libkb.NewLoginRequiredError(fmt.Sprintf("Encrypting for %v requires logging in%s", upk.Username, s))
}

// lookupAndAddUserRecipient add the KID corresponding to a recipient to the recipientMap
func (e *SaltpackRecipientKeyfinderEngine) lookupAndAddUserRecipient(m libkb.MetaContext, u string) (err error) {
	upk, err := e.LookupUser(m, u) // For existing users

	if _, isIdentifyFailedError := err.(libkb.IdentifyFailedError); err != nil && isIdentifyFailedError {
		// recipient is not a keybase user

		expr, err := externals.AssertionParse(u)
		if err != nil {
			m.CDebugf("error parsing assertion: %s", err)
			return libkb.NewRecipientNotFoundError(fmt.Sprintf("Cannot encrypt for %v: it is not a keybase user or social assertion (err = %v)", u, err))
		}
		if _, err := expr.ToSocialAssertion(); err != nil {
			m.CDebugf("not a social assertion: %s (%s), err: %+v", u, expr, err)
			return libkb.NewRecipientNotFoundError(fmt.Sprintf("Cannot encrypt for %v: it is not a keybase user or social assertion (err = %v)", u, err))
		}

		if !m.ActiveDevice().Valid() {
			return libkb.NewRecipientNotFoundError(fmt.Sprintf("Cannot encrypt for %v: it is not a registered user (and you cannot encrypt for users not yet on keybase unless you are logged in)", u))
		}
		if e.Arg.UseDeviceKeys || e.Arg.UsePaperKeys {
			return libkb.NewRecipientNotFoundError(fmt.Sprintf("Cannot encrypt for %v: it is not a registered user (and you cannot use device or paper keys for users not yet on keybase)", u))
		}
		if !e.Arg.UseEntityKeys {
			return libkb.NewRecipientNotFoundError(fmt.Sprintf("Cannot encrypt for %v: it is not a registered user (cannot use --no-entity-keys for users not yet on keybase)", u))
		}

		m.CDebugf("%v is not an existing user, trying to create an implicit team")
		err = e.lookupAndAddImplicitTeamKeys(m, u)
		return err
	} else if _, isNoKeyError := err.(libkb.NoKeyError); err != nil && isNoKeyError {
		// User exists but has no keys. Just try adding implicit team keys.
		if e.Arg.UseDeviceKeys || e.Arg.UsePaperKeys {
			return libkb.NewRecipientNotFoundError(fmt.Sprintf("Cannot encrypt for %v: it does not have the required keys", u))
		}
		return e.lookupAndAddImplicitTeamKeys(m, u)
	} else if err != nil {
		return err
	}

	if err := e.AddDeviceAndPaperKeys(m, upk); err != nil {
		return err
	}
	return e.AddPUKOrImplicitTeamKeys(m, upk)
}

func (e *SaltpackRecipientKeyfinderEngine) lookupAndAddTeam(m libkb.MetaContext, teamName string) error {
	team, err := teams.Load(m.Ctx(), m.G(), keybase1.LoadTeamArg{
		Name: teamName,
	})
	if err != nil {
		return teams.FixupTeamGetError(m.Ctx(), m.G(), err, teamName, false /* public bool: this might not be true, but the message is less specific for private teams */)
	}

	// Test that the logged in user is part of the team, as a user can load a public team that they are not part of (and therefore have no keys for).
	arg := libkb.NewLoadUserArgWithMetaContext(m).WithUID(m.ActiveDevice().UID()).WithForcePoll(true)
	upak, _, err := m.G().GetUPAKLoader().LoadV2(arg)
	if err != nil {
		return err
	}
	if !team.IsMember(m.Ctx(), upak.Current.ToUserVersion()) {
		return fmt.Errorf("cannot encrypt for team %s because you are not a member", teamName)
	}

	// Note: when we encrypt for a team with UseEntityKeys set, we use just the per team key, and do not add
	// all the per user keys of the individual members (except for the sender's PUK, which is added unless NoSelfEncrypt is set).
	if e.Arg.UseEntityKeys {
		if e.Arg.UseRepudiableAuth {
			return fmt.Errorf("encrypting for a team with --auth-type=repudiable requires --no-entity-keys")
		}
		appKey, err := team.SaltpackEncryptionKeyLatest(m.Ctx())
		if err != nil {
			return err
		}
		m.CDebugf("Adding team key for team %v", teamName)
		e.SymmetricEntityKeyMap[team.ID] = appKey
	}

	if e.Arg.UseDeviceKeys || e.Arg.UsePaperKeys {
		members, err := team.Members()
		if err != nil {
			return err
		}
		upakLoader := m.G().GetUPAKLoader()

		for _, userVersion := range members.AllUserVersions() {
			uid := userVersion.Uid
			if e.Arg.NoSelfEncrypt && m.CurrentUID() == uid {
				m.CDebugf("skipping device and paper keys for %v as part of team %v because of NoSelfEncrypt", uid, teamName)
				continue
			}
			arg := libkb.NewLoadUserArgWithMetaContext(m).WithUID(uid).WithForcePoll(true)
			upak, _, err := upakLoader.LoadV2(arg)
			if err != nil {
				return err
			}
			// Skip deleted and reset users
			if upak.Current.Status == keybase1.StatusCode_SCDeleted {
				m.CDebugf("skipping device and paper keys for %v as part of team %v because it is deleted", uid, teamName)
				continue
			}
			if userVersion != upak.Current.ToUserVersion() {
				m.CDebugf("skipping device and paper keys for %v as part of team %v because the user version doesn't match", uid, teamName)
				continue
			}

			err = e.AddDeviceAndPaperKeys(m, &upak.Current)
			if err != nil {
				return err
			}
		}
	}

	return err
}

func (e *SaltpackRecipientKeyfinderEngine) lookupAndAddImplicitTeamKeys(m libkb.MetaContext, validSocialAssertionOrExistingUser string) (err error) {
	// Implicit teams require login.
	if !m.ActiveDevice().Valid() {
		return libkb.NewLoginRequiredError(fmt.Sprintf("encrypting for %v requires login", validSocialAssertionOrExistingUser))
	}
	if !e.Arg.UseEntityKeys {
		return fmt.Errorf("cannot encrypt for %v unless the --no-entity-keys option is turned off", validSocialAssertionOrExistingUser)
	}
	if e.Arg.UseRepudiableAuth {
		return fmt.Errorf("cannot encrypt for %v with --auth-type=repudiable", validSocialAssertionOrExistingUser)
	}

	team, _, impTeamName, err := teams.LookupOrCreateImplicitTeam(m.Ctx(), m.G(), m.CurrentUsername().String()+","+validSocialAssertionOrExistingUser, false)

	if err != nil {
		return err
	}

	appKey, err := team.SaltpackEncryptionKeyLatest(m.Ctx())
	if err != nil {
		return err
	}
	m.CDebugf("adding team key for implicit team %v", impTeamName)
	m.CWarningf("encrypting for %v who is not yet a keybase user (or does not have a provisioned device): one of your devices will need to be online after they join keybase (or provision a new device), or they won't be able to decrypt it.", validSocialAssertionOrExistingUser)
	e.SymmetricEntityKeyMap[team.ID] = appKey

	return err
}
