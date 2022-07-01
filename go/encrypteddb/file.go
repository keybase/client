package encrypteddb

import (
	"io/ioutil"
	"os"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

type EncryptedFile struct {
	libkb.Contextified

	getSecretBoxKey KeyFn
	path            string
}

func NewFile(g *libkb.GlobalContext, path string, getSecretBoxKey KeyFn) *EncryptedFile {
	return &EncryptedFile{
		Contextified:    libkb.NewContextified(g),
		path:            path,
		getSecretBoxKey: getSecretBoxKey,
	}
}

func (f *EncryptedFile) Get(ctx context.Context, res interface{}) error {
	enc, err := ioutil.ReadFile(f.path)
	if err != nil {
		return err
	}
	if err = DecodeBox(ctx, enc, f.getSecretBoxKey, res); err != nil {
		return err
	}
	return nil
}

func (f *EncryptedFile) Put(ctx context.Context, data interface{}) error {
	b, err := EncodeBox(ctx, data, f.getSecretBoxKey)
	if err != nil {
		return err
	}
	return ioutil.WriteFile(f.path, b, 0644)
}

func (f *EncryptedFile) Remove(ctx context.Context) error {
	return os.Remove(f.path)
}
