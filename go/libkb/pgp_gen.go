// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto"
	"fmt"
	"strings"

	"github.com/keybase/go-crypto/openpgp"
	"github.com/keybase/go-crypto/openpgp/errors"
	"github.com/keybase/go-crypto/openpgp/packet"
	"github.com/keybase/go-crypto/openpgp/s2k"
	"github.com/keybase/go-crypto/rsa"
)

type PGPGenArg struct {
	PrimaryBits     int
	SubkeyBits      int
	Ids             Identities
	Config          *packet.Config
	PGPUids         []string
	PrimaryLifetime int
	SubkeyLifetime  int
}

func ui32p(i int) *uint32 {
	if i >= 0 {
		tmp := uint32(i)
		return &tmp
	}
	return nil
}

// NewEntity returns an Entity that contains a fresh RSA/RSA keypair with a
// single identity composed of the given full name, comment and email, any of
// which may be empty but must not contain any of "()<>\x00".
// If config is nil, sensible defaults will be used.
//
// Modification of: https://code.google.com/p/go/source/browse/openpgp/keys.go?repo=crypto&r=8fec09c61d5d66f460d227fd1df3473d7e015bc6#456
//  From golang.com/x/crypto/openpgp/keys.go
func GeneratePGPKeyBundle(g *GlobalContext, arg PGPGenArg, logUI LogUI) (*PGPKeyBundle, error) {
	currentTime := arg.Config.Now()

	if len(arg.Ids) == 0 {
		return nil, errors.InvalidArgumentError("No Ids in PGPArg")
	}
	uids, err := arg.PGPUserIDs()
	if err != nil {
		return nil, err
	}
	for i, id := range arg.Ids {
		extra := ""
		if i == 0 {
			extra = "[primary]"
		}
		if logUI != nil {
			logUI.Info("PGP User ID: %s %s", id, extra)
		}
	}

	if logUI != nil {
		logUI.Info("Generating primary key (%d bits)", arg.PrimaryBits)
	}
	masterPriv, err := rsa.GenerateKey(arg.Config.Random(), arg.PrimaryBits)
	if err != nil {
		return nil, err
	}

	if logUI != nil {
		logUI.Info("Generating encryption subkey (%d bits)", arg.SubkeyBits)
	}
	encryptingPriv, err := rsa.GenerateKey(arg.Config.Random(), arg.SubkeyBits)
	if err != nil {
		return nil, err
	}

	e := &openpgp.Entity{
		PrimaryKey: packet.NewRSAPublicKey(currentTime, &masterPriv.PublicKey),
		PrivateKey: packet.NewRSAPrivateKey(currentTime, masterPriv),
		Identities: make(map[string]*openpgp.Identity),
	}

	for i, uid := range uids {
		isPrimaryID := true
		if i > 0 {
			isPrimaryID = false
		}
		id := &openpgp.Identity{
			Name:   uid.Name,
			UserId: uid,
			SelfSignature: &packet.Signature{
				CreationTime:         currentTime,
				SigType:              packet.SigTypePositiveCert,
				PubKeyAlgo:           packet.PubKeyAlgoRSA,
				Hash:                 arg.Config.Hash(),
				IsPrimaryId:          &isPrimaryID,
				FlagsValid:           true,
				FlagSign:             true,
				FlagCertify:          true,
				IssuerKeyId:          &e.PrimaryKey.KeyId,
				PreferredSymmetric:   arg.PreferredSymmetric(),
				PreferredHash:        arg.PreferredHash(),
				PreferredCompression: arg.PreferredCompression(),
			},
		}
		id.SelfSignature.KeyLifetimeSecs = ui32p(arg.PrimaryLifetime)
		e.Identities[uid.Id] = id
	}

	e.Subkeys = make([]openpgp.Subkey, 1)
	e.Subkeys[0] = openpgp.Subkey{
		PublicKey:  packet.NewRSAPublicKey(currentTime, &encryptingPriv.PublicKey),
		PrivateKey: packet.NewRSAPrivateKey(currentTime, encryptingPriv),
		Sig: &packet.Signature{
			CreationTime:              currentTime,
			SigType:                   packet.SigTypeSubkeyBinding,
			PubKeyAlgo:                packet.PubKeyAlgoRSA,
			Hash:                      arg.Config.Hash(),
			FlagsValid:                true,
			FlagEncryptStorage:        true,
			FlagEncryptCommunications: true,
			IssuerKeyId:               &e.PrimaryKey.KeyId,
			PreferredSymmetric:        arg.PreferredSymmetric(),
			PreferredHash:             arg.PreferredHash(),
			PreferredCompression:      arg.PreferredCompression(),
		},
	}
	e.Subkeys[0].PublicKey.IsSubkey = true
	e.Subkeys[0].PrivateKey.IsSubkey = true
	e.Subkeys[0].Sig.KeyLifetimeSecs = ui32p(arg.SubkeyLifetime)

	return NewGeneratedPGPKeyBundle(e), nil
}

// CreateIDs creates identities for KeyGenArg.Ids if none exist.
// It uses PGPUids to determine the set of Ids.  It does not set the
// default keybase.io uid.  AddDefaultUid() does that.
func (a *PGPGenArg) CreatePGPIDs() error {
	if len(a.Ids) > 0 {
		return nil
	}
	for _, id := range a.PGPUids {
		if !strings.Contains(id, "<") && CheckEmail.F(id) {
			a.Ids = append(a.Ids, Identity{Email: id})
			continue
		}
		parsed, err := ParseIdentity(id)
		if err != nil {
			return err
		}
		a.Ids = append(a.Ids, *parsed)
	}
	return nil
}

// Just for testing
func (a *PGPGenArg) AddDefaultUID() {
	a.Ids = append(a.Ids, KeybaseIdentity(""))
}

// Just for testing
func (a *PGPGenArg) MakeAllIds() error {
	if err := a.CreatePGPIDs(); err != nil {
		return err
	}
	a.AddDefaultUID()
	return nil
}

func (a *PGPGenArg) PGPUserIDs() ([]*packet.UserId, error) {
	uids := make([]*packet.UserId, len(a.Ids))
	for i, id := range a.Ids {
		uids[i] = id.ToPGPUserID()
		if uids[i] == nil {
			return nil, fmt.Errorf("Id[%d] failed to convert to PGPUserId (%+v)", i, id)
		}
	}
	return uids, nil
}

func (a *PGPGenArg) Init() (err error) {
	defBits := 4096
	if a.PrimaryBits == 0 {
		a.PrimaryBits = defBits
	}
	if a.SubkeyBits == 0 {
		a.SubkeyBits = defBits
	}
	if a.PrimaryLifetime == 0 {
		a.PrimaryLifetime = KeyExpireIn
	}
	if a.SubkeyLifetime == 0 {
		a.SubkeyLifetime = SubkeyExpireIn
	}
	return
}

func (a *PGPGenArg) PreferredSymmetric() []uint8 {
	return []uint8{
		uint8(packet.CipherAES128),
		uint8(packet.CipherAES256),
		uint8(packet.CipherCAST5),
	}
}

func (a *PGPGenArg) PreferredHash() []uint8 {
	gohash := []crypto.Hash{
		crypto.SHA256,
		crypto.SHA512,
		crypto.SHA1,
		crypto.RIPEMD160,
	}
	var res []uint8
	for _, h := range gohash {
		id, ok := s2k.HashToHashId(h)
		if !ok {
			continue
		}
		res = append(res, id)
	}
	return res
}

func (a *PGPGenArg) PreferredCompression() []uint8 {
	return []uint8{
		uint8(packet.CompressionNone),
		uint8(packet.CompressionZIP),
		uint8(packet.CompressionZLIB),
	}
}
