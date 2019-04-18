package libkb

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

	"golang.org/x/crypto/nacl/secretbox"
)

type UnboxError struct {
	inner error
	info  string
}

func NewUnboxError(inner error) UnboxError {
	return UnboxError{inner: inner}
}

func NewUnboxErrorWithInfo(inner error, info string) UnboxError {
	return UnboxError{inner: inner, info: info}
}

func (e UnboxError) Error() string {
	return fmt.Sprintf("ErasableKVStore UnboxError (info=%s): %v", e.info, e.inner.Error())
}

func (e UnboxError) Info() string {
	return e.info
}

type boxedData struct {
	V int
	N [NaclDHNonceSize]byte
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

func getStorageDir(mctx MetaContext, subDir string) string {
	base := mctx.G().Env.GetDataDir()
	// check for iOS
	if runtime.GOOS == "darwin" && mctx.G().IsMobileAppType() {
		base = mctx.G().Env.GetConfigDir()
	}
	return filepath.Join(base, storageSubDir, subDir)
}

type ErasableKVStore interface {
	Put(mctx MetaContext, key string, val interface{}) error
	Get(mctx MetaContext, key string, val interface{}) error
	Erase(mctx MetaContext, key string) error
	AllKeys(mctx MetaContext, keySuffix string) ([]string, error)
}

type SecretlessErasableKVStore interface {
	Erase(mctx MetaContext, key string) error
	AllKeys(mctx MetaContext, keySuffix string) ([]string, error)
}

type keygenFunc = func(mctx MetaContext, noise NoiseBytes) ([32]byte, error)

// File based erasable kv store. Thread safe.
// We encrypt all data stored here with a mix of the device long term key and a
// large random noise file. We use the random noise file to make it more
// difficult to recover the encrypted data once the noise file is wiped from
// the filesystem as is done for the secret_store_file.
type FileErasableKVStore struct {
	sync.Mutex
	storageDir string
	keygen     keygenFunc
}

var _ ErasableKVStore = (*FileErasableKVStore)(nil)

func NewFileErasableKVStore(mctx MetaContext, subDir string, keygen keygenFunc) *FileErasableKVStore {
	return &FileErasableKVStore{
		storageDir: getStorageDir(mctx, subDir),
		keygen:     keygen,
	}
}

func NewSecretlessFileErasableKVStore(mctx MetaContext, subDir string) SecretlessErasableKVStore {
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

func (s *FileErasableKVStore) unbox(mctx MetaContext, data []byte, noiseBytes NoiseBytes, val interface{}) (err error) {
	defer mctx.TraceTimed("FileErasableKVStore#unbox", func() error { return err })()
	// Decode encrypted box
	var boxed boxedData
	if err := MPackDecode(data, &boxed); err != nil {
		return NewUnboxError(err)
	}
	if boxed.V > cryptoVersion {
		return NewUnboxError(fmt.Errorf("unexpected crypto version: %d current: %d", boxed.V, cryptoVersion))
	}
	enckey, err := s.keygen(mctx, noiseBytes)
	if err != nil {
		return err
	}
	pt, ok := secretbox.Open(nil, boxed.E, &boxed.N, &enckey)
	if !ok {
		// If this fails, let's see if our noise file was corrupted somehow.
		originalNoise := boxed.H
		currentNoise := s.noiseHash(noiseBytes[:])
		eq := bytes.Equal(originalNoise, currentNoise)
		err = fmt.Errorf("secretbox.Open failure. Stored noise hash: %x, current noise hash: %x, equal: %v", originalNoise, currentNoise, eq)
		if eq {
			return NewUnboxErrorWithInfo(err, "noise hashes match")
		}
		return NewUnboxErrorWithInfo(err, "noise hashes do not match")
	}

	err = MPackDecode(pt, val)
	if err != nil {
		return NewUnboxError(err)
	}
	return nil
}

func (s *FileErasableKVStore) box(mctx MetaContext, val interface{},
	noiseBytes NoiseBytes) (data []byte, err error) {
	defer mctx.TraceTimed("FileErasableKVStore#box", func() error { return err })()
	data, err = MPackEncode(val)
	if err != nil {
		return data, err
	}

	enckey, err := s.keygen(mctx, noiseBytes)
	if err != nil {
		return data, err
	}
	var nonce []byte
	nonce, err = RandBytes(NaclDHNonceSize)
	if err != nil {
		return data, err
	}
	var fnonce [NaclDHNonceSize]byte
	copy(fnonce[:], nonce)
	sealed := secretbox.Seal(nil, data, &fnonce, &enckey)
	boxed := boxedData{
		V: cryptoVersion,
		E: sealed,
		N: fnonce,
		H: s.noiseHash(noiseBytes[:]),
	}

	// Encode encrypted box
	return MPackEncode(boxed)
}

func (s *FileErasableKVStore) Put(mctx MetaContext, key string, val interface{}) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("FileErasableKVStore#Put: %v", key), func() error { return err })()
	s.Lock()
	defer s.Unlock()

	noiseBytes, err := MakeNoise()
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

func (s *FileErasableKVStore) write(mctx MetaContext, key string, data []byte) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("FileErasableKVStore#write: %v", key), func() error { return err })()
	filepath := s.filepath(key)
	if err := MakeParentDirs(mctx.G().Log, filepath); err != nil {
		return err
	}

	tmp, err := ioutil.TempFile(s.storageDir, key)
	if err != nil {
		return err
	}
	// remove the temp file if it still exists at the end of this function
	defer ShredFile(tmp.Name())

	if SetDisableBackup(mctx, tmp.Name()); err != nil {
		return err
	}

	if runtime.GOOS != "windows" {
		// os.Fchmod not supported on windows
		if err := tmp.Chmod(PermFile); err != nil {
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
		if err := os.Chmod(filepath, PermFile); err != nil {
			return err
		}
	}
	return nil
}

func (s *FileErasableKVStore) Get(mctx MetaContext, key string, val interface{}) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("FileErasableKVStore#Get: %v", key), func() error { return err })()
	s.Lock()
	defer s.Unlock()
	return s.get(mctx, key, val)
}

func (s *FileErasableKVStore) get(mctx MetaContext, key string, val interface{}) (err error) {
	noiseKey := s.noiseKey(key)
	noise, err := s.read(mctx, noiseKey)
	if err != nil {
		return NewUnboxError(err)
	}
	var noiseBytes NoiseBytes
	copy(noiseBytes[:], noise)

	data, err := s.read(mctx, key)
	if err != nil {
		return NewUnboxError(err)
	}

	return s.unbox(mctx, data, noiseBytes, val)
}

func (s *FileErasableKVStore) read(mctx MetaContext, key string) (data []byte, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("FileErasableKVStore#read: %v", key), func() error { return err })()
	filepath := s.filepath(key)
	return ioutil.ReadFile(filepath)
}

func (s *FileErasableKVStore) noiseHash(noiseBytes []byte) []byte {
	h := sha256.New()
	h.Write(noiseBytes[:])
	return h.Sum(nil)
}

func (s *FileErasableKVStore) Erase(mctx MetaContext, key string) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("FileErasableKVStore#Erase: %s", key), func() error { return err })()
	s.Lock()
	defer s.Unlock()
	noiseKey := s.noiseKey(key)
	epick := FirstErrorPicker{}
	epick.Push(s.erase(mctx, noiseKey))
	epick.Push(s.erase(mctx, key))
	err = epick.Error()
	return err
}

func (s *FileErasableKVStore) erase(mctx MetaContext, key string) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("FileErasableKVStore#erase: %s", key), func() error { return err })()
	filepath := s.filepath(key)
	if exists, err := FileExists(filepath); err != nil {
		return err
	} else if exists {
		if err := ShredFile(filepath); err != nil {
			return err
		}
	}
	return nil
}

func (s *FileErasableKVStore) AllKeys(mctx MetaContext, keySuffix string) (keys []string, err error) {
	defer mctx.TraceTimed("FileErasableKVStore#AllKeys", func() error { return err })()
	s.Lock()
	defer s.Unlock()
	if err := os.MkdirAll(s.storageDir, PermDir); err != nil {
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
			if err := ShredFile(s.filepath(filename)); err != nil {
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
