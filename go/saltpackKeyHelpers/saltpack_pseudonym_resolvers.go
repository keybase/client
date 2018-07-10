package saltpackKeyHelpers

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/keybase/saltpack"
)

// This file contains two implementations of saltpack.SymmetricKeyResolver, which can be used to resolve
// respectively the old Kbfs Pseudonyms and the newer Key Pseudonyms by querying the server. A mock implementation
// (which does not communicate with the sever and avoids circular dependencies) is available in the saltpackHelperMocks package.

// Resolves old kbfs pseudonyms.
type TlfKeyResolver struct {
	m libkb.MetaContext
}

var _ saltpack.SymmetricKeyResolver = (*TlfKeyResolver)(nil)

func NewLegacyKBFSResolver(m libkb.MetaContext) saltpack.SymmetricKeyResolver {
	return &TlfKeyResolver{m: m}
}

func (r *TlfKeyResolver) ResolveKeys(identifiers [][]byte) ([]*saltpack.SymmetricKey, error) {
	tlfPseudonyms := []libkb.TlfPseudonym{}
	for _, identifier := range identifiers {
		pseudonym := libkb.TlfPseudonym{}
		if len(pseudonym) != len(identifier) {
			return nil, fmt.Errorf("identifier is the wrong length for a TLF pseudonym (%d != %d)", len(pseudonym), len(identifier))
		}
		copy(pseudonym[:], identifier)
		tlfPseudonyms = append(tlfPseudonyms, pseudonym)
	}

	results, err := libkb.GetTlfPseudonyms(r.m.Ctx(), r.m.G(), tlfPseudonyms)
	if err != nil {
		return nil, err
	}

	symmetricKeys := []*saltpack.SymmetricKey{}
	for _, result := range results {
		if result.Err != nil {
			r.m.CDebugf("skipping unresolved pseudonym: %s", result.Err)
			symmetricKeys = append(symmetricKeys, nil)
			continue
		}
		r.m.CDebugf("resolved pseudonym for %s, fetching key", result.Info.Name)
		symmetricKey, err := r.getSymmetricKey(r.m, *result.Info)
		if err != nil {
			return nil, err
		}
		symmetricKeys = append(symmetricKeys, symmetricKey)
	}
	return symmetricKeys, nil
}

func (r *TlfKeyResolver) getCryptKeys(m libkb.MetaContext, name string) (keybase1.GetTLFCryptKeysRes, error) {
	xp := m.G().ConnectionManager.LookupByClientType(keybase1.ClientType_KBFS)
	if xp == nil {
		return keybase1.GetTLFCryptKeysRes{}, libkb.KBFSNotRunningError{}
	}
	cli := &keybase1.TlfKeysClient{
		Cli: rpc.NewClient(xp, libkb.NewContextifiedErrorUnwrapper(r.m.G()), libkb.LogTagsFromContext),
	}
	return cli.GetTLFCryptKeys(m.Ctx(), keybase1.TLFQuery{
		TlfName:          name,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
}

func (r *TlfKeyResolver) getSymmetricKey(m libkb.MetaContext, info libkb.TlfPseudonymServerInfo) (*saltpack.SymmetricKey, error) {
	// NOTE: In order to handle finalized TLFs (which is one of the main
	// benefits of using TLF keys to begin with, for forward readability), we
	// need the server to tell us what the current, potentially-finalized name
	// of the TLF is. If that's not the same as what the name was when the
	// message was sent, we can't necessarily check that the server is being
	// honest. That's ok insofar as we're not relying on these keys for
	// authenticity, but it's a drag to not be able to use the pseudonym
	// machinery.

	// TODO: Check as much as we can, if the original TLF was fully resolved.
	// This is a little tricky, because the current TLF name parsing code lives
	// in chat and depends on externals, and it would create a circular
	// dependency if we pulled it directly into libkb.

	// Strip "/keybase/private/" from the name.
	basename := strings.TrimPrefix(info.UntrustedCurrentName, "/keybase/private/")
	if len(basename) >= len(info.UntrustedCurrentName) {
		return nil, fmt.Errorf("unexpected prefix, expected '/keybase/private', found %q", info.UntrustedCurrentName)
	}
	res, err := r.getCryptKeys(m, basename)
	if err != nil {
		return nil, err
	}
	for _, key := range res.CryptKeys {
		if libkb.KeyGen(key.KeyGeneration) == info.KeyGen {
			// Success!
			return (*saltpack.SymmetricKey)(&key.Key), nil
		}
	}
	return nil, fmt.Errorf("no keys in TLF %q matched generation %d", basename, info.KeyGen)
}

// Resolves new Key Pseudonyms (depends on teams).
type KeyPseudonymResolver struct {
	m libkb.MetaContext
}

var _ saltpack.SymmetricKeyResolver = (*KeyPseudonymResolver)(nil)

func NewKeyPseudonymResolver(m libkb.MetaContext) *KeyPseudonymResolver {
	return &KeyPseudonymResolver{m: m}
}

func (r *KeyPseudonymResolver) ResolveKeys(identifiers [][]byte) ([]*saltpack.SymmetricKey, error) {
	keyPseudonyms := []libkb.KeyPseudonym{}
	for _, identifier := range identifiers {
		pseudonym := libkb.KeyPseudonym{}
		if len(pseudonym) != len(identifier) {
			return nil, fmt.Errorf("identifier is the wrong length for a key pseudonym (%d != %d)", len(pseudonym), len(identifier))
		}
		copy(pseudonym[:], identifier)
		keyPseudonyms = append(keyPseudonyms, pseudonym)
	}

	results, err := libkb.GetKeyPseudonyms(r.m, keyPseudonyms)
	if err != nil {
		return nil, err
	}

	symmetricKeys := []*saltpack.SymmetricKey{}
	for _, result := range results {
		if result.Err != nil {
			r.m.CDebugf("skipping unresolved pseudonym: %s", result.Err)
			symmetricKeys = append(symmetricKeys, nil)
			continue
		}
		r.m.CDebugf("resolved pseudonym for %s, fetching key", result.Info.ID)
		symmetricKey, err := r.getSymmetricKey(result.Info.ID, result.Info.KeyGen)
		if err != nil {
			return nil, err
		}
		symmetricKeys = append(symmetricKeys, symmetricKey)
	}

	return symmetricKeys, nil
}

func (r *KeyPseudonymResolver) getSymmetricKey(id keybase1.UserOrTeamID, gen libkb.KeyGen) (*saltpack.SymmetricKey, error) {
	// For now resolving key pseudonyms for users is not necessary, as keybase encrypt does not
	// use symmetric per user encryption keys.

	team, err := teams.Load(r.m.Ctx(), r.m.G(), keybase1.LoadTeamArg{
		ID: keybase1.TeamID(id),
	})
	if err != nil {
		return nil, err
	}

	var key keybase1.TeamApplicationKey
	key, err = team.SaltpackEncryptionKeyAtGeneration(r.m.Ctx(), keybase1.PerTeamKeyGeneration(gen))
	if err != nil {
		return nil, err
	}

	ssk := saltpack.SymmetricKey(key.Key)
	return &ssk, nil
}
