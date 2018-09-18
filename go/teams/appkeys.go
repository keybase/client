package teams

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func AllApplicationKeys(mctx libkb.MetaContext, teamData *keybase1.TeamData,
	application keybase1.TeamApplication, latestGen keybase1.PerTeamKeyGeneration) (res []keybase1.TeamApplicationKey, err error) {
	defer mctx.CTraceTimed("teams.AllApplicationKeys", func() error { return err })()
	for gen := keybase1.PerTeamKeyGeneration(1); gen <= latestGen; gen++ {
		appKey, err := ApplicationKeyAtGeneration(mctx, teamData, application, gen)
		if err != nil {
			return res, err
		}
		res = append(res, appKey)
	}
	return res, nil

}

func ApplicationKeyAtGeneration(mctx libkb.MetaContext, teamData *keybase1.TeamData,
	application keybase1.TeamApplication, generation keybase1.PerTeamKeyGeneration) (res keybase1.TeamApplicationKey, err error) {

	item, err := GetAndVerifyPerTeamKey(mctx, teamData, generation)
	if err != nil {
		return res, err
	}

	var rkm *keybase1.ReaderKeyMask
	if UseRKMForApp(application) {
		rkmReal, err := readerKeyMask(teamData, application, generation)
		if err != nil {
			return res, err
		}
		rkm = &rkmReal
	} else {
		var zeroMask [32]byte
		zeroRKM := keybase1.ReaderKeyMask{
			Application: application,
			Generation:  generation,
			Mask:        zeroMask[:],
		}
		rkm = &zeroRKM
	}

	return applicationKeyForMask(*rkm, item.Seed)
}

func UseRKMForApp(application keybase1.TeamApplication) bool {
	switch application {
	case keybase1.TeamApplication_SEITAN_INVITE_TOKEN:
		// Seitan tokens do not use RKMs because implicit admins have all the privileges of explicit members.
		return false
	default:
		return true
	}
}

func applicationKeyForMask(mask keybase1.ReaderKeyMask, secret keybase1.PerTeamKeySeed) (keybase1.TeamApplicationKey, error) {
	if secret.IsZero() {
		return keybase1.TeamApplicationKey{}, errors.New("nil shared secret in Team#applicationKeyForMask")
	}
	var derivationString string
	switch mask.Application {
	case keybase1.TeamApplication_KBFS:
		derivationString = libkb.TeamKBFSDerivationString
	case keybase1.TeamApplication_CHAT:
		derivationString = libkb.TeamChatDerivationString
	case keybase1.TeamApplication_SALTPACK:
		derivationString = libkb.TeamSaltpackDerivationString
	case keybase1.TeamApplication_GIT_METADATA:
		derivationString = libkb.TeamGitMetadataDerivationString
	case keybase1.TeamApplication_SEITAN_INVITE_TOKEN:
		derivationString = libkb.TeamSeitanTokenDerivationString
	case keybase1.TeamApplication_STELLAR_RELAY:
		derivationString = libkb.TeamStellarRelayDerivationString
	default:
		return keybase1.TeamApplicationKey{}, fmt.Errorf("unrecognized application id: %v", mask.Application)
	}

	key := keybase1.TeamApplicationKey{
		Application:   mask.Application,
		KeyGeneration: mask.Generation,
	}

	if len(mask.Mask) != 32 {
		return keybase1.TeamApplicationKey{}, fmt.Errorf("mask length: %d, expected 32", len(mask.Mask))
	}

	secBytes := make([]byte, len(mask.Mask))
	n := libkb.XORBytes(secBytes, derivedSecret(secret, derivationString), mask.Mask)
	if n != 32 {
		return key, errors.New("invalid derived secret xor mask size")
	}
	copy(key.Key[:], secBytes)

	return key, nil
}

func readerKeyMask(teamData *keybase1.TeamData,
	application keybase1.TeamApplication, generation keybase1.PerTeamKeyGeneration) (res keybase1.ReaderKeyMask, err error) {

	m2, ok := teamData.ReaderKeyMasks[application]
	if !ok {
		return res, NewKeyMaskNotFoundErrorForApplication(application)
	}
	mask, ok := m2[generation]
	if !ok {
		return res, NewKeyMaskNotFoundErrorForApplicationAndGeneration(application, generation)
	}
	return keybase1.ReaderKeyMask{
		Application: application,
		Generation:  generation,
		Mask:        mask,
	}, nil
}
