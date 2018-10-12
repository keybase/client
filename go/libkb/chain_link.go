// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/buger/jsonparser"
	"github.com/keybase/client/go/jsonparserw"
	pkgerrors "github.com/pkg/errors"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

const (
	LinkIDLen = 32
)

type LinkID []byte

func GetLinkID(w *jsonw.Wrapper) (LinkID, error) {
	if w.IsNil() {
		return nil, nil
	}
	s, err := w.GetString()
	if err != nil {
		return nil, err
	}
	ret, err := LinkIDFromHex(s)
	return ret, err
}

func ImportLinkID(i keybase1.LinkID) (LinkID, error) {
	return LinkIDFromHex(string(i))
}

func GetLinkIDVoid(w *jsonw.Wrapper, l *LinkID, e *error) {
	ret, err := GetLinkID(w)
	if err != nil {
		*e = err
	} else {
		*l = ret
	}
}

func (l *LinkID) UnmarshalJSON(b []byte) error {
	lid, err := LinkIDFromHex(keybase1.Unquote(b))
	if err != nil {
		return err
	}
	*l = make([]byte, len(lid))
	copy((*l)[:], lid[:])
	return nil
}

func (l *LinkID) MarshalJSON() ([]byte, error) {
	return keybase1.Quote(l.String()), nil
}

func LinkIDFromHex(s string) (LinkID, error) {
	bv, err := hex.DecodeString(s)
	if err == nil && len(bv) != LinkIDLen {
		err = fmt.Errorf("Bad link ID; wrong length: %d", len(bv))
		bv = nil
	}
	var ret LinkID
	if bv != nil {
		ret = LinkID(bv)
	}
	return ret, err
}

func (l LinkID) String() string {
	return hex.EncodeToString(l)
}

func (l LinkID) Eq(i2 LinkID) bool {
	if l == nil && i2 == nil {
		return true
	} else if l == nil || i2 == nil {
		return false
	} else {
		return FastByteArrayEq(l[:], i2[:])
	}
}

type ChainLinkUnpacked struct {
	prev                               LinkID
	seqno                              keybase1.Seqno
	highSkip                           *HighSkip
	seqType                            keybase1.SeqType
	ignoreIfUnsupported                SigIgnoreIfUnsupported
	payloadLocal                       []byte // local track payloads
	payloadV2                          []byte
	ctime, etime                       int64
	pgpFingerprint                     *PGPFingerprint
	kid                                keybase1.KID
	eldestKID                          keybase1.KID
	sig                                string
	sigID                              keybase1.SigID
	uid                                keybase1.UID
	username                           string
	typ                                string
	proofText                          string
	outerLinkV2                        *OuterLinkV2WithMetadata
	sigVersion                         SigVersion // what the server hints is the sig version (must be verified)
	stubbed                            bool
	firstAppearedMerkleSeqnoUnverified keybase1.Seqno
	payloadHash                        []byte
	sigDropped                         bool
	hasRevocations                     bool
	merkleSeqno                        keybase1.Seqno
	merkleHashMeta                     keybase1.HashMeta
}

// A template for some of the reasons in badChainLinks below.
const badAkalin = "Link %d of akalin's sigchain, which was accidentally added by an old client in development on 23 Mar 2015 20:02 GMT."
const badJamGregory = "Link %d of jamgregory's sigchain, which had a bad PGP keypin"
const badDens = "Link 8 of dens's sigchain, which signs in a revoked PGP key"
const badAjar = "Link 98 of ajar's sigchain allowed a PGP update with a broken PGP key"

const akalin = keybase1.UID("ebbe1d99410ab70123262cf8dfc87900")
const jamGregory = keybase1.UID("e8767e19a3ed9c7350847b7b040de319")
const dens = keybase1.UID("ca9e948f6f7a4a19e02058ad626f6c19")
const ajar = keybase1.UID("d1d94b3131e493dfee738802843f7719")

type SpecialChainLink struct {
	UID    keybase1.UID
	Seqno  keybase1.Seqno
	Reason string
}

// A map from SigIDs of bad chain links that should be ignored to the
// reasons why they're ignored.
var badChainLinks = map[keybase1.LinkID]SpecialChainLink{
	// Links 22-25 of akalin's sigchain, which was accidentally
	// added by an old client in development on 3/23/2015, 9:02am.
	// Links 17-19 of jamGregory's sigchain, which referred to a corrupted
	// PGP key. See https://github.com/keybase/client/issues/1908
	// Link 8 of dens's sigchain is to a revoked PGP key, which wasn't
	// properly checked for on the server side.
	// See: https://github.com/keybase/client/issues/4754
	// Link 98 of ajar's sigchain is a PGP update with a broken PGP key,
	// that doesn't have a valid cross-sig on a signing key. It was a server
	// bug to allow it be uploaded.
	"694ed7166cee72449964e97bcd4be58243877718425c4dc655d2d80832bd5cdf": SpecialChainLink{UID: akalin, Seqno: keybase1.Seqno(22), Reason: fmt.Sprintf(badAkalin, 22)},
	"27bc88059a768a82b1a21dcc1c46f7fc61c2d2b80c445eb2d18fed3a5bb42e49": SpecialChainLink{UID: akalin, Seqno: keybase1.Seqno(23), Reason: fmt.Sprintf(badAkalin, 23)},
	"12b594e44d9289349283f8b14a6f83ad144a17a3025a758e17d4eca70fbdc923": SpecialChainLink{UID: akalin, Seqno: keybase1.Seqno(24), Reason: fmt.Sprintf(badAkalin, 24)},
	"ce162011e380c954de15f30db28f8b7b358866d2721143d9d0d4424166ce5ed8": SpecialChainLink{UID: akalin, Seqno: keybase1.Seqno(25), Reason: fmt.Sprintf(badAkalin, 25)},
	"bf914e6d4cf9b4eb7c88c2a8a6f5650e969ade9a97cf1605c1eb8cae97d5d278": SpecialChainLink{UID: jamGregory, Seqno: keybase1.Seqno(17), Reason: fmt.Sprintf(badJamGregory, 17)},
	"e56f492c1b519905d04ce51368e87794963906dd6dacb63fbeab7ad23596af29": SpecialChainLink{UID: jamGregory, Seqno: keybase1.Seqno(18), Reason: fmt.Sprintf(badJamGregory, 18)},
	"51e46dad8b71a1a7204368f9cb4931257a32eed92cf3b97a08190c12912739dd": SpecialChainLink{UID: jamGregory, Seqno: keybase1.Seqno(19), Reason: fmt.Sprintf(badJamGregory, 19)},
	"6d527d776cb28ea980c6e0474286fe745377e116fd5d07b44928d165ae4b7c97": SpecialChainLink{UID: dens, Seqno: keybase1.Seqno(8), Reason: badDens},
	"9b3b3a3d973449ca3238bf59b7407186dc80242b917c158cba5e374595257dd0": SpecialChainLink{UID: ajar, Seqno: keybase1.Seqno(98), Reason: badAjar},
}

// Some chainlinks are broken and need a small whitespace addition to match their payload
// hash in subsequent chainlinks.  Caused by bad code on 15 Sep 2015.
const whitespaceIssue20150915 = "Bad whitespace stripping on 15 Sep 2015"

var badWhitespaceChainLinks = map[keybase1.SigID]string{
	"595a73fc649c2c8ccc1aa79384e0b3e7ab3049d8df838f75ef0edbcb5bbc42990f": whitespaceIssue20150915,
	"e256078702afd7a15a24681259935b48342a49840ab6a90291b300961669790f0f": whitespaceIssue20150915,
	"30831001edee5e01c3b5f5850043f9ef7749a1ed8624dc703ae0922e1d0f16dd0f": whitespaceIssue20150915,
	"88e6c581dbccbf390559bcb30ca21548ba0ec4861ec2d666217bd4ed4a4a8c3f0f": whitespaceIssue20150915,
	"4db0fe3973b3a666c7830fcb39d93282f8bc414eca1d535033a5cc625eabda0c0f": whitespaceIssue20150915,
	"9ba23a9a1796fb22b3c938f1edf5aba4ca5be7959d9151895eb6aa7a8d8ade420f": whitespaceIssue20150915,
	"df0005f6c61bd6efd2867b320013800781f7f047e83fd44d484c2cb2616f019f0f": whitespaceIssue20150915,
	"a32692af33e559e00a40aa3bb4004744d2c1083112468ed1c8040eaacd15c6eb0f": whitespaceIssue20150915,
	"3e61901f50508aba72f12740fda2be488571afc51d718d845e339e5d1d1b531d0f": whitespaceIssue20150915,
	"de43758b653b3383aca640a96c7890458eadd35242e8f8531f29b606890a14ea0f": whitespaceIssue20150915,
	"b9ee3b46c97d48742a73e35494d3a373602460609e3c6c54a553fc4d83b659e40f": whitespaceIssue20150915,
	"0ff29c1d036c3f4841f3f485e28d77351abb3eeeb52d2f8d802fd15e383d9a5f0f": whitespaceIssue20150915,
	"eb1a13c6b6e42bb7470e222b51d36144a25ffc4fbc0b32e9a1ec11f059001bc80f": whitespaceIssue20150915,
	"9c189d6d644bad9596f78519d870a685624f813afc1d0e49155073d3b0521f970f": whitespaceIssue20150915,
	"aea7c8f7726871714e777ac730e77e1905a38e9587f9504b739ff9b77ef2d5cc0f": whitespaceIssue20150915,
	"ac6e225b8324c1fcbe814382e198495bea801dfeb56cb22b9e89066cc52ab03b0f": whitespaceIssue20150915,
	"3034e8b7d75861fc28a478b4992a8592b5478d4cbc7b87150d0b59573d731d870f": whitespaceIssue20150915,
	"140f1b7b7ba32f34ad6302d0ed78692cf1564760d78c082965dc3b8b5f7e27f10f": whitespaceIssue20150915,
	"833f27edcf54cc489795df1dc7d9f0cbea8253e1b84f5e82749a7a2a4ffc295c0f": whitespaceIssue20150915,
	"110a64513b4188eca2af6406a8a6dbf278dfce324b8879b5cb67e8626ff2af180f": whitespaceIssue20150915,
	"3042dbe45383b0c2eafe13a73da35c4e721be026d7908dfcef6eb121d95b75b10f": whitespaceIssue20150915,
	"50ba350ddc388f7c6fdba032a7d283e4caa0ca656f92f69257213222dd7deeaf0f": whitespaceIssue20150915,
	"803854b4074d668e1761ee9c533c0fc576bd0404cf26ff7545e14512f3b9002f0f": whitespaceIssue20150915,
	"2e08f0b9566e15fa1f9e67b236e5385cdb38d57ff51d7ab3e568532867c9f8890f": whitespaceIssue20150915,
	"cb97f4b62f2e817e8db8c6193440214ad20f906571e4851db186869f0b4c0e310f": whitespaceIssue20150915,
	"a5c4a30d1eaaf752df424bf813c5a907a5cf94fd371e280d39e0a3d078310fba0f": whitespaceIssue20150915,
	"c7d26afbc1957ecca890d8d9001a9cc4863490161720ad76a2aedeb8c2d50df70f": whitespaceIssue20150915,
	"b385c0c76d790aba156ff68fd571171fc7cb85f75e7fc9d1561d7960d8875acb0f": whitespaceIssue20150915,
	"47d349b8bb3c8457449390ca2ed5e489a70ad511ab3edb4c7f0af27eed8c65d30f": whitespaceIssue20150915,
	"2785b24acd6869e1e7d38a91793af549f3c35cd0729127d200b66f8c0ffba59b0f": whitespaceIssue20150915,
	"503df567f98cf5910ba44cb95e157e656afe95d159a15c7df4e88ac6016c948f0f": whitespaceIssue20150915,
	"2892863758cdaf9796fb36e2466093762efda94e74eb51e3ab9d6bec54064b8a0f": whitespaceIssue20150915,
	"e1d60584995e677254f7d913b3f40060b5500241d6de0c5822ba1282acc5e08b0f": whitespaceIssue20150915,
	"031b506b705926ea962e59046bfe1720dcf72c85310502020e2ae836b294fcde0f": whitespaceIssue20150915,
	"1454fec21489f17a6d78927af1c9dca4209360c6ef6bfa569d8b62d32e668ea30f": whitespaceIssue20150915,
	"ba68052597a3782f64079d7d9ec821ea9785c0868e44b597a04c9cd8bf634c1e0f": whitespaceIssue20150915,
	"db8d59151b2f78c82c095c9545f1e4d39947a0c0bcc01b907e0ace14517d39970f": whitespaceIssue20150915,
	"e088beccfee26c5df39239023d1e4e0cbcd63fd50d0bdc4bf2c2ba25ef1a8fe40f": whitespaceIssue20150915,
	"8182f385c347fe57d3c46fe40e8df0e2d6cabdac38f490417b313050249be9dc0f": whitespaceIssue20150915,
	"2415e1c77b0815661452ea683e366c6d9dfd2008a7dbc907004c3a33e56cf6190f": whitespaceIssue20150915,
	"44847743878bd56f5cd74980475e8f4e95d0d6ec1dd8722fd7cfc7761698ec780f": whitespaceIssue20150915,
	"70c4026afec66312456b6820492b7936bff42b58ca7a035729462700677ef4190f": whitespaceIssue20150915,
	"7591a920a5050de28faad24b5fe3336f658b964e0e64464b70878bfcf04537420f": whitespaceIssue20150915,
	"10a45e10ff2585b03b9b5bc449cb1a7a44fbb7fcf25565286cb2d969ad9b89ae0f": whitespaceIssue20150915,
	"062e6799f211177023bc310fd6e4e28a8e2e18f972d9b037d24434a203aca7240f": whitespaceIssue20150915,
	"db9a0afaab297048be0d44ffd6d89a3eb6a003256426d7fd87a60ab59880f8160f": whitespaceIssue20150915,
	"58bf751ddd23065a820449701f8a1a0a46019e1c54612ea0867086dbd405589a0f": whitespaceIssue20150915,
}

type ChainLink struct {
	Contextified
	parent            *SigChain
	id                LinkID
	diskVersion       int
	hashVerified      bool
	sigVerified       bool
	payloadVerified   bool
	chainVerified     bool
	highChainVerified bool
	storedLocally     bool
	revoked           bool
	unsigned          bool
	dirty             bool
	revocationsCache  *[]keybase1.SigID
	computedHighSkip  *HighSkip

	unpacked *ChainLinkUnpacked
	cki      *ComputedKeyInfos

	typed                  TypedChainLink
	isOwnNewLinkFromServer bool
}

// See NCC-KB2018-006
func (c ChainLink) checkSpecialLinksTable(tab map[keybase1.LinkID]SpecialChainLink, uid keybase1.UID, why string) (found bool, reason string, err error) {
	var scl SpecialChainLink

	// The combination of hashVerified and chainVerified should ensure that this link
	// is only considered here after all prevs have been successfully checked.
	if !c.canTrustID() {
		return false, "", ChainLinkError{fmt.Sprintf("cannot check if a link is %q without a verified link ID (linkID=%s, uid=%s, hash=%v, chain=%v, diskVersion=%d)", why, c.id, uid, c.hashVerified, c.chainVerified, c.diskVersion)}
	}

	scl, found = tab[c.LinkID().Export()]
	if !found {
		return false, "", nil
	}
	if !c.GetSeqno().Eq(scl.Seqno) {
		return false, "", NewChainLinkWrongSeqnoError(fmt.Sprintf("malicious bad link in from server has wrong seqno in %q check: %d != %d", why, c.GetSeqno(), scl.Seqno))
	}
	if !scl.UID.Equal(uid) {
		return false, "", NewUIDMismatchError(fmt.Sprintf("malicious bad link from server in %q check; UID %s != %s", why, scl.UID, uid))
	}
	return true, scl.Reason, nil
}

func (c *ChainLink) IsBad() (isBad bool, reason string, err error) {
	return c.checkSpecialLinksTable(badChainLinks, c.parent.uid, "bad chain links")
}

func (c *ChainLink) Parent() *SigChain {
	return c.parent
}

func (c *ChainLink) SetParent(parent *SigChain) {
	if c.parent != nil {
		c.G().Log.Warning("changing ChainLink parent")
	}
	c.parent = parent
}

func (c *ChainLink) getPrevFromPayload() LinkID {
	return c.unpacked.prev
}

func (c *ChainLink) getSeqTypeFromPayload() keybase1.SeqType {
	return c.unpacked.seqType
}

func (c *ChainLink) getIgnoreIfUnsupportedFromPayload() SigIgnoreIfUnsupported {
	return c.unpacked.ignoreIfUnsupported
}

func (c *ChainLink) GetIgnoreIfSupported() SigIgnoreIfUnsupported {
	return c.getIgnoreIfUnsupportedFromPayload()
}

func (c *ChainLink) getHighSkipFromPayload() *HighSkip {
	return c.unpacked.highSkip
}

func (c *ChainLink) IsStubbed() bool {
	return c.unpacked.stubbed
}

func (c *ChainLink) IsEldest() bool {
	if c.unpacked == nil {
		return false
	}
	if c.unpacked.outerLinkV2 != nil {
		return c.unpacked.outerLinkV2.LinkType == SigchainV2TypeEldest
	}
	if c.unpacked.typ == string(DelegationTypeEldest) {
		return true
	}
	return false
}

func (c *ChainLink) GetPrev() LinkID {
	return c.unpacked.prev
}

func (c *ChainLink) GetCTime() time.Time {
	if c.IsStubbed() {
		return time.Time{}
	}

	return time.Unix(int64(c.unpacked.ctime), 0)
}

func (c *ChainLink) GetETime() time.Time {
	if c.IsStubbed() {
		return time.Time{}
	}
	return UnixToTimeMappingZero(c.unpacked.etime)
}

func (c *ChainLink) GetFirstAppearedMerkleSeqnoUnverified() keybase1.Seqno {
	if c.IsStubbed() {
		return keybase1.Seqno(0)
	}
	return c.unpacked.firstAppearedMerkleSeqnoUnverified
}

func (c *ChainLink) GetUID() keybase1.UID {
	return c.unpacked.uid
}

func (c *ChainLink) UnmarshalPayloadJSON() *jsonw.Wrapper {
	jw, err := c.G().PayloadCache.GetOrPrime(c)
	if err != nil {
		// Any unmarshal error here would already have
		// happened in Unpack
		return nil
	}
	return jw
}

func (c *ChainLink) ToSigChainLocation() keybase1.SigChainLocation {
	return keybase1.SigChainLocation{
		Seqno: c.GetSeqno(),
		// This code is meant only for user chains
		SeqType: keybase1.SeqType_PUBLIC,
	}
}

const chainLinkDiskVersion = 1

func (c *ChainLink) canTrustID() bool {
	return c.hashVerified || (c.storedLocally && c.diskVersion < 2)
}

func (c *ChainLink) Pack() (*jsonw.Wrapper, error) {
	p := jsonw.NewDictionary()

	if c.IsStubbed() {
		p.SetKey("s2", jsonw.NewString(c.unpacked.outerLinkV2.EncodeStubbed()))
	} else {
		// store the payload for v2 links and local tracks
		if c.unpacked.sigVersion == KeybaseSignatureV2 {
			p.SetKey("payload_json", jsonw.NewString(string(c.unpacked.payloadV2)))
		} else if len(c.unpacked.payloadLocal) > 0 {
			p.SetKey("payload_json", jsonw.NewString(string(c.unpacked.payloadLocal)))
		}

		p.SetKey("sig", jsonw.NewString(c.unpacked.sig))
		p.SetKey("sig_id", jsonw.NewString(string(c.unpacked.sigID)))
		p.SetKey("kid", c.unpacked.kid.ToJsonw())
		p.SetKey("ctime", jsonw.NewInt64(c.unpacked.ctime))
		if c.unpacked.pgpFingerprint != nil {
			p.SetKey("fingerprint", jsonw.NewString(c.unpacked.pgpFingerprint.String()))
		}
		p.SetKey("sig_verified", jsonw.NewBool(c.sigVerified))
		p.SetKey("chain_verified", jsonw.NewBool(c.chainVerified))
		p.SetKey("hash_verified", jsonw.NewBool(c.hashVerified))
		p.SetKey("proof_text_full", jsonw.NewString(c.unpacked.proofText))
		p.SetKey("sig_version", jsonw.NewInt(int(c.unpacked.sigVersion)))
		p.SetKey("merkle_seqno", jsonw.NewInt64(int64(c.unpacked.firstAppearedMerkleSeqnoUnverified)))
		p.SetKey("disk_version", jsonw.NewInt(chainLinkDiskVersion))
	}

	if c.cki != nil {
		p.SetKey("computed_key_infos", jsonw.NewWrapper(*c.cki))
	}

	return p, nil
}

func (c *ChainLink) GetMerkleSeqno() keybase1.Seqno {
	if c.IsStubbed() {
		return 0
	}
	return c.unpacked.merkleSeqno
}

func (c *ChainLink) GetMerkleHashMeta() (keybase1.HashMeta, error) {
	if c.IsStubbed() {
		return nil, nil
	}
	return c.unpacked.merkleHashMeta, nil
}

func (c *ChainLink) HasRevocations() bool {
	if c.IsStubbed() {
		return false
	}
	if c.unpacked != nil {
		return c.unpacked.hasRevocations
	}
	return false
}

func (tmp *ChainLinkUnpacked) HasRevocations(payload []byte) bool {
	if _, _, _, err := jsonparserw.Get(payload, "body", "revoke", "sig_id"); err == nil {
		return true
	}
	if _, _, _, err := jsonparserw.Get(payload, "body", "revoke", "sig_ids", "[0]"); err == nil {
		return true
	}
	if _, _, _, err := jsonparserw.Get(payload, "body", "revoke", "kid"); err == nil {
		return true
	}
	if _, _, _, err := jsonparserw.Get(payload, "body", "revoke", "kids", "[0]"); err == nil {
		return true
	}
	return false
}

func (c *ChainLink) GetRevocations() []keybase1.SigID {
	if c.IsStubbed() {
		return nil
	}
	if c.revocationsCache != nil {
		return *c.revocationsCache
	}
	payload, err := c.unpacked.Payload()
	if err != nil {
		return nil
	}
	var ret []keybase1.SigID
	if !bytes.Contains(payload, []byte("revoke")) {
		c.revocationsCache = &ret
		return nil
	}
	if s, err := jsonparserw.GetString(payload, "body", "revoke", "sig_id"); err == nil {
		if sigID, err := keybase1.SigIDFromString(s, true); err == nil {
			ret = append(ret, sigID)
		}
	}

	jsonparserw.ArrayEach(payload, func(value []byte, dataType jsonparser.ValueType, offset int, err error) {
		if s, err := keybase1.SigIDFromString(string(value), true); err == nil {
			ret = append(ret, s)
		}
	}, "body", "revoke", "sig_ids")

	c.revocationsCache = &ret
	return ret
}

func (c *ChainLink) GetRevokeKids() []keybase1.KID {
	if c.IsStubbed() {
		return nil
	}

	payload, err := c.unpacked.Payload()
	if err != nil {
		return nil
	}
	var ret []keybase1.KID
	if s, err := jsonparserw.GetString(payload, "body", "revoke", "kid"); err == nil {
		ret = append(ret, keybase1.KIDFromString(s))
	}

	jsonparserw.ArrayEach(payload, func(value []byte, dataType jsonparser.ValueType, offset int, err error) {
		ret = append(ret, keybase1.KIDFromString(string(value)))
	}, "body", "revoke", "kids")

	return ret
}

func (c *ChainLink) checkAgainstMerkleTree(t *MerkleTriple) (found bool, err error) {
	if c.IsStubbed() {
		return false, ChainLinkError{"cannot check stubbed link against the merkle tree"}
	}
	found = false
	if t != nil && c.GetSeqno() == t.Seqno {
		c.G().Log.Debug("| Found chain tail advertised in Merkle tree @%d", int(t.Seqno))
		found = true
		if !c.id.Eq(t.LinkID) {
			err = fmt.Errorf("Bad chain ID at seqno=%d", int(t.Seqno))
		}
	}
	return
}

func getSigVersionFromPayload(payload []byte) (SigVersion, error) {
	var err error
	var i int64
	if i, err = jsonparserw.GetInt(payload, "body", "version"); err != nil {
		return KeybaseNullSigVersion, ChainLinkError{"link is missing a version field"}
	}
	return SigVersion(int(i)), nil
}

func (tmp *ChainLinkUnpacked) parseHighSkipFromPayload(payload []byte) (*HighSkip, error) {
	hs, dataType, _, err := jsonparserw.Get(payload, "high_skip")
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

func (tmp *ChainLinkUnpacked) unpackPayloadJSON(g *GlobalContext, payload []byte) error {

	if !IsJSONObject(payload) {
		return ChainLinkError{"chain link is not a valid JSON object as expected; found leading junk"}
	}

	if s, err := jsonparserw.GetString(payload, "body", "key", "fingerprint"); err == nil {
		if tmp.pgpFingerprint, err = PGPFingerprintFromHex(s); err != nil {
			return err
		}
	}
	if s, err := jsonparserw.GetString(payload, "body", "key", "kid"); err == nil {
		tmp.kid = keybase1.KIDFromString(s)
	}
	if s, err := jsonparserw.GetString(payload, "body", "key", "eldest_kid"); err == nil {
		tmp.eldestKID = keybase1.KIDFromString(s)
	}

	var err error
	tmp.username, err = jsonparserw.GetString(payload, "body", "key", "username")
	if err != nil {
		return err
	}
	suid, err := jsonparserw.GetString(payload, "body", "key", "uid")
	if err != nil {
		return err
	}
	if tmp.uid, err = UIDFromHex(suid); err != nil {
		return err
	}

	if prev, err := jsonparserw.GetString(payload, "prev"); err == nil {
		tmp.prev, err = LinkIDFromHex(prev)
		if err != nil {
			return err
		}
	}

	highSkip, err := tmp.parseHighSkipFromPayload(payload)
	if err != nil {
		return err
	}
	tmp.highSkip = highSkip

	tmp.typ, err = jsonparserw.GetString(payload, "body", "type")
	if err != nil {
		return err
	}

	tmp.ctime, err = jsonparserw.GetInt(payload, "ctime")
	if err != nil {
		return err
	}

	seqno, err := jsonparserw.GetInt(payload, "seqno")
	if err != nil {
		return err
	}
	tmp.seqno = keybase1.Seqno(seqno)

	if tmp.HasRevocations(payload) {
		tmp.hasRevocations = true
	}

	// Assume public unless its a number
	tmp.seqType = keybase1.SeqType_PUBLIC
	if seqTypeInt, err := jsonparserw.GetInt(payload, "seq_type"); err == nil {
		tmp.seqType = keybase1.SeqType(seqTypeInt)
	}

	// Assume false if unsupported
	tmp.ignoreIfUnsupported = SigIgnoreIfUnsupported(false)
	if ignore, err := jsonparserw.GetBoolean(payload, "ignore_if_unsupported"); err == nil {
		tmp.ignoreIfUnsupported = SigIgnoreIfUnsupported(ignore)
	}

	// Due to an earlier error, it's possible for the merkle root that we signed over
	// to be in one of two places, so check both.
	if i, err := jsonparserw.GetInt(payload, "body", "merkle_root", "seqno"); err == nil {
		tmp.merkleSeqno = keybase1.Seqno(i)
	} else if i, err := jsonparserw.GetInt(payload, "merkle_root", "seqno"); err == nil {
		tmp.merkleSeqno = keybase1.Seqno(i)
	}

	// Hash meta was only ever in the correct place (within body)
	if s, err := jsonparserw.GetString(payload, "body", "merkle_root", "hash_meta"); err == nil {
		tmp.merkleHashMeta, err = keybase1.HashMetaFromString(s)
		if err != nil {
			return err
		}
	}

	ei, err := jsonparserw.GetInt(payload, "expire_in")
	if err != nil {
		return err
	}

	tmp.etime = tmp.ctime + ei

	tmp.payloadHash = fixAndHashPayload(g, payload, tmp.sigID)

	if tmp.sigVersion == KeybaseSignatureV2 {
		tmp.payloadV2 = payload
	}

	return nil
}

func (c *ChainLink) UnpackLocal(payload []byte) (err error) {
	tmp := ChainLinkUnpacked{}
	err = tmp.unpackPayloadJSON(c.G(), payload)
	if err == nil {
		tmp.payloadLocal = payload
		c.unpacked = &tmp
	}
	return
}

func (c *ChainLink) UnpackComputedKeyInfos(data []byte) error {
	if data == nil {
		return nil
	}
	var tmp ComputedKeyInfos
	tmp.SetGlobalContext(c.G())
	if err := json.Unmarshal(data, &tmp); err == nil {
		c.cki = &tmp
	} else {
		return err
	}
	return nil
}

func (c *ChainLink) unpackStubbed(raw string) error {
	ol, err := DecodeStubbedOuterLinkV2(raw)
	if err != nil {
		return err
	}
	if ol.SeqType == 0 {
		// Assume public if unset
		ol.SeqType = keybase1.SeqType_PUBLIC
	}

	if !ol.IgnoreIfUnsupported.Bool() && !ol.LinkType.IsSupportedType() {
		return ChainLinkStubbedUnsupportedError{fmt.Sprintf("Stubbed link with type %d is unknown and not marked with IgnoreIfUnsupported", ol.LinkType)}
	}

	c.id = ol.LinkID()

	// Because the outer link does not have a highSkip parent object, we check
	// for the nullity of highSkipSeqno to see if highSkip should be set, since
	// a null highSkipHash is valid when specifying highSkip=0.
	var highSkipPtr *HighSkip
	if ol.HighSkipSeqno != nil {
		highSkip := NewHighSkip(*ol.HighSkipSeqno, *ol.HighSkipHash)
		highSkipPtr = &highSkip
	}

	c.unpacked = &ChainLinkUnpacked{
		prev:                ol.Prev,
		seqno:               ol.Seqno,
		seqType:             ol.SeqType,
		ignoreIfUnsupported: ol.IgnoreIfUnsupported,
		highSkip:            highSkipPtr,
		sigVersion:          ol.Version,
		outerLinkV2:         ol,
		stubbed:             true,
	}
	return nil
}

func (c *ChainLink) Unpack(m MetaContext, trusted bool, selfUID keybase1.UID, packed []byte) error {
	if s, err := jsonparserw.GetString(packed, "s2"); err == nil {
		return c.unpackStubbed(s)
	}

	tmp := ChainLinkUnpacked{}
	s, err := jsonparserw.GetString(packed, "sig_id")
	if err != nil {
		return err
	}
	tmp.sigID, err = keybase1.SigIDFromString(s, true)
	if err != nil {
		return err
	}
	tmp.sig, err = jsonparserw.GetString(packed, "sig")
	if err != nil {
		return err
	}

	// Beware that this is server-untrusted data at this point. We'll have to check it
	// before we can exit without error (see below).
	tmp.sigVersion = KeybaseSignatureV1
	if sv, err := jsonparserw.GetInt(packed, "sig_version"); err == nil {
		tmp.sigVersion = SigVersion(int(sv))
		if tmp.sigVersion != KeybaseSignatureV1 && tmp.sigVersion != KeybaseSignatureV2 {
			return ChainLinkError{fmt.Sprintf("Bad sig_version: expected 1 or 2 but got %d", tmp.sigVersion)}
		}
	}

	if i, err := jsonparserw.GetInt(packed, "merkle_seqno"); err == nil {
		tmp.firstAppearedMerkleSeqnoUnverified = keybase1.Seqno(i)
	}

	var payload []byte
	if trusted && tmp.sigVersion == KeybaseSignatureV1 {
		// use payload from sig
		payload, err = tmp.Payload()
		if err != nil {
			return err
		}
	} else {
		// use the payload in payload_json
		data, _, _, err := jsonparserw.Get(packed, "payload_json")
		if err != nil {
			return err
		}

		// unquote it
		sdata, err := strconv.Unquote(`"` + string(data) + `"`)
		if err != nil {
			return err
		}
		payload = []byte(sdata)

		if tmp.sigVersion == KeybaseSignatureV1 {
			// check that payload_json matches payload in sig
			sigPayload, err := tmp.Payload()
			if err != nil {
				return err
			}

			payloadFixed := c.fixPayload(payload, tmp.sigID)

			if !FastByteArrayEq(payloadFixed, sigPayload) {
				return ChainLinkError{"sig payload does not match payload_json"}
			}

			// mark the payload verified so verification can be skipped in the future
			c.markPayloadVerified(tmp.sigID)
		}
	}

	// unpack the payload
	if err := tmp.unpackPayloadJSON(c.G(), payload); err != nil {
		m.CDebugf("unpack payload json err: %s", err)
		return err
	}

	// We previously took the server's word on what version we wanted, but now
	// we're going to check that it matches what we actually sign over -- what's
	// in the JSON payload. If it doesn't match, the we error out right here.
	if err := tmp.assertPayloadSigVersionMatchesHint(payload); err != nil {
		return err
	}

	var sigKID, serverKID, payloadKID keybase1.KID

	if tmp.sigVersion == KeybaseSignatureV2 {
		var ol2 *OuterLinkV2WithMetadata
		ol2, err = DecodeOuterLinkV2(tmp.sig)
		if err != nil {
			return err
		}
		if ol2.SeqType == 0 {
			// Assume public if unset
			ol2.SeqType = keybase1.SeqType_PUBLIC
		}
		tmp.outerLinkV2 = ol2
		sigKID = ol2.kid
	}

	payloadKID = tmp.kid

	if kid, err := jsonparserw.GetString(packed, "kid"); err == nil {
		serverKID = keybase1.KIDFromString(kid)
	}

	if !payloadKID.IsNil() && !serverKID.IsNil() && !payloadKID.Equal(serverKID) {
		return ChainLinkKIDMismatchError{
			fmt.Sprintf("Payload KID (%s) doesn't match server KID (%s).",
				payloadKID, serverKID),
		}
	}

	if !payloadKID.IsNil() && !sigKID.IsNil() && !payloadKID.Equal(sigKID) {
		return ChainLinkKIDMismatchError{
			fmt.Sprintf("Payload KID (%s) doesn't match sig KID (%s).",
				payloadKID, sigKID),
		}
	}

	if !serverKID.IsNil() && !sigKID.IsNil() && !serverKID.Equal(sigKID) {
		return ChainLinkKIDMismatchError{
			fmt.Sprintf("Server KID (%s) doesn't match sig KID (%s).",
				serverKID, sigKID),
		}
	}

	if tmp.kid.IsNil() && !sigKID.IsNil() {
		tmp.kid = sigKID
	}
	if tmp.kid.IsNil() && !serverKID.IsNil() {
		tmp.kid = serverKID
	}

	// Note, we can still be in a situation in which don't know any kids!
	// That would be bad *if* we need to verify the signature for this link.

	// only unpack the proof_text_full if owner of this link
	if tmp.uid.Equal(selfUID) {
		if pt, err := jsonparserw.GetString(packed, "proof_text_full"); err == nil {
			tmp.proofText = pt
		}
	}

	c.unpacked = &tmp

	// IF we're loaded from *trusted* storage, like our local
	// DB, then we can skip verification later
	if trusted {
		if b, err := jsonparserw.GetBoolean(packed, "sig_verified"); err == nil && b {
			c.sigVerified = true
			m.VLogf(VLog1, "| Link is marked as 'sig_verified'")
			if ckidata, _, _, err := jsonparserw.Get(packed, "computed_key_infos"); err == nil {
				if uerr := c.UnpackComputedKeyInfos(ckidata); uerr != nil {
					m.CWarningf("Problem unpacking computed key infos: %s", uerr)
				}
			}
		}
		if b, err := jsonparserw.GetBoolean(packed, "hash_verified"); err == nil && b {
			c.hashVerified = true
		}
		if b, err := jsonparserw.GetBoolean(packed, "chain_verified"); err == nil && b {
			c.chainVerified = true
		}
		if i, err := jsonparserw.GetInt(packed, "disk_version"); err == nil {
			c.diskVersion = int(i)
		}
	}

	c.G().VDL.Log(VLog1, "| Unpacked Link %s", c.id)

	return nil
}

func (tmp *ChainLinkUnpacked) Payload() ([]byte, error) {
	// local track payloads are stored in ChainLinkUnpacked.
	// if anything there, use it:
	if len(tmp.payloadLocal) > 0 {
		return tmp.payloadLocal, nil
	}

	switch tmp.sigVersion {
	case KeybaseSignatureV1:
		// v1 links have the payload inside the sig
		sigPayload, _, _, err := SigExtractPayloadAndKID(tmp.sig)
		return sigPayload, err
	case KeybaseSignatureV2:
		// v2 links have the payload in ChainLinkUnpacked
		return tmp.payloadV2, nil
	default:
		return nil, ChainLinkError{msg: fmt.Sprintf("unexpected signature version: %d", tmp.sigVersion)}
	}
}

func (tmp *ChainLinkUnpacked) assertPayloadSigVersionMatchesHint(payload []byte) error {
	payloadVersion, err := getSigVersionFromPayload(payload)
	if err != nil {
		return err
	}
	if tmp.sigVersion != payloadVersion {
		return ChainLinkError{msg: fmt.Sprintf("Big sigchain version hint from server: %d != %d", tmp.sigVersion, payloadVersion)}
	}
	return nil
}

func (c *ChainLink) CheckNameAndID(s NormalizedUsername, i keybase1.UID) error {

	// We can't check name and ID if we have compacted chain link with no
	// payload JSON
	if c.IsStubbed() {
		return nil
	}

	if c.unpacked.uid.NotEqual(i) {
		return UIDMismatchError{
			fmt.Sprintf("UID mismatch %s != %s in Link %s", c.unpacked.uid, i, c.id),
		}
	}
	if !s.Eq(NewNormalizedUsername(c.unpacked.username)) {
		return NewBadUsernameErrorWithFullMessage(
			fmt.Sprintf("Username mismatch %s != %s in Link %s",
				c.unpacked.username, s, c.id))
	}
	return nil

}

func ComputeLinkID(d []byte) LinkID {
	h := sha256.Sum256(d)
	return LinkID(h[:])
}

func (c *ChainLink) getPayloadHash() LinkID {
	if c.unpacked == nil {
		return nil
	}
	return c.unpacked.payloadHash
}

func (c *ChainLink) verifyHashV2() error {
	if c.hashVerified {
		return nil
	}
	ol := c.unpacked.outerLinkV2
	if ol == nil {
		return fmt.Errorf("nil outer link V2 unpacking")
	}
	if h := ol.LinkID(); !FastByteArrayEq(h, c.id) {
		return SigchainV2MismatchedHashError{}
	}
	c.hashVerified = true
	c.G().LinkCache().Mutate(c.id, func(c *ChainLink) { c.hashVerified = true })
	return nil
}

func (c *ChainLink) verifyHashV1() error {
	if c.hashVerified {
		return nil
	}
	h := c.getPayloadHash()
	if !FastByteArrayEq(h[:], c.id) {
		return fmt.Errorf("hash mismatch in verifyHashV1")
	}
	c.hashVerified = true
	c.G().LinkCache().Mutate(c.id, func(c *ChainLink) { c.hashVerified = true })
	return nil
}

func (c *ChainLink) markChainVerified() {
	c.chainVerified = true
	c.G().LinkCache().Mutate(c.id, func(c *ChainLink) { c.chainVerified = true })
}

// getFixedPayload usually just returns c.unpacked.Payload(), but sometimes
// it adds extra whitespace to work around server-side bugs.
func (c ChainLink) getFixedPayload() []byte {
	payload, err := c.unpacked.Payload()
	if err != nil {
		return nil
	}
	return c.fixPayload(payload, c.unpacked.sigID)
}

func (c *ChainLink) fixPayload(payload []byte, sigID keybase1.SigID) []byte {
	if s, ok := badWhitespaceChainLinks[sigID]; ok {
		if payload[len(payload)-1] != '\n' {
			c.G().Log.Debug("Fixing payload by adding newline on link '%s': %s", sigID, s)

			// Careful not to mutate the passed in payload via append. So make
			// a copy first.
			ret := make([]byte, len(payload))
			copy(ret, payload)
			ret = append(ret, '\n')

			return ret
		}
	}
	return payload
}

// fixAndHashPayload does the inverse of ChainLink#fixPayload. It strips off a trailing
// newline for buggy signature payloads, and then computes the hash of the result. This is
// necessary now that we are computing chain link IDs from signature bodies.
func fixAndHashPayload(g *GlobalContext, payload []byte, sigID keybase1.SigID) []byte {
	toHash := payload
	if s, ok := badWhitespaceChainLinks[sigID]; ok {
		last := len(payload) - 1
		if payload[last] == '\n' {
			g.Log.Debug("Fixing payload hash by stripping newline on link '%s': %s", sigID, s)
			toHash = payload[0:last]
		}
	}
	ret := sha256.Sum256(toHash)
	return ret[:]
}

func inferSigVersion(payload []byte) SigVersion {

	// Version 1 payloads are JSON and must start with an opening '{'
	if IsJSONObject(payload) {
		return KeybaseSignatureV1
	}

	// Version 2 payloads are Msgpack and must arrays, so they must
	// fit the following requirements. The case where b == 0xdc or
	// b = 0xdd are far-fetched, since that would mean a large or very
	// large packing. But still, allow any valid array up front.
	if IsEncodedMsgpackArray(payload) {
		return KeybaseSignatureV2
	}

	// We didn't find anything useful, so mark it a "none"
	return KeybaseNullSigVersion
}

func assertCorrectSigVersion(expected SigVersion, payload []byte) error {
	vInferred := inferSigVersion(payload)
	if vInferred != expected {
		return ChainLinkError{msg: fmt.Sprintf("chainlink in wrong format; expected version=%d but payload was %d", expected, vInferred)}
	}
	return nil
}

func (c *ChainLink) getSigPayload() ([]byte, error) {
	if c.IsStubbed() {
		return nil, ChainLinkError{"Cannot verify sig with nil outer link v2"}
	}
	v := c.unpacked.sigVersion
	var ret []byte
	switch v {
	case KeybaseSignatureV1:
		ret = c.getFixedPayload()
	case KeybaseSignatureV2:
		ret = c.unpacked.outerLinkV2.raw
	default:
		return nil, ChainLinkError{msg: fmt.Sprintf("unexpected signature version: %d", c.unpacked.sigVersion)}
	}

	err := assertCorrectSigVersion(v, ret)
	if err != nil {
		return nil, err
	}
	return ret, nil
}

func (c *ChainLink) verifyPayloadV2() error {

	if c.payloadVerified {
		return nil
	}

	ol := c.unpacked.outerLinkV2

	if ol == nil {
		return ChainLinkError{"no outer V2 structure available"}
	}

	version := KeybaseSignatureV2
	seqno := c.getSeqnoFromPayload()
	prev := c.getPrevFromPayload()
	curr := c.getPayloadHash()
	innerVersion := c.unpacked.sigVersion
	if innerVersion != version {
		return ChainLinkError{fmt.Sprintf("In chainlink v2, expected inner link to match; got %d", innerVersion)}
	}
	ignoreIfUnsupported := c.getIgnoreIfUnsupportedFromPayload()
	linkType, err := c.GetSigchainV2TypeFromInner(SigIgnoreIfUnsupported(ignoreIfUnsupported))
	if err != nil {
		return err
	}
	seqType := c.getSeqTypeFromPayload()
	highSkip := c.getHighSkipFromPayload()

	if err := ol.AssertFields(version, seqno, prev, curr, linkType, seqType, ignoreIfUnsupported, highSkip); err != nil {
		return err
	}

	c.markPayloadVerified(ol.sigID)
	return nil
}

func (c *ChainLink) markPayloadVerified(sigid keybase1.SigID) {
	if c.unpacked != nil {
		c.unpacked.sigID = sigid
	}
	c.payloadVerified = true
	c.G().LinkCache().Mutate(c.id, func(c *ChainLink) { c.payloadVerified = true })
}

func (c *ChainLink) verifyPayloadV1() error {
	if c.payloadVerified {
		return nil
	}
	sigid, err := SigAssertPayload(c.unpacked.sig, c.getFixedPayload())
	if err != nil {
		return err
	}
	c.markPayloadVerified(sigid)
	return nil
}

func (c *ChainLink) getSeqnoFromPayload() keybase1.Seqno {
	if c.unpacked != nil {
		return c.unpacked.seqno
	}
	return keybase1.Seqno(-1)
}

func (c *ChainLink) GetSeqno() keybase1.Seqno {
	return c.unpacked.seqno
}

func (c *ChainLink) GetHighSkip() *HighSkip {
	return c.unpacked.highSkip
}

func (c *ChainLink) GetSigID() keybase1.SigID {
	return c.unpacked.sigID
}

func (c *ChainLink) GetSigCheckCache() (cki *ComputedKeyInfos) {
	if c.sigVerified && c.cki != nil {
		cki = c.cki
	}
	return cki
}

func (c *ChainLink) PutSigCheckCache(cki *ComputedKeyInfos) {
	c.G().Log.Debug("Caching SigCheck for link %s (version: %d)", c.id, cki.Version)
	c.sigVerified = true
	c.dirty = true
	c.cki = cki
	c.G().LinkCache().Mutate(c.id, func(c *ChainLink) { c.cki = cki })
	return
}

func (c *ChainLink) VerifySigWithKeyFamily(ckf ComputedKeyFamily) (err error) {

	var key GenericKey
	var verifyKID keybase1.KID
	var sigID keybase1.SigID

	if c.IsStubbed() {
		return ChainLinkError{"cannot verify signature -- none available; is this a stubbed out link?"}
	}

	if c.unpacked != nil && c.unpacked.sigDropped {
		return ChainLinkError{"cannot verify signature -- none available; sig dropped intentionally."}
	}

	verifyKID, err = c.checkServerSignatureMetadata(ckf)
	if err != nil {
		return err
	}

	if key, _, err = ckf.FindActiveSibkeyAtTime(verifyKID, c.GetCTime()); err != nil {
		return err
	}

	if err = c.VerifyLink(); err != nil {
		return err
	}

	var sigPayload []byte
	sigPayload, err = c.getSigPayload()
	if err != nil {
		return err
	}

	if sigID, err = key.VerifyString(c.G().Log, c.unpacked.sig, sigPayload); err != nil {
		return BadSigError{err.Error()}
	}
	c.unpacked.sigID = sigID

	return nil
}

func ImportLinkFromServer(m MetaContext, parent *SigChain, data []byte, selfUID keybase1.UID) (ret *ChainLink, err error) {
	var id LinkID

	if ph, err := jsonparserw.GetString(data, "payload_hash"); err == nil {
		id, err = LinkIDFromHex(ph)
		if err != nil {
			return nil, err
		}
	}
	ret = NewChainLink(m.G(), parent, id)
	if err = ret.Unpack(m, false, selfUID, data); err != nil {
		m.CDebugf("Unpack error: %s", err)
		return nil, err
	}

	return ret, nil
}

func putLinkToCache(m MetaContext, link *ChainLink) {
	m.G().LinkCache().Put(m, link.id, link.Copy())
}

func NewChainLink(g *GlobalContext, parent *SigChain, id LinkID) *ChainLink {
	return &ChainLink{
		Contextified: NewContextified(g),
		parent:       parent,
		id:           id,
	}
}

func ImportLinkFromStorage(m MetaContext, id LinkID, selfUID keybase1.UID) (*ChainLink, error) {
	link, ok := m.G().LinkCache().Get(id)
	if ok {
		link.Contextified = NewContextified(m.G())
		return &link, nil
	}

	var ret *ChainLink
	data, _, err := m.G().LocalDb.GetRaw(DbKey{Typ: DBLink, Key: id.String()})
	if err == nil && data != nil {
		// May as well recheck onload (maybe revisit this)
		ret = NewChainLink(m.G(), nil, id)
		if err = ret.Unpack(m, true, selfUID, data); err != nil {
			return nil, err
		}
		ret.storedLocally = true

		m.G().LinkCache().Put(m, id, ret.Copy())
	}
	return ret, err
}

func (c *ChainLink) VerifyLink() error {
	v := c.unpacked.sigVersion
	switch v {
	case 1:
		return c.verifyLinkV1()
	case 2:
		return c.verifyLinkV2()
	default:
		return ChainLinkError{msg: fmt.Sprintf("unexpected signature version: %d", v)}
	}
}

func (c *ChainLink) verifyLinkV1() error {
	if err := c.verifyHashV1(); err != nil {
		return err
	}
	return c.verifyPayloadV1()
}

func (c *ChainLink) verifyLinkV2() error {
	if err := c.verifyHashV2(); err != nil {
		return err
	}

	// We might not have an unpacked payload at all, if it's a V2 link
	// without a body (for BW savings)
	if c.IsStubbed() {
		return nil
	}

	return c.verifyPayloadV2()
}

func (c *ChainLink) GetSigchainV2TypeFromInner(ignoreIfUnsupported SigIgnoreIfUnsupported) (SigchainV2Type, error) {
	if c.unpacked == nil || c.unpacked.typ == "" {
		return SigchainV2TypeNone, errors.New("chain link not unpacked")
	}
	return SigchainV2TypeFromV1TypeAndRevocations(c.unpacked.typ, SigHasRevokes(c.HasRevocations()), ignoreIfUnsupported)
}

func (c *ChainLink) GetSigchainV2TypeFromV2Shell() (SigchainV2Type, error) {
	if c.unpacked == nil {
		return SigchainV2TypeNone, errors.New("GetSigchainV2TypeFromV2Shell: chain link not unpacked")
	}
	if c.unpacked.outerLinkV2 == nil {
		return SigchainV2TypeNone, errors.New("GetSigchainV2TypeFromV2Shell: chain link has no v2 shell")
	}
	return c.unpacked.outerLinkV2.LinkType, nil
}

// GetSigchainV2Type is a helper function for getting a ChainLink's type. If it
// is a v2 link (that may or may not be stubbed), return the type from the
// outer link, otherwise from the inner link.
func (c *ChainLink) GetSigchainV2Type() (SigchainV2Type, error) {
	if c.unpacked == nil {
		return SigchainV2TypeNone, errors.New("chain link is not unpacked")
	}
	if c.unpacked.outerLinkV2 == nil && c.unpacked.typ == "" {
		return SigchainV2TypeNone, errors.New("chain inner link type is not unpacked, and has no v2 shell")
	}
	if c.unpacked.outerLinkV2 != nil {
		return c.GetSigchainV2TypeFromV2Shell()
	}
	return c.GetSigchainV2TypeFromInner(c.GetIgnoreIfSupported())
}

func (c *ChainLink) checkServerSignatureMetadata(ckf ComputedKeyFamily) (ret keybase1.KID, err error) {
	var serverKID, linkKID, verifyKID keybase1.KID

	// PC: I'm not sure what exactly this was trying to do since
	// c.packed.kid can only be equal to c.unpacked.kid at this point.
	// The following two lines result in the least changes below:
	serverKID = c.unpacked.kid
	linkKID = c.unpacked.kid

	if linkKID.Exists() && serverKID.Exists() && linkKID.NotEqual(serverKID) {
		// Check the KID. This is actually redundant of a check we do in Unpack(),
		// but I'm keeping it here in case we change the way we unpack in the
		// future.  --jacko
		return ret, ChainLinkKIDMismatchError{
			fmt.Sprintf("Payload KID (%s) doesn't match server KID (%s).",
				linkKID, serverKID),
		}
	}

	if serverKID.Exists() {
		verifyKID = serverKID
	}

	if linkKID.Exists() {
		verifyKID = linkKID
	}

	if verifyKID.IsNil() {
		return ret, ChainLinkError{"cannot verify signature without a KID"}
	}

	serverKey, err := ckf.FindKeyWithKIDUnsafe(verifyKID)
	if err != nil {
		return ret, err
	}

	// Check the fingerprint.
	if c.unpacked.pgpFingerprint != nil {
		payloadFingerprintStr := c.unpacked.pgpFingerprint.String()
		serverFingerprintStr := ""
		if fp := GetPGPFingerprintFromGenericKey(serverKey); fp != nil {
			serverFingerprintStr = fp.String()
		}
		if payloadFingerprintStr != serverFingerprintStr {
			return ret, ChainLinkFingerprintMismatchError{
				fmt.Sprintf("Payload fingerprint (%s) did not match server key (%s).",
					payloadFingerprintStr, serverFingerprintStr),
			}
		}
	}
	return verifyKID, nil
}

func (c *ChainLink) Store(m MetaContext) (didStore bool, err error) {

	m.VLogf(VLog1, "| Storing Link %s...", c.id)
	if c.storedLocally && !c.dirty {
		m.VLogf(VLog1, "| Bailed on link %s since wasn't dirty...", c.id)
		return didStore, nil
	}

	if err = c.VerifyLink(); err != nil {
		return false, err
	}

	if !c.hashVerified || (!c.IsStubbed() && !c.payloadVerified) || !c.chainVerified {
		err = fmt.Errorf("Internal error; should have been verified in Store(); hashVerified=%v, isStubbed=%v, payloadVerified=%v, chainVerified=%v",
			c.hashVerified, c.IsStubbed(), c.payloadVerified, c.chainVerified)
		return false, err
	}

	packed, err := c.Pack()
	if err != nil {
		return false, err
	}

	key := DbKey{Typ: DBLink, Key: c.id.String()}

	// Don't write with any aliases
	if err = m.G().LocalDb.Put(key, nil, packed); err != nil {
		return false, err
	}
	m.VLogf(VLog1, "| Store Link %s", c.id)

	c.storedLocally = true
	c.dirty = false
	return true, nil
}

func (c *ChainLink) GetPGPFingerprint() *PGPFingerprint {
	return c.unpacked.pgpFingerprint
}
func (c *ChainLink) GetKID() keybase1.KID {
	return c.unpacked.kid
}

func (c *ChainLink) MatchFingerprint(fp PGPFingerprint) bool {
	return c.unpacked.pgpFingerprint != nil && fp.Eq(*c.unpacked.pgpFingerprint)
}

func (c *ChainLink) ToEldestKID() keybase1.KID {
	if !c.unpacked.eldestKID.IsNil() {
		return c.unpacked.eldestKID
	}
	// For links that don't explicitly specify an eldest KID, it's implied
	// that we're starting a new subchain, so the signing KID is the
	// eldest.
	return c.GetKID()
}

// ToLinkSummary converts a ChainLink into a MerkleTriple object.
func (c ChainLink) ToMerkleTriple() *MerkleTriple {
	if c.IsStubbed() {
		return nil
	}
	return &MerkleTriple{
		Seqno:  c.GetSeqno(),
		LinkID: c.id,
		SigID:  c.GetSigID(),
	}
}

//=========================================================================
// IsInCurrentFamily checks to see if the given chainlink
// was signed by a key in the current family.
func (c *ChainLink) IsInCurrentFamily(u *User) bool {
	eldest := u.GetEldestKID()
	if eldest.IsNil() {
		return false
	}
	return eldest.Equal(c.ToEldestKID())
}

//=========================================================================

func (c *ChainLink) Typed() TypedChainLink {
	return c.typed
}

func (c *ChainLink) Copy() ChainLink {
	var unpacked ChainLinkUnpacked
	if c.unpacked != nil {
		unpacked = *c.unpacked
	}

	r := *c
	r.SetGlobalContext(nil)
	r.parent = nil
	r.chainVerified = c.chainVerified
	r.hashVerified = c.hashVerified
	r.payloadVerified = c.payloadVerified
	r.unpacked = &unpacked

	if c.cki != nil {
		r.cki = c.cki.ShallowCopy()
	}

	return r
}

func (c ChainLink) LinkID() LinkID {
	return c.id
}

func (c ChainLink) AllowStubbing() bool {
	if c.unpacked.outerLinkV2 == nil {
		return false
	}
	return c.unpacked.outerLinkV2.LinkType.AllowStubbing()
}

// IsHighUserLink determines whether a chainlink counts as "high" in a user's chain,
// which is defined as an Eldest link, a link with seqno=1, a link that is Sibkey,
// PGPUpdate, Revoke, or any link that is revoking.
func (c ChainLink) IsHighUserLink(mctx MetaContext, uid keybase1.UID) (bool, error) {
	v2Type, err := c.GetSigchainV2Type()
	if err != nil {
		return false, err
	}

	hardcodedEldest := false
	if c.GetSeqno() > 1 {
		prevLink := c.parent.GetLinkFromSeqno(c.GetSeqno() - 1)
		if prevLink == nil {
			return false, ChainLinkWrongSeqnoError{}
		}
		hardcodedEldest, err = isSubchainStart(mctx, &c, prevLink, uid)
		if err != nil {
			return false, err
		}
	}

	isFirstLink := v2Type == SigchainV2TypeEldest || c.GetSeqno() == 1 || hardcodedEldest
	isNewHighLink := isFirstLink ||
		v2Type == SigchainV2TypeRevoke ||
		v2Type == SigchainV2TypeWebServiceBindingWithRevoke ||
		v2Type == SigchainV2TypeCryptocurrencyWithRevoke ||
		v2Type == SigchainV2TypeSibkey ||
		v2Type == SigchainV2TypePGPUpdate
	return isNewHighLink, nil
}

// ExpectedNextHighSkip returns the expected highSkip of the immediately
// subsequent link in the chain (which may not exist yet). This function can
// only be called after VerifyChain has processed the chainLink, and set
// c.computedHighSkip.
func (c ChainLink) ExpectedNextHighSkip(mctx MetaContext, uid keybase1.UID) (HighSkip, error) {
	isHigh, err := c.IsHighUserLink(mctx, uid)
	if err != nil {
		return HighSkip{}, err
	}
	if isHigh {
		return NewHighSkip(c.GetSeqno(), c.id), nil
	}
	if c.computedHighSkip == nil {
		return HighSkip{}, NewUserReverifyNeededError("Expected to have already computed this link's HighSkip, but it was not computed.")
	}
	return *c.computedHighSkip, nil
}
