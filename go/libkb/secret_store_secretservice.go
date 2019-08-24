// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build linux

package libkb

import (
	cryptorand "crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"time"

	secsrv "github.com/keybase/go-keychain/secretservice"
	dbus "github.com/keybase/go.dbus"
	"golang.org/x/crypto/hkdf"
)

const sessionOpenTimeout = 5 * time.Second

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

func (s *SecretStoreRevokableSecretService) makeAttributes(mctx MetaContext, username NormalizedUsername, instanceIdentifier []byte) secsrv.Attributes {
	serviceAttributes := s.makeServiceAttributes(mctx)
	serviceAttributes["username"] = string(username)
	serviceAttributes["identifier"] = hex.EncodeToString(instanceIdentifier)
	serviceAttributes["note"] = "https://keybase.io/docs/crypto/local-key-security"
	serviceAttributes["info"] = "Do not delete this entry. Instead, log out or uncheck 'remember passphrase' in the app."
	return serviceAttributes
}

func (s *SecretStoreRevokableSecretService) retrieveManyItems(mctx MetaContext, srv *secsrv.SecretService, username NormalizedUsername, instanceIdentifier []byte) ([]dbus.ObjectPath, error) {
	if srv == nil {
		return nil, fmt.Errorf("got nil d-bus secretservice")
	}
	attributes := s.makeAttributes(mctx, username, instanceIdentifier)
	items, err := srv.SearchCollection(secsrv.DefaultCollection, attributes)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (s *SecretStoreRevokableSecretService) maybeRetrieveSingleItem(mctx MetaContext, srv *secsrv.SecretService, username NormalizedUsername, instanceIdentifier []byte) (*dbus.ObjectPath, error) {
	items, err := s.retrieveManyItems(mctx, srv, username, instanceIdentifier)
	if err != nil {
		return nil, err
	}

	if len(items) < 1 {
		return nil, nil
	}
	if len(items) > 1 {
		mctx.Warning("found more than one match in keyring for query %+v", s.makeAttributes(mctx, username, instanceIdentifier))
	}
	item := items[0]
	err = srv.Unlock([]dbus.ObjectPath{item})
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *SecretStoreRevokableSecretService) keystoreDir(mctx MetaContext, username string) string {
	return fmt.Sprintf("ring%c%s", filepath.Separator, username)
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

const identifierKeystoreSuffix = ".user"

func (s *SecretStoreRevokableSecretService) identifierKeystoreKey(username NormalizedUsername) string {
	return string(username) + identifierKeystoreSuffix
}

func (s *SecretStoreRevokableSecretService) identifierKeystore(mctx MetaContext) ErasableKVStore {
	plaintextKeygen := func(mctx MetaContext, noise NoiseBytes) (xs [32]byte, err error) {
		return sha256.Sum256(noise[:]), nil
	}
	return NewFileErasableKVStore(mctx, "ring-identifiers", plaintextKeygen)
}

func (s *SecretStoreRevokableSecretService) RetrieveSecret(mctx MetaContext, username NormalizedUsername) (secret LKSecFullSecret, err error) {
	defer mctx.TraceTimed("SecretStoreRevokableSecretService.RetrieveSecret", func() error { return err })()

	identifierKeystore := s.identifierKeystore(mctx)
	var instanceIdentifier []byte
	err = identifierKeystore.Get(mctx, s.identifierKeystoreKey(username), &instanceIdentifier)
	if err != nil {
		return LKSecFullSecret{}, err
	}

	srv, err := secsrv.NewService()
	if err != nil {
		return LKSecFullSecret{}, err
	}
	srv.SetSessionOpenTimeout(sessionOpenTimeout)
	session, err := srv.OpenSession(secsrv.AuthenticationDHAES)
	if err != nil {
		return LKSecFullSecret{}, err
	}
	defer srv.CloseSession(session)

	item, err := s.maybeRetrieveSingleItem(mctx, srv, username, instanceIdentifier)
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

	// We add a public random identifier to the secret's properties in the
	// Secret Service so if the same machine (with the same keyring) is storing
	// passwords for the same user but in different home directories, they
	// don't overwrite each others' keyring secrets (effectively logging the
	// other one out after service restart).
	instanceIdentifier := make([]byte, 32)
	_, err = cryptorand.Read(instanceIdentifier)
	if err != nil {
		return err
	}

	keyringSecret := make([]byte, 32)
	_, err = cryptorand.Read(keyringSecret)
	if err != nil {
		return err
	}

	srv, err := secsrv.NewService()
	if err != nil {
		return err
	}
	srv.SetSessionOpenTimeout(sessionOpenTimeout)
	session, err := srv.OpenSession(secsrv.AuthenticationDHAES)
	if err != nil {
		return err
	}
	defer srv.CloseSession(session)
	label := fmt.Sprintf("%s@%s", username, mctx.G().Env.GetStoredSecretServiceName())
	properties := secsrv.NewSecretProperties(label, s.makeAttributes(mctx, username, instanceIdentifier))
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

	identifierKeystore := s.identifierKeystore(mctx)
	err = identifierKeystore.Put(mctx, s.identifierKeystoreKey(username), instanceIdentifier)
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

	identifierKeystore := s.identifierKeystore(mctx)
	var instanceIdentifier []byte
	err = identifierKeystore.Get(mctx, s.identifierKeystoreKey(username), &instanceIdentifier)
	if err != nil {
		// If we can't get the identifier, we can't delete it from the keyring, so bail out here.
		return CombineErrors(keystoreErr, err)
	}

	err = identifierKeystore.Erase(mctx, s.identifierKeystoreKey(username))
	if err != nil {
		// We can continue even if we failed to erase the identifier, since we know it now.
		mctx.Warning("Failed to erase identifier from identifier keystore %s; continuing to attempt to delete from keyring", err)
	}

	srv, err := secsrv.NewService()
	if err != nil {
		return CombineErrors(keystoreErr, err)
	}
	srv.SetSessionOpenTimeout(sessionOpenTimeout)
	// Only delete the ones for the identifier we care about, so as not to erase
	// other passwords for the same user in a different home directory on the
	// same computer.
	items, err := s.retrieveManyItems(mctx, srv, username, instanceIdentifier)
	if err != nil {
		return CombineErrors(keystoreErr, err)
	}
	for _, item := range items {
		err = srv.DeleteItem(item)
		if err != nil {
			return CombineErrors(keystoreErr, err)
		}
	}

	return keystoreErr
}

// Note that in the case of corruption, not all of these usernames may actually
// be able to be logged in as due to the noise file being corrupted, the
// keyring being uninstalled, etc.
func (s *SecretStoreRevokableSecretService) GetUsersWithStoredSecrets(mctx MetaContext) (usernames []string, err error) {
	defer mctx.TraceTimed("SecretStoreRevokableSecretService.GetUsersWithStoredSecrets", func() error { return err })()
	identifierKeystore := s.identifierKeystore(mctx)
	suffixedUsernames, err := identifierKeystore.AllKeys(mctx, identifierKeystoreSuffix)
	if err != nil {
		return nil, err
	}
	for _, suffixedUsername := range suffixedUsernames {
		usernames = append(usernames, strings.TrimSuffix(suffixedUsername, identifierKeystoreSuffix))
	}
	return usernames, nil
}

func (s *SecretStoreRevokableSecretService) GetOptions(MetaContext) *SecretStoreOptions  { return nil }
func (s *SecretStoreRevokableSecretService) SetOptions(MetaContext, *SecretStoreOptions) {}
