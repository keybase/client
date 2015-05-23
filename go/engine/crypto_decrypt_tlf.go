package engine

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/protocol/go"
)

type CryptoDecryptTLFEngine struct {
	libkb.Contextified
	encryptedData         []byte
	nonce                 keybase1.Nonce
	peersPublicKey        keybase1.PeersPublicKey
	reason                string
	tlfCryptKeyClientHalf keybase1.TLFCryptKeyClientHalf
}

func NewCryptoDecryptTLFEngine(ctx *libkb.GlobalContext, encryptedData []byte, nonce keybase1.Nonce, peersPublicKey keybase1.PeersPublicKey, reason string) *CryptoDecryptTLFEngine {
	cse := &CryptoDecryptTLFEngine{
		encryptedData:  encryptedData,
		nonce:          nonce,
		peersPublicKey: peersPublicKey,
		reason:         reason,
	}
	cse.SetGlobalContext(ctx)
	return cse
}

func (cse *CryptoDecryptTLFEngine) Name() string {
	return "CryptoDecryptTLF"
}

func (cse *CryptoDecryptTLFEngine) GetPrereqs() EnginePrereqs { return EnginePrereqs{} }

func (cse *CryptoDecryptTLFEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.SecretUIKind,
	}
}

func (cse *CryptoDecryptTLFEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (cse *CryptoDecryptTLFEngine) Run(ctx *Context) (err error) {
	_, err = libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return err
	}

	panic("Not implemented")
}

func (cse *CryptoDecryptTLFEngine) GetTLFCryptKeyClientHalf() keybase1.TLFCryptKeyClientHalf {
	return cse.tlfCryptKeyClientHalf
}
