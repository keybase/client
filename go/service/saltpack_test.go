package service

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestSaltpackFrontend(t *testing.T) {
	tc := libkb.SetupTest(t, "sp", 0)
	defer tc.Cleanup()

	u1, err := kbtest.CreateAndSignupFakeUser("sp", tc.G)
	require.NoError(t, err)

	kr, err := tc.G.GetPerUserKeyring(context.Background())
	require.NoError(t, err)
	err = kr.Sync(libkb.NewMetaContext(context.Background(), tc.G))
	require.NoError(t, err)

	u2, err := kbtest.CreateAndSignupFakeUser("sp", tc.G)
	require.NoError(t, err)

	kr, err = tc.G.GetPerUserKeyring(context.Background())
	require.NoError(t, err)
	err = kr.Sync(libkb.NewMetaContext(context.Background(), tc.G))
	require.NoError(t, err)

	h := NewSaltpackHandler(nil, tc.G)
	testEncryptDecryptString(tc, h, u1, u2)
	testSignVerifyString(tc, h, u1, u2)
	testEncryptDecryptFile(tc, h, u1, u2)
	testSignVerifyFile(tc, h, u1, u2)
}

func testEncryptDecryptString(tc libkb.TestContext, h *SaltpackHandler, u1, u2 *kbtest.FakeUser) {
	ctx := context.Background()
	encArg := keybase1.SaltpackEncryptStringArg{
		Plaintext: "Think of life as a banquet.",
		Opts: keybase1.SaltpackFrontendEncryptOptions{
			Recipients:  []string{u1.Username, u2.Username},
			Signed:      true,
			IncludeSelf: true,
		},
	}
	ciphertext, err := h.SaltpackEncryptString(ctx, encArg)
	require.NoError(tc.T, err)
	require.NotEqual(tc.T, encArg.Plaintext, ciphertext)

	decArg := keybase1.SaltpackDecryptStringArg{Ciphertext: ciphertext}
	decRes, err := h.SaltpackDecryptString(ctx, decArg)
	require.NoError(tc.T, err)
	require.Equal(tc.T, decRes.Plaintext, encArg.Plaintext)
	require.True(tc.T, decRes.Signed)
}

func testSignVerifyString(tc libkb.TestContext, h *SaltpackHandler, u1, u2 *kbtest.FakeUser) {
	ctx := context.Background()
	signArg := keybase1.SaltpackSignStringArg{Plaintext: "Begin with little things."}
	signedMsg, err := h.SaltpackSignString(ctx, signArg)
	require.NoError(tc.T, err)
	require.NotEqual(tc.T, signArg.Plaintext, signedMsg)

	verifyArg := keybase1.SaltpackVerifyStringArg{SignedMsg: signedMsg}
	verifyRes, err := h.SaltpackVerifyString(ctx, verifyArg)
	require.NoError(tc.T, err)
	require.Equal(tc.T, verifyRes.Plaintext, signArg.Plaintext)
	require.True(tc.T, verifyRes.Verified)
}

func testEncryptDecryptFile(tc libkb.TestContext, h *SaltpackHandler, u1, u2 *kbtest.FakeUser) {
	ctx := context.Background()
	encArg := keybase1.SaltpackEncryptFileArg{
		Filename: filepath.FromSlash("testdata/textfile"),
		Opts: keybase1.SaltpackFrontendEncryptOptions{
			Recipients:  []string{u1.Username, u2.Username},
			Signed:      true,
			IncludeSelf: true,
		},
	}
	encFile, err := h.SaltpackEncryptFile(ctx, encArg)
	require.NoError(tc.T, err)
	defer os.Remove(encFile)
	require.NotEqual(tc.T, encFile, encArg.Filename)
	require.True(tc.T, strings.HasSuffix(encFile, ".encrypted.saltpack"))

	decArg := keybase1.SaltpackDecryptFileArg{EncryptedFilename: encFile}
	decRes, err := h.SaltpackDecryptFile(ctx, decArg)
	require.NoError(tc.T, err)
	defer os.Remove(decRes.DecryptedFilename)
	require.Equal(tc.T, encArg.Filename+" (1)", decRes.DecryptedFilename)
	require.True(tc.T, decRes.Signed)

	filesEqual(tc, encArg.Filename, decRes.DecryptedFilename)
}

func testSignVerifyFile(tc libkb.TestContext, h *SaltpackHandler, u1, u2 *kbtest.FakeUser) {
	ctx := context.Background()
	signArg := keybase1.SaltpackSignFileArg{Filename: filepath.FromSlash("testdata/textfile")}
	signedFile, err := h.SaltpackSignFile(ctx, signArg)
	require.NoError(tc.T, err)
	defer os.Remove(signedFile)
	require.NotEqual(tc.T, signedFile, signArg.Filename)
	require.True(tc.T, strings.HasSuffix(signedFile, ".signed.saltpack"))

	verifyArg := keybase1.SaltpackVerifyFileArg{SignedFilename: signedFile}
	verifyRes, err := h.SaltpackVerifyFile(ctx, verifyArg)
	require.NoError(tc.T, err)
	defer os.Remove(verifyRes.VerifiedFilename)
	require.Equal(tc.T, signArg.Filename+" (1)", verifyRes.VerifiedFilename)
	require.True(tc.T, verifyRes.Verified)

	filesEqual(tc, signArg.Filename, verifyRes.VerifiedFilename)
}

func filesEqual(tc libkb.TestContext, a, b string) {
	adata, err := ioutil.ReadFile(a)
	require.NoError(tc.T, err)
	bdata, err := ioutil.ReadFile(b)
	require.NoError(tc.T, err)
	require.Equal(tc.T, adata, bdata)
}
