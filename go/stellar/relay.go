package stellar

import (
	"context"
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/stellarnet"
	"github.com/stellar/go/build"
	"github.com/stellar/go/keypair"
	"golang.org/x/crypto/nacl/secretbox"
)

// Get the key used to encrypted the key for a relay transfer
// A key from the implicit team betwen the logged-in user and `to`.
// If `generation` is nil, gets the latest key.
// TODO CORE-7718 make this private
func KeyForRelayTransfer(ctx context.Context, g *libkb.GlobalContext, remoter remote.Remoter,
	other *libkb.User, generation *keybase1.PerTeamKeyGeneration) (res keybase1.TeamApplicationKey, err error) {
	if other == nil {
		return res, fmt.Errorf("missing other user")
	}
	meUsername, err := g.GetUPAKLoader().LookupUsername(ctx, g.ActiveDevice.UID())
	if err != nil {
		return res, err
	}
	impTeamDisplayName := fmt.Sprintf("%s,%s", meUsername.String(), other.GetNormalizedName().String())
	team, _, _, err := teams.LookupOrCreateImplicitTeam(ctx, g, impTeamDisplayName, false /*public*/)
	if err != nil {
		return res, err
	}
	if generation == nil {
		return team.ApplicationKey(ctx, keybase1.TeamApplication_STELLAR_RELAY)
	}
	return team.ApplicationKeyAtGeneration(keybase1.TeamApplication_STELLAR_RELAY, *generation)
}

// TODO CORE-7718 make this private
type RelayPaymentInput struct {
	From      stellar1.SecretKey
	AmountXLM string
	// Implicit-team key to encrypt for
	EncryptFor    keybase1.TeamApplicationKey
	SeqnoProvider build.SequenceProvider
}

// TODO CORE-7718 make this private
type RelayPaymentOutput struct {
	// Account ID of the shared account.
	RelayAccountID stellar1.AccountID
	// Encrypted box containing the secret key to the account.
	EncryptedSeed stellar1.EncryptedRelaySecret
	FundTx        stellarnet.SignResult
}

// createRelayTransfer generates a stellar account, encrypts its key, and signs a transaction funding it.
// TODO CORE-7718 make this private
func CreateRelayTransfer(in RelayPaymentInput) (res RelayPaymentOutput, err error) {
	_, _, senderKp, err := libkb.ParseStellarSecretKey(string(in.From))
	if err != nil {
		return res, err
	}
	senderSeed, err := stellarnet.NewSeedStr(senderKp.Seed())
	if err != nil {
		return res, err
	}
	relayKp, err := keypair.Random()
	if err != nil {
		return res, err
	}
	relayAccountID, err := stellarnet.NewAddressStr(relayKp.Address())
	if err != nil {
		return res, err
	}
	sig, err := stellarnet.CreateAccountXLMTransaction(
		senderSeed, relayAccountID, in.AmountXLM, in.SeqnoProvider)
	if err != nil {
		return res, err
	}
	encSeed, err := encryptRelaySecret(stellar1.SecretKey(relayKp.Seed()), in.EncryptFor)
	return RelayPaymentOutput{
		RelayAccountID: stellar1.AccountID(relayKp.Address()),
		EncryptedSeed:  encSeed,
		FundTx:         sig,
	}, nil
}

func encryptRelaySecret(secret stellar1.SecretKey, encryptFor keybase1.TeamApplicationKey) (res stellar1.EncryptedRelaySecret, err error) {
	if encryptFor.Key.IsBlank() {
		return res, errors.New("attempt to use blank team application key")
	}
	nonce, err := libkb.RandomNaclDHNonce()
	if err != nil {
		return res, err
	}
	secbox := secretbox.Seal(
		nil, []byte(secret), &nonce, (*[32]byte)(&encryptFor.Key))
	return stellar1.EncryptedRelaySecret{
		V:   1,
		E:   secbox,
		N:   nonce,
		Gen: encryptFor.KeyGeneration,
	}, nil
}

// TODO CORE-7718 make this private
func DecryptRelaySecret(box stellar1.EncryptedRelaySecret, key keybase1.TeamApplicationKey) (res stellar1.SecretKey, err error) {
	if box.V != 1 {
		return res, fmt.Errorf("unsupported relay secret box version: %v", box.V)
	}
	msg, ok := secretbox.Open(
		nil, box.E, (*[24]byte)(&box.N), (*[32]byte)(&key.Key))
	if !ok {
		return res, libkb.NewDecryptOpenError("relay payment secretbox")
	}
	res, _, _, err = libkb.ParseStellarSecretKey(string(msg))
	return res, err
}
