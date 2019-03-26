package erasablekv

import (
	"bytes"
	"crypto/sha256"
	"fmt"
	"io/ioutil"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/nacl/secretbox"
)

type UnboxError struct {
	inner error
}

func NewUnboxError(inner error) UnboxError {
	return UnboxError{inner: inner}
}

func (e UnboxError) Error() string {
	return fmt.Sprintf("ErasableKVStore UnboxError: %v", e.inner.Error())
}

type boxedData struct {
	V int
	N [libkb.NaclDHNonceSize]byte
	E []byte
	H []byte // sha256 has of noise used for encryption
}

// ***
// If we change this, make sure to update the key derivation reason for all
// callers of ErasableKVStore!
// ***
const cryptoVersion = 1
const noiseSuffix = ".ns"
const storageSubDir = "eraseablekvstore"

func getStorageDir(mctx libkb.MetaContext, subDir string) string {
	base := mctx.G().Env.GetDataDir()
	// check for iOS
	if runtime.GOOS == "darwin" && mctx.G().GetAppType() == libkb.MobileAppType {
		base = mctx.G().Env.GetConfigDir()
	}
	return filepath.Join(base, storageSubDir, subDir)
}

type ErasableKVStore interface {
	Put(mctx libkb.MetaContext, key string, val interface{}) error
	Get(mctx libkb.MetaContext, key string, val interface{}) error
	Erase(mctx libkb.MetaContext, key string) error
	AllKeys(mctx libkb.MetaContext, keySuffix string) ([]string, error)
}

// File based erasable kv store. Thread safe.
// We encrypt all data stored here with a mix of the device long term key and a
// large random noise file. We use the random noise file to make it more
// difficult to recover the encrypted data once the noise file is wiped from
// the filesystem as is done for the secret_store_file.
type FileErasableKVStore struct {
	sync.Mutex
	storageDir string
}

var _ ErasableKVStore = (*FileErasableKVStore)(nil)

func NewFileErasableKVStore(mctx libkb.MetaContext, subDir string) *FileErasableKVStore {
	return &FileErasableKVStore{
		storageDir: getStorageDir(mctx, subDir),
	}
}

func (s *FileErasableKVStore) filepath(key string) string {
	return filepath.Join(s.storageDir, url.QueryEscape(key))
}

func (s *FileErasableKVStore) noiseKey(key string) string {
	return fmt.Sprintf("%s%s", url.QueryEscape(key), noiseSuffix)
}

func (s *FileErasableKVStore) getEncryptionKey(mctx libkb.MetaContext, noiseBytes libkb.NoiseBytes) (fkey [32]byte, err error) {
	enckey, err := getLocalStorageSecretBoxKey(mctx)
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

func (s *FileErasableKVStore) unbox(mctx libkb.MetaContext, data []byte, noiseBytes libkb.NoiseBytes, val interface{}) (err error) {
	defer mctx.TraceTimed("FileErasableKVStore#unbox", func() error { return err })()
	// Decode encrypted box
	var boxed boxedData
	if err := libkb.MPackDecode(data, &boxed); err != nil {
		return NewUnboxError(err)
	}
	if boxed.V > cryptoVersion {
		return NewUnboxError(fmt.Errorf("unexpected crypto version: %d current: %d", boxed.V, cryptoVersion))
	}
	enckey, err := s.getEncryptionKey(mctx, noiseBytes)
	if err != nil {
		return err
	}
	pt, ok := secretbox.Open(nil, boxed.E, &boxed.N, &enckey)
	if !ok {
		// If this fails, let's see if our noise file was corrupted somehow.
		originalNoise := boxed.H
		currentNoise := s.noiseHash(noiseBytes[:])
		return NewUnboxError(fmt.Errorf("secretbox.Open failure. Stored noise hash: %x, current noise hash: %x, equal: %v", originalNoise, currentNoise, bytes.Equal(originalNoise, currentNoise)))
	}

	err = libkb.MPackDecode(pt, val)
	if err != nil {
		return NewUnboxError(err)
	}
	return nil
}

func (s *FileErasableKVStore) box(mctx libkb.MetaContext, val interface{},
	noiseBytes libkb.NoiseBytes) (data []byte, err error) {
	defer mctx.TraceTimed("FileErasableKVStore#box", func() error { return err })()
	data, err = libkb.MPackEncode(val)
	if err != nil {
		return data, err
	}

	enckey, err := s.getEncryptionKey(mctx, noiseBytes)
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
		H: s.noiseHash(noiseBytes[:]),
	}

	// Encode encrypted box
	return libkb.MPackEncode(boxed)
}

func (s *FileErasableKVStore) Put(mctx libkb.MetaContext, key string, val interface{}) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("FileErasableKVStore#Put: %v", key), func() error { return err })()
	s.Lock()
	defer s.Unlock()

	noiseBytes, err := libkb.MakeNoise()
	data, err := s.box(mctx, val, noiseBytes)
	if err != nil {
		return err
	}
	if err = s.write(mctx, key, data); err != nil {
		return err
	}
	noiseKey := s.noiseKey(key)
	return s.write(mctx, noiseKey, noiseBytes[:])
}

func (s *FileErasableKVStore) write(mctx libkb.MetaContext, key string, data []byte) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("FileErasableKVStore#write: %v", key), func() error { return err })()
	filepath := s.filepath(key)
	if err := libkb.MakeParentDirs(mctx.G().Log, filepath); err != nil {
		return err
	}

	tmp, err := ioutil.TempFile(s.storageDir, key)
	if err != nil {
		return err
	}
	// remove the temp file if it still exists at the end of this function
	defer libkb.ShredFile(tmp.Name())

	if SetDisableBackup(mctx, tmp.Name()); err != nil {
		return err
	}

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
	s.erase(mctx, key)

	if err := os.Rename(tmp.Name(), filepath); err != nil {
		return err
	}
	if SetDisableBackup(mctx, filepath); err != nil {
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

func (s *FileErasableKVStore) Get(mctx libkb.MetaContext, key string, val interface{}) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("FileErasableKVStore#Get: %v", key), func() error { return err })()
	s.Lock()
	defer s.Unlock()
	return s.get(mctx, key, val)
}

func (s *FileErasableKVStore) get(mctx libkb.MetaContext, key string, val interface{}) (err error) {
	noiseKey := s.noiseKey(key)
	noise, err := s.read(mctx, noiseKey)
	if err != nil {
		return NewUnboxError(err)
	}
	var noiseBytes libkb.NoiseBytes
	copy(noiseBytes[:], noise)

	data, err := s.read(mctx, key)
	if err != nil {
		return NewUnboxError(err)
	}

	return s.unbox(mctx, data, noiseBytes, val)
}

func (s *FileErasableKVStore) read(mctx libkb.MetaContext, key string) (data []byte, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("FileErasableKVStore#read: %v", key), func() error { return err })()
	filepath := s.filepath(key)
	return ioutil.ReadFile(filepath)
}

func (s *FileErasableKVStore) noiseHash(noiseBytes []byte) []byte {
	h := sha256.New()
	h.Write(noiseBytes[:])
	return h.Sum(nil)
}

func (s *FileErasableKVStore) Erase(mctx libkb.MetaContext, key string) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("FileErasableKVStore#Erase: %s", key), func() error { return err })()
	s.Lock()
	defer s.Unlock()
	noiseKey := s.noiseKey(key)
	epick := libkb.FirstErrorPicker{}
	epick.Push(s.erase(mctx, noiseKey))
	epick.Push(s.erase(mctx, key))
	err = epick.Error()
	return err
}

func (s *FileErasableKVStore) erase(mctx libkb.MetaContext, key string) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("FileErasableKVStore#erase: %s", key), func() error { return err })()
	filepath := s.filepath(key)
	if exists, err := libkb.FileExists(filepath); err != nil {
		return err
	} else if exists {
		if err := libkb.ShredFile(filepath); err != nil {
			return err
		}
	}
	return nil
}

func (s *FileErasableKVStore) AllKeys(mctx libkb.MetaContext, keySuffix string) (keys []string, err error) {
	defer mctx.TraceTimed("FileErasableKVStore#AllKeys", func() error { return err })()
	s.Lock()
	defer s.Unlock()
	if err := os.MkdirAll(s.storageDir, libkb.PermDir); err != nil {
		return nil, err
	}
	files, err := ioutil.ReadDir(s.storageDir)
	if err != nil {
		return nil, err
	}
	tmpFileExp, err := regexp.Compile(fmt.Sprintf(`(%s|%s)[\d]+`, keySuffix, noiseSuffix))
	if err != nil {
		return nil, err
	}
	for _, file := range files {
		filename := filepath.Base(file.Name())
		if tmpFileExp.MatchString(filename) {
			if err := libkb.ShredFile(s.filepath(filename)); err != nil {
				mctx.Debug("FileErasableKVStore#AllKeys: unable to remove temp file: %v, %v", file.Name(), err)
			}
			continue
		}
		if strings.HasSuffix(filename, noiseSuffix) {
			continue
		}
		key, err := url.QueryUnescape(filename)
		if err != nil {
			return nil, err
		}
		keys = append(keys, key)
	}
	return keys, nil
}

func getLocalStorageSecretBoxKey(mctx libkb.MetaContext) (fkey [32]byte, err error) {
	// Get secret device key
	encKey, err := mctx.ActiveDevice().EncryptionKey()
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
