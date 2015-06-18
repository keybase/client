package engine

import (
	"bytes"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func decengctx(fu *FakeUser, tc libkb.TestContext) *Context {
	return &Context{
		IdentifyUI: &FakeIdentifyUI{},
		SecretUI:   fu.NewSecretUI(),
		LogUI:      tc.G.UI.GetLogUI(),
	}
}

func TestPGPDecrypt(t *testing.T) {
	tc := SetupEngineTest(t, "PGPDecrypt")
	defer tc.Cleanup()
	fu := createFakeUserWithPGPOnly(t, tc)

	// encrypt a message
	msg := "10 days in Japan"
	sink := libkb.NewBufferCloser()
	ctx := decengctx(fu, tc)
	arg := &PGPEncryptArg{
		Source:       strings.NewReader(msg),
		Sink:         sink,
		NoSign:       true,
		BinaryOutput: true,
	}
	enc := NewPGPEncrypt(arg, tc.G)
	if err := RunEngine(enc, ctx); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	t.Logf("encrypted data: %x", out)

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &PGPDecryptArg{
		Source: bytes.NewReader(out),
		Sink:   decoded,
	}
	dec := NewPGPDecrypt(decarg, tc.G)
	if err := RunEngine(dec, ctx); err != nil {
		t.Fatal(err)
	}
	decmsg := string(decoded.Bytes())
	if decmsg != msg {
		t.Errorf("decoded: %q, expected: %q", decmsg, msg)
	}

	owner := dec.Owner()
	if owner == nil {
		t.Errorf("owner is nil")
	}
}

func TestPGPDecryptArmored(t *testing.T) {
	tc := SetupEngineTest(t, "PGPDecrypt")
	defer tc.Cleanup()
	fu := createFakeUserWithPGPOnly(t, tc)

	// encrypt a message
	msg := "10 days in Japan"
	ctx := decengctx(fu, tc)
	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Source: strings.NewReader(msg),
		Sink:   sink,
		NoSign: true,
	}
	enc := NewPGPEncrypt(arg, tc.G)
	if err := RunEngine(enc, ctx); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	t.Logf("encrypted data: %x", out)

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &PGPDecryptArg{
		Source: bytes.NewReader(out),
		Sink:   decoded,
	}
	dec := NewPGPDecrypt(decarg, tc.G)
	if err := RunEngine(dec, ctx); err != nil {
		t.Fatal(err)
	}
	decmsg := string(decoded.Bytes())
	if decmsg != msg {
		t.Errorf("decoded: %q, expected: %q", decmsg, msg)
	}
}

// TestPGPDecryptSignedSelf tests that the user who signed the
// message can decrypt it.
func TestPGPDecryptSignedSelf(t *testing.T) {
	tc := SetupEngineTest(t, "PGPDecrypt")
	defer tc.Cleanup()
	fu := createFakeUserWithPGPOnly(t, tc)

	// encrypt a message
	msg := "We pride ourselves on being meticulous; no issue is too small."
	ctx := decengctx(fu, tc)
	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Source:       strings.NewReader(msg),
		Sink:         sink,
		BinaryOutput: true,
	}
	enc := NewPGPEncrypt(arg, tc.G)
	if err := RunEngine(enc, ctx); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	t.Logf("encrypted data: %x", out)

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &PGPDecryptArg{
		Source:       bytes.NewReader(out),
		Sink:         decoded,
		AssertSigned: true,
	}
	dec := NewPGPDecrypt(decarg, tc.G)
	if err := RunEngine(dec, ctx); err != nil {
		t.Fatal(err)
	}
	decmsg := string(decoded.Bytes())
	if decmsg != msg {
		t.Errorf("decoded: %q, expected: %q", decmsg, msg)
	}
}

// TestPGPDecryptSignedOther tests that a user who didn't sign the
// message can verify the signature.
func TestPGPDecryptSignedOther(t *testing.T) {
	tcRecipient := SetupEngineTest(t, "PGPDecrypt - Recipient")
	defer tcRecipient.Cleanup()
	recipient := createFakeUserWithPGPSibkey(tcRecipient)
	Logout(tcRecipient)

	tcSigner := SetupEngineTest(t, "PGPDecrypt - Signer")
	defer tcSigner.Cleanup()
	signer := createFakeUserWithPGPSibkey(tcSigner)

	// encrypt a message
	msg := "We pride ourselves on being meticulous; no issue is too small."
	ctx := decengctx(signer, tcSigner)
	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Recips:       []string{recipient.Username},
		Source:       strings.NewReader(msg),
		Sink:         sink,
		BinaryOutput: true,
	}
	enc := NewPGPEncrypt(arg, tcSigner.G)
	if err := RunEngine(enc, ctx); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	t.Logf("encrypted data: %x", out)

	// signer logs out, recipient logs in:
	t.Logf("signer (%q) logging out", signer.Username)
	Logout(tcSigner)
	libkb.G = tcRecipient.G
	// G = libkb.G
	t.Logf("recipient (%q) logging in", recipient.Username)
	recipient.LoginOrBust(tcRecipient)

	rtrackUI := &FakeIdentifyUI{
		Fapr: keybase1.FinishAndPromptRes{TrackRemote: true},
	}
	ctx = &Context{IdentifyUI: rtrackUI, SecretUI: recipient.NewSecretUI(), LogUI: tcRecipient.G.UI.GetLogUI()}

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &PGPDecryptArg{
		Source:       bytes.NewReader(out),
		Sink:         decoded,
		AssertSigned: true,
	}
	dec := NewPGPDecrypt(decarg, tcRecipient.G)
	if err := RunEngine(dec, ctx); err != nil {
		t.Fatal(err)
	}
	decmsg := string(decoded.Bytes())
	if decmsg != msg {
		t.Errorf("decoded: %q, expected: %q", decmsg, msg)
	}
}

func TestPGPDecryptLong(t *testing.T) {
	tc := SetupEngineTest(t, "PGPDecrypt")
	defer tc.Cleanup()
	fu := createFakeUserWithPGPSibkey(tc)

	// encrypt a message
	msg := make([]byte, 1024*1024)
	f, err := os.Open("/dev/urandom")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if _, err := f.Read(msg); err != nil {
		t.Fatal(err)
	}

	sink := libkb.NewBufferCloser()
	ctx := decengctx(fu, tc)
	arg := &PGPEncryptArg{
		Source:       bytes.NewReader(msg),
		Sink:         sink,
		NoSign:       true,
		BinaryOutput: true,
	}
	enc := NewPGPEncrypt(arg, tc.G)
	if err := RunEngine(enc, ctx); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &PGPDecryptArg{
		Source: bytes.NewReader(out),
		Sink:   decoded,
	}
	dec := NewPGPDecrypt(decarg, tc.G)
	if err := RunEngine(dec, ctx); err != nil {
		t.Fatal(err)
	}
	decmsg := decoded.Bytes()
	if len(decmsg) != len(msg) {
		t.Fatalf("decoded msg size: %d, expected %d", len(decmsg), len(msg))
	}

	for i, b := range msg {
		if decmsg[i] != b {
			t.Errorf("decode msg differs at byte %d: %x, expected %x", i, decmsg[i], b)
		}
	}

	owner := dec.Owner()
	if owner == nil {
		t.Errorf("owner is nil")
	}
}

type cstest struct {
	name string
	msg  string
}

var cstests = []cstest{
	{name: "ascii", msg: clearsignASCII},
	{name: "emoji", msg: clearsignEmoji},
}

func TestPGPDecryptClearsign(t *testing.T) {
	t.Skip()
	tc := SetupEngineTest(t, "PGPDecrypt")
	defer tc.Cleanup()

	for _, test := range cstests {
		decoded := libkb.NewBufferCloser()
		arg := &PGPDecryptArg{
			Source: strings.NewReader(test.msg),
			Sink:   decoded,
		}
		ctx := &Context{
			SecretUI:   libkb.TestSecretUI{},
			LogUI:      tc.G.UI.GetLogUI(),
			IdentifyUI: &FakeIdentifyUI{},
		}
		eng := NewPGPDecrypt(arg, tc.G)
		if err := RunEngine(eng, ctx); err != nil {
			t.Errorf("clearsign test %q error: %q", test.name, err)
			continue
		}
		msg := decoded.Bytes()
		fmt.Printf("clearsign test %q decoded message: %s\n", test.name, string(msg))
	}
}

const clearsignASCII = `-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA256

hello
-----BEGIN PGP SIGNATURE-----

wsFcBAEBCAAQBQJVgt0ACRAUYRAuxcGVygAAVJgQAA6lcAR4uEskffx/CiGcicc5
EVy3nKHJiClQFUtLnZdi0isOCl+uPnOM6snwo/4u4mctdZ01/bfCNwpWAxhQDSsV
QK2kXhx94YtW0Pp3QRMdiMFzrKdLFNLCYbcwJuiacPbPC+BfumO/mFq8HSTvrWjN
dR3/kY6do/9X/MZYY4IMMKj6H6j1ypXEUbPsMntyovuQtnreR70wxCR5/L/mTZNS
effxf6A96nR5lWrXygGeMDLbdsOopo6ZMTn6dLIbIoBQZGO/Js2O8x0EPZe23fSl
yut0drDDWzEW153xzSal5BSGR/Iui+TMX9LUlgdNu0qolHIp8aH1ky1xxwvG/EF+
MoxSSjyes71YgWeUmWoxNWjVQ2v11gQ58Lz0wMXegGiphAA8tkULPxCrm3PJXCuu
AFswYTyuwG/AYv/KAZMrXPw9yC6vsZMOOgk3vf1QhzjCgBxFT477/JSR3bqSg6s2
ZGiJ4OBKJb4LKOGUcaM0W+eGT9eRTIeclvuwuCaTh2mKGDfy1RHMZhfH6CiMftfK
5ZvLZizsLbGyFIIo2CMWg2/Rr89+f4bZl7y0CWlTeF3kqZr5s0F7MbsbHvgLNjq4
YBFIBja0A+E9DJYfUqewQwgpm921dJocs9Y65cPEXfUIvws8wAJRD90RpsMOTcoy
TVM6xjjo0vS3UghBY0Zz
=yDdF
-----END PGP SIGNATURE-----`

const clearsignEmoji = `-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA256

😓😕😙
-----BEGIN PGP SIGNATURE-----

wsFcBAEBCAAQBQJVcdygCRAOCFVquTBgxAAAJKMQALh5LT64AcX6crOZl0d+RqNJ
2SlzCgOSd9pUeEzybz2hwHQg43/2RexwWMXFTwklLypsialSun4xy9YODp6KDUzk
zeVBxbvYdYJehDS6LQKy/8He9aQDjmwX6kXnrBKRBWY9vKYq5tigv3qgJ2RgbURv
+7Y4SIyDRKwy9IwwH/zO48u1pxqdPZKaG7P3csjjE6LWWCoywuSLaZnJm9Zp+tQS
BQu4BIUXkfqMv2svbglgPXMMppvandtKsKSAbC2exibmG4WvugOJEPZlBDHMJVc1
/TRNCyBXSuTMBBTxgn4oU/t9Ug/u6l26UZIHNZMHjHWv6oKzEwKVStAgnaTtpTnO
8W5/ZywUBQZvhpZNE1h4k8u3QWz7Yva4A/sok0/FSteHqH40pCrAj7fVzXshnxTT
ezVqj8oiArXGbYXyDATnPXpUO93ji76U7DIrxm6y4wz7AcOwVlU1N2SJ8IXpEJLt
SO0TWUhR4Mr8FoQtUknpNysyDdtvib+R70Lu6LORL57moKCXDvzFXeb3j3oqdjPk
o8iVSK4lDWpdbWNcEtvzFJF+idROZV0STnFYWHwDAAdza4nxB9rgD+Vbg6hURv3C
teSqjQl5mFedYsH4VPxLnHI/fsOd16Toy7SQM8jz25EmK3wkFBgJLvVSoZyoOyjS
IOCGPgZFGCq6qb1te9up
=BQ89
-----END PGP SIGNATURE-----`
