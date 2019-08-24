// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type PGPPullPrivate struct {
	arg keybase1.PGPPullPrivateArg
}

func (e *PGPPullPrivate) Name() string {
	return "PGPPullPrivate"
}

func (e *PGPPullPrivate) Prereqs() Prereqs {
	return Prereqs{}
}

func (e *PGPPullPrivate) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

func (e *PGPPullPrivate) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func NewPGPPullPrivate(arg keybase1.PGPPullPrivateArg) *PGPPullPrivate {
	return &PGPPullPrivate{arg}
}

func (e *PGPPullPrivate) read(m libkb.MetaContext, fs *keybase1.SimpleFSClient, filepath string) (armored string, err error) {
	opid, err := fs.SimpleFSMakeOpid(m.Ctx())
	if err != nil {
		return "", err
	}
	err = fs.SimpleFSOpen(m.Ctx(), keybase1.SimpleFSOpenArg{
		OpID:  opid,
		Dest:  keybase1.NewPathWithKbfsPath(filepath),
		Flags: keybase1.OpenFlags_READ | keybase1.OpenFlags_EXISTING,
	})
	if err != nil {
		return "", err
	}
	defer fs.SimpleFSClose(m.Ctx(), opid)
	var offset int64
	bufsize := 64 * 1024
	var data []byte
	for {
		m.Debug("SimpleFS: Reading at %d", offset)

		content, err := fs.SimpleFSRead(m.Ctx(), keybase1.SimpleFSReadArg{
			OpID:   opid,
			Offset: offset,
			Size:   bufsize,
		})
		if err != nil {
			return "", err
		}
		m.Debug("SimpleFS: Read %d", len(content.Data))

		if len(content.Data) > 0 {
			offset += int64(len(content.Data))
			data = append(data, content.Data...)
		} else {
			break
		}
	}
	return string(data), nil
}

func (e *PGPPullPrivate) pull(m libkb.MetaContext, fp libkb.PGPFingerprint, tty string, fs *keybase1.SimpleFSClient) error {

	username := m.CurrentUsername()
	if username.IsNil() {
		return libkb.NewLoginRequiredError("no username found")
	}

	filepath := "/private/" + username.String() + "/.keys/pgp/" + fp.String() + ".asc"

	armored, err := e.read(m, fs, filepath)
	if err != nil {
		return err
	}

	err = m.G().GetGpgClient().ExportKeyArmored(armored)
	if err != nil {
		return err
	}
	return nil
}

func (e *PGPPullPrivate) Run(m libkb.MetaContext) (err error) {

	defer m.Trace("PGPPullPrivate#Run", func() error { return err })()

	tty, err := m.UIs().GPGUI.GetTTY(m.Ctx())
	if err != nil {
		return err
	}

	fingerprints, err := getPrivateFingerprints(m, e.arg.Fingerprints)
	if err != nil {
		return err
	}
	if len(fingerprints) == 0 {
		return errors.New("no PGP keys provided")
	}

	fs, err := simpleFSClient(m)
	if err != nil {
		return err
	}

	for _, fp := range fingerprints {
		err = e.pull(m, fp, tty, fs)
		if err != nil {
			return err
		}
	}

	return nil
}
