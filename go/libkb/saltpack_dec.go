// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/saltpack"
)

func SaltpackDecrypt(
	ctx context.Context, g *GlobalContext, source io.Reader, sink io.WriteCloser,
	deviceEncryptionKey NaclDHKeyPair,
	checkSenderMki func(*saltpack.MessageKeyInfo) error,
	checkSenderSigningKey func(saltpack.SigningPublicKey) error) (*saltpack.MessageKeyInfo, error) {

	sc, newSource, err := ClassifyStream(source)
	if err != nil {
		return nil, err
	}

	if sc.Format != CryptoMessageFormatSaltpack {
		return nil, WrongCryptoFormatError{
			Wanted:    CryptoMessageFormatSaltpack,
			Received:  sc.Format,
			Operation: "decrypt",
		}
	}

	source = newSource

	var dearmored io.Reader
	var frame saltpack.Frame
	if sc.Armored {
		dearmored, frame, err = saltpack.NewArmor62DecoderStream(source)
		if err != nil {
			return nil, err
		}
	} else {
		dearmored = source
	}

	// mki will be set for DH mode, senderSigningKey will be set for signcryption mode
	plainsource, mki, senderSigningKey, typ, err := peekTypeAndMakeDecoder(ctx, g, dearmored, naclKeyring(deviceEncryptionKey))

	if err != nil {
		return mki, err
	}

	if typ == saltpack.MessageTypeEncryption && checkSenderMki != nil {
		if err = checkSenderMki(mki); err != nil {
			return mki, err
		}
	}
	if typ == saltpack.MessageTypeSigncryption && checkSenderSigningKey != nil {
		if err = checkSenderSigningKey(senderSigningKey); err != nil {
			return nil, err
		}
	}

	n, err := io.Copy(sink, plainsource)
	if err != nil {
		return mki, err
	}

	// TODO: Check header inline, and only warn if the footer
	// doesn't match.
	if sc.Armored {
		var brand string
		brand, err = saltpack.CheckArmor62Frame(frame, saltpack.MessageTypeEncryption)
		if err != nil {
			return mki, err
		}
		if err = checkSaltpackBrand(brand); err != nil {
			return mki, err
		}
	}

	g.Log.CDebugf(ctx, "Decrypt: read %d bytes", n)

	if err := sink.Close(); err != nil {
		return mki, err
	}
	return mki, nil
}

func peekTypeAndMakeDecoder(ctx context.Context, g *GlobalContext, dearmored io.Reader, keyring naclKeyring) (io.Reader, *saltpack.MessageKeyInfo, saltpack.SigningPublicKey, saltpack.MessageType, error) {
	// How much do we need to peek to get at the mode number?
	// - bin tag (2, 3, or 5 bytes)
	// - array tag (1 byte)
	// - format name (9 bytes, including tag)
	// - version (3 bytes, including tag)
	// - and finally, the mode (1 byte)
	// sums to 16-19 bytes.
	peekable := bufio.NewReader(dearmored)
	peekedBytes, err := peekable.Peek(19)
	if err != nil {
		return nil, nil, nil, -1, err
	}

	// Figure out the bin tag size.
	var binTagSize int
	switch peekedBytes[0] {
	case 0xc4:
		binTagSize = 2
	case 0xc5:
		binTagSize = 3
	case 0xc6:
		binTagSize = 5
	default:
		return nil, nil, nil, -1, fmt.Errorf("invalid bin tag value when peeking: %x", peekedBytes[0])
	}
	arrayTagOffset := binTagSize
	formatNameOffset := arrayTagOffset + 1
	versionOffset := formatNameOffset + 9
	modeOffset := versionOffset + 3

	// Sanity check all the values we've peeked, to avoid kicking errors down
	// the road if we're reading garbage.

	arrayTag := peekedBytes[arrayTagOffset]
	if arrayTag&0x90 != 0x90 {
		return nil, nil, nil, -1, fmt.Errorf("invalid array tag value when peeking: %x", arrayTag)
	}

	formatName := peekedBytes[formatNameOffset : formatNameOffset+9]
	if !bytes.Equal([]byte("\xa8saltpack"), formatName) {
		return nil, nil, nil, -1, fmt.Errorf("invalid format name when peeking: %q", string(formatName))
	}

	versionTag := peekedBytes[versionOffset]
	if versionTag != 0x92 {
		return nil, nil, nil, -1, fmt.Errorf("invalid version tag value when peeking: %x", versionTag)
	}

	// fixints are encoded as their literal byte value
	typ := saltpack.MessageType(peekedBytes[modeOffset])
	switch typ {
	case saltpack.MessageTypeEncryption:
		mki, plainsource, err := saltpack.NewDecryptStream(peekable, keyring)
		return plainsource, mki, nil, typ, err
	case saltpack.MessageTypeSigncryption:
		senderPublic, plainsource, err := saltpack.NewSigncryptOpenStream(peekable, keyring, NewTlfKeyResolver(ctx, g))
		return plainsource, nil, senderPublic, typ, err
	default:
		return nil, nil, nil, -1, fmt.Errorf("unexpected message mode when peeking: %d", typ)
	}
}

type TlfKeyResolver struct {
	Contextified
	ctx context.Context
}

var _ saltpack.SymmetricKeyResolver = (*TlfKeyResolver)(nil)

func NewTlfKeyResolver(ctx context.Context, g *GlobalContext) *TlfKeyResolver {
	return &TlfKeyResolver{NewContextified(g), ctx}
}

func (r *TlfKeyResolver) ResolveKeys(identifiers [][]byte) ([]*saltpack.SymmetricKey, error) {
	tlfPseudonyms := []TlfPseudonym{}
	for _, identifier := range identifiers {
		pseudonym := TlfPseudonym{}
		if len(pseudonym) != len(identifier) {
			return nil, fmt.Errorf("identifier is the wrong length for a TLF pseudonym (%d != %d)", len(pseudonym), len(identifier))
		}
		copy(pseudonym[:], identifier)
		tlfPseudonyms = append(tlfPseudonyms, pseudonym)
	}

	results, err := GetTlfPseudonyms(r.ctx, r.G(), tlfPseudonyms)
	if err != nil {
		return nil, err
	}

	symmetricKeys := []*saltpack.SymmetricKey{}
	for _, result := range results {
		if result.Err != nil {
			r.G().Log.CDebugf(r.ctx, "skipping unresolved pseudonym: %s", result.Err)
			symmetricKeys = append(symmetricKeys, nil)
			continue
		}
		r.G().Log.CDebugf(r.ctx, "resolved pseudonym for %s, fetching key", result.Info.Name)
		symmetricKey, err := r.getSymmetricKey(*result.Info)
		if err != nil {
			return nil, err
		}
		symmetricKeys = append(symmetricKeys, symmetricKey)
	}
	return symmetricKeys, nil
}

func (r *TlfKeyResolver) getSymmetricKey(info TlfPseudonymInfo) (*saltpack.SymmetricKey, error) {
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
	breaks := []keybase1.TLFIdentifyFailure{}
	identifyCtx := types.IdentifyModeCtx(r.ctx, keybase1.TLFIdentifyBehavior_CHAT_CLI, &breaks)
	res, err := r.G().TlfInfoSource.CryptKeys(identifyCtx, basename)
	if err != nil {
		return nil, err
	}
	for _, key := range res.CryptKeys {
		if KeyGen(key.KeyGeneration) == info.KeyGen {
			// Success!
			return (*saltpack.SymmetricKey)(&key.Key), nil
		}
	}
	return nil, fmt.Errorf("no keys in TLF %q matched generation %d", basename, info.KeyGen)
}
