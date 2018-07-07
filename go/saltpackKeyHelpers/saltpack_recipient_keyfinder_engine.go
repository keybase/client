// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpackKeyHelpers

import (
	"fmt"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/saltpack"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// SaltpackRecipientKeyfinder is an engine to find Per User/Per Team Keys.
// Users can also be loaded by assertions, possibly tracking them if necessary.
//
// SaltpackRecipientKeyfinder extends the functionality of engine.SaltpackUserKeyfinder (which can only find user keys but not team keys).
// This is a separate object (and also not part of the engine package) to avoid circular dependencies (as teams depends on engine).
type SaltpackRecipientKeyfinderEngine struct {
	libkb.Contextified
	*engine.SaltpackUserKeyfinder
	SymmetricEntityKeyMap map[keybase1.TeamID](keybase1.TeamApplicationKey)
	SaltpackSymmetricKeys []libkb.SaltpackReceiverSymmetricKey
}

// SaltpackNewRecipientKeyfinder creates a SaltpackRecipientKeyfinder engine.
func NewSaltpackRecipientKeyfinderEngine(g *libkb.GlobalContext, arg libkb.SaltpackRecipientKeyfinderArg) libkb.SaltpackRecipientKeyfinderEngineInterface {
	return &SaltpackRecipientKeyfinderEngine{
		Contextified:          libkb.NewContextified(g),
		SaltpackUserKeyfinder: engine.NewSaltpackUserKeyfinder(g, arg),
		SymmetricEntityKeyMap: make(map[keybase1.TeamID](keybase1.TeamApplicationKey)),
	}
}

// Name is the unique engine name.
func (e *SaltpackRecipientKeyfinderEngine) Name() string {
	return "SaltpackRecipientKeyfinder"
}

func (e *SaltpackRecipientKeyfinderEngine) Run(m libkb.MetaContext) (err error) {
	defer m.CTrace("SaltpackRecipientKeyfinder#Run", func() error { return err })()

	if e.Arg.Self != nil && !e.Arg.NoSelfEncrypt {
		var selfUpk *keybase1.UserPlusKeysV2AllIncarnations
		selfUpk, err = e.Arg.Self.ExportToUPKV2AllIncarnations()
		if err != nil {
			return err
		}
		e.AddUserRecipient(m, &selfUpk.Current)
	}

	err = e.lookupRecipients(m)
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
	err := libkb.MakeAndPostKeyPseudonyms(m.Ctx(), m.G(), &pseudonymInfos)
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

// lookupRecipients adds the KID corresponding to each recipient to the recipientMap
func (e *SaltpackRecipientKeyfinderEngine) lookupRecipients(m libkb.MetaContext) error {
	for _, u := range e.Arg.Recipients {

		err := e.LookupUser(m, u) // For existing users
		if err == nil {
			continue
		} else if _, isIdentifyFailedError := err.(libkb.IdentifyFailedError); !isIdentifyFailedError {
			return err
		}

		// TODO What is this the canonical way to tell if a user is logged in?? I will need to update the other checks too.
		if e.Arg.Self == nil {
			return libkb.NewRecipientNotFoundError(fmt.Sprintf("Cannot encrypt for %v: it is not a registered user. To encrypt for a team you belong to or for someone non yet on keybase, you need to login first", u))
		}

		err = e.lookupTeam(m, u) // For existing teams
		if err == nil {
			continue
		} else if _, isNotFound := err.(teamNotFoundError); !isNotFound {
			return err
		}

		err = e.lookupImplicitTeam(m, u) // For social assertions referring to a single user which can be used to create implicit teams
		if err == nil {
			continue
		} else if _, isAssertionError := err.(invalidAssertionError); !isAssertionError {
			return err
		}

		return libkb.NewRecipientNotFoundError(fmt.Sprintf("Cannot encrypt for %v: it is not a valid social assertion or a registered user or team", u))
	}
	return nil
}

type teamNotFoundError struct {
	error
}

func (e teamNotFoundError) Error() string {
	return fmt.Sprintf("Loading a team failed with error: %s", e.error.Error())
}

func (e *SaltpackRecipientKeyfinderEngine) lookupTeam(m libkb.MetaContext, teamName string) error {
	team, err := teams.Load(m.Ctx(), e.G(), keybase1.LoadTeamArg{
		Name: teamName,
	})
	// TODO: Need to be more granular and separate actual NotFound (which should not block the lookupRecipients loop as we want to try social assertions)
	// from network errors and similar issues (which should stop the command).
	if err != nil {
		return teamNotFoundError{error: err}
	}

	// Note: when we encrypt for a team with --use-entity-keys set, we use just the per team key, and do not add
	// all the per user keys of the individual members.
	if e.Arg.UseEntityKeys {
		appKey, err := team.SaltpackEncryptionKeyLatest(m.Ctx())
		if err != nil {
			return err
		}
		e.G().Log.CDebugf(m.Ctx(), "Adding team key for team %v", teamName)
		e.SymmetricEntityKeyMap[team.ID] = appKey
	}

	if e.Arg.UseDeviceKeys || e.Arg.UsePaperKeys {
		members, err := team.Members()
		if err != nil {
			return err
		}
		upakLoader := e.G().GetUPAKLoader()

		for _, uid := range members.AllUIDs() {
			if e.Arg.NoSelfEncrypt && e.Arg.Self.GetUID() == uid {
				m.CDebugf("skipping device keys for %v as part of team %v because of NoSelfEncrypt", uid, teamName)
				continue
			}
			// TODO: SHOULD I EXCLUDE ANY MEMBERS HERE? Inactive? Implicit Admins?
			arg := libkb.NewLoadUserByUIDArg(m.Ctx(), m.G(), uid)
			upak, _, err := upakLoader.LoadV2(arg)
			if err != nil {
				return err
			}
			e.AddDeviceAndPaperKeys(m, &upak.Current)
		}
	}

	return err
}

type invalidAssertionError struct {
	error
}

func (e invalidAssertionError) Error() string {
	return fmt.Sprintf("Invalid assertion:  %s", e.error.Error())
}

func (e *SaltpackRecipientKeyfinderEngine) lookupImplicitTeam(m libkb.MetaContext, socialAssertionForNonExistingUser string) (err error) {
	// Implicit teams require login.
	if e.Arg.Self == nil {
		return libkb.LoginRequiredError{}
	}

	// validate socialAssertionForNonExistingUser
	var expr libkb.AssertionExpression
	expr, err = externals.AssertionParse(socialAssertionForNonExistingUser)
	if err != nil {
		m.CDebugf("error parsing assertion: %s", err)
		return invalidAssertionError{fmt.Errorf("invalid recipient %q: %s", socialAssertionForNonExistingUser, err)}
	}
	_, err = expr.ToSocialAssertion()
	if err != nil {
		m.CDebugf("not a social assertion: %s (%s)", socialAssertionForNonExistingUser, expr)
		return invalidAssertionError{fmt.Errorf("invalid recipient %q: %s", socialAssertionForNonExistingUser, err)}
	}

	team, _, impTeamName, err := teams.LookupOrCreateImplicitTeam(m.Ctx(), e.G(), e.Arg.Self.GetName()+","+socialAssertionForNonExistingUser, false)

	if err != nil {
		return err
	}

	if e.Arg.UseEntityKeys {
		appKey, err := team.SaltpackEncryptionKeyLatest(m.Ctx())
		if err != nil {
			return err
		}
		e.G().Log.CDebugf(m.Ctx(), "Adding team key for implicit team %v", impTeamName)
		e.G().Log.CWarningf(m.Ctx(), "Encrypting for %v who is not yet a keybase user: one of your devices will need to be online after they join keybase, or they won't be able to decrypt it.", socialAssertionForNonExistingUser)
		e.SymmetricEntityKeyMap[team.ID] = appKey
	} else {
		return fmt.Errorf("encrypting for %v (who is not yet on keybase) requires --use-entity-keys.", socialAssertionForNonExistingUser)
	}

	if e.Arg.UseDeviceKeys || e.Arg.UsePaperKeys {
		return fmt.Errorf("cannot use device keys or paper keys when encrypting for non existing users.")
	}

	return err
}
