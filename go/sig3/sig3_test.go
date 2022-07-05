package sig3

import (
	"crypto/rand"
	"encoding/base64"
	"github.com/keybase/client/go/msgpack"
	"github.com/keybase/go-crypto/ed25519"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

func genKey(t *testing.T) (pair KeyPair) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)
	copy(pair.priv[:], privateKey[:])
	pair.pub = makeKID(publicKey[:], 0x20)
	return pair
}

func genDHKID(t *testing.T) KID {
	return makeKID(randomBytes(t, 32), 0x21)
}

func makeKID(key []byte, typ byte) KID {
	ret := KID(make([]byte, 35))
	ret[0] = 1
	ret[1] = typ
	ret[34] = 0x0a
	copy(ret[2:34], key)
	return ret
}

func randomBytes(t *testing.T, i int) []byte {
	ret, err := genRandomBytes(i)
	require.NoError(t, err)
	return ret
}

func randomUID(t *testing.T) UID {
	var ret UID
	b := randomBytes(t, len(ret))
	copy(ret[:], b)
	return ret
}

func randomTeamID(t *testing.T) TeamID {
	var ret TeamID
	b := randomBytes(t, len(ret))
	copy(ret[:], b)
	return ret
}

func randomLinkIDPointer(t *testing.T) *LinkID {
	var ret LinkID
	b := randomBytes(t, len(ret))
	copy(ret[:], b)
	return &ret
}

func genTest(t *testing.T, n int) (bun *Sig3Bundle, ex ExportJSON, rk *RotateKey, outerKey KeyPair, innerKey []KeyPair) {
	now := TimeSec(time.Now().Unix())
	inner := InnerLink{
		Ctime:   now,
		Entropy: randomBytes(t, 16),
		ClientInfo: &ClientInfo{
			Desc:    "foo",
			Version: "1.0.0-1",
		},
		MerkleRoot: MerkleRoot{
			Ctime: now,
			Seqno: 100,
			Hash:  randomBytes(t, 32),
		},
		Signer: Signer{
			EldestSeqno: 1,
			UID:         randomUID(t),
		},
		Team: &Team{
			TeamID:     randomTeamID(t),
			IsPublic:   false,
			IsImplicit: false,
		},
	}
	outer := OuterLink{
		Seqno: Seqno(11),
		Prev:  randomLinkIDPointer(t),
	}

	var ptks []PerTeamKey
	var innerKeys []KeyPair
	for i := 0; i < n; i++ {
		ptk := PerTeamKey{
			AppkeyDerivationVersion: 1,
			Generation:              PerTeamKeyGeneration(5),
			EncryptionKID:           genDHKID(t),
			PTKType:                 PTKType(i),
		}
		ptks = append(ptks, ptk)
		innerKeys = append(innerKeys, genKey(t))
	}
	rkb := RotateKeyBody{PTKs: ptks}

	outerKey = genKey(t)
	rk = NewRotateKey(outer, inner, rkb)
	bun, err := rk.Sign(outerKey, innerKeys)
	require.NoError(t, err)
	ex, err = bun.Export()
	require.NoError(t, err)
	return bun, ex, rk, outerKey, innerKeys
}

func TestSignAndVerifyHappyPath(t *testing.T) {
	_, ex, rk, outerKey, _ := genTest(t, 1)
	generic, err := ex.Import()
	require.NoError(t, err)
	rk2, castOk := generic.(*RotateKey)
	require.True(t, castOk)
	require.NotNil(t, rk2.Signer())
	require.Equal(t, rk2.Signer().KID, outerKey.pub)
	require.Equal(t, rk2.Signer().UID, rk.Base.inner.Signer.UID)
}

func TestSignAndVerifyHappyPathFourFold(t *testing.T) {
	_, ex, rk, outerKey, _ := genTest(t, 4)
	generic, err := ex.Import()
	require.NoError(t, err)
	rk2, castOk := generic.(*RotateKey)
	require.True(t, castOk)
	require.NotNil(t, rk2.Signer())
	require.Equal(t, rk2.Signer().KID, outerKey.pub)
	require.Equal(t, rk2.Signer().UID, rk.Base.inner.Signer.UID)
	require.Equal(t, len(rk2.rkb().PTKs), 4)
}

func TestMissingSig(t *testing.T) {
	_, ex, _, _, _ := genTest(t, 1)
	ex.Sig = ""
	_, err := ex.Import()
	require.Error(t, err)
	require.Equal(t, err, newParseError("need a sig and an inner, or neither, but not one without the other (sig: false, inner: true)"))
}

func TestMissingInner(t *testing.T) {
	_, ex, _, _, _ := genTest(t, 1)
	ex.Inner = ""
	_, err := ex.Import()
	require.Error(t, err)
	require.Equal(t, err, newParseError("need a sig and an inner, or neither, but not one without the other (sig: true, inner: false)"))
}

func TestStubbed(t *testing.T) {
	_, ex, _, _, _ := genTest(t, 1)
	ex.Sig = ""
	ex.Inner = ""
	rk, err := ex.Import()
	require.NoError(t, err)
	require.Nil(t, rk.Signer())
}

func TestMissingOuter(t *testing.T) {
	_, ex, _, _, _ := genTest(t, 1)
	ex.Outer = ""
	_, err := ex.Import()
	require.Error(t, err)
	require.Equal(t, err, newParseError("outer cannot be nil"))
}

func TestLeadingGarbage(t *testing.T) {
	_, ex, _, _, _ := genTest(t, 1)
	ex.Outer = "eyJhYmMi" + ex.Outer
	_, err := ex.Import()
	require.Error(t, err)
	require.Equal(t, err, newParseError("need an encoded msgpack array (with no leading garbage)"))
}

func TestBadSig(t *testing.T) {
	_, ex, _, _, _ := genTest(t, 1)
	b, err := base64.StdEncoding.DecodeString(ex.Sig)
	require.NoError(t, err)
	b[4] ^= 1
	ex.Sig = base64.StdEncoding.EncodeToString(b)
	_, err = ex.Import()
	require.Error(t, err)
	require.Equal(t, err, newSig3Error("signature verification failed"))
}

func testMutateOuter(t *testing.T, f func(o *OuterLink), wantedErr error) {
	_, ex, _, _, _ := genTest(t, 1)
	b, err := base64.StdEncoding.DecodeString(ex.Outer)
	require.NoError(t, err)
	var tmp OuterLink
	err = msgpack.Decode(&tmp, b)
	require.NoError(t, err)
	f(&tmp)
	b, err = msgpack.Encode(tmp)
	require.NoError(t, err)
	ex.Outer = base64.StdEncoding.EncodeToString(b)
	_, err = ex.Import()
	require.Error(t, err)
	require.Equal(t, err, wantedErr)
}

func TestBadPayload(t *testing.T) {
	testMutateOuter(t, func(o *OuterLink) { o.Seqno++ }, newSig3Error("signature verification failed"))
}

func TestBadInnerLink(t *testing.T) {
	testMutateOuter(t, func(o *OuterLink) { o.InnerLinkID[0] ^= 1 }, newSig3Error("inner link hash doesn't match inner"))
}

func TestBadVersion(t *testing.T) {
	testMutateOuter(t, func(o *OuterLink) { o.Version = 10 }, newSig3Error("can only handle sig version 3 (got 10)"))
}

func TestBadChainType(t *testing.T) {
	testMutateOuter(t, func(o *OuterLink) { o.ChainType = 10 }, newSig3Error("can only handle type 17 (team private hidden)"))
}

func TestBadLinkType(t *testing.T) {
	testMutateOuter(t, func(o *OuterLink) { o.LinkType = 10 }, newParseError("unknown link type 10"))
}

func (r RotateKey) badSign(outer KeyPair, inner KeyPair, f func(sig *Sig) *Sig) (ret *Sig3Bundle, err error) {
	i := r.Inner()
	o := r.outerPointer()
	if i == nil {
		return nil, newSig3Error("cannot sign without an inner link")
	}

	o.Version = SigVersion3
	o.LinkType = LinkTypeRotateKey
	o.ChainType = ChainTypeTeamPrivateHidden

	r.rkb().PTKs[0].ReverseSig = nil
	r.rkb().PTKs[0].SigningKID = inner.pub
	i.Signer.KID = outer.pub
	tmp, err := signGeneric(&r.Base, inner.priv)
	if err != nil {
		return nil, err
	}
	r.rkb().PTKs[0].ReverseSig = f(tmp.Sig)
	return signGeneric(&r.Base, outer.priv)
}

func TestBadReverseSig(t *testing.T) {
	_, _, rk, outerKey, innerKeys := genTest(t, 1)
	bun, err := rk.badSign(outerKey, innerKeys[0], func(sig *Sig) *Sig { sig[0] ^= 1; return sig })
	require.NoError(t, err)
	ex, err := bun.Export()
	require.NoError(t, err)
	_, err = ex.Import()
	require.Error(t, err)
	require.Equal(t, err, newSig3Error("bad reverse signature: sig3 error: signature verification failed"))
}

func TestNoReverseSig(t *testing.T) {
	_, _, rk, outerKey, innerKeys := genTest(t, 1)
	bun, err := rk.badSign(outerKey, innerKeys[0], func(sig *Sig) *Sig { return nil })
	require.NoError(t, err)
	ex, err := bun.Export()
	require.NoError(t, err)
	_, err = ex.Import()
	require.Error(t, err)
	require.Equal(t, err, newSig3Error("rotate key link is missing a reverse sig"))
}
