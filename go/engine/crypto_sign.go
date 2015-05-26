package engine

import "github.com/keybase/client/go/libkb"

type CryptoSignEngine struct {
	libkb.Contextified
	msg      []byte
	reason   string
	sig      []byte
	verifier libkb.Verifier
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

	signer, ok := sigKey.(libkb.Signer)
	if !ok {
		return libkb.KeyCannotSignError{}
	}

	sig, verifier, err := signer.SignToBytes(cse.msg)
	if err != nil {
		return err
	}

	cse.sig = sig
	cse.verifier = verifier
	return nil
}

func (cse *CryptoSignEngine) GetSignature() []byte {
	return cse.sig
}

func (cse *CryptoSignEngine) GetVerifier() libkb.Verifier {
	return cse.verifier
}
