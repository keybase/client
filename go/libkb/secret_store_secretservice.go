// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build linux

package libkb

import (
	cryptorand "crypto/rand"
	"crypto/sha256"
	"fmt"
	"io"

	dbus "github.com/guelfey/go.dbus"
	secsrv "github.com/keybase/go-keychain/secretservice"
	"golang.org/x/crypto/hkdf"

	"github.com/pkg/errors"
)

type SecretStoreRevokableSecretService struct{}

var _ SecretStoreAll = (*SecretStoreRevokableSecretService)(nil)

func NewSecretStoreRevokableSecretService() *SecretStoreRevokableSecretService {
	return &SecretStoreRevokableSecretService{}
}

func (s *SecretStoreRevokableSecretService) makeServiceAttributes(mctx MetaContext) secsrv.Attributes {
	return secsrv.Attributes{
		"service": mctx.G().Env.GetStoredSecretServiceName(),
	}
}

func (s *SecretStoreRevokableSecretService) makeAttributes(mctx MetaContext, username NormalizedUsername) secsrv.Attributes {
	serviceAttributes := s.makeServiceAttributes(mctx)
	serviceAttributes["username"] = string(username)
	serviceAttributes["note"] = "https://keybase.io/docs/crypto/local-key-security"
	return serviceAttributes
}

func (s *SecretStoreRevokableSecretService) maybeRetrieveSingleItem(mctx MetaContext, srv *secsrv.SecretService, username NormalizedUsername) (*dbus.ObjectPath, error) {
	if srv == nil {
		return nil, fmt.Errorf("got nil d-bus secretservice")
	}
	attributes := s.makeAttributes(mctx, username)
	items, err := srv.SearchCollection(secsrv.DefaultCollection, attributes)
	if err != nil {
		return nil, err
	}
	if len(items) < 1 {
		return nil, nil
	}
	if len(items) > 1 {
		mctx.Warning("found more than one match in keyring for query %+v", attributes)
	}
	item := items[0]
	err = srv.Unlock([]dbus.ObjectPath{item})
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *SecretStoreRevokableSecretService) keystoreDir(mctx MetaContext, username string) string {
	return fmt.Sprintf("ring/%s", username)
}

func (s *SecretStoreRevokableSecretService) secretlessKeystore(mctx MetaContext, username string) SecretlessErasableKVStore {
	return NewSecretlessFileErasableKVStore(mctx, s.keystoreDir(mctx, username))
}

func (s *SecretStoreRevokableSecretService) keystoreKey() string {
	return "key"
}

func (s *SecretStoreRevokableSecretService) keystore(mctx MetaContext, username string, keyringSecret []byte) ErasableKVStore {
	keygen := func(mctx MetaContext, noise NoiseBytes) (xs [32]byte, err error) {
		// hkdf with salt=nil, info=context string, and using entropy from both
		// the noise in the file and the secret in the keyring. Thus, when we
		// try to erase this secret, as long as we are able to delete it from
		// either the noise file or the keyring, we'll have succeeded in making
		// the secret impossible to retrieve.
		// See additional docs at https://keybase.io/docs/crypto/local-key-security.
		h := hkdf.New(sha256.New, append(noise[:], keyringSecret...), nil, []byte(DeriveReasonLinuxRevokableKeyring))
		_, err = io.ReadFull(h, xs[:])
		if err != nil {
			return [32]byte{}, err
		}
		return xs, nil
	}
	return NewFileErasableKVStore(mctx, s.keystoreDir(mctx, username), keygen)
}

func (s *SecretStoreRevokableSecretService) RetrieveSecret(mctx MetaContext, username NormalizedUsername) (secret LKSecFullSecret, err error) {
	defer mctx.TraceTimed("SecretStoreRevokableSecretService.RetrieveSecret", func() error { return err })()

	srv, err := secsrv.NewService()
	if err != nil {
		return LKSecFullSecret{}, err
	}
	session, err := srv.OpenSession(secsrv.AuthenticationDHAES)
	if err != nil {
		return LKSecFullSecret{}, err
	}
	defer srv.CloseSession(session)

	item, err := s.maybeRetrieveSingleItem(mctx, srv, username)
	if err != nil {
		return LKSecFullSecret{}, err
	}
	if item == nil {
		return LKSecFullSecret{}, fmt.Errorf("secret not found in secretstore")
	}
	keyringSecret, err := srv.GetSecret(*item, *session)
	if err != nil {
		return LKSecFullSecret{}, err
	}

	keystore := s.keystore(mctx, string(username), keyringSecret)
	var secretBytes []byte
	err = keystore.Get(mctx, s.keystoreKey(), &secretBytes)
	if err != nil {
		return LKSecFullSecret{}, err
	}

	return newLKSecFullSecretFromBytes(secretBytes)
}

func (s *SecretStoreRevokableSecretService) StoreSecret(mctx MetaContext, username NormalizedUsername, secret LKSecFullSecret) (err error) {
	defer mctx.TraceTimed("SecretStoreRevokableSecretService.StoreSecret", func() error { return err })()

	keyringSecret := make([]byte, 32)
	_, err = cryptorand.Read(keyringSecret)
	if err != nil {
		return err
	}

	srv, err := secsrv.NewService()
	if err != nil {
		return err
	}
	session, err := srv.OpenSession(secsrv.AuthenticationDHAES)
	if err != nil {
		return err
	}
	defer srv.CloseSession(session)
	label := fmt.Sprintf("%s@%s", username, mctx.G().Env.GetStoredSecretServiceName())
	properties := secsrv.NewSecretProperties(label, s.makeAttributes(mctx, username))
	srvSecret, err := session.NewSecret(keyringSecret)
	if err != nil {
		return err
	}
	err = srv.Unlock([]dbus.ObjectPath{secsrv.DefaultCollection})
	if err != nil {
		return err
	}
	_, err = srv.CreateItem(secsrv.DefaultCollection, properties, srvSecret, secsrv.ReplaceBehaviorReplace)
	if err != nil {
		return err
	}

	keystore := s.keystore(mctx, string(username), keyringSecret)
	err = keystore.Put(mctx, s.keystoreKey(), secret.Bytes())
	if err != nil {
		return err
	}

	return nil
}

func (s *SecretStoreRevokableSecretService) ClearSecret(mctx MetaContext, username NormalizedUsername) (err error) {
	defer mctx.TraceTimed("SecretStoreRevokableSecretService.ClearSecret", func() error { return err })()

	// Delete file-based portion first. If it fails, we can still try to erase the keyring's portion.
	secretlessKeystore := s.secretlessKeystore(mctx, string(username))
	keystoreErr := secretlessKeystore.Erase(mctx, s.keystoreKey())
	if keystoreErr != nil {
		mctx.Warning("Failed to erase keystore half: %s; attempting to delete from keyring", keystoreErr)
	}

	srv, err := secsrv.NewService()
	if err != nil {
		return CombineErrors(keystoreErr, err)
	}
	item, err := s.maybeRetrieveSingleItem(mctx, srv, username)
	if err != nil {
		return CombineErrors(keystoreErr, err)
	}
	if item == nil {
		mctx.Debug("secret not found; short-circuiting clear")
		return nil
	}
	err = srv.DeleteItem(*item)
	if err != nil {
		return CombineErrors(keystoreErr, err)
	}

	return keystoreErr
}

func (s *SecretStoreRevokableSecretService) GetUsersWithStoredSecrets(mctx MetaContext) (usernames []string, err error) {
	defer mctx.TraceTimed("SecretStoreRevokableSecretService.GetUsersWithStoredSecrets", func() error { return err })()

	srv, err := secsrv.NewService()
	if err != nil {
		return nil, err
	}
	items, err := srv.SearchCollection(secsrv.DefaultCollection, s.makeServiceAttributes(mctx))
	if err != nil {
		return nil, err
	}
	for _, item := range items {
		attributes, err := srv.GetAttributes(item)
		if err != nil {
			return nil, err
		}
		username, ok := attributes["username"]
		if !ok {
			return nil, errors.Errorf("secret with attributes %+v does not have username key", attributes)
		}
		usernames = append(usernames, username)
	}

	return usernames, nil
}

func (s *SecretStoreRevokableSecretService) GetOptions(MetaContext) *SecretStoreOptions  { return nil }
func (s *SecretStoreRevokableSecretService) SetOptions(MetaContext, *SecretStoreOptions) {}
