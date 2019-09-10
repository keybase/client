package contacts

import (
	"context"
	"encoding/base64"
	"errors"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/msgpack"
	"github.com/keybase/client/go/protocol/keybase1"
)

type ContactResolution struct {
	Description  string
	ResolvedUser keybase1.User
}

const ContactResolutionEncryptionVersion = 1

type ContactResolutionForEncryption struct {
	ContactResolution
	EncryptionVersion int
}

type EncryptedContactResolution struct {
	Blob          []byte
	PukGeneration keybase1.PerUserKeyGeneration
}

var errWrongContactEncryptionScheme = errors.New(
	"wrong encryption version for encrypted contact blob")

func getPerUserKeyFn(mctx libkb.MetaContext,
	pukGen *keybase1.PerUserKeyGeneration) (keyFn func(ctx context.
	Context) ([32]byte, error), gen keybase1.PerUserKeyGeneration,
	errOuter error) {
	pukring, err := mctx.G().GetPerUserKeyring(mctx.Ctx())
	if err != nil {
		return nil, gen, err
	}
	err = pukring.Sync(mctx)
	if err != nil {
		return nil, gen, err
	}
	currentGen := pukring.CurrentGeneration()
	if pukGen == nil {
		pukGen = &currentGen
	}
	keyFn = func(ctx context.Context) (res [32]byte, err error) {
		keypair, err := pukring.GetEncryptionKeyByGeneration(mctx, *pukGen)
		if err != nil {
			return res, err
		}

		// Derive symmetric key from PUK
		skey, err := keypair.SecretSymmetricKey(libkb.EncryptionReasonContactsResolvedServer)
		if err != nil {
			return res, err
		}

		copy(res[:], skey[:])
		return res, nil
	}
	return keyFn, *pukGen, nil
}

func encryptContactBlob(mctx libkb.MetaContext, res ContactResolution) (string,
	error) {
	keyFn, gen, err := getPerUserKeyFn(mctx, nil)
	if err != nil {
		return "", err
	}
	boxedRes := ContactResolutionForEncryption{res, ContactResolutionEncryptionVersion}
	encrypted, err := encrypteddb.EncodeBox(mctx.Ctx(), boxedRes, keyFn)
	if err != nil {
		return "", err
	}
	result := EncryptedContactResolution{
		Blob:          encrypted,
		PukGeneration: gen,
	}
	messagePacked, err := msgpack.Encode(result)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(messagePacked), nil
}

func DecryptContactBlob(mctx libkb.MetaContext,
	contactResBlob string) (res ContactResolution, err error) {
	messagePacked, err := base64.StdEncoding.DecodeString(contactResBlob)
	if err != nil {
		return res, err
	}
	var unpacked EncryptedContactResolution
	err = msgpack.Decode(&unpacked, messagePacked)
	if err != nil {
		return res, err
	}
	keyFn, _, err := getPerUserKeyFn(mctx, &unpacked.PukGeneration)
	if err != nil {
		return res, err
	}
	var boxedRes ContactResolutionForEncryption
	err = encrypteddb.DecodeBox(mctx.Ctx(), unpacked.Blob,
		keyFn, &boxedRes)
	if err != nil {
		return res, err
	}
	if boxedRes.EncryptionVersion != ContactResolutionEncryptionVersion {
		return res, errWrongContactEncryptionScheme
	}
	return boxedRes.ContactResolution, nil
}

func SendEncryptedContactResolutionToServer(mctx libkb.MetaContext,
	resolutions []ContactResolution) error {

	type resolvedArg struct {
		ResolvedContactBlobBase64 string `json:"blob"`
	}

	type resolvedRes struct {
		libkb.AppStatusEmbed
	}

	args := make([]resolvedArg, 0, len(resolutions))
	for _, res := range resolutions {
		blob, err := encryptContactBlob(mctx, res)
		if err != nil {
			return err
		}
		args = append(args, resolvedArg{ResolvedContactBlobBase64: blob})
	}
	payload := make(libkb.JSONPayload)
	payload["resolved_contact_blobs"] = args

	arg := libkb.APIArg{
		Endpoint:    "contacts/resolved",
		JSONPayload: payload,
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	var resp resolvedRes
	return mctx.G().API.PostDecode(mctx, arg, &resp)
}
