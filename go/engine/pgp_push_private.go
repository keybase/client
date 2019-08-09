// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type PGPPushPrivate struct {
	arg keybase1.PGPPushPrivateArg
}

func (e *PGPPushPrivate) Name() string {
	return "PGPPushPrivate"
}

func (e *PGPPushPrivate) Prereqs() Prereqs {
	return Prereqs{}
}

func (e *PGPPushPrivate) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

func (e *PGPPushPrivate) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func NewPGPPushPrivate(arg keybase1.PGPPushPrivateArg) *PGPPushPrivate {
	return &PGPPushPrivate{arg}
}

func getCurrentUserPGPKeys(m libkb.MetaContext) ([]libkb.PGPFingerprint, error) {
	uid := m.CurrentUID()
	if uid.IsNil() {
		return nil, libkb.NewLoginRequiredError("for push/pull of PGP private keys to KBFS")
	}
	upk, _, err := m.G().GetUPAKLoader().LoadV2(libkb.NewLoadUserArgWithMetaContext(m).WithUID(uid))
	if err != nil {
		return nil, err
	}
	var res []libkb.PGPFingerprint
	for _, key := range upk.Current.PGPKeys {
		if key.Base.Revocation != nil {
			continue
		}
		res = append(res, libkb.PGPFingerprint(key.Fingerprint))
	}
	if len(res) == 0 {
		return nil, errors.New("The --all flag only works if you have PGP keys linked to your Keybase account")
	}
	return res, nil
}

func getPrivateFingerprints(m libkb.MetaContext, fps []keybase1.PGPFingerprint) ([]libkb.PGPFingerprint, error) {
	if len(fps) == 0 {
		return getCurrentUserPGPKeys(m)
	}

	var ret []libkb.PGPFingerprint
	for _, fp := range fps {
		ret = append(ret, libkb.ImportPGPFingerprint(fp))

	}
	return ret, nil
}

func simpleFSClient(m libkb.MetaContext) (*keybase1.SimpleFSClient, error) {
	xp := m.G().ConnectionManager.LookupByClientType(keybase1.ClientType_KBFS)
	if xp == nil {
		return nil, libkb.KBFSNotRunningError{}
	}
	return &keybase1.SimpleFSClient{
		Cli: rpc.NewClient(xp, libkb.NewContextifiedErrorUnwrapper(m.G()), nil),
	}, nil
}

func (e *PGPPushPrivate) mkdir(m libkb.MetaContext, fs *keybase1.SimpleFSClient, path string) (err error) {
	opid, err := fs.SimpleFSMakeOpid(m.Ctx())
	if err != nil {
		return err
	}
	defer fs.SimpleFSClose(m.Ctx(), opid)
	err = fs.SimpleFSOpen(m.Ctx(), keybase1.SimpleFSOpenArg{
		OpID:  opid,
		Dest:  keybase1.NewPathWithKbfsPath(path),
		Flags: keybase1.OpenFlags_DIRECTORY,
	})
	return err
}

func (e *PGPPushPrivate) write(m libkb.MetaContext, fs *keybase1.SimpleFSClient, path string, data string) (err error) {
	opid, err := fs.SimpleFSMakeOpid(m.Ctx())
	if err != nil {
		return err
	}
	defer fs.SimpleFSClose(m.Ctx(), opid)
	err = fs.SimpleFSOpen(m.Ctx(), keybase1.SimpleFSOpenArg{
		OpID:  opid,
		Dest:  keybase1.NewPathWithKbfsPath(path),
		Flags: keybase1.OpenFlags_WRITE,
	})
	if err != nil {
		return err
	}
	err = fs.SimpleFSWrite(m.Ctx(), keybase1.SimpleFSWriteArg{
		OpID:    opid,
		Offset:  0,
		Content: []byte(data),
	})
	if err != nil {
		return err
	}
	return nil
}

func (e *PGPPushPrivate) link(m libkb.MetaContext, fs *keybase1.SimpleFSClient, file string, link string) (err error) {
	err = fs.SimpleFSSymlink(m.Ctx(), keybase1.SimpleFSSymlinkArg{
		Target: file,
		Link:   keybase1.NewPathWithKbfsPath(link),
	})
	return err
}

func (e *PGPPushPrivate) remove(m libkb.MetaContext, fs *keybase1.SimpleFSClient, file string) (err error) {
	opid, err := fs.SimpleFSMakeOpid(m.Ctx())
	if err != nil {
		return err
	}
	defer fs.SimpleFSClose(m.Ctx(), opid)
	err = fs.SimpleFSRemove(m.Ctx(), keybase1.SimpleFSRemoveArg{
		OpID: opid,
		Path: keybase1.NewPathWithKbfsPath(file),
	})
	if err != nil {
		return err
	}
	err = fs.SimpleFSWait(m.Ctx(), opid)
	return err
}

func (e *PGPPushPrivate) push(m libkb.MetaContext, fp libkb.PGPFingerprint, tty string, fs *keybase1.SimpleFSClient) error {
	armored, err := m.G().GetGpgClient().ImportKeyArmored(true /* secret */, fp, tty)
	if err != nil {
		return err
	}

	username := m.CurrentUsername()
	if username.IsNil() {
		return libkb.NewLoginRequiredError("no username found")
	}

	path := "/private/" + username.String() + "/.keys"

	// Make /.keys/pgp. If it already exists, these mkdir calls should not error out.
	err = e.mkdir(m, fs, path)
	if err != nil {
		return err
	}
	path = path + "/pgp"
	err = e.mkdir(m, fs, path)
	if err != nil {
		return err
	}

	filename := fp.String() + "-" + fmt.Sprintf("%d", m.G().Clock().Now().Unix()) + ".asc"
	linkname := fp.String() + ".asc"
	filepath := path + "/" + filename
	linkpath := path + "/" + linkname

	err = e.write(m, fs, filepath, armored)
	if err != nil {
		return err
	}

	e.remove(m, fs, linkpath)

	err = e.link(m, fs, filename, linkpath)
	return err
}

func (e *PGPPushPrivate) Run(m libkb.MetaContext) (err error) {

	defer m.Trace("PGPPushPrivate#Run", func() error { return err })()

	tty, err := m.UIs().GPGUI.GetTTY(m.Ctx())
	if err != nil {
		return err
	}

	fingerprints, err := getPrivateFingerprints(m, e.arg.Fingerprints)
	if err != nil {
		return err
	}

	fs, err := simpleFSClient(m)
	if err != nil {
		return err
	}

	if len(fingerprints) == 0 {
		return errors.New("no PGP keys provided")
	}

	for _, fp := range fingerprints {
		err = e.push(m, fp, tty, fs)
		if err != nil {
			return err
		}
	}

	return nil
}
