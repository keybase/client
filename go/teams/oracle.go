package teams

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/crypto/nacl/box"
)

func TryDecryptWithTeamKey(mctx libkb.MetaContext, arg keybase1.TryDecryptWithTeamKeyArg) (ret []byte, err error) {
	loadArg := keybase1.LoadTeamArg{
		ID:          arg.TeamID,
		Public:      arg.TeamID.IsPublic(),
		ForceRepoll: false,
		Refreshers: keybase1.TeamRefreshers{
			NeedKeyGeneration: arg.MinGeneration,
		},
	}
	team, err := Load(mctx.Ctx(), mctx.G(), loadArg)
	if err != nil {
		return nil, err
	}

	mctx.Debug("Loaded team %q, max key generation is %d", team.ID, team.Generation())

	tryKeys := func(min keybase1.PerTeamKeyGeneration) (ret []byte, found bool, err error) {
		if min == 0 {
			// per team keys start from generation 1.
			min = 1
		}
		for gen := team.Generation(); gen >= min; gen-- {
			key, err := team.encryptionKeyAtGen(mctx.Ctx(), gen)
			if err != nil {
				mctx.Debug("Failed to get key gen %d: %v", gen, err)
				switch err.(type) {
				case libkb.NotFoundError:
					continue
				default:
					return nil, false, err
				}
			}

			mctx.Debug("Trying to unbox with key gen %d", gen)
			decryptedData, ok := box.Open(nil, arg.EncryptedData[:], (*[24]byte)(&arg.Nonce),
				(*[32]byte)(&arg.PeersPublicKey), (*[32]byte)(key.Private))
			if !ok {
				continue
			}

			mctx.Debug("Success! Decrypted using encryption key gen=%d", gen)
			return decryptedData, true, nil
		}

		// No error, but didn't find the right key either.
		return nil, false, nil
	}

	ret, found, err := tryKeys(arg.MinGeneration)
	if err != nil {
		// Error during key searching.
		return nil, err
	}
	if found {
		// Success - found the right key.
		return ret, nil
	}

	mctx.Debug("Repolling team")

	// Repoll the team and if we get more keys, try again.
	loadArg.Refreshers = keybase1.TeamRefreshers{}
	loadArg.ForceRepoll = true
	team, err = Load(mctx.Ctx(), mctx.G(), loadArg)
	if err != nil {
		return nil, err
	}
	mctx.Debug("Reloaded team %q, max key generation is %d", team.ID, team.Generation())
	ret, found, err = tryKeys(1)
	if err != nil {
		return nil, err
	}
	if found {
		return ret, nil
	}
	return nil, libkb.DecryptionError{}
}
