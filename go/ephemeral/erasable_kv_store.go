package ephemeral

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/crypto/nacl/secretbox"
	"golang.org/x/net/context"
)

type boxedData struct {
	V int
	N [24]byte
	E []byte
}

// ***
// If we change this, make sure to update the key derivation reason for all callers of ErasableKVStore!
// ***
const cryptoVersion = 1

type ErasableKVStore interface {
	Put(ctx context.Context, key string, val interface{}) error
	Get(ctx context.Context, key string) (interface{}, error)
	Erase(key string) error
	AllKeys() ([]string, error)
	EraseAll() error
}

// File based erasable kv store. Thread safe.
type FileErasableKVStore struct {
	libkb.Contextified
	sync.Mutex
	storagePath string
}

func NewFileErasableKVStore(g *libkb.GlobalContext, storagePath string) *FileErasableKVStore {
	return &FileErasableKVStore{
		Contextified: libkb.NewContextified(g),
		storagePath:  storagePath,
	}
}

func (s *FileErasableKVStore) filepath(key string) string {
	return filepath.Join(s.storagePath, key)
}

func (s *FileErasableKVStore) unbox(ctx context.Context, data []byte) (val interface{}, err error) {
	// Decode encrypted box
	var boxed boxedData
	if err := libkb.MPackDecode(data, &boxed); err != nil {
		return val, err
	}
	if boxed.V > cryptoVersion {
		return val, fmt.Errorf("bad crypto version: %d current: %d", boxed.V,
			cryptoVersion)
	}
	enckey, err := getLocalStorageSecretBoxKey(ctx, s.G())
	if err != nil {
		return val, err
	}
	pt, ok := secretbox.Open(nil, boxed.E, &boxed.N, &enckey)
	if !ok {
		return val, fmt.Errorf("failed to unbox item")
	}

	if err = libkb.MPackDecode(pt, val); err != nil {
		return val, err
	}

	return val, nil
}

func (s *FileErasableKVStore) box(ctx context.Context, val interface{}) (data []byte, err error) {
	data, err = libkb.MPackEncode(val)
	if err != nil {
		return data, err
	}
	enckey, err := getLocalStorageSecretBoxKey(ctx, s.G())
	if err != nil {
		return data, err
	}
	var nonce []byte
	nonce, err = libkb.RandBytes(24)
	if err != nil {
		return data, err
	}
	var fnonce [24]byte
	copy(fnonce[:], nonce)
	sealed := secretbox.Seal(nil, data, &fnonce, &enckey)
	boxed := boxedData{
		V: cryptoVersion,
		E: sealed,
		N: fnonce,
	}

	// Encode encrypted box
	return libkb.MPackEncode(boxed)
}

func (s *FileErasableKVStore) Put(ctx context.Context, key string, val interface{}) error {
	s.Lock()
	defer s.Unlock()

	data, err := s.box(ctx, val)
	if err != nil {
		return err
	}

	filepath := s.filepath(key)
	if err := os.MkdirAll(s.storagePath, libkb.PermDir); err != nil {
		return err
	}

	tmp, err := ioutil.TempFile(s.storagePath, key)
	if err != nil {
		return err
	}
	// remove the temp file if it still exists at the end of this function
	defer libkb.ShredFile(tmp.Name())

	if runtime.GOOS != "windows" {
		// os.Fchmod not supported on windows
		if err := tmp.Chmod(libkb.PermFile); err != nil {
			return err
		}
	}
	if _, err := tmp.Write(data); err != nil {
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}

	// remove the data if it already exists
	s.erase(key)

	if err := os.Rename(tmp.Name(), filepath); err != nil {
		return err
	}

	if runtime.GOOS != "windows" {
		// os.Fchmod not supported on windows
		if err := os.Chmod(filepath, libkb.PermFile); err != nil {
			return err
		}
	}
	return nil
}

func (s *FileErasableKVStore) Get(ctx context.Context, key string) (interface{}, error) {
	s.Lock()
	defer s.Unlock()
	return s.get(ctx, key)
}

func (s *FileErasableKVStore) get(ctx context.Context, key string) (val interface{}, err error) {
	filepath := s.filepath(key)
	data, err := ioutil.ReadFile(filepath)
	val, err = s.unbox(ctx, data)
	if err != nil {
		return val, err
	}

	return val, err
}

func (s *FileErasableKVStore) Erase(key string) error {
	s.Lock()
	defer s.Unlock()
	return s.erase(key)
}

func (s *FileErasableKVStore) erase(key string) error {
	filepath := s.filepath(key)
	exists, err := libkb.FileExists(filepath)
	if err != nil {
		return err
	}
	if exists {
		err = libkb.ShredFile(filepath)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *FileErasableKVStore) AllKeys() ([]string, error) {
	s.Lock()
	defer s.Unlock()
	return s.allKeys()
}

func (s *FileErasableKVStore) allKeys() (keys []string, err error) {
	files, err := filepath.Glob(s.storagePath)
	if err != nil {
		return keys, err
	}
	for _, file := range files {
		parts := strings.Split(file, s.storagePath)
		keys = append(keys, parts[1])
	}
	return keys, nil
}

func (s *FileErasableKVStore) EraseAll() error {
	s.Lock()
	defer s.Unlock()
	keys, err := s.allKeys()
	if err != nil {
		return err
	}
	for _, key := range keys {
		err := s.erase(key)
		if err != nil {
			return err
		}
	}
	return nil
}

func getLocalStorageSecretBoxKey(ctx context.Context, g *libkb.GlobalContext) (fkey [32]byte, err error) {
	// Get secret device key
	encKey, err := engine.GetMySecretKey(ctx, g, getLameSecretUI, libkb.DeviceEncryptionKeyType,
		"encrypt erasable kv store")
	if err != nil {
		return fkey, err
	}
	kp, ok := encKey.(libkb.NaclDHKeyPair)
	if !ok || kp.Private == nil {
		return fkey, libkb.KeyCannotDecryptError{}
	}

	// Derive symmetric key from device key
	skey, err := encKey.SecretSymmetricKey(libkb.EncryptionReasonErasableKVLocakStoreage)
	if err != nil {
		return fkey, err
	}

	copy(fkey[:], skey[:])
	return fkey, nil
}

type LameSecretUI struct{}

func (d LameSecretUI) GetPassphrase(pinentry keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	return keybase1.GetPassphraseRes{}, fmt.Errorf("no secret UI available")
}

var getLameSecretUI = func() libkb.SecretUI { return LameSecretUI{} }
