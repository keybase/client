package engine

import (
	"bytes"
	"io"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/saltpack"
	"github.com/stretchr/testify/require"
)

func TestSaltpackVerifyErrors(t *testing.T) {
	tc := SetupEngineTest(t, "verify")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "ver")

	var sink bytes.Buffer

	msg := "10 days in Japan"
	sarg := &SaltpackSignArg{
		Sink:   libkb.NopWriteCloser{W: &sink},
		Source: io.NopCloser(bytes.NewBufferString(msg)),
	}

	eng := NewSaltpackSign(tc.G, sarg)
	uis := libkb.UIs{
		IdentifyUI: &FakeIdentifyUI{},
		SecretUI:   fu.NewSecretUI(),
	}

	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	sig := sink.String()
	t.Logf("signed data: %s", sig)

	// test SignedBy option:
	varg := &SaltpackVerifyArg{
		Sink:   libkb.NopWriteCloser{W: &sink},
		Source: strings.NewReader(sig),
		Opts: keybase1.SaltpackVerifyOptions{
			SignedBy: fu.Username,
		},
	}

	m = m.WithSaltpackUI(fakeSaltpackUI{})
	veng := NewSaltpackVerify(tc.G, varg)
	if err := RunEngine2(m, veng); err != nil {
		t.Fatal(err)
	}

	invalidFormatMsg := `BEGIN KEYBASE SALTPACK SIGNED MESSAGE. kXR7VktZdyH7rvq v5weRa0zkUpZbPl nShyKLCCGSyBcvL sg7Gi9ySjlkxHPS RUM4Vm3DUD635GV a9LihWKrvns0JGJ RmkXOCgHdP3xfwr if6ynJGBkv7cOUC xLo6Q4zPrJ4TAKG bIc1OaeFW8rmpBo OyWcfzK9cRARuy5 hP0TMta2T2mgL0P 3Dwjg3VFKL. END KEYBASE SALTPACK SIGNED.`

	// test SignedBy option:
	varg = &SaltpackVerifyArg{
		Sink:   libkb.NopWriteCloser{W: &sink},
		Source: strings.NewReader(invalidFormatMsg),
		Opts: keybase1.SaltpackVerifyOptions{
			SignedBy: fu.Username,
		},
	}
	veng = NewSaltpackVerify(tc.G, varg)
	err := RunEngine2(m, veng)
	require.Error(t, err)
	require.IsType(t, libkb.VerificationError{}, err)
	if err, ok := err.(libkb.VerificationError); ok {
		require.Equal(t, 0, err.Cause.StatusCode) // not set
	}

	wrongTypeSig := `BEGIN KEYBASE SALTPACK ENCRYPTED MESSAGE. kiOUtMhcc4NXXRb XMxIeCbf5rCLT18 pRBzZdL55xh2r43 A3X3m0ge60cfaQp Lv2fkhFdLXXzkqr qPkQ8IoPvsi27CB wQhS4rFkNRwOgDF G1keffFjdpeZj7h xk15rsO1gIBbpIy 1KYUAdFv8GcyxQ7 jipKdjlAr334MDn r6aaaXxiTs6io71 cr0FJoqVtCJfxNV JGaqDu1W9zT7XTq 5pyyVKTdzE1MzLd jTi21JXMTxOeWfe B42YrRzmyNOrBw9 rve1C4zoYUaL2zk 44zqEkpZloLiyn9 Y9EOjMRe6tdGnq4 GxJBAI0q6Im0Q7k fN4STMCmhgdjnag PWdxXfL1gh912B9 M7EFAQ3x9IWnp7U N2ezXytHvVJTXkR Lpo23jh7WOQkXpS 2tDszd1a46Atd7Q 9u2G9JsfxIKi6im AkCxEBReBQbhpWM e2r4qyN24Kbya2s Zc67fEYK6EWcMFq MEEwO2hKZYBwshq nND9jcuPAVxPTLv 9mEotIO7ubkYHVm 8DCyR4W4Owkiw4V 0DFLUP5tgHXJKXy 2YYDzR2NvnKfqJd z8Bn15pYkZ9sUhA KuFIHFiA95RfFsY cn2Se7YGGBP. END KEYBASE SALTPACK ENCRYPTED MESSAGE.`

	// test SignedBy option:
	varg = &SaltpackVerifyArg{
		Sink:   libkb.NopWriteCloser{W: &sink},
		Source: strings.NewReader(wrongTypeSig),
		Opts: keybase1.SaltpackVerifyOptions{
			SignedBy: fu.Username,
		},
	}
	veng = NewSaltpackVerify(tc.G, varg)
	err = RunEngine2(m, veng)
	require.Error(t, err)
	require.IsType(t, libkb.VerificationError{}, err)
	if err, ok := err.(libkb.VerificationError); ok {
		require.IsType(t, saltpack.ErrWrongMessageType{}, err.Cause.Err)
		require.IsType(t, libkb.SCWrongCryptoMsgType, err.Cause.StatusCode)
	}
}
