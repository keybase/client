// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"strconv"

	"github.com/buger/jsonparser"
	"github.com/keybase/client/go/jsonparserw"
	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/msgpack"
	"github.com/keybase/client/go/sigid"
	pkgerrors "github.com/pkg/errors"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// badWhitespaceLinkIDConversion converts what we get by naively computing
// the LinkID to what it should be (on the basis of a mistakenly stripped newline).
var badWhitespaceLinkIDConversion = map[keybase1.LinkID]keybase1.LinkID{
	"c6403b7eec2f2ada4f5e0349bd59488c6fc6a8ff62f7e4a9b559f3e672690f23": "03fb1e2c0e61e3715c41515045d89d2f788dbcc7eb671b94ac12ee5f805bbe70",
	"67f63579dcb143cde80af2196037e61b8d5410677939c3635fbf44e34e106d6e": "09527db7672bf23a9681ac86c70826cdc01ed1e467252a76ca4bf4ad0964efd7",
	"0adfc5a682a1f717469ce5781f03110ea47aad62a65fba5c9db6c93ffd1d31ef": "12c9203c98fe0b1c80a551f8933b2c870fcc3754a8ea05591e43a4d528fadc68",
	"b068f86b9a6b12b45c4a727e2b2506900d84107a66331dadc50e9127eec1df11": "14ef90159164e19228ff21c909b764e239f27f0fff49f86414a2dde9b719845f",
	"179ba2604ca94bd3c049fd37bc60fdf7b6f5aa331ec5432b6ce8fb5e30a76c80": "18688c45cbe05ee2b72567acc696b3856f9876dff0ec3ea927ad7632a3f48fe6",
	"781db37c7eec976551e0c5d06a1fc64c84c06c601c093f71661892776335a360": "2c11a140d8f231af6d69543474138a503191486ae6b5739892c5e0c6c0c4c348",
	"5f6f398fed407020498d5258183ac5cf09b96832a57c19b412b4a5a186a8ddae": "2cf8b9ffa500089b6db873acbabdba771e8e897c0a899a01f8967a7280cfd0da",
	"2ea16dd1ed2339cc193e8e4d36f3b12955276b9bd02d00c0ccac19a865fedb8a": "2efe839231d6b03f85ab3c542e870e7062329a8c5e384f1289b00be7c7afb8ab",
	"fc6febd300f012a8796bc29b7f9f119736fbece786b5bf41535debb4c4065e18": "32f5dd2643eabf3828f7f03ccded07d8d8a29e352df6130c3a4232104398d819",
	"908df90fcdc82b13689c3826fec2b113d0f5ea95ab12dfccac0c8017e051523a": "33a61f19c0ca52257214f97524ef10441cf85215ff171868f53561dfd7b14c81",
	"f025714a5b92f29ece12c5d3dfa3f1cff430d00375381ce3d3029f57cb6fbe87": "36328ab1cf15cc3dd2ba4c771ca1066b2d44714780ad8e83894611e2a2642003",
	"3f59f95a6027faad6cd7d0ecdd087824cad743af8c460b24d8c3dd3e73fdc564": "371f9ae63d56ec853fa53941e79d29abbb4cd11aa926715d354d18d687b0ca71",
	"8629ef8148542ba40ab650de522a08f7fcba12e1c4dd9cae702054ddd1db3469": "374f1da46fd8238ab9f288183cb78f3c6a59732f4b19705763c9d6ac356015ef",
	"a05c5533c3a0be260c2c61d3e026c7f0ed9f050cf7fb1b3375561e9b74900f39": "3803be27ec0c61b3fdcd8b9b7c78de3df73766736ef00727267858d34a039c7d",
	"ca574ddc1f5b1d8cfcea4c98cbf9318aa7730654fc27f155194a0331743018f2": "3ca5ef6a6115a8a86d7d94cb3565f43f05f7975d66015455dd6cc32b73936177",
	"c342332cd2e16bef3fcd3c179b4c68e1711966a42d2f761a8cad1d9018b6e50c": "3cdd165df44ba7f8331b89213f213dab36482ef513d023c5d2b0f6bfd11d5678",
	"2c7d63521953099c4dd1eeaecaf73ea7141358d861804581afabdb41fbc4c6dd": "43f21601ffaeae70eca2f585949f42c67e85e93cf2a6847d6c20ffd81a9ff890",
	"608a930cd23b8326c6c54c333a3b06c5a7817e6dd0776931600d0232c9b64415": "4948115615d7dceb90bcdd818f69b66b5899339a2b747b5e6dc0f6987abbcbd0",
	"5b01b5f4868b1a57c17dfd7e0a29e814c2ebf517124d3fc9e80de91a14f36853": "4c3f7855eb307aa5620962e15de84b2cfe3f728a9722c43906b12e0f3082cb87",
	"e155732239cdfbc7e8f984724048ea55837f1dc2e296103f3b8b5b920e1d06a0": "5957f583bec18cc6f381355843c21f903fe47d584a9816e072f3f102f1f488be",
	"19fb5089a2c976a3da70313509853967ddc9e7aca66bbd83b692ec6c25f42ad0": "605525686fef18180be692df6106c13dae39abb2799dc9e8bed1e2bb64e9b886",
	"9cc3b515ef372c4dab04f634ae781eab44dc3c905b2e50eeb491cde73e6abc76": "616d9710b3a594ab00292d3d414e6e141929935a133bfa9a25ec4a155a403e5c",
	"35567057358f9a9907f8ac53195c32a9c8297c244420f77f34973ea9aa0c99bf": "61e9f4b437fccac8abd396acfc96b17558c9c355b57f4a5f2f3698e78f19532f",
	"992232ad3e598cad26dc8247a59ae00026c710aad8d4d0aa30c8b22c30c41068": "6f3d73ddf575f2033a48268a564575e40edbb5111cc057984f51f463d4e8ed58",
	"2b999c0c8a6d7580fe15cad0718555d1ad4dbe7ee66fbdf064e50314e63908b0": "720b80b7c15cb9a3d21a2eec228bceb5db6f0ef54df2d0aef08aec5ed1632257",
	"070a137418bf79584da4806d342cb85da195b81ba34ab17866301e0074a62106": "740f9140a7901defaaaec10042722b30d2fee457337b7ae8e9de3b9fc05d109f",
	"9fe6d8d33743b1c115386f6e0640b1a1a20b78f5abd33068a122eee76b0ac1fa": "7560f896c19457365225f48be0217b8a00519f1daccefee4c097dd1b4594dd66",
	"0a66d169b9735d3d6017bebb3c6663651d0e7945b7807da7fc0f81cd89a1bab4": "7772c99774570202a2c5ac017eefc8296f613e64c8d4adff4ba7991b553431f5",
	"c76aed537f11f43d9f29960e64ac3826d8b588db523ecdc5d3962f370a603e91": "7d97355e5917c5bcc14ba3a1994398b3fa36416768b663c1454069de84a4fca2",
	"f34d8e9cb975c2ff1695a62f6382705a9c8495d418fdf31b8e07ea8838726fbc": "893567013c77f45755279bf1138fecbb54cd3a55bf5814504cf0406acbe4bfeb",
	"7a5c2c7535131175c8881f7d22425f9ceb7ac2a9c9a1bd4a1f3002f257130fbc": "8d7c1a0c99186f972afc5d3624aca2f88ddc3a5dbf84e826ef0b520c31a78aa3",
	"9567542c190ccece597d9fd75a376406dde0c0a66dfece93bd458b7b8209001c": "94fde9d49c29cba59c949b35dd424de3a0daccf8a04ba443833e3328d495b9d8",
	"6b4439bb3b4296fc3121e7254138da0112ee1f5d19060424a3795a52ba0118e1": "9644d4db6a4928ad1075a22b4473d1efa47c99a1a2a779450d4cd67d9115b9ba",
	"49fdec5413bb7a31d12afd6d6d51449d51b0e294322b652dd5826d22b2240688": "9db59496652a1587ed56ec6ae15917b6d0ef4ac9a14dda97bfa4d2427a80e2b8",
	"ccfa667ad9a1a392b51c719fcb5d526eee06e74e541d17e008b34ad8c0f2b2a6": "9f8c0a29a6ba3a521db2cd4d3e2ae15223dbcd5d5d1201e33ebb2dee1b61342f",
	"1403ea660224a2ec5cd87c96f675cbb5d44535962c4b77c78e9711096579feec": "a9efa00bc479cb40ac0521749520f5a7a38a4ba4e698ee03355a85a8464b3840",
	"c8890433c797440189f7dd99c8830d3524f4ed89cc5493380cbca463ef2f53bf": "ac3ecaa2aa1d638867026f0c54a1d895777f366d02bfef37403275aa0d4f8322",
	"02e298aae0a3cefb14b53b9aa3c2757ddfd07f2b2bd70aca5d0fa1b23dd63818": "acf150b2d57a3aa65574bc2bb97e224413ce3f5344fd24fc7c3282da48cc2f3d",
	"4b9d7cb38779b31acff69bb2426bbe7a3a5718e0b51f6197acf06f84fea30d67": "b23dfd34e58a814543e1f8368b9d07922abec213afca6d2b76722825794acffa",
	"1cf025e248cca9ecd59936bb2c6a35f3842ca9a96bb264d2a53606476629266f": "b74b420f49b771ec04e656101f86c9729cf328b0fd32f5082d04d3c39f8ccea7",
	"9c30bbd352353746885c0d0455c9482852f4cc824367a188d71650348847d1ad": "b9f188d0c6638e3bef3dfc3476c04078bb2aef2a9249cc77b6f009692967388a",
	"3be37854d6b2585cab0b4371df454372b919fe688fb12bee28ccbce7c0de6375": "d380d18672da3c18f0804baf6b28f5efda76d64220a152c000f2b3f9af8b6603",
	"9fb504227c9df7f10fe887c67038a4a9cd694a2b28ab8f5f47c23a86dce26a45": "d7ae76e4fdae7034b07e515d5684adcd51afea5a22b8520d2c61d31f5028fc6e",
	"f74cf3b94f3896fa8a6413749072085c86544c4a51dd551128b39f57b0b43e63": "da99975f9ae8cdeb9e3a42a1166617dbf6afbcf841919dcf05145a73a7026cc2",
	"e570d6a661985326582524f4b5d177fb2027847863cdc8d2c4a073c71f420e2d": "e449b1cd1d6f2a86a0f800c47e7d1ad26bbb6c76b983bd78154972c51f77e960",
	"01932d6b39ab9a7ee0ca835ef4301adba0a2cd6da63fb07696153166d48fc075": "f1509495f4f1d46e43dcdd341156b975f7ad19aefeb250a80fd2b236c517a891",
	"99668480e4731a47a81051e35d4957780395990d718d8629a8653ba718d489f2": "f5f324e91a94c073fdc936b50d56250133dc19415ae592d2c7cb99db9e980e1b",
}

func fixupSeqType(st *keybase1.SeqType) {
	if *st == keybase1.SeqType_NONE {
		*st = keybase1.SeqType_PUBLIC
	}
}

func importLinkFromServerV2Stubbed(m MetaContext, parent *SigChain, raw string) (ret *ChainLink, err error) {
	ol, err := DecodeStubbedOuterLinkV2(raw)
	if err != nil {
		return nil, err
	}

	fixupSeqType(&ol.SeqType)

	if !ol.IgnoreIfUnsupported.Bool() && !ol.LinkType.IsSupportedType() {
		return nil, ChainLinkStubbedUnsupportedError{fmt.Sprintf("Stubbed link with type %d is unknown and not marked with IgnoreIfUnsupported", ol.LinkType)}
	}

	linkID := ol.LinkID()

	// Because the outer link does not have a highSkip parent object, we check
	// for the nullity of highSkipSeqno to see if highSkip should be set, since
	// a null highSkipHash is valid when specifying highSkip=0.
	var highSkipPtr *HighSkip
	if ol.HighSkipSeqno != nil {
		highSkip := NewHighSkip(*ol.HighSkipSeqno, *ol.HighSkipHash)
		highSkipPtr = &highSkip
	}

	unpacked := &ChainLinkUnpacked{
		prev:                ol.Prev,
		seqno:               ol.Seqno,
		seqType:             ol.SeqType,
		ignoreIfUnsupported: ol.IgnoreIfUnsupported,
		highSkip:            highSkipPtr,
		sigVersion:          ol.Version,
		outerLinkV2:         ol,
		stubbed:             true,
	}
	ret = NewChainLink(m.G(), parent, linkID)
	ret.unpacked = unpacked
	return ret, nil
}

type importRes struct {
	kid     keybase1.KID
	linkID  LinkID
	sigID   keybase1.SigID
	sig     string
	payload []byte
	ol2     *OuterLinkV2WithMetadata
}

func getPGPSig(m MetaContext, data []byte) (sig string) {
	sig = jsonGetString(data, "sig")
	if sig == "" || !IsPGPSig(sig) {
		return ""
	}
	return sig
}

func jsonGetString(d []byte, args ...string) string {
	s, err := jsonparserw.GetString(d, args...)
	if err != nil {
		return ""
	}
	return s

}

func importServerTrustFields(m MetaContext, tmp *ChainLinkUnpacked, data []byte, selfUID keybase1.UID) error {
	if selfUID.Equal(tmp.uid) {
		tmp.proofText = jsonGetString(data, "proof_text_full")
	}

	if i, err := jsonparserw.GetInt(data, "merkle_seqno"); err == nil {
		tmp.firstAppearedMerkleSeqnoUnverified = keybase1.Seqno(i)
	}
	return nil
}

func ImportLinkFromServer(m MetaContext, parent *SigChain, data []byte, selfUID keybase1.UID) (ret *ChainLink, err error) {

	sig2Stubbed := jsonGetString(data, "s2")
	if sig2Stubbed != "" {
		return importLinkFromServerV2Stubbed(m, parent, sig2Stubbed)
	}

	versionRaw, err := jsonparserw.GetInt(data, "sig_version")
	if err != nil || versionRaw == 0 {
		return nil, ChainLinkError{"cannot read signature version from server"}
	}

	pgpSig := getPGPSig(m, data)
	sigVersion := SigVersion(versionRaw)

	var ir *importRes
	switch {
	case sigVersion == KeybaseSignatureV1 && pgpSig != "":
		ir, err = importLinkFromServerPGP(m, pgpSig, data)
	case sigVersion == KeybaseSignatureV1 && pgpSig == "":
		ir, err = importLinkFromServerV1NaCl(m, data)
	case sigVersion == KeybaseSignatureV2 && pgpSig == "":
		ir, err = importLinkFromServerV2Unstubbed(m, data)
	default:
		err = ChainLinkError{fmt.Sprintf("bad link back from server; version=%d; pgp=%v", sigVersion, (pgpSig != ""))}
	}
	if err != nil {
		return nil, err
	}

	ret = NewChainLink(m.G(), parent, ir.linkID)
	tmp := ChainLinkUnpacked{sigVersion: sigVersion}
	tmp.outerLinkV2 = ir.ol2

	err = tmp.unpackPayloadJSON(m.G(), ir.payload, ret.id)
	if err != nil {
		m.Debug("unpack payload json err: %s", err)
		return nil, err
	}
	err = tmp.assertPayloadSigVersionMatchesHint(ir.payload)
	if err != nil {
		return nil, err
	}

	tmp.sig = ir.sig
	tmp.sigID = ir.sigID
	// this might overwrite the actions of unpackPayloadJSON. TODO: to change
	// unpackPayloadJSON to fix this issue.
	tmp.kid = ir.kid

	err = importServerTrustFields(m, &tmp, data, selfUID)
	if err != nil {
		return nil, err
	}

	ret.unpacked = &tmp
	ret.hashVerified = true
	ret.payloadVerified = true

	return ret, nil
}

func computeLinkIDFromHashWithWhitespaceFixes(m MetaContext, payload []byte) (LinkID, error) {
	hsh := sha256.Sum256(payload)
	linkID := LinkID(hsh[:])
	converted, found := badWhitespaceLinkIDConversion[linkID.Export()]
	if !found {
		return linkID, nil
	}
	last := len(payload) - 1
	if payload[last] != '\n' {
		err := ChainLinkError{fmt.Sprintf("failed to strip newline from line '%s'", linkID.Export())}
		return nil, err
	}
	m.Debug("Fixing payload hash by stripping newline on link '%s'", linkID.Export())
	toHash := payload[0:last]
	hsh = sha256.Sum256(toHash)
	fixedLinkID := LinkID(hsh[:])
	if !fixedLinkID.Export().Eq(converted) {
		err := ChainLinkError{fmt.Sprintf("failed hash comparison after whitespace-fixing link '%s'", linkID.Export())}
		return nil, err
	}
	return fixedLinkID, nil
}

func (s *sigChainPayloadJSON) KID() (ret keybase1.KID, err error) {
	tmp, err := jsonparserw.GetString(s.b, "body", "key", "kid")
	if err != nil {
		return ret, err
	}
	ret = keybase1.KIDFromString(tmp)
	return ret, nil
}

func (s *sigChainPayloadJSON) Seqno() (keybase1.Seqno, error) {
	seqno, err := jsonparserw.GetInt(s.b, "seqno")
	return keybase1.Seqno(seqno), err
}

func (s *sigChainPayloadJSON) Type() (string, error) {
	return jsonparserw.GetString(s.b, "body", "type")
}

func (s *sigChainPayloadJSON) Version() (SigVersion, error) {
	tmp, err := jsonparserw.GetInt(s.b, "body", "version")
	return SigVersion(tmp), err
}

func (s *sigChainPayloadJSON) ClientNameAndVersion() (string, string) {
	name, _ := jsonparserw.GetString(s.b, "client", "name")
	version, _ := jsonparserw.GetString(s.b, "client", "version")
	return name, version
}

func (s *sigChainPayloadJSON) AssertJSON(linkID LinkID) (err error) {
	if !isJSONObject(s.b, linkID) {
		return ChainLinkError{"JSON payload has leading garbage"}
	}
	return nil
}

func (s *sigChainPayloadJSON) Prev() (LinkID, error) {
	data, typ, _, err := jsonparserw.Get(s.b, "prev")
	if err != nil {
		return nil, err
	}
	if typ == jsonparser.Null {
		return nil, nil
	}
	if typ != jsonparser.String {
		return nil, ChainLinkError{"bad JSON type for prev"}
	}
	tmp := string(data)
	return LinkIDFromHex(tmp)
}

func (s *sigChainPayloadJSON) HasRevocations() bool {
	if _, _, _, err := jsonparserw.Get(s.b, "body", "revoke", "sig_id"); err == nil {
		return true
	}
	if _, _, _, err := jsonparserw.Get(s.b, "body", "revoke", "sig_ids", "[0]"); err == nil {
		return true
	}
	if _, _, _, err := jsonparserw.Get(s.b, "body", "revoke", "kid"); err == nil {
		return true
	}
	if _, _, _, err := jsonparserw.Get(s.b, "body", "revoke", "kids", "[0]"); err == nil {
		return true
	}
	return false
}

func (s *sigChainPayloadJSON) HighSkip() (*HighSkip, error) {
	hs, dataType, _, err := jsonparserw.Get(s.b, "high_skip")
	// high_skip is optional, but must be an object if it exists
	if err != nil {
		switch pkgerrors.Cause(err) {
		case jsonparser.KeyPathNotFoundError:
			return nil, nil
		default:
			return nil, err
		}
	}

	if dataType != jsonparser.Object {
		return nil, ChainLinkError{fmt.Sprintf("When provided, expected high_skip to be a JSON object, was %v.", dataType)}
	}

	highSkipSeqnoInt, err := jsonparserw.GetInt(hs, "seqno")
	if err != nil {
		return nil, err
	}

	// highSkipHash can either be null (zero-value of a LinkID) or a hexstring.
	// We call GetString first instead of Get so we only parse the value
	// twice for the first link.
	highSkipHashStr, err := jsonparserw.GetString(hs, "hash")
	var highSkipHash LinkID
	if err != nil {
		// If there was an error parsing as a string, make sure the value is null.
		_, dataType, _, getErr := jsonparserw.Get(hs, "hash")
		if getErr != nil {
			return nil, getErr
		}
		if dataType != jsonparser.Null {
			return nil, ChainLinkError{
				fmt.Sprintf("high_skip.hash was neither a valid string (%v) nor null.", err.Error()),
			}
		}
	} else {
		highSkipHash, err = LinkIDFromHex(highSkipHashStr)
		if err != nil {
			return nil, err
		}
	}

	highSkip := NewHighSkip(keybase1.Seqno(highSkipSeqnoInt), highSkipHash)
	return &highSkip, nil
}

func (s *sigChainPayloadJSON) toSigIDSuffixParameters() (ret keybase1.SigIDSuffixParameters, err error) {
	var typ string
	var vers SigVersion
	typ, err = s.Type()
	if err != nil {
		return ret, err
	}
	vers, err = s.Version()
	if err != nil {
		return ret, err
	}
	return keybase1.SigIDSuffixParametersFromTypeAndVersion(typ, keybase1.SigVersion(vers)), nil
}

func newSigInfo(kid keybase1.KID, payload []byte, sig kbcrypto.NaclSignature) *kbcrypto.NaclSigInfo {
	return &kbcrypto.NaclSigInfo{
		Kid:      kid.ToBinaryKID(),
		Payload:  payload,
		Sig:      sig,
		SigType:  kbcrypto.SigKbEddsa,
		HashType: kbcrypto.HashPGPSha512,
		Detached: true,
	}
}

func decodeSig1Imploded(s string) (*kbcrypto.NaclSignature, error) {
	raw, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return nil, err
	}
	var ret kbcrypto.NaclSignature
	copy(ret[:], raw)
	return &ret, nil
}

func importLinkFromServerV1NaCl(m MetaContext, packed []byte) (*importRes, error) {
	var sigBody []byte
	var ret importRes
	var sigIDBase keybase1.SigIDBase
	var params keybase1.SigIDSuffixParameters

	sig1ImplodedRaw := jsonGetString(packed, "si1")
	if sig1ImplodedRaw == "" {
		return nil, ChainLinkError{"no si1 field as expected"}
	}

	sig1Imploded, err := decodeSig1Imploded(sig1ImplodedRaw)
	if err != nil {
		return nil, err
	}

	payloadJSON, err := getPayloadJSONFromServerLink(packed)
	if err != nil {
		return nil, err
	}
	version, err := payloadJSON.Version()
	if err != nil {
		return nil, err
	}
	if version != KeybaseSignatureV1 {
		return nil, ChainLinkError{"inner chainlink showed wrong version, while expecting 1"}
	}
	ret.linkID = payloadJSON.Hash()
	err = payloadJSON.AssertJSON(ret.linkID)
	if err != nil {
		return nil, err
	}
	ret.kid, err = payloadJSON.KID()
	if err != nil {
		return nil, err
	}
	sigInfo := newSigInfo(ret.kid, payloadJSON.Bytes(), *sig1Imploded)
	clientName, clientVersion := payloadJSON.ClientNameAndVersion()
	sigBody, sigIDBase, err = sigid.ComputeSigBodyAndID(sigInfo, clientName, clientVersion)
	if err != nil {
		return nil, err
	}
	params, err = payloadJSON.toSigIDSuffixParameters()
	if err != nil {
		return nil, err
	}
	ret.sigID = sigIDBase.ToSigID(params)
	ret.sig = base64.StdEncoding.EncodeToString(sigBody)
	ret.payload = payloadJSON.Bytes()
	return &ret, nil
}

type sig2Imploded struct {
	_struct   bool `codec:",toarray"` //nolint
	Sig       kbcrypto.NaclSignature
	OuterLink OuterLinkV2
	NumFields int
}

type sigChainPayloadJSON struct {
	b []byte
}

func newSigChainPayloadJSON(s string) *sigChainPayloadJSON {
	return &sigChainPayloadJSON{b: []byte(s)}
}

func newSigChainPayloadJSONFromBytes(b []byte) *sigChainPayloadJSON {
	return &sigChainPayloadJSON{b: b}
}

func (s *sigChainPayloadJSON) Bytes() []byte {
	return s.b
}

func (s *sigChainPayloadJSON) Hash() LinkID {
	return ComputeLinkID(s.b)
}

func getPayloadJSONFromServerLink(packed []byte) (*sigChainPayloadJSON, error) {
	data, _, _, err := jsonparserw.Get(packed, "payload_json")
	if err != nil {
		return nil, err
	}
	sdata, err := strconv.Unquote(`"` + string(data) + `"`)
	if err != nil {
		return nil, err
	}
	return newSigChainPayloadJSON(sdata), nil
}

func decodeSig2Imploded(s string) (*sig2Imploded, error) {
	raw, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return nil, err
	}
	var ret sig2Imploded
	if !msgpack.IsEncodedMsgpackArray(raw) {
		return nil, ChainLinkError{"expected a msgpack array but got leading junk"}
	}
	err = msgpack.Decode(&ret, raw)
	if err != nil {
		return nil, err
	}
	return &ret, nil
}

func importLinkFromServerV2Unstubbed(m MetaContext, packed []byte) (*importRes, error) {
	var ret importRes
	var sigIDBase keybase1.SigIDBase
	var params keybase1.SigIDSuffixParameters

	sig2ImplodedRaw := jsonGetString(packed, "si2")
	if sig2ImplodedRaw == "" {
		return nil, ChainLinkError{"no si2 field as expected"}
	}
	payloadJSON, err := getPayloadJSONFromServerLink(packed)
	if err != nil {
		return nil, err
	}
	version, err := payloadJSON.Version()
	if err != nil {
		return nil, err
	}
	if version != KeybaseSignatureV2 {
		return nil, ChainLinkError{"inner chainlink showed wrong version, while expecting 2"}
	}
	innerLinkID := payloadJSON.Hash()
	sig2Imploded, err := decodeSig2Imploded(sig2ImplodedRaw)
	if err != nil {
		return nil, err
	}
	sig2Imploded.OuterLink.Curr = innerLinkID
	prev, err := payloadJSON.Prev()
	if err != nil {
		return nil, err
	}
	sig2Imploded.OuterLink.Prev = prev
	seqno, err := payloadJSON.Seqno()
	if err != nil {
		return nil, err
	}
	sig2Imploded.OuterLink.Seqno = seqno
	fixupSeqType(&sig2Imploded.OuterLink.SeqType)

	outerPayload, err := sig2Imploded.OuterLink.EncodePartial(sig2Imploded.NumFields)
	if err != nil {
		m.Debug("EncodePartial failed on input si2=%s", sig2ImplodedRaw)
		return nil, err
	}
	ret.linkID = ComputeLinkID(outerPayload)

	err = payloadJSON.AssertJSON(ret.linkID)
	if err != nil {
		return nil, err
	}

	ret.kid, err = payloadJSON.KID()
	if err != nil {
		return nil, err
	}

	sigInfo := newSigInfo(ret.kid, outerPayload, sig2Imploded.Sig)

	sigBody, err := kbcrypto.EncodePacketToBytes(sigInfo)
	if err != nil {
		return nil, err
	}
	ret.sig = base64.StdEncoding.EncodeToString(sigBody)
	sigIDBase = kbcrypto.ComputeSigIDFromSigBody(sigBody)
	params, err = payloadJSON.toSigIDSuffixParameters()
	if err != nil {
		return nil, err
	}
	ret.sigID = sigIDBase.ToSigID(params)

	ret.ol2 = &OuterLinkV2WithMetadata{
		OuterLinkV2: sig2Imploded.OuterLink,
		raw:         outerPayload,
		sigID:       ret.sigID,
		sig:         base64.StdEncoding.EncodeToString(sigBody),
		kid:         ret.kid,
	}
	linkTypeStr, err := payloadJSON.Type()
	if err != nil {
		return nil, err
	}

	linkType, err := SigchainV2TypeFromV1TypeAndRevocations(
		linkTypeStr,
		SigHasRevokes(payloadJSON.HasRevocations()),
		sig2Imploded.OuterLink.IgnoreIfUnsupported,
	)
	if err != nil {
		return nil, err
	}
	highSkip, err := payloadJSON.HighSkip()
	if err != nil {
		return nil, err
	}
	err = sig2Imploded.OuterLink.AssertFields(
		KeybaseSignatureV2,
		seqno,
		prev,
		innerLinkID,
		linkType,
		sig2Imploded.OuterLink.SeqType,
		sig2Imploded.OuterLink.IgnoreIfUnsupported,
		highSkip,
	)
	if err != nil {
		return nil, err
	}
	ret.payload = payloadJSON.Bytes()
	return &ret, nil
}

func importLinkFromServerPGP(m MetaContext, sig string, packed []byte) (*importRes, error) {
	var ret importRes
	var err error
	var sigIDBase keybase1.SigIDBase

	ret.payload, sigIDBase, err = SigExtractPGPPayload(sig)
	if err != nil {
		return nil, err
	}
	ret.sigID = sigIDBase.ToSigIDLegacy()
	ret.linkID, err = computeLinkIDFromHashWithWhitespaceFixes(m, ret.payload)
	if err != nil {
		return nil, err
	}
	payloadJSON := newSigChainPayloadJSONFromBytes(ret.payload)

	err = payloadJSON.AssertJSON(ret.linkID)
	if err != nil {
		return nil, err
	}

	// Very old PGP signatures did not include kids in signature bodies.
	// So the server always returns such KIDs, and we check for equality
	// with what's in the payload if it was specified.
	payloadKID, _ := payloadJSON.KID()
	rawServerKID, err := jsonparserw.GetString(packed, "kid")
	if err != nil {
		return nil, err
	}
	serverKID := keybase1.KIDFromString(rawServerKID)
	if serverKID.IsNil() {
		return nil, ChainLinkError{"server returned an invalid KID for PGP key"}
	}
	if !payloadKID.IsNil() && !payloadKID.Equal(serverKID) {
		return nil, ChainLinkKIDMismatchError{"server returned a bad KID that didn't match PGP body"}
	}
	ret.kid = serverKID
	ret.payload = payloadJSON.Bytes()
	ret.sig = sig
	return &ret, nil
}
