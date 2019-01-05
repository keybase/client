package libkb

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
)

// PDPKA is a "Passphrase-Derived Public Key Authentication". In this case, it's a
// armored, packed, signature that's been output by our signing interface.
type PDPKA string

// PDPKALoginPackage contains all relevant PDPKA versions in use at this
// time. For now, versions 4 and 5.
type PDPKALoginPackage struct {
	pdpka5 PDPKA
	pdpka4 PDPKA
}

type loginIdentifier interface {
	value() string
}

type loginIdentifierEmail string

func (l loginIdentifierEmail) value() string { return string(l) }

type loginIdentifierUsername string

func (l loginIdentifierUsername) value() string { return string(l) }

type loginIdentifierUID keybase1.UID

func (l loginIdentifierUID) value() string { return keybase1.UID(l).String() }

func (p PDPKA) String() string { return string(p) }

type authPayload struct {
	Body struct {
		Auth struct {
			Nonce   string `json:"nonce"`
			Session string `json:"session"`
		} `json:"auth"`
		Key struct {
			Email    string `json:"email,omitempty"`
			Host     string `json:"host"`
			Kid      string `json:"kid"`
			UID      string `json:"uid,omitempty"`
			Username string `json:"username,omitempty"`
		} `json:"key"`
		Type    string `json:"type"`
		Version int    `json:"version"`
	} `json:"body"`
	Ctime    int    `json:"ctime"`
	ExpireIn int    `json:"expire_in"`
	Tag      string `json:"tag"`
}

func seedToPDPKAKey(seed []byte) (ret NaclSigningKeyPair, err error) {
	if len(seed) != NaclSigningKeySecretSize {
		return ret, fmt.Errorf("wrong size secret in computePDPKA (%d != %d)", len(seed), NaclSigningKeySecretSize)
	}
	var secret [NaclSigningKeySecretSize]byte
	copy(secret[:], seed)
	return MakeNaclSigningKeyPairFromSecret(secret)
}

func seedToPDPKAKID(seed []byte) (ret keybase1.KID, err error) {
	var signingKey NaclSigningKeyPair
	signingKey, err = seedToPDPKAKey(seed)
	if err != nil {
		return ret, err
	}
	return signingKey.GetKID(), nil
}

func computePDPKA(li loginIdentifier, seed []byte, loginSession []byte) (ret PDPKA, err error) {

	var nonce [16]byte
	if _, err = rand.Read(nonce[:]); err != nil {
		return ret, err
	}

	var ap authPayload
	ap.Body.Auth.Nonce = hex.EncodeToString(nonce[:])
	ap.Body.Auth.Session = base64.StdEncoding.EncodeToString(loginSession)

	var signingKey NaclSigningKeyPair
	signingKey, err = seedToPDPKAKey(seed)
	if err != nil {
		return ret, err
	}

	ap.Body.Key.Kid = signingKey.GetKID().String()
	ap.Body.Key.Host = CanonicalHost
	ap.Body.Type = "auth"
	ap.Body.Version = 1
	ap.Tag = "signature"
	ap.Ctime = int(time.Now().Unix())
	ap.ExpireIn = 60 * 60 * 24 // good for one day, to deal with clock skew

	switch li.(type) {
	case loginIdentifierEmail:
		ap.Body.Key.Email = li.value()
	case loginIdentifierUsername:
		ap.Body.Key.Username = li.value()
	case loginIdentifierUID:
		ap.Body.Key.UID = li.value()
	}

	var jsonRaw []byte
	if jsonRaw, err = json.Marshal(ap); err != nil {
		return ret, err
	}

	var sig string
	if sig, _, err = signingKey.SignToString(jsonRaw); err != nil {
		return ret, err
	}

	ret = PDPKA(sig)
	return ret, nil
}

func computeLoginPackageFromUID(u keybase1.UID, ps *PassphraseStream, loginSession []byte) (ret PDPKALoginPackage, err error) {
	return computeLoginPackage(loginIdentifierUID(u), ps, loginSession)
}

func computeLoginPackageFromEmailOrUsername(eou string, ps *PassphraseStream, loginSession []byte) (ret PDPKALoginPackage, err error) {
	var li loginIdentifier
	if CheckUsername.F(eou) {
		li = loginIdentifierUsername(eou)
	} else if CheckEmail.F(eou) {
		li = loginIdentifierEmail(eou)
	} else {
		return ret, fmt.Errorf("expected an email or username; got neither (%s)", eou)
	}
	return computeLoginPackage(li, ps, loginSession)
}

func computeLoginPackage(li loginIdentifier, ps *PassphraseStream, loginSession []byte) (ret PDPKALoginPackage, err error) {
	if ps == nil {
		return ret, errors.New("computeLoginPackage failed due to nil PassphraseStream")
	}
	ret.pdpka5, err = computePDPKA(li, ps.EdDSASeed(), loginSession)
	if err != nil {
		return ret, err
	}
	ret.pdpka4, err = computePDPKA(li, ps.PWHash(), loginSession)
	if err != nil {
		return ret, err
	}
	return ret, nil
}

// PopulateArgs populates the given HTTP args with parameters in this PDPKA package.
// Right now that includes v4 and v5 of the PDPKA login system.
func (lp PDPKALoginPackage) PopulateArgs(h *HTTPArgs) {
	h.Add("pdpka4", S{string(lp.pdpka4)})
	h.Add("pdpka5", S{string(lp.pdpka5)})
}

// PDPKA4 gets the v4 of the PDPKA token for this login package
func (lp PDPKALoginPackage) PDPKA4() PDPKA { return lp.pdpka4 }

// PDPKA5 gets the v4 of the PDPKA token for this login package
func (lp PDPKALoginPackage) PDPKA5() PDPKA { return lp.pdpka5 }
