package ephemeral

import (
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"golang.org/x/crypto/nacl/secretbox"
)

const deviceEKPrefix = "device-ephemeral-key"

type boxedData struct {
	V int
	N [24]byte
	E []byte
}

func encode(input interface{}) ([]byte, error) {
	mh := codec.MsgpackHandle{WriteExt: true}
	var data []byte
	enc := codec.NewEncoderBytes(&data, &mh)
	if err := enc.Encode(input); err != nil {
		return nil, err
	}
	return data, nil
}

func decode(data []byte, res interface{}) error {
	mh := codec.MsgpackHandle{WriteExt: true}
	dec := codec.NewDecoderBytes(data, &mh)
	err := dec.Decode(res)
	return err
}

// ***
// If we change this, make sure to update the key derivation reason for all callers of DeviceEKStorage!
// ***
const cryptoVersion = 1

type DeviceEKStorage struct {
	libkb.Contextified
	sync.Mutex
	keys        map[keybase1.EkGeneration]keybase1.DeviceEk
	indexOnce   *sync.Once
	storagePath string
}

func NewDeviceEKStorage(g *libkb.GlobalContext) (keyring *DeviceEKStorage) {
	username := g.Env.GetUsername().String()
	storagePath := filepath.Join(g.Env.GetDataDir(), "device-eks", username)
	return &DeviceEKStorage{
		Contextified: libkb.NewContextified(g),
		storagePath:  storagePath,
		keys:         make(map[keybase1.EkGeneration]keybase1.DeviceEk),
		indexOnce:    new(sync.Once),
	}
}

func (s *DeviceEKStorage) filepath(generation keybase1.EkGeneration) string {
	filename := fmt.Sprintf("%s-%d.ek", deviceEKPrefix, generation)
	return filepath.Join(s.storagePath, filename)
}

func (s *DeviceEKStorage) Get(ctx context.Context, generation keybase1.EkGeneration) (deviceEK keybase1.DeviceEk, err error) {
	s.Lock()
	defer s.Unlock()
	return s.get(ctx, generation)
}

func (s *DeviceEKStorage) get(ctx context.Context, generation keybase1.EkGeneration) (deviceEK keybase1.DeviceEk, err error) {
	deviceEK, ok := s.keys[generation]
	if ok {
		return deviceEK, nil
	}

	filepath := s.filepath(generation)
	data, err := ioutil.ReadFile(filepath)
	if err != nil {
		return deviceEK, err
	}

	deviceEK, err = s.unbox(ctx, data)
	if err != nil {
		return deviceEK, err
	}

	// cache the result
	s.keys[generation] = deviceEK
	return deviceEK, nil
}

func (s *DeviceEKStorage) unbox(ctx context.Context, data []byte) (deviceEK keybase1.DeviceEk, err error) {
	// Decode encrypted box
	var boxed boxedData
	if err := decode(data, &boxed); err != nil {
		return deviceEK, err
	}
	if boxed.V > cryptoVersion {
		return deviceEK, fmt.Errorf("bad crypto version: %d current: %d", boxed.V,
			cryptoVersion)
	}
	enckey, err := getLocalStorageSecretBoxKey(ctx, s.G())
	if err != nil {
		return deviceEK, err
	}
	pt, ok := secretbox.Open(nil, boxed.E, &boxed.N, &enckey)
	if !ok {
		return deviceEK, fmt.Errorf("failed to unbox item")
	}

	if err = decode(pt, deviceEK); err != nil {
		return deviceEK, err
	}

	return deviceEK, nil
}

func (s *DeviceEKStorage) Put(ctx context.Context, generation keybase1.EkGeneration, deviceEK keybase1.DeviceEk) (err error) {
	s.Lock()
	defer s.Unlock()

	data, err := s.box(ctx, deviceEK)
	if err != nil {
		return err
	}
	err = s.write(generation, data)
	if err != nil {
		return err
	}

	// cache the result
	s.keys[generation] = deviceEK
	return nil
}

func (s *DeviceEKStorage) box(ctx context.Context, deviceEK keybase1.DeviceEk) (data []byte, err error) {
	data, err = encode(deviceEK)
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
	return encode(boxed)
}

func (s *DeviceEKStorage) write(generation keybase1.EkGeneration, data []byte) (err error) {
	filepath := s.filepath(generation)

	if err := os.MkdirAll(s.storagePath, libkb.PermDir); err != nil {
		return err
	}
	tmp, err := ioutil.TempFile(s.storagePath, fmt.Sprintf("%s-%d", deviceEKPrefix, generation))
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

	// remove the secret if it already exsists
	s.delete(generation)

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

func (s *DeviceEKStorage) Delete(generation keybase1.EkGeneration) error {
	s.Lock()
	defer s.Unlock()
	return s.delete(generation)
}

func (s *DeviceEKStorage) delete(generation keybase1.EkGeneration) error {
	// clear the cache
	delete(s.keys, generation)

	filepath := s.filepath(generation)
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

func (s *DeviceEKStorage) index(ctx context.Context) (err error) {
	s.indexOnce.Do(func() {
		files, err := filepath.Glob(filepath.Join(s.storagePath, "*.ek"))
		if err != nil {
			return
		}

		for _, file := range files {
			if strings.HasPrefix(file, deviceEKPrefix) {
				parts := strings.Split(file, deviceEKPrefix)
				g, err := strconv.ParseUint(parts[1], 10, 64)
				if err != nil {
					return
				}
				generation := keybase1.EkGeneration(g)
				deviceEK, err := s.Get(ctx, generation)
				if err != nil {
					return
				}
				s.keys[generation] = deviceEK
			}
		}
	})
	return err
}

func (s *DeviceEKStorage) GetAll(ctx context.Context) (deviceEKs map[keybase1.EkGeneration]keybase1.DeviceEk, err error) {
	s.Lock()
	defer s.Unlock()

	err = s.index(ctx)
	return s.keys, err
}

func (s *DeviceEKStorage) MaxGeneration(ctx context.Context) (maxGeneration keybase1.EkGeneration) {
	s.Lock()
	defer s.Unlock()

	err := s.index(ctx)
	if err != nil {
		return maxGeneration
	}
	for generation := range s.keys {
		if generation > maxGeneration {
			maxGeneration = generation
		}
	}
	return maxGeneration
}

func getLocalStorageSecretBoxKey(ctx context.Context, g *libkb.GlobalContext) (fkey [32]byte, err error) {
	// Get secret device key
	encKey, err := engine.GetMySecretKey(ctx, g, getLameSecretUI, libkb.DeviceEncryptionKeyType,
		"encrypt ephemeral key storage")
	if err != nil {
		return fkey, err
	}
	kp, ok := encKey.(libkb.NaclDHKeyPair)
	if !ok || kp.Private == nil {
		return fkey, libkb.KeyCannotDecryptError{}
	}

	// Derive symmetric key from device key
	skey, err := encKey.SecretSymmetricKey(libkb.EncryptionReasonDeviceEKLocalStorage)
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
