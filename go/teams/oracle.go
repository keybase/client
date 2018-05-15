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
	}
	team, err := Load(mctx.Ctx(), mctx.G(), loadArg)
	if err != nil {
		return nil, err
	}
	currentGen := team.Generation()

	tryKeys := func(min, max keybase1.PerTeamKeyGeneration) ([]byte, bool, error) {
		for gen := min; gen <= max; gen++ {
			key, err := team.encryptionKeyAtGen(gen)
			if err != nil {
				switch err.(type) {
				case libkb.NotFoundError:
					continue
				default:
					return nil, false, err
				}
			}

			decryptedData, ok := box.Open(nil, arg.EncryptedData[:], (*[24]byte)(&arg.Nonce),
				(*[32]byte)(&arg.PeersPublicKey), (*[32]byte)(key.Private))
			if !ok {
				continue
			}

			return decryptedData, false, nil
		}

		return nil, true, libkb.DecryptionError{}
	}

	// NOTE: If MinGeneration is already higher than currently known
	// generation, tryKeys exits immediately and tells us to retry
	// after repolling team.
	ret, retry, err := tryKeys(arg.MinGeneration, currentGen)
	if err != nil && retry {
		loadArg.ForceRepoll = true
		team, err = Load(mctx.Ctx(), mctx.G(), loadArg)
		if err != nil {
			return nil, err
		}
		if team.Generation() == currentGen {
			// There are no new keys to try
			return nil, libkb.DecryptionError{}
		}
		if arg.MinGeneration > currentGen {
			// In case we had to repoll to even get the key at
			// generation=MinGeneration.
			currentGen = arg.MinGeneration
		}
		ret, _, err = tryKeys(currentGen+1, team.Generation())
		if err != nil {
			return nil, err
		}

		return ret, nil
	}

	return ret, nil
}
