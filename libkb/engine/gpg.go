package engine

import (
	"fmt"
	"os/exec"

	"github.com/keybase/go/libkb"
	keybase_1 "github.com/keybase/protocol/go"
)

type GPGUI interface {
	keybase_1.GpgUiInterface
}

type GPG struct {
	ui       GPGUI
	secretUI libkb.SecretUI
}

func NewGPG(ui GPGUI, sui libkb.SecretUI) *GPG {
	return &GPG{ui: ui, secretUI: sui}
}

func (g *GPG) WantsGPG() (bool, error) {
	gpg := G.GetGpgClient()
	if _, err := gpg.Configure(); err != nil {
		if err == exec.ErrNotFound {
			return false, nil
		}
		return false, err
	}

	// they have gpg

	res, err := g.ui.WantToAddGPGKey()
	if err != nil {
		return false, err
	}
	return res, nil
}

func (g *GPG) Run() error {
	gpg := G.GetGpgClient()
	if _, err := gpg.Configure(); err != nil {
		return err
	}
	index, err, warns := gpg.Index(true, "")
	if err != nil {
		return err
	}
	warns.Warn()

	var set keybase_1.GPGKeySet
	for _, key := range index.Keys {
		gk := keybase_1.GPGKey{
			Algorithm:  fmt.Sprintf("%d%s", key.Bits, key.AlgoString()),
			KeyID:      key.GetFingerprint().ToKeyId(),
			Expiration: key.ExpirationString(),
			Identities: key.GetEmails(),
		}
		set.Keys = append(set.Keys, gk)
	}

	res, err := g.ui.SelectKey(keybase_1.SelectKeyArg{Keyset: set})
	if err != nil {
		return err
	}
	G.Log.Info("SelectKey result: %+v", res)

	var selected *libkb.GpgPrimaryKey
	for _, key := range index.Keys {
		if key.GetFingerprint().ToKeyId() == res.KeyID {
			selected = key
			break
		}
	}

	if selected == nil {
		return fmt.Errorf("no key selected")
	}

	bundle, err := gpg.ImportKey(true, *(selected.GetFingerprint()))
	if err != nil {
		return fmt.Errorf("ImportKey error: %s", err)
	}

	if err := bundle.Unlock("Import of key into keybase keyring", g.secretUI); err != nil {
		return fmt.Errorf("bundle Unlock error: %s", err)
	}

	G.Log.Info("Bundle unlocked: %s", selected.GetFingerprint().ToKeyId())

	// this seems a little weird to use keygen to post a key, but...
	arg := &libkb.KeyGenArg{
		Pregen:       bundle,
		DoSecretPush: res.DoSecretPush,
		SecretUI:     g.secretUI,
	}
	kg := libkb.NewKeyGen(arg)
	if _, err := kg.Run(); err != nil {
		return err
	}

	G.Log.Info("Key %s imported", selected.GetFingerprint().ToKeyId())

	return nil
}
