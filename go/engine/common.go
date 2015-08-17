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

type keypair struct {
	encKey libkb.GenericKey
	sigKey libkb.GenericKey
}

// findBackupKeys checks if the user has backup keys.  If he/she
// does, it prompts for a backup phrase.  This is used to
// regenerate backup keys, which are then matched against the
// backup keys found in the keyfamily.
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

	bkarg := &PaperKeyGenArg{
		Passphrase: passphrase,
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
