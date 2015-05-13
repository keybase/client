package engine

import (
	"github.com/keybase/client/go/libkb"
)

type CryptoSignEngine struct {
	libkb.Contextified
	msg          []byte
	reason       string
	sig          []byte
	verifyingKey libkb.GenericKey
}

func NewCryptoSignEngine(ctx *libkb.GlobalContext, msg []byte, reason string) *CryptoSignEngine {
	cse := &CryptoSignEngine{msg: msg, reason: reason}
	cse.SetGlobalContext(ctx)
	return cse
}

func (cse *CryptoSignEngine) Name() string {
	return "CryptoSign"
}

func (cse *CryptoSignEngine) GetPrereqs() EnginePrereqs { return EnginePrereqs{} }

func (cse *CryptoSignEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.SecretUIKind,
	}
}

func (cse *CryptoSignEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (cse *CryptoSignEngine) Run(ctx *Context) (err error) {
	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return err
	}

	sigKey, _, err := cse.G().Keyrings.GetSecretKeyWithPrompt(libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceKeyType,
	}, ctx.SecretUI, cse.reason)
	if err != nil {
		return err
	}

	if err = sigKey.CheckSecretKey(); err != nil {
		return err
	}

	sig, err := sigKey.SignToBytes(cse.msg)
	if err != nil {
		return err
	}

	verifyingKey, err := libkb.ImportKeypairFromKID(sigKey.GetKid(), cse.G())
	if err != nil {
		return err
	}

	cse.sig = sig
	cse.verifyingKey = verifyingKey
	return nil
}

func (cse *CryptoSignEngine) GetSignature() []byte {
	return cse.sig
}

func (cse *CryptoSignEngine) GetVerifyingKey() libkb.GenericKey {
	return cse.verifyingKey
}
