// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
)

type Bug3964Repairman struct {
	libkb.Contextified
}

func NewBug3964Repairman(g *libkb.GlobalContext) *Bug3964Repairman {
	return &Bug3964Repairman{Contextified: libkb.NewContextified(g)}
}

// Name provides the name of the engine for the engine interface
func (b *Bug3964Repairman) Name() string {
	return "Bug3964Repairman"
}

// Prereqs returns engine prereqs
func (b *Bug3964Repairman) Prereqs() Prereqs {
	return Prereqs{
		Session: true,
		Device:  true,
	}
}

// RequiredUIs returns the required UIs.
func (b *Bug3964Repairman) RequiredUIs() []libkb.UIKind {
	return nil
}

// SubConsumers requires the other UI consumers of this engine
func (b *Bug3964Repairman) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (b *Bug3964Repairman) loadUnlockedEncryptionKey(ctx *Context, me *libkb.User) (ret libkb.GenericKey, err error) {
	defer b.G().Trace("Bug3964Repairman#loadUnlockedEncryptionKey", func() error { return err })()
	parg := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceEncryptionKeyType,
	}
	ret, err = b.G().Keyrings.GetSecretKeyWithoutPrompt(ctx.LoginContext, parg)
	return ret, err
}

func (b *Bug3964Repairman) loadMe() (*libkb.User, error) {
	return libkb.LoadMe(libkb.NewLoadUserForceArg(b.G()))
}

func (b *Bug3964Repairman) decryptPassphrase(ctx *Context, me *libkb.User, encKey libkb.GenericKey) (ret *libkb.LKSec, err error) {
	defer b.G().Trace("Bug3964Repairman#decryptPassphrase", func() error { return err })()
	ppgen, clientHalf, err := fetchLKS(ctx, b.G(), encKey)
	if err != nil {
		return nil, err
	}
	ret = libkb.NewLKSecWithClientHalf(clientHalf, ppgen, me.GetUID(), b.G())
	return ret, nil
}

func (b *Bug3964Repairman) attemptRepair(ctx *Context, lksec *libkb.LKSec, dkm libkb.DeviceKeyMap) (ran bool, err error) {
	defer b.G().Trace("Bug3964Repairman#attemptRepair", func() error { return err })()
	var rerr error
	err = b.G().LoginState().MutateKeyring(func(kr *libkb.SKBKeyringFile) *libkb.SKBKeyringFile {
		var newKeyring *libkb.SKBKeyringFile
		newKeyring, rerr = kr.Bug3964Repair(ctx.LoginContext, lksec, dkm)
		if rerr != nil || newKeyring == nil {
			return nil
		}
		ran = true
		if rerr = newKeyring.Save(); rerr != nil {
			b.G().Log.Debug("Error saving new keyring: %s", rerr)
			return nil
		}
		return newKeyring
	}, "Bug3964Repairman")
	if err != nil {
		return false, err
	}
	return ran, rerr
}

func (b *Bug3964Repairman) loadLKSecServerDetails(ctx *Context, lksec *libkb.LKSec) (ret libkb.DeviceKeyMap, err error) {
	defer b.G().Trace("Bug3964Repairman#loadLKSecServerDetails", func() error { return err })()
	ret, err = lksec.LoadServerDetails(ctx.LoginContext)
	lksec.SetFullSecret()
	return ret, err
}

func (b *Bug3964Repairman) updateSecretStore(me *libkb.User, lksec *libkb.LKSec) error {
	fs := lksec.FullSecret()
	nun := me.GetNormalizedName()
	ss := b.G().SecretStoreAll
	if fs.IsNil() {
		b.G().Log.Warning("Got unexpected nil full secret")
		return ss.ClearSecret(nun)
	}
	return ss.StoreSecret(nun, fs)
}

// Run the engine
func (b *Bug3964Repairman) Run(ctx *Context) (err error) {
	traceDone := b.G().Trace("Bug3964Repairman#Run", func() error { return err })
	defer func() {
		b.G().SKBKeyringMu.Unlock()
		traceDone()
	}()
	b.G().SKBKeyringMu.Lock()
	b.G().Log.Debug("| Acquired SKBKeyringMu mutex")

	var me *libkb.User
	var encKey libkb.GenericKey
	var lksec *libkb.LKSec
	var ran bool
	var dkm libkb.DeviceKeyMap

	if me, err = b.loadMe(); err != nil {
		return err
	}

	if encKey, err = b.loadUnlockedEncryptionKey(ctx, me); err != nil {
		return err
	}

	if lksec, err = b.decryptPassphrase(ctx, me, encKey); err != nil {
		return err
	}

	if dkm, err = b.loadLKSecServerDetails(ctx, lksec); err != nil {
		return err
	}

	if ran, err = b.attemptRepair(ctx, lksec, dkm); err != nil {
		return err
	}
	if !ran {
		return err
	}
	b.G().Log.Debug("| Successfully ran SKB keyring repair")

	if tmp := b.updateSecretStore(me, lksec); tmp != nil {
		b.G().Log.Warning("Error in secret store manipulation: %s", tmp)
	}

	return err
}
