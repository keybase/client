// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bufio"
	"io"
	"regexp"
	"sort"
	"strings"

	"github.com/keybase/saltpack/encoding/basex"

	"github.com/keybase/go-codec/codec"
)

const (
	// To decide if a byte slice might contain a valild header of a saltpack message, and identify its type, we need to consider at most:
	// - 1 byte for bin tag at the beginning
	// - at most 4 bytes for the bin length (i.e. the length of the binary encoded header)
	// - at most 5 bytes to determine how many parts the header consists of (we expect 6 parts, but newer versions of saltpack might add more, which we would ignore as per the spec)
	// - 9 bytes for the format name
	// - 3 bytes for the version number
	// - 1 byte for the message type
	// In the common case less might be enough, but this makes the code simpler, and 23 bytes is not that much anyways.
	minLengthToIdentifyBinarySaltpack int = 23
)

// IsSaltpackBinary peeks into the provided bufio.Reader to determine whether it encodes a binary saltpack message.
// It does not consume any of the reader's bytes (whose buffer length must be at least minLengthToIdentifyBinarySaltpack). It returns a non nil error if the buffer
// size of the reader is not large enough (ErrShortSliceOrBuffer), or if the stream does not appear to contain a binary
// saltpack message. If err is nil, msgType will return the type of the encoded message, but this does *NOT* guarantee that the
// rest of the message is well formed.
func IsSaltpackBinary(stream *bufio.Reader) (msgType MessageType, version Version, err error) {

	b, err := stream.Peek(minLengthToIdentifyBinarySaltpack)
	if err == bufio.ErrBufferFull {
		return MessageTypeUnknown, Version{}, ErrShortSliceOrBuffer
	}
	if err != nil {
		return MessageTypeUnknown, Version{}, err
	}
	return IsSaltpackBinarySlice(b)
}

// IsSaltpackBinarySlice tries to determine if the input slice encodes the beginning of a binary saltpack message. It returns a non nil error if the slice is not
// long enough to make this determination, or if it does not appear to contain a binary saltpack message. If err is nil, msgType
// will return the type of the encoded message, but this does *NOT* guarantee that the rest of the message is well formed.
func IsSaltpackBinarySlice(b []byte) (msgType MessageType, version Version, err error) {

	// To avoid decoding the whole header, part of the messagepack decoding is done manually
	// instead of through go-codec. See https://github.com/msgpack/msgpack/blob/master/spec.md
	// for details on the encoding.

	if len(b) < minLengthToIdentifyBinarySaltpack {
		return MessageTypeUnknown, Version{}, ErrShortSliceOrBuffer
	}

	// The header is double-encoded, so we need to skip the "bin" tag at the front to
	// get at the encoded header array.
	var binTagBytesToSkip int
	if b[0] == 0xc4 {
		binTagBytesToSkip = 2
	} else if b[0] == 0xc5 {
		binTagBytesToSkip = 3
	} else if b[0] == 0xc6 {
		binTagBytesToSkip = 5
	} else {
		return MessageTypeUnknown, Version{}, ErrNotASaltpackMessage
	}

	// The header should be a msg pack encoded array: verify it is, that it has at least three elements, and
	// note how many bytes to skip to point to its first element.
	arrayTagByte := b[binTagBytesToSkip]
	var arrayTagBytesToSkip int
	if 0x93 <= arrayTagByte && arrayTagByte <= 0x9f {
		arrayTagBytesToSkip = 1
	} else if arrayTagByte == 0xdc {
		arrayTagBytesToSkip = 3
	} else if arrayTagByte == 0xdd {
		arrayTagBytesToSkip = 5
	} else {
		return MessageTypeUnknown, Version{}, ErrNotASaltpackMessage
	}

	// Devode the first 3 elements of the header, and use them to classify the message.
	var mh codec.MsgpackHandle
	decoder := codec.NewDecoderBytes(b[binTagBytesToSkip+arrayTagBytesToSkip:], &mh)
	var formatName string

	if err := decoder.Decode(&formatName); err != nil {
		return MessageTypeUnknown, Version{}, ErrNotASaltpackMessage
	}
	if formatName != FormatName {
		return MessageTypeUnknown, Version{}, ErrNotASaltpackMessage
	}
	if err := decoder.Decode(&version); err != nil {
		return MessageTypeUnknown, Version{}, ErrNotASaltpackMessage
	}
	if err := decoder.Decode(&msgType); err != nil {
		return MessageTypeUnknown, Version{}, ErrNotASaltpackMessage
	}
	switch msgType {
	case MessageTypeEncryption, MessageTypeSigncryption, MessageTypeAttachedSignature, MessageTypeDetachedSignature:
		return msgType, version, nil
	default:
		return MessageTypeUnknown, Version{}, ErrNotASaltpackMessage
	}
}

// IsSaltpackArmored peeks into the provided bufio.Reader to determine whether it encodes an ASCII-armored saltpack message.
// It does not consume any of the reader's bytes. The buffer size of the reader must be sufficient to contain the header frame plus
// the first Base62 encoded block of the payload. It returns a non nil error if the buffer
// size of the reader is not large enough to make this determination (ErrShortSliceOrBuffer), or if the stream does not appear to contain a valid
// saltpack message. If err is nil, then the brand, version and expected type of the message will be returned, but this does *NOT* guarantee that the
// rest of the message is well formed.
func IsSaltpackArmored(stream *bufio.Reader) (brand string, msgType MessageType, ver Version, err error) {

	// temporary hack to compute stream.Size(), which is only available from go 1.10
	// TODO remove after we can drop support for go 1.9 or older.
	// If the buffer is larger then 8192, we use the first 8192 bytes (which should be
	// enough to decode one block in the vast majority of cases)
	sizePlusOne := sort.Search(8192, func(i int) bool {
		_, peekErr := stream.Peek(i)
		return peekErr == bufio.ErrBufferFull
	})

	buf, err := stream.Peek(sizePlusOne - 1)
	if (err != nil && err != io.EOF) || len(buf) == 0 {
		return "", MessageTypeUnknown, ver, err
	}

	return IsSaltpackArmoredPrefix(string(buf))
}

// IsSaltpackArmoredPrefix tries to determine whether the string is the prefix of a valid ASCII-armored saltpack message.
// The prefix must be large enough to contain the header frame plus the first Base62 encoded block of the payload. It returns a non nil error if the buffer
// size of the reader is not large enough to make this determination (ErrShortSliceOrBuffer), or if the stream does not appear to contain a valid
// saltpack message. If err is nil, then the brand, version and expected type of the message will be returned, but this does *NOT* guarantee that the
// rest of the message is well formed.
func IsSaltpackArmoredPrefix(pref string) (brand string, messageType MessageType, ver Version, err error) {
	// replace blocks of characters in the set [>\n\r\t ] with a single space, so that the next regexp is simpler
	re := regexp.MustCompile("[>\n\r\t ]+")
	s := strings.TrimSpace(re.ReplaceAllString(pref, " "))

	headerRegExpSt := "^BEGIN (?:([a-zA-Z0-9]+) )?SALTPACK (" + EncryptionArmorString + "|" + SignedArmorString + "|" + DetachedSignatureArmorString + ") ?\\.([a-zA-Z0-9 ]*)"
	headerRegExp := regexp.MustCompile(headerRegExpSt)

	m := headerRegExp.FindStringSubmatch(s)
	if m == nil || len(m) == 0 {
		// Matches at most five words
		if !regexp.MustCompile("^([a-zA-Z0-9]+ ?){0,5}$").MatchString(s) {
			return "", MessageTypeUnknown, Version{}, ErrNotASaltpackMessage
		}

		strs := strings.Split(s, " ")

		switch len(strs) {
		case 1:
			if strings.HasPrefix(string(headerMarker), strs[0]) {
				return "", MessageTypeUnknown, Version{}, ErrShortSliceOrBuffer
			}
			return "", MessageTypeUnknown, Version{}, ErrNotASaltpackMessage
		case 2:
			if string(headerMarker) == strs[0] {
				return "", MessageTypeUnknown, Version{}, ErrShortSliceOrBuffer
			}
			return "", MessageTypeUnknown, Version{}, ErrNotASaltpackMessage
		case 3, 4, 5:
			// more processing needed.
		default:
			panic("logic error in ClassifyStream")
		}

		headerWithoutBrand := strings.Join(append([]string{strs[0]}, strs[2:]...), " ")

		if strings.HasPrefix(string(headerMarker)+" "+strings.ToUpper(FormatName)+" "+EncryptionArmorString, headerWithoutBrand) ||
			strings.HasPrefix(string(headerMarker)+" "+strings.ToUpper(FormatName)+" "+SignedArmorString, headerWithoutBrand) ||
			strings.HasPrefix(string(headerMarker)+" "+strings.ToUpper(FormatName)+" "+DetachedSignatureArmorString, headerWithoutBrand) ||
			strings.HasPrefix(string(headerMarker)+" "+strings.ToUpper(FormatName)+" "+EncryptionArmorString, s) ||
			strings.HasPrefix(string(headerMarker)+" "+strings.ToUpper(FormatName)+" "+SignedArmorString, s) ||
			strings.HasPrefix(string(headerMarker)+" "+strings.ToUpper(FormatName)+" "+DetachedSignatureArmorString, s) {
			return "", MessageTypeUnknown, Version{}, ErrShortSliceOrBuffer
		}
		return "", MessageTypeUnknown, Version{}, ErrNotASaltpackMessage
	}

	brand = m[1]
	headerArmorType := m[2] // can be one of SignedArmorString, DetachedSignatureArmorString, EncryptionArmorString

	dec, err := basex.Base62StdEncoding.DecodeString(m[3])
	// This is not a prefix free encoding, so we need to decode a full codeword (32 bytes) to make sure we are not interpreting
	// a truncated block as if it was a short block. Moreover, we only need one codeword, so if an error is returned but a codeword
	// was decoded, the error can be ignored.
	if len(dec) < 32 {
		if err == basex.ErrInvalidEncodingLength || err == nil {
			return "", MessageTypeUnknown, ver, ErrShortSliceOrBuffer
		}
		return "", MessageTypeUnknown, ver, ErrNotASaltpackMessage
	}

	messageType, ver, err = IsSaltpackBinarySlice(dec)
	if err != nil {
		return "", MessageTypeUnknown, ver, err
	}

	// ensure that the type of the armor matches the type of the inner header
	if (messageType == MessageTypeSigncryption && headerArmorType != EncryptionArmorString) ||
		(messageType == MessageTypeEncryption && headerArmorType != EncryptionArmorString) ||
		(messageType == MessageTypeAttachedSignature && headerArmorType != SignedArmorString) ||
		(messageType == MessageTypeDetachedSignature && headerArmorType != DetachedSignatureArmorString) {
		return "", MessageTypeUnknown, ver, ErrNotASaltpackMessage
	}

	return m[1], messageType, ver, nil
}

// ClassifyStream peeks at the beginning of a stream and checks wether it seems to contain a valid
// saltpack message (either armored or not).
// The buffer size must be at least minLengthToIdentifyBinarySaltpack bytes for binary messages, and large
// enough that if there is a header frame (i.e. "BEGIN FOO."), plus the first
// base62 encoded block (43 characters) of the steam (the default buffer size of bufio.Reader
// will be enough in most cases). Otherwise, ErrShortSliceOrBuffer will be returned.
// If err is nil, then the expected message type and version will be returned, as well as a booleand
// indicating if the message is ASCII-armored and the brand (for armored messages only).
// Note this classification is just a guess based on the beginning of the stream, and it does not
// guarantee that the message is valid or well formed.
func ClassifyStream(stream *bufio.Reader) (isArmored bool, brand string, messageType MessageType, ver Version, err error) {
	brand, messageType, ver, err = IsSaltpackArmored(stream)
	if err == nil {
		return true, brand, messageType, ver, err
	} else if err == ErrShortSliceOrBuffer {
		return false, "", MessageTypeUnknown, Version{}, ErrShortSliceOrBuffer
	}
	messageType, ver, err = IsSaltpackBinary(stream)
	if err == nil {
		return false, "", messageType, ver, err
	}
	return false, "", MessageTypeUnknown, Version{}, err
}

// ClassifyEncryptedStreamAndMakeDecoder takes as input an io.Reader (containing an encrypted saltpack stream),
// a SigncryptKeyring containing the keys to use for decryption, and a SymmetricKeyResolver (used to map an
// identifiers to symmetric keys in an application specific way). It classifies the encrypted stream
// (encryption vs signcryption mode and binary vs armored format) and returns a reader for the decoded stream,
// as well as some informtation about the stream. The brand is only returned for armored ciphertexts, mki only
// for encryption-mode ciphertext, senderPublic only for signcryption-mode ciphertexts.
func ClassifyEncryptedStreamAndMakeDecoder(source io.Reader, decryptionKeyring SigncryptKeyring, keyResolver SymmetricKeyResolver) (
	plainsource io.Reader, msgType MessageType, mki *MessageKeyInfo, senderPublic SigningPublicKey, isArmored bool, brand string, ver Version, err error) {
	stream := bufio.NewReader(source)

	isArmored, _, msgType, ver, err = ClassifyStream(stream)
	if err == ErrShortSliceOrBuffer {
		return nil, MessageTypeUnknown, nil, nil, false, "", Version{}, ErrShortSliceOrBuffer
	}
	if err != nil {
		return nil, MessageTypeUnknown, nil, nil, false, "", Version{}, ErrNotASaltpackMessage
	}

	switch msgType {
	case MessageTypeEncryption:
		if isArmored {
			mki, plainsource, brand, err = NewDearmor62DecryptStream(CheckKnownMajorVersion, stream, decryptionKeyring)
		} else {
			mki, plainsource, err = NewDecryptStream(CheckKnownMajorVersion, stream, decryptionKeyring)
		}
		return plainsource, msgType, mki, nil, isArmored, brand, ver, err
	case MessageTypeSigncryption:
		if isArmored {
			senderPublic, plainsource, brand, err = NewDearmor62SigncryptOpenStream(stream, decryptionKeyring, keyResolver)
		} else {
			senderPublic, plainsource, err = NewSigncryptOpenStream(stream, decryptionKeyring, keyResolver)
		}
		return plainsource, msgType, nil, senderPublic, isArmored, brand, ver, err
	default:
		return nil, MessageTypeUnknown, nil, nil, false, "", Version{}, ErrWrongMessageType{MessageTypeEncryption, msgType}
	}
}
