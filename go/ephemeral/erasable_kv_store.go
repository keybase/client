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
	N [libkb.NaclDHNonceSize]byte
	E []byte
}

// ***
// If we change this, make sure to update the key derivation reason for all callers of ErasableKVStore!
// ***
const cryptoVersion = 1
const noiseSuffix = ".ns"

type ErasableKVStore interface {
	Put(ctx context.Context, key string, val interface{}) error
	Get(ctx context.Context, key string) (interface{}, error)
	Erase(ctx context.Context, key string) error
	AllKeys(ctx context.Context) ([]string, error)
}

// File based erasable kv store. Thread safe.
// We encrypt all data stored here with a mix of the device long term key and a
// large random noise file. We use the random noise file to make it more
// difficult to recover the encrypted data once the noise file is wiped from
// the filesystem as is done for the secret_store_file.
type FileErasableKVStore struct {
	libkb.Contextified
	sync.Mutex
	storagePath string
}

var _ ErasableKVStore = (*FileErasableKVStore)(nil)

func NewFileErasableKVStore(g *libkb.GlobalContext) *FileErasableKVStore {
	return &FileErasableKVStore{
		Contextified: libkb.NewContextified(g),
		storagePath:  g.Env.GetDataDir(),
	}
}

func (s *FileErasableKVStore) filepath(key string) string {
	return filepath.Join(s.storagePath, key)
}

func (s *FileErasableKVStore) noiseKey(key string) string {
	return fmt.Sprintf("%s%s", key, noiseSuffix)
}

func (s *FileErasableKVStore) getEncryptionKey(ctx context.Context, noiseBytes libkb.NoiseBytes) (fkey [32]byte, err error) {
	enckey, err := getLocalStorageSecretBoxKey(ctx, s.G())
	if err != nil {
		return fkey, err
	}

	xor, err := libkb.NoiseXOR(enckey, noiseBytes)
	if err != nil {
		return fkey, err
	}
	copy(fkey[:], xor)
	return fkey, nil
}

func (s *FileErasableKVStore) unbox(ctx context.Context, data []byte, noiseBytes libkb.NoiseBytes) (val interface{}, err error) {
	defer s.G().CTrace(ctx, "FileErasableKVStore#unbox", func() error { return err })()
	// Decode encrypted box
	var boxed boxedData
	if err := libkb.MPackDecode(data, &boxed); err != nil {
		return val, err
	}
	if boxed.V > cryptoVersion {
		return val, fmt.Errorf("unexpected crypto version: %d current: %d", boxed.V,
			cryptoVersion)
	}
	enckey, err := s.getEncryptionKey(ctx, noiseBytes)
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

func (s *FileErasableKVStore) box(ctx context.Context, val interface{}, noiseBytes libkb.NoiseBytes) (data []byte, err error) {
	defer s.G().CTrace(ctx, "FileErasableKVStore#box", func() error { return err })()
	data, err = libkb.MPackEncode(val)
	if err != nil {
		return data, err
	}

	enckey, err := s.getEncryptionKey(ctx, noiseBytes)
	if err != nil {
		return data, err
	}
	var nonce []byte
	nonce, err = libkb.RandBytes(libkb.NaclDHNonceSize)
	if err != nil {
		return data, err
	}
	var fnonce [libkb.NaclDHNonceSize]byte
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

func (s *FileErasableKVStore) Put(ctx context.Context, key string, val interface{}) (err error) {
	defer s.G().CTrace(ctx, "FileErasableKVStore#Put", func() error { return err })()
	s.Lock()
	defer s.Unlock()

	noiseBytes, err := libkb.MakeNoise()
	data, err := s.box(ctx, val, noiseBytes)
	if err != nil {
		return err
	}
	err = s.write(ctx, key, data)
	if err != nil {
		return err
	}
	noiseKey := s.noiseKey(key)
	return s.write(ctx, noiseKey, noiseBytes[:])
}

func (s *FileErasableKVStore) write(ctx context.Context, key string, data []byte) (err error) {
	defer s.G().CTrace(ctx, "FileErasableKVStore#write", func() error { return err })()
	filepath := s.filepath(key)
	if err := libkb.MakeParentDirs(s.G().Log, filepath); err != nil {
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

	// NOTE: Pre-existing maybe-bug: I think this step breaks atomicity. It's
	// possible that the rename below fails, in which case we'll have already
	// destroyed the previous value.

	// On Unix we could solve this by hard linking the old file to a new tmp
	// location, and then shredding it after the rename. On Windows, I think
	// we'd need to somehow call the ReplaceFile Win32 function (which Go
	// doesn't expose anywhere as far as I know, so this would require CGO) to
	// take advantage of its lpBackupFileName param.
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

func (s *FileErasableKVStore) Get(ctx context.Context, key string) (value interface{}, err error) {
	defer s.G().CTrace(ctx, "FileErasableKVStore#Get", func() error { return err })()
	s.Lock()
	defer s.Unlock()
	return s.get(ctx, key)
}

func (s *FileErasableKVStore) get(ctx context.Context, key string) (val interface{}, err error) {
	noiseKey := s.noiseKey(key)
	noise, err := s.read(ctx, noiseKey)
	if err != nil {
		return val, err
	}
	var noiseBytes libkb.NoiseBytes
	copy(noiseBytes[:], noise)

	data, err := s.read(ctx, key)
	if err != nil {
		return val, err
	}

	val, err = s.unbox(ctx, data, noiseBytes)
	if err != nil {
		return val, err
	}

	return val, err
}

func (s *FileErasableKVStore) read(ctx context.Context, key string) (data []byte, err error) {
	defer s.G().CTrace(ctx, "FileErasableKVStore#read", func() error { return err })()
	filepath := s.filepath(key)
	return ioutil.ReadFile(filepath)
}

func (s *FileErasableKVStore) Erase(ctx context.Context, key string) (err error) {
	defer s.G().CTrace(ctx, "FileErasableKVStore#Erase", func() error { return err })()
	s.Lock()
	defer s.Unlock()
	noiseKey := s.noiseKey(key)
	epick := libkb.FirstErrorPicker{}
	epick.Push(s.erase(noiseKey))
	epick.Push(s.erase(key))
	return epick.Error()
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

func (s *FileErasableKVStore) AllKeys(ctx context.Context) (keys []string, err error) {
	defer s.G().CTrace(ctx, "FileErasableKVStore#AllKeys", func() error { return err })()
	s.Lock()
	defer s.Unlock()
	files, err := filepath.Glob(s.storagePath)
	if err != nil {
		return keys, err
	}
	for _, file := range files {
		if strings.HasSuffix(file, noiseSuffix) {
			continue
		}
		parts := strings.Split(file, s.storagePath)
		keys = append(keys, parts[1])
	}
	return keys, nil
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
	skey, err := encKey.SecretSymmetricKey(libkb.EncryptionReasonErasableKVLocalStorage)
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
