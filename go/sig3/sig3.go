package sig3

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/msgpack"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-crypto/ed25519"
)

// Generic sig3 wrapper class, should implement the following interface.
type Generic interface {
	Signer() *Signer
	Prev() *LinkID
	Seqno() Seqno
	Outer() OuterLink
	Inner() *InnerLink

	// Inner methods for generic decoding of incoming sig3 links
	outerPointer() *OuterLink

	// setVerifiedBit is called once we've verified the outer signature over the whole
	// link, and also any inner reverse signatures. If any verification fails, the bit
	// will not get set. The bit also won't get set for stubbed links, since there isn't
	// enough information to verify.
	setVerifiedBit()
	verify() error

	// check this chainlink after parsing for type-specific properties
	parseCheck() error
}

// Base struct for sig3 links that contains much of the raw material pulled down or off local storage.
// Most implementations of sig3 links should include this base class.
type Base struct {
	verified bool // see message above for when this bit is set.
	inner    *InnerLink
	outerRaw []byte
	outer    OuterLink
	sig      *Sig
}

// RotateKey is a sig3 link type for a PTK rotation. Handles multiple PTK types being rotated in
// one link.
type RotateKey struct {
	Base
}

// LinkFromFuture is a sig3 link type that we don't know how to decode, but it's ok to ignore.
type LinkFromFuture struct {
	Base
}

var _ Generic = (*Base)(nil)
var _ Generic = (*RotateKey)(nil)
var _ Generic = (*LinkFromFuture)(nil)

// NewRotateKey makes a new rotate key given sig3 skeletons (Outer and Inner) and
// also the PTKs that are going to be advertised in the sig3 link.
func NewRotateKey(o OuterLink, i InnerLink, b RotateKeyBody) *RotateKey {
	i.Body = &b
	return &RotateKey{
		Base: Base{
			inner: &i,
			outer: o,
		},
	}
}

// rkb returns the RotateKeyBody that we are expecting at r.Base.inner. It should never fail, if it does,
// the program will crash.
func (r *RotateKey) rkb() *RotateKeyBody {
	ret, _ := r.Base.inner.Body.(*RotateKeyBody)
	return ret
}

func (r *RotateKey) PTKs() []PerTeamKey {
	return r.rkb().PTKs
}

func (r *RotateKey) ReaderKey() *PerTeamKey {
	for _, k := range r.rkb().PTKs {
		if k.PTKType == keybase1.PTKType_READER {
			return &k
		}
	}
	return nil
}

func (b *Base) setVerifiedBit() {
	if b.inner != nil && b.sig != nil {
		b.verified = true
	}
}

func (b *Base) parseCheck() error {
	return nil
}

// Outer returns a copy of the OuterLink in this base class
func (b *Base) Outer() OuterLink {
	return b.outer
}

func (b *Base) outerPointer() *OuterLink {
	return &b.outer
}

// Inner returns a pointer to the InnerLink in this base class.
func (b *Base) Inner() *InnerLink {
	return b.inner
}

// Signer returns the (uid, eldest, KID) of the signer of this link if a sig was provided,
// and it was successfully verified (as reported by the link itself). If not, then this will
// return a nil.
func (b *Base) Signer() *Signer {
	if !b.verified {
		return nil
	}
	if b.inner == nil {
		return nil
	}
	return &b.inner.Signer
}

// Prev returns the LinkID of the previous link, or nil if none was provided.
func (b *Base) Prev() *LinkID {
	return b.outer.Prev
}

// Seqno returns the seqno of this link, as reported in the outer link itself.
func (b *Base) Seqno() Seqno {
	return b.outer.Seqno
}

func (b Base) verify() error {
	if (b.sig == nil) != (b.inner == nil) {
		return newSig3Error("need sig and inner, or neither, but can't have one and not the other (sig: %v, inner: %v)", (b.sig != nil), (b.inner != nil))
	}
	if b.sig == nil || b.inner == nil {
		return nil
	}
	err := b.sig.verify(b.inner.Signer.KID, b.outerRaw)
	if err != nil {
		return err
	}
	return nil
}

func (i InnerLink) hash() (LinkID, error) {
	return hashInterface(i)
}

func hashInterface(i interface{}) (LinkID, error) {
	b, err := msgpack.Encode(i)
	if err != nil {
		return LinkID{}, err
	}
	return hash(b), nil
}

func (l LinkID) String() string {
	return hex.EncodeToString(l[:])
}

func (o OuterLink) Hash() (LinkID, error) {
	return hashInterface(o)
}

func (r RotateKey) verify() error {
	err := r.Base.verify()
	if err != nil {
		return err
	}
	err = r.verifyReverseSig()
	if err != nil {
		return err
	}
	return nil
}

func (r RotateKey) verifyReverseSig() (err error) {
	if r.inner == nil {
		return nil
	}

	// First make a checkpoint of all of the previous sigs and the previous inner
	// link, since we're going to mutate them as we verify
	var reverseSigs []*Sig
	for _, ptk := range r.rkb().PTKs {
		reverseSigs = append(reverseSigs, ptk.ReverseSig)
	}
	innerLinkID := r.Base.outer.InnerLinkID

	// Make sure to replace them on the way out of the function, even in an error.
	defer func() {
		for j, rs := range reverseSigs {
			r.rkb().PTKs[j].ReverseSig = rs
		}
		r.Base.outer.InnerLinkID = innerLinkID
	}()

	// Verify signatures in the reverse order they were signed, nulling them out
	// from back to front. We are not going middle-out.
	for i := len(r.rkb().PTKs) - 1; i >= 0; i-- {
		ptk := &r.rkb().PTKs[i]
		revSig := ptk.ReverseSig
		if revSig == nil {
			return newSig3Error("rotate key link is missing a reverse sig")
		}

		ptk.ReverseSig = nil
		r.Base.outer.InnerLinkID, err = r.Base.inner.hash()
		if err != nil {
			return err
		}
		b, err := msgpack.Encode(r.Base.outer)
		if err != nil {
			return err
		}
		err = revSig.verify(ptk.SigningKID, b)
		if err != nil {
			return newSig3Error("bad reverse signature: %s", err.Error())
		}
	}

	return nil
}

func hash(b []byte) LinkID {
	return LinkID(sha256.Sum256(b))
}

func (l LinkID) eq(m LinkID) bool {
	return hmac.Equal(l[:], m[:])
}

func (s ExportJSON) parseSig() (*Base, error) {
	var out Base
	if s.Sig == "" {
		return &out, nil
	}
	b, err := base64.StdEncoding.DecodeString(s.Sig)
	if err != nil {
		return nil, err
	}
	out.sig = &Sig{}
	err = msgpack.Decode(&out.sig, b)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (s ExportJSON) parseOuter(in Base) (*Base, error) {
	if s.Outer == "" {
		return nil, newParseError("outer cannot be nil")
	}
	b, err := base64.StdEncoding.DecodeString(s.Outer)
	if err != nil {
		return nil, err
	}
	in.outerRaw = b
	if !msgpack.IsEncodedMsgpackArray(b) {
		return nil, newParseError("need an encoded msgpack array (with no leading garbage)")
	}
	err = msgpack.Decode(&in.outer, b)
	if err != nil {
		return nil, err
	}
	if in.outer.Version != SigVersion3 {
		return nil, newSig3Error("can only handle sig version 3 (got %d)", in.outer.Version)
	}
	if in.outer.ChainType != ChainTypeTeamPrivateHidden {
		return nil, newSig3Error("can only handle type 17 (team private hidden)")
	}
	return &in, nil
}

func (r *RotateKey) parseCheck() error {
	m := make(map[keybase1.PTKType]bool)
	for _, k := range r.rkb().PTKs {
		typ := k.PTKType
		if m[typ] {
			return newParseError("duplicated PTK type: %s", typ)
		}
		m[typ] = true
	}
	return nil
}

func (s *ExportJSON) parseInner(in Base) (Generic, error) {
	var out Generic

	if (s.Inner == "") != (in.sig == nil) {
		return nil, newParseError("need a sig and an inner, or neither, but not one without the other (sig: %v, inner: %v)", (in.sig != nil), (s.Inner != ""))
	}

	if s.Inner == "" {
		return &in, nil
	}

	b, err := base64.StdEncoding.DecodeString(s.Inner)
	if err != nil {
		return nil, err
	}

	if !hash(b).eq(in.outer.InnerLinkID) {
		return nil, newSig3Error("inner link hash doesn't match inner")
	}

	in.inner = &InnerLink{}
	switch in.outer.LinkType {
	case LinkTypeRotateKey:
		var rkb RotateKeyBody
		in.inner.Body = &rkb
		out = &RotateKey{Base: in}
	default:
		if !in.outer.IgnoreIfUnsupported {
			return nil, newParseError("unknown link type %d", in.outer.LinkType)
		}
		// Make it seem like a stubbed link
		out = &LinkFromFuture{Base: in}
	}

	err = msgpack.Decode(in.inner, b)
	if err != nil {
		return nil, err
	}

	err = out.parseCheck()
	if err != nil {
		return nil, err
	}

	return out, nil
}

func (s ExportJSON) parse() (out Generic, err error) {
	var tmp *Base
	tmp, err = s.parseSig()
	if err != nil {
		return nil, err
	}
	tmp, err = s.parseOuter(*tmp)
	if err != nil {
		return nil, err
	}
	out, err = s.parseInner(*tmp)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// Import from ExportJSON format (as sucked down from the server) into a Generic link type,
// that can be casted into the supported link types (like RotateKey). Returns an error if we
// failed to parse the input data, or if signature validation failed.
func (s ExportJSON) Import() (Generic, error) {
	out, err := s.parse()
	if err != nil {
		return nil, err
	}
	err = out.verify()
	if err != nil {
		return nil, err
	}
	out.setVerifiedBit()
	return out, nil
}

func (sig Sig) verify(kid KID, body []byte) error {
	key := kbcrypto.KIDToNaclSigningKeyPublic([]byte(kid))
	if key == nil {
		return newSig3Error("failed to import public key")
	}
	msg := kbcrypto.SignaturePrefixSigchain3.Prefix(body)
	if !ed25519.Verify(key[:], msg, sig[:]) {
		return newSig3Error("signature verification failed")
	}
	return nil
}

type KeyPair struct {
	priv kbcrypto.NaclSigningKeyPrivate
	pub  KID
}

func NewKeyPair(priv kbcrypto.NaclSigningKeyPrivate, pub KID) *KeyPair {
	return &KeyPair{priv, pub}
}

func genRandomBytes(i int) ([]byte, error) {
	ret := make([]byte, i)
	n, err := rand.Read(ret)
	if err != nil {
		return nil, err
	}
	if n != i {
		return nil, newSig3Error("short random entropy read")
	}
	return ret, nil
}

// Sign the RotateKey structure, with the given user's keypair (outer), and with the new
// PTKs (inner). Return a Sig3Bundle, which was the exportable information, that you can
// export either to local storage or up to the server.
func (r RotateKey) Sign(outer KeyPair, inners []KeyPair) (ret *Sig3Bundle, err error) {
	i := r.Inner()
	o := r.outerPointer()
	if i == nil {
		return nil, newSig3Error("cannot sign without an inner link")
	}

	o.Version = SigVersion3
	o.LinkType = LinkTypeRotateKey
	o.ChainType = ChainTypeTeamPrivateHidden
	i.Signer.KID = outer.pub
	if i.Entropy == nil {
		i.Entropy, err = genRandomBytes(16)
		if err != nil {
			return nil, err
		}
	}

	for j := range r.rkb().PTKs {
		ptk := &r.rkb().PTKs[j]
		ptk.ReverseSig = nil
		ptk.SigningKID = inners[j].pub
	}

	for j := range r.rkb().PTKs {
		ptk := &r.rkb().PTKs[j]
		tmp, err := signGeneric(&r.Base, inners[j].priv)
		if err != nil {
			return nil, err
		}
		ptk.ReverseSig = tmp.Sig
	}
	return signGeneric(&r.Base, outer.priv)
}

func signGeneric(g Generic, privkey kbcrypto.NaclSigningKeyPrivate) (ret *Sig3Bundle, err error) {
	o := g.Outer()
	i := g.Inner()
	if i == nil {
		return nil, newSig3Error("cannot sign without an inner link")
	}
	o.InnerLinkID, err = i.hash()
	if err != nil {
		return nil, err
	}
	b, err := msgpack.Encode(o)
	if err != nil {
		return nil, err
	}
	var sig Sig
	msg := kbcrypto.SignaturePrefixSigchain3.Prefix(b)
	copy(sig[:], ed25519.Sign(privkey[:], msg))
	return &Sig3Bundle{
		Sig:   &sig,
		Inner: i,
		Outer: o,
	}, nil
}

// Export a sig3 up to the server in base64'ed JSON format, as in a POST request.
func (s Sig3Bundle) Export() (ret ExportJSON, err error) {
	enc := func(i interface{}) (string, error) {
		b, err := msgpack.Encode(i)
		if err != nil {
			return "", err
		}
		return base64.StdEncoding.EncodeToString(b), nil
	}
	ret.Outer, err = enc(s.Outer)
	if err != nil {
		return ret, err
	}
	if s.Inner != nil {
		ret.Inner, err = enc(s.Inner)
		if err != nil {
			return ret, err
		}
	}
	if s.Sig != nil {
		ret.Sig, err = enc(s.Sig[:])
		if err != nil {
			return ret, nil
		}
	}
	return ret, nil
}

func IsStubbed(g Generic) bool {
	return g.Inner() == nil
}

func Hash(g Generic) (LinkID, error) {
	return g.Outer().Hash()
}

func CheckLinkSequence(v []Generic) error {
	if len(v) == 0 {
		return nil
	}
	prev := v[0]
	for _, link := range v[1:] {
		if prev.Seqno()+keybase1.Seqno(1) != link.Seqno() {
			return newSequenceError("seqno mismatch at link %d", link.Seqno())
		}
		hsh, err := Hash(prev)
		if err != nil {
			return newSequenceError("bad prev hash computation at %d: %s", link.Seqno(), err.Error())
		}
		if link.Prev() == nil {
			return newSequenceError("bad nil prev at %d", link.Seqno())
		}
		if !hsh.eq(*link.Prev()) {
			return newSequenceError("prev hash mismatch at %d", link.Seqno())
		}
		prev = link
	}
	return nil
}
