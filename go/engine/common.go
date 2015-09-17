package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func IsLoggedIn(e Engine, ctx *Context) (bool, error) {
	if ctx.LoginContext != nil {
		return ctx.LoginContext.LoggedInLoad()
	}
	return e.G().LoginState().LoggedInLoad()
}

func IsProvisioned(e Engine, ctx *Context) (bool, error) {
	if ctx.LoginContext != nil {
		return ctx.LoginContext.LoggedInProvisionedLoad()
	}
	return e.G().LoginState().LoggedInProvisionedLoad()
}

type keypair struct {
	encKey libkb.GenericKey
	sigKey libkb.GenericKey
}

// findPaperKeys checks if the user has paper backup keys.  If he/she
// does, it prompts for a paperkey phrase.  This is used to
// regenerate paper keys, which are then matched against the
// paper keys found in the keyfamily.
func findPaperKeys(ctx *Context, g *libkb.GlobalContext, me *libkb.User) (*keypair, error) {
	cki := me.GetComputedKeyInfos()
	if cki == nil {
		return nil, fmt.Errorf("no computed key infos")
	}
	bdevs := cki.PaperDevices()
	if len(bdevs) == 0 {
		return nil, libkb.NoPaperKeysError{}
	}

	passphrase, err := ctx.SecretUI.GetPaperKeyPassphrase(keybase1.GetPaperKeyPassphraseArg{Username: me.GetName()})
	if err != nil {
		return nil, err
	}
	paperPhrase := libkb.NewPaperKeyPhrase(passphrase)
	if paperPhrase.Version() != libkb.PaperKeyVersion {
		return nil, libkb.KeyVersionError{}
	}

	bkarg := &PaperKeyGenArg{
		Passphrase: libkb.NewPaperKeyPhrase(passphrase),
		SkipPush:   true,
		Me:         me,
	}
	bkeng := NewPaperKeyGen(bkarg, g)
	if err := RunEngine(bkeng, ctx); err != nil {
		return nil, err
	}

	sigKey := bkeng.SigKey()
	encKey := bkeng.EncKey()

	var match bool
	ckf := me.GetComputedKeyFamily()
	for _, bdev := range bdevs {
		sk, err := ckf.GetSibkeyForDevice(bdev.ID)
		if err != nil {
			continue
		}
		ek, err := ckf.GetEncryptionSubkeyForDevice(bdev.ID)
		if err != nil {
			continue
		}

		if sk.GetKID().Equal(sigKey.GetKID()) && ek.GetKID().Equal(encKey.GetKID()) {
			match = true
			break
		}
	}

	if !match {
		return nil, libkb.PassphraseError{Msg: "no matching paper backup keys found"}
	}

	return &keypair{sigKey: sigKey, encKey: encKey}, nil

}
