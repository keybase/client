package engine

import "github.com/keybase/client/go/libkb"

type CryptoSignEngine struct {
	libkb.Contextified
	msg          []byte
	reason       string
	sig          libkb.NaclSignature
	verifyingKey libkb.NaclSigningKeyPublic
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

	sigKey, _, err := cse.G().Keyrings.GetSecretKeyWithPrompt(ctx.LoginContext, libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}, ctx.SecretUI, cse.reason)
	if err != nil {
		return err
	}

	kp, ok := sigKey.(libkb.NaclSigningKeyPair)
	if !ok || kp.Private == nil {
		return libkb.KeyCannotSignError{}
	}

	cse.sig = *kp.Private.Sign(cse.msg)
	cse.verifyingKey = kp.Public
	return nil
}

func (cse *CryptoSignEngine) GetSignature() libkb.NaclSignature {
	return cse.sig
}

func (cse *CryptoSignEngine) GetVerifyingKey() libkb.NaclSigningKeyPublic {
	return cse.verifyingKey
}
