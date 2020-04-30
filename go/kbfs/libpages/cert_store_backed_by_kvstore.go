// Copyright 2020 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libpages

import (
	"context"
	"encoding/base64"

	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/crypto/acme/autocert"
)

// certStoreBackedByKVStore is a wrapper around the KVStore in Keybase. No
// caching is done here since acme/autocert has a in-memory cache already.
type certStoreBackedByKVStore struct {
	kbfsConfig libkbfs.Config
}

var _ autocert.Cache = (*certStoreBackedByKVStore)(nil)

func newCertStoreBackedByKVStore(kbfsConfig libkbfs.Config) autocert.Cache {
	return &certStoreBackedByKVStore{
		kbfsConfig: kbfsConfig,
	}
}

func encodeData(data []byte) string {
	return base64.URLEncoding.EncodeToString(data)
}

func decodeData(str string) ([]byte, error) {
	return base64.URLEncoding.DecodeString(str)
}

const certKVStoreNamespace = "cert-store-v1"

// Get implements the autocert.Cache interface.
func (s *certStoreBackedByKVStore) Get(ctx context.Context, key string) ([]byte, error) {
	res, err := s.kbfsConfig.KeybaseService().GetKVStoreClient().GetKVEntry(ctx,
		keybase1.GetKVEntryArg{
			Namespace: certKVStoreNamespace,
			EntryKey:  key,
		})
	if err != nil {
		return nil, errors.WithMessage(err, "kvstore get error")
	}
	if res.EntryValue == nil {
		return nil, errors.New("kvstore get error: empty result")
	}
	data, err := decodeData(*res.EntryValue)
	if err != nil {
		return nil, errors.WithMessage(err, "decodeData error")
	}
	return data, nil
}

// Put implements the autocert.Cache interface.
func (s *certStoreBackedByKVStore) Put(ctx context.Context, key string, data []byte) error {
	_, err := s.kbfsConfig.KeybaseService().GetKVStoreClient().PutKVEntry(ctx,
		keybase1.PutKVEntryArg{
			Namespace:  certKVStoreNamespace,
			EntryKey:   key,
			EntryValue: encodeData(data),
		})
	if err != nil {
		return errors.WithMessage(err, "kvstore put error")
	}
	return nil
}

// Delete implements the autocert.Cache interface.
func (s *certStoreBackedByKVStore) Delete(ctx context.Context, key string) error {
	_, err := s.kbfsConfig.KeybaseService().GetKVStoreClient().DelKVEntry(ctx, keybase1.DelKVEntryArg{
		Namespace: certKVStoreNamespace,
		EntryKey:  key,
	})
	if err != nil {
		return errors.WithMessage(err, "kvstore del error")
	}
	return nil
}
