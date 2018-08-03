// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bufio"
	"bytes"
	"fmt"
	"io"

	"github.com/keybase/saltpack"
)

func SaltpackDecrypt(m MetaContext, source io.Reader, sink io.WriteCloser,
	decryptionKeyring saltpack.SigncryptKeyring,
	checkSenderMki func(*saltpack.MessageKeyInfo) error,
	checkSenderSigningKey func(saltpack.SigningPublicKey) error,
	keyResolver saltpack.SymmetricKeyResolver) (*saltpack.MessageKeyInfo, error) {

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
	plainsource, mki, senderSigningKey, typ, err := peekTypeAndMakeDecoder(dearmored, decryptionKeyring, keyResolver)

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

	m.CDebugf("Decrypt: read %d bytes", n)

	if err := sink.Close(); err != nil {
		return mki, err
	}
	return mki, nil
}

func peekTypeAndMakeDecoder(dearmored io.Reader, keyring saltpack.SigncryptKeyring, keyResolver saltpack.SymmetricKeyResolver) (io.Reader, *saltpack.MessageKeyInfo, saltpack.SigningPublicKey, saltpack.MessageType, error) {
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
		mki, plainsource, err := saltpack.NewDecryptStream(saltpack.CheckKnownMajorVersion, peekable, keyring)
		return plainsource, mki, nil, typ, err
	case saltpack.MessageTypeSigncryption:
		senderPublic, plainsource, err := saltpack.NewSigncryptOpenStream(peekable, keyring, keyResolver)
		return plainsource, nil, senderPublic, typ, err
	default:
		return nil, nil, nil, -1, fmt.Errorf("unexpected message mode when peeking: %d", typ)
	}
}
