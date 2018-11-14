package relays

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/stellarcommon"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/stellarnet"
	"github.com/stellar/go/build"
	"github.com/stellar/go/keypair"
	"golang.org/x/crypto/nacl/secretbox"
)

// Get the key used to encrypt the stellar key for a relay transfer
// A key from the implicit team betwen the logged-in user and `to`.
// If `generation` is nil, gets the latest key.
func GetKey(ctx context.Context, g *libkb.GlobalContext,
	recipient stellarcommon.Recipient) (key keybase1.TeamApplicationKey, teamID keybase1.TeamID, err error) {
	meUsername, err := g.GetUPAKLoader().LookupUsername(ctx, g.ActiveDevice.UID())
	if err != nil {
		return key, teamID, err
	}
	impTeamNameStruct := keybase1.ImplicitTeamDisplayName{
		Writers: keybase1.ImplicitTeamUserSet{
			KeybaseUsers: []string{meUsername.String()},
		},
	}
	switch {
	case recipient.User != nil:
		impTeamNameStruct.Writers.KeybaseUsers = append(impTeamNameStruct.Writers.KeybaseUsers, recipient.User.Username.String())
	case recipient.Assertion != nil:
		impTeamNameStruct.Writers.UnresolvedUsers = append(impTeamNameStruct.Writers.UnresolvedUsers, *recipient.Assertion)
	default:
		return key, teamID, fmt.Errorf("recipient unexpectly not user nor assertion: %v", recipient.Input)
	}
	impTeamDisplayName, err := teams.FormatImplicitTeamDisplayName(ctx, g, impTeamNameStruct)
	if err != nil {
		return key, teamID, err
	}
	team, _, _, err := teams.LookupOrCreateImplicitTeam(ctx, g, impTeamDisplayName, false /*public*/)
	if err != nil {
		return key, teamID, err
	}
	key, err = team.ApplicationKey(ctx, keybase1.TeamApplication_STELLAR_RELAY)
	return key, team.ID, err
}

func getKeyForDecryption(ctx context.Context, g *libkb.GlobalContext,
	teamID keybase1.TeamID, generation keybase1.PerTeamKeyGeneration) (res keybase1.TeamApplicationKey, err error) {
	team, err := teams.Load(ctx, g, keybase1.LoadTeamArg{
		ID:      teamID,
		StaleOK: true,
		Refreshers: keybase1.TeamRefreshers{
			NeedApplicationsAtGenerations: map[keybase1.PerTeamKeyGeneration][]keybase1.TeamApplication{
				generation: {keybase1.TeamApplication_STELLAR_RELAY},
			},
		},
	})
	if err != nil {
		return res, err
	}
	return team.ApplicationKeyAtGeneration(ctx, keybase1.TeamApplication_STELLAR_RELAY, generation)
}

type Input struct {
	From       stellar1.SecretKey
	AmountXLM  string
	Note       string
	PublicMemo string
	// Implicit-team key to encrypt for
	EncryptFor    keybase1.TeamApplicationKey
	SeqnoProvider build.SequenceProvider
}

type Output struct {
	// Account ID of the shared account.
	RelayAccountID stellar1.AccountID
	// Encrypted box containing the secret key to the account.
	EncryptedB64 string
	FundTx       stellarnet.SignResult
}

// Create generates a stellar account, encrypts its key, and signs a transaction funding it.
func Create(in Input) (res Output, err error) {
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
		senderSeed, relayAccountID, in.AmountXLM, in.PublicMemo, in.SeqnoProvider)
	if err != nil {
		return res, err
	}
	enc, err := encrypt(stellar1.RelayContents{
		StellarID: stellar1.TransactionID(sig.TxHash),
		Sk:        stellar1.SecretKey(relayKp.Seed()),
		Note:      in.Note,
	}, in.EncryptFor)
	if err != nil {
		return res, err
	}
	pack, err := libkb.MsgpackEncode(enc)
	if err != nil {
		return res, err
	}
	return Output{
		RelayAccountID: stellar1.AccountID(relayKp.Address()),
		EncryptedB64:   base64.StdEncoding.EncodeToString(pack),
		FundTx:         sig,
	}, nil
}

func encrypt(relay stellar1.RelayContents, encryptFor keybase1.TeamApplicationKey) (res stellar1.EncryptedRelaySecret, err error) {
	if encryptFor.Key.IsBlank() {
		return res, errors.New("attempt to use blank team application key")
	}
	clearpack, err := libkb.MsgpackEncode(relay)
	if err != nil {
		return res, err
	}
	nonce, err := libkb.RandomNaclDHNonce()
	if err != nil {
		return res, err
	}
	secbox := secretbox.Seal(
		nil, clearpack[:], &nonce, (*[32]byte)(&encryptFor.Key))
	return stellar1.EncryptedRelaySecret{
		V:   1,
		E:   secbox,
		N:   nonce,
		Gen: encryptFor.KeyGeneration,
	}, nil
}

// `boxB64` should be a stellar1.EncryptedRelaySecret
func DecryptB64(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, boxB64 string) (res stellar1.RelayContents, err error) {
	pack, err := base64.StdEncoding.DecodeString(boxB64)
	if err != nil {
		return res, fmt.Errorf("error decoding relay box: %v", err)
	}
	var box stellar1.EncryptedRelaySecret
	err = libkb.MsgpackDecode(&box, pack)
	if err != nil {
		return res, err
	}
	appKey, err := getKeyForDecryption(ctx, g, teamID, box.Gen)
	if err != nil {
		return res, err
	}
	return decrypt(box, appKey)
}

func decrypt(box stellar1.EncryptedRelaySecret, key keybase1.TeamApplicationKey) (res stellar1.RelayContents, err error) {
	if box.V != 1 {
		return res, fmt.Errorf("unsupported relay secret box version: %v", box.V)
	}
	clearpack, ok := secretbox.Open(
		nil, box.E, (*[24]byte)(&box.N), (*[32]byte)(&key.Key))
	if !ok {
		return res, libkb.NewDecryptOpenError("relay payment secretbox")
	}
	err = libkb.MsgpackDecode(&res, clearpack)
	if err != nil {
		return res, err
	}
	_, _, _, err = libkb.ParseStellarSecretKey(res.Sk.SecureNoLogString())
	return res, err
}
