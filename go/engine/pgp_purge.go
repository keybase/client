// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// PGPPurge is an engine.
type PGPPurge struct {
	libkb.Contextified
	arg       keybase1.PGPPurgeArg
	me        *libkb.User
	filenames []string
}

// NewPGPPurge creates a PGPPurge engine.
func NewPGPPurge(g *libkb.GlobalContext, arg keybase1.PGPPurgeArg) *PGPPurge {
	return &PGPPurge{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

// Name is the unique engine name.
func (e *PGPPurge) Name() string {
	return "PGPPurge"
}

// GetPrereqs returns the engine prereqs.
func (e *PGPPurge) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

// RequiredUIs returns the required UIs.
func (e *PGPPurge) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPPurge) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&SaltpackEncrypt{newKeyfinderHook: NewSaltpackUserKeyfinderAsInterface},
	}
}

// Run starts the engine.
func (e *PGPPurge) Run(m libkb.MetaContext) error {
	me, err := libkb.LoadMe(libkb.NewLoadUserPubOptionalArg(e.G()))
	if err != nil {
		return err
	}
	e.me = me

	// get all PGP blocks in keyring
	ring, err := m.ActiveDevice().Keyring(m)
	if err != nil {
		return err
	}
	blocks, err := ring.AllPGPBlocks()
	if err != nil {
		return err
	}

	// export each one to a file
	if err := e.exportBlocks(m, blocks); err != nil {
		return err
	}

	if e.arg.DoPurge {
		// if purge flag set, remove all PGP blocks from keyring and save it
		err = ring.RemoveAllPGPBlocks()
		if err != nil {
			return err
		}
		err = ring.Save()
		if err != nil {
			return err
		}
	}

	return nil
}

// KeyFiles returns the filenames of the exported keys.
func (e *PGPPurge) KeyFiles() []string {
	return e.filenames
}

func (e *PGPPurge) exportBlocks(m libkb.MetaContext, blocks []*libkb.SKB) error {
	sstore := libkb.NewSecretStore(e.G(), e.me.GetNormalizedName())
	promptArg := libkb.SecretKeyPromptArg{
		SecretUI: m.UIs().SecretUI,
		Reason:   "export private PGP key",
	}

	for i, block := range blocks {
		block.SetUID(e.me.GetUID())
		key, err := block.PromptAndUnlock(m, promptArg, sstore, e.me)
		if err != nil {
			return err
		}

		pgpKey, ok := key.(*libkb.PGPKeyBundle)
		if !ok {
			return fmt.Errorf("unlocked key incorrect type")
		}

		name := fmt.Sprintf("kb-%04d-%s.saltpack", i, pgpKey.GetFingerprint())
		path := filepath.Join(e.G().Env.GetConfigDir(), name)
		if err := e.encryptToFile(m, pgpKey, path); err != nil {
			return err
		}

		e.filenames = append(e.filenames, path)
	}

	return nil
}

func (e *PGPPurge) isPaperEncryptionKey(key *keybase1.PublicKeyV2NaCl, deviceKeys *(map[keybase1.KID]keybase1.PublicKeyV2NaCl)) bool {
	return libkb.KIDIsDeviceEncrypt(key.Base.Kid) && key.Parent != nil && (*deviceKeys)[*key.Parent].DeviceType == libkb.DeviceTypePaper
}

func (e *PGPPurge) encryptToFile(m libkb.MetaContext, bundle *libkb.PGPKeyBundle, filename string) error {
	out, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer out.Close()

	var buf bytes.Buffer
	if err := bundle.EncodeToStream(libkb.NopWriteCloser{W: &buf}, true); err != nil {
		return err
	}

	// encrypt
	arg := &SaltpackEncryptArg{
		Source: &buf,
		Sink:   out,
		Opts: keybase1.SaltpackEncryptOptions{
			Recipients:       []string{m.CurrentUsername().String()},
			AuthenticityType: keybase1.AuthenticityType_SIGNED,
			UsePaperKeys:     true,
			UseDeviceKeys:    true,
			UseEntityKeys:    true,
		},
	}
	eng := NewSaltpackEncrypt(arg, NewSaltpackUserKeyfinderAsInterface)
	return RunEngine2(m, eng)
}
