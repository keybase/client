// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type CryptocurrencyEngine struct {
	libkb.Contextified
	arg keybase1.RegisterAddressArg
	res keybase1.RegisterAddressRes
}

func NewCryptocurrencyEngine(g *libkb.GlobalContext, arg keybase1.RegisterAddressArg) *CryptocurrencyEngine {
	if arg.SigVersion == nil || libkb.SigVersion(*arg.SigVersion) == libkb.KeybaseNullSigVersion {
		tmp := keybase1.SigVersion(libkb.GetDefaultSigVersion(g))
		arg.SigVersion = &tmp
	}
	return &CryptocurrencyEngine{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

func (e *CryptocurrencyEngine) Name() string {
	return "Cryptocurrency"
}

func (e *CryptocurrencyEngine) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

func (e *CryptocurrencyEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
		libkb.SecretUIKind,
	}
}

func (e *CryptocurrencyEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func normalizeAddress(address string) string {
	switch strings.ToLower(address)[0:3] {
	case "bc1", "zs1":
		// bech32 addresses require that cases not be mixed
		// (an error which will be caught downstream in validation),
		// but the spec is otherwise case-insensitive. so if it's
		// passed in as uppercase, then we downcase it right away to
		// ensure that everything we do with the address (e.g. sign it into
		// a sigchain link) will be consistent and checksum correctly.
		if strings.ToUpper(address) == address {
			return strings.ToLower(address)
		}
	}
	return address
}

func (e *CryptocurrencyEngine) Run(m libkb.MetaContext) (err error) {
	m.G().LocalSigchainGuard().Set(m.Ctx(), "CryptocurrencyEngine")
	defer m.G().LocalSigchainGuard().Clear(m.Ctx(), "CryptocurrencyEngine")

	defer m.Trace("CryptocurrencyEngine", func() error { return err })()

	var typ libkb.CryptocurrencyType
	e.arg.Address = normalizeAddress(e.arg.Address)
	typ, _, err = libkb.CryptocurrencyParseAndCheck(e.arg.Address)
	if err != nil {
		return libkb.InvalidAddressError{Msg: err.Error()}
	}

	family := typ.ToCryptocurrencyFamily()
	if len(e.arg.WantedFamily) > 0 && e.arg.WantedFamily != string(family) {
		return libkb.InvalidAddressError{Msg: fmt.Sprintf("wanted coin type %q, but got %q", e.arg.WantedFamily, family)}
	}

	me, err := libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(m))
	if err != nil {
		return err
	}

	cryptocurrencyLink := me.IDTable().ActiveCryptocurrency(typ.ToCryptocurrencyFamily())
	if cryptocurrencyLink != nil && !e.arg.Force {
		return libkb.ExistsError{Msg: string(family)}
	}
	var sigIDToRevoke keybase1.SigID
	var lease *libkb.Lease
	var merkleRoot *libkb.MerkleRoot
	if cryptocurrencyLink != nil {
		sigIDToRevoke = cryptocurrencyLink.GetSigID()
		lease, merkleRoot, err = libkb.RequestDowngradeLeaseBySigIDs(m.Ctx(), m.G(), []keybase1.SigID{sigIDToRevoke})
		if err != nil {
			return err
		}
	}

	ska := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	sigKey, err := m.G().Keyrings.GetSecretKeyWithPrompt(m, m.SecretKeyPromptArg(ska, "to register a cryptocurrency address"))
	if err != nil {
		return err
	}
	if err = sigKey.CheckSecretKey(); err != nil {
		return err
	}
	sigVersion := libkb.SigVersion(*e.arg.SigVersion)
	claim, err := me.CryptocurrencySig(m, sigKey, e.arg.Address, typ, sigIDToRevoke, merkleRoot, sigVersion)
	if err != nil {
		return err
	}

	sigInner, err := claim.J.Marshal()
	if err != nil {
		return err
	}

	sig, _, linkID, err := libkb.MakeSig(
		m,
		sigKey,
		libkb.LinkTypeCryptocurrency,
		sigInner,
		libkb.SigHasRevokes(len(sigIDToRevoke) > 0),
		keybase1.SeqType_PUBLIC,
		libkb.SigIgnoreIfUnsupported(false),
		me,
		sigVersion,
	)

	if err != nil {
		return err
	}

	kid := sigKey.GetKID()
	args := libkb.HTTPArgs{
		"sig":             libkb.S{Val: sig},
		"signing_kid":     libkb.S{Val: kid.String()},
		"is_remote_proof": libkb.B{Val: false},
		"type":            libkb.S{Val: "cryptocurrency"},
	}
	if lease != nil {
		args["downgrade_lease_id"] = libkb.S{Val: string(lease.LeaseID)}
	}

	if sigVersion == libkb.KeybaseSignatureV2 {
		args["sig_inner"] = libkb.S{Val: string(sigInner)}
	}

	_, err = m.G().API.Post(m, libkb.APIArg{
		Endpoint:    "sig/post",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        args,
	})
	if err != nil {
		return err
	}

	err = libkb.MerkleCheckPostedUserSig(m, me.GetUID(), claim.Seqno, linkID)
	if err != nil {
		return err
	}

	e.res.Family = string(family)
	e.res.Type = typ.String()

	return nil
}

func (e *CryptocurrencyEngine) Result() keybase1.RegisterAddressRes {
	return e.res
}
