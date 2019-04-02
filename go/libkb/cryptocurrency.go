// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto/sha256"
	"errors"
	"strings"

	"github.com/btcsuite/btcutil/bech32"
)

type CryptocurrencyType int

type CryptocurrencyFamily string

const (
	CryptocurrencyTypeNone                  CryptocurrencyType = -1
	CryptocurrencyTypeBTC                   CryptocurrencyType = 0      // 0x0
	CryptocurrencyTypeBTCMultiSig           CryptocurrencyType = 5      // 0x5
	CryptocurrencyTypeBTCSegwit             CryptocurrencyType = 0x6263 // "bc"
	CryptocurrencyTypeZCashShielded         CryptocurrencyType = 5786   // 0x169a
	CryptocurrencyTypeZCashTransparentP2PKH CryptocurrencyType = 7352   // 0x1cb8
	CryptocurrencyTypeZCashTransparentP2SH  CryptocurrencyType = 7357   // 0x1cbd
	CryptocurrencyTypeZCashSapling          CryptocurrencyType = 0x7a73 // "zs"
)

const (
	CryptocurrencyFamilyNone    CryptocurrencyFamily = ""
	CryptocurrencyFamilyBitcoin CryptocurrencyFamily = "bitcoin"
	CryptocurrencyFamilyZCash   CryptocurrencyFamily = "zcash"
)

// Wallet and cryptocurrency are separate systems.
// Wallet links have reverse signatures, and the control secrets are in keybase.
// Whereas Cryptocurrency links are generally public only and have no reverse sigs.
// CryptocurrencyFamily and WalletNetwork are defined next to each other so that
// someone will notice if they start to overlap.
type WalletNetwork string

const (
	WalletNetworkStellar WalletNetwork = "stellar"
)

type CryptocurrencyPrefix struct {
	Type   CryptocurrencyType
	Prefix []byte
	Len    int
}

func (p CryptocurrencyType) String() string {
	switch p {
	case CryptocurrencyTypeBTC, CryptocurrencyTypeBTCMultiSig, CryptocurrencyTypeBTCSegwit:
		return "bitcoin"
	case CryptocurrencyTypeZCashShielded:
		return "zcash.z"
	case CryptocurrencyTypeZCashTransparentP2PKH, CryptocurrencyTypeZCashTransparentP2SH:
		return "zcash.t"
	case CryptocurrencyTypeZCashSapling:
		return "zcash.s"
	default:
		return ""
	}
}

func (p CryptocurrencyType) ToCryptocurrencyFamily() CryptocurrencyFamily {
	switch p {
	case CryptocurrencyTypeBTC, CryptocurrencyTypeBTCMultiSig, CryptocurrencyTypeBTCSegwit:
		return CryptocurrencyFamilyBitcoin
	case CryptocurrencyTypeZCashShielded, CryptocurrencyTypeZCashTransparentP2PKH, CryptocurrencyTypeZCashTransparentP2SH, CryptocurrencyTypeZCashSapling:
		return CryptocurrencyFamilyZCash
	default:
		return CryptocurrencyFamilyNone
	}
}

type BtcOpts struct{}

var knownPrefixes = []CryptocurrencyPrefix{
	{CryptocurrencyTypeBTC, []byte{0x0}, 25},
	{CryptocurrencyTypeBTCMultiSig, []byte{0x5}, 25},
	{CryptocurrencyTypeZCashShielded, []byte{0x16, 0x9a}, 70},
	{CryptocurrencyTypeZCashTransparentP2PKH, []byte{0x1c, 0xb8}, 26},
	{CryptocurrencyTypeZCashTransparentP2SH, []byte{0x1c, 0xbd}, 26},
}

func safeBufPrefix(b []byte, n int) []byte {
	if len(b) > n {
		return b[0:n]
	}
	return b
}

func addressToType(b []byte) (CryptocurrencyType, error) {
	for _, kp := range knownPrefixes {
		if FastByteArrayEq(safeBufPrefix(b, len(kp.Prefix)), kp.Prefix) {
			if len(b) != kp.Len {
				return CryptocurrencyTypeNone, errors.New("wrong address length")
			}
			return kp.Type, nil
		}
	}
	return CryptocurrencyTypeNone, errors.New("address type not known")
}

func cryptocurrencyParseZCashSapling(s string) (CryptocurrencyType, []byte, error) {
	hrp, decoded, err := bech32.Decode(s)
	if err != nil {
		return CryptocurrencyTypeNone, nil, err
	}
	if strings.ToLower(hrp) != "zs" {
		return CryptocurrencyTypeNone, nil, errors.New("bad prefix after bech32 parse")
	}
	return CryptocurrencyTypeZCashSapling, decoded, nil
}

func cryptocurrencyIsZCashSaplingViaPrefix(s string) bool {
	return len(s) > 3 && strings.ToLower(s[0:3]) == "zs1"
}

func cryptocurrencyParseBTCSegwit(s string) (CryptocurrencyType, []byte, error) {
	hrp, decoded, err := bech32.Decode(s)
	if err != nil {
		return CryptocurrencyTypeNone, nil, err
	}
	if strings.ToLower(hrp) != "bc" {
		return CryptocurrencyTypeNone, nil, errors.New("bad prefix after bech32 parse")
	}
	return CryptocurrencyTypeBTCSegwit, decoded, nil
}

func cryptocurrencyIsBTCSegwitViaPrefix(s string) bool {
	return len(s) > 3 && strings.ToLower(s[0:3]) == "bc1"
}

func CryptocurrencyParseAndCheck(s string) (CryptocurrencyType, []byte, error) {

	switch {
	case cryptocurrencyIsBTCSegwitViaPrefix(s):
		return cryptocurrencyParseBTCSegwit(s)
	case cryptocurrencyIsZCashSaplingViaPrefix(s):
		return cryptocurrencyParseZCashSapling(s)
	}

	buf, err := Decode58(s)
	if err != nil {
		return CryptocurrencyTypeNone, nil, err
	}
	l := len(buf)
	if l < 8 {
		return CryptocurrencyTypeNone, nil, errors.New("truncated cryptocurrency address")
	}
	if l > 256 {
		return CryptocurrencyTypeNone, nil, errors.New("cryptocurrency address too long")
	}
	typ, err := addressToType(buf)
	if err != nil {
		return typ, nil, err
	}
	pkhash := buf[0:(l - 4)]
	c1 := buf[(l - 4):]
	tmp := sha256.Sum256(pkhash)
	tmp2 := sha256.Sum256(tmp[:])
	c2 := tmp2[0:4]

	if !FastByteArrayEq(c1, c2) {
		return CryptocurrencyTypeNone, nil, errors.New("bad checksum in address")
	}
	return typ, pkhash, nil
}

func BtcAddrCheck(s string, _ *BtcOpts) (version int, pkhash []byte, err error) {
	var typ CryptocurrencyType
	typ, pkhash, err = CryptocurrencyParseAndCheck(s)
	if err != nil {
		return version, pkhash, err
	}
	if typ != CryptocurrencyTypeBTC && typ != CryptocurrencyTypeBTCMultiSig && typ != CryptocurrencyTypeBTCSegwit {
		return int(CryptocurrencyTypeNone), nil, errors.New("unrecognizable btc address")
	}
	return int(typ), pkhash, nil
}
