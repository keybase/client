package service

import (
	"archive/zip"

	"io"
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
	testSignToTextFile(tc, h, u1, u2)
	testEncryptToTextFile(tc, h, u1, u2)
	testDecryptBogusFile(tc, h, u1, u2)
	testEncryptDecryptDirectory(tc, h, u1, u2)
	testSignVerifyDirectory(tc, h, u1, u2)
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
	encRes, err := h.SaltpackEncryptString(ctx, encArg)
	require.NoError(tc.T, err)
	require.NotEqual(tc.T, encArg.Plaintext, encRes.Ciphertext)
	require.False(tc.T, encRes.UsedUnresolvedSBS)
	require.Empty(tc.T, encRes.UnresolvedSBSAssertion)

	decArg := keybase1.SaltpackDecryptStringArg{Ciphertext: encRes.Ciphertext}
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
	encRes, err := h.SaltpackEncryptFile(ctx, encArg)
	require.NoError(tc.T, err)
	defer os.Remove(encRes.Filename)
	require.NotEqual(tc.T, encRes.Filename, encArg.Filename)
	require.True(tc.T, strings.HasSuffix(encRes.Filename, ".encrypted.saltpack"))
	require.False(tc.T, encRes.UsedUnresolvedSBS)
	require.Empty(tc.T, encRes.UnresolvedSBSAssertion)

	decArg := keybase1.SaltpackDecryptFileArg{EncryptedFilename: encRes.Filename}
	decRes, err := h.SaltpackDecryptFile(ctx, decArg)
	require.NoError(tc.T, err)
	defer os.Remove(decRes.DecryptedFilename)
	require.Equal(tc.T, encArg.Filename+" (1)", decRes.DecryptedFilename)
	require.True(tc.T, decRes.Signed)

	filesEqual(tc, encArg.Filename, decRes.DecryptedFilename)

	decArg.DestinationDir = os.TempDir()
	decRes, err = h.SaltpackDecryptFile(ctx, decArg)
	require.NoError(tc.T, err)
	defer os.Remove(decRes.DecryptedFilename)
	require.Equal(tc.T, filepath.Join(decArg.DestinationDir, filepath.Base(encArg.Filename)), decRes.DecryptedFilename)
	require.True(tc.T, decRes.Signed)
	filesEqual(tc, encArg.Filename, decRes.DecryptedFilename)

	encArg.DestinationDir = os.TempDir()
	encRes, err = h.SaltpackEncryptFile(ctx, encArg)
	require.NoError(tc.T, err)
	defer os.Remove(encRes.Filename)
	require.NotEqual(tc.T, encRes.Filename, encArg.Filename)
	require.True(tc.T, strings.HasSuffix(encRes.Filename, ".encrypted.saltpack"))
	require.Equal(tc.T, filepath.Join(encArg.DestinationDir, filepath.Base(encArg.Filename)+".encrypted.saltpack"), encRes.Filename)
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

func testSignToTextFile(tc libkb.TestContext, h *SaltpackHandler, u1, u2 *kbtest.FakeUser) {
	ctx := context.Background()
	signArg := keybase1.SaltpackSignStringToTextFileArg{Plaintext: "Begin with little things."}
	signedFile, err := h.SaltpackSignStringToTextFile(ctx, signArg)
	require.NoError(tc.T, err)
	defer os.Remove(signedFile)
	require.NotEmpty(tc.T, signedFile)

	verifyArg := keybase1.SaltpackVerifyFileArg{SignedFilename: signedFile}
	verifyRes, err := h.SaltpackVerifyFile(ctx, verifyArg)
	require.NoError(tc.T, err)
	defer os.Remove(verifyRes.VerifiedFilename)
	require.True(tc.T, verifyRes.Verified)
	fdata, err := os.ReadFile(verifyRes.VerifiedFilename)
	require.NoError(tc.T, err)
	require.Equal(tc.T, []byte(signArg.Plaintext), fdata)
}

func testEncryptToTextFile(tc libkb.TestContext, h *SaltpackHandler, u1, u2 *kbtest.FakeUser) {
	ctx := context.Background()
	encArg := keybase1.SaltpackEncryptStringToTextFileArg{
		Plaintext: "Think of life as a banquet.",
		Opts: keybase1.SaltpackFrontendEncryptOptions{
			Recipients:  []string{u1.Username, u2.Username},
			Signed:      true,
			IncludeSelf: true,
		},
	}
	encRes, err := h.SaltpackEncryptStringToTextFile(ctx, encArg)
	require.NoError(tc.T, err)
	defer os.Remove(encRes.Filename)
	require.NotEmpty(tc.T, encRes.Filename)
	require.False(tc.T, encRes.UsedUnresolvedSBS)
	require.Empty(tc.T, encRes.UnresolvedSBSAssertion)

	decArg := keybase1.SaltpackDecryptFileArg{EncryptedFilename: encRes.Filename}
	decRes, err := h.SaltpackDecryptFile(ctx, decArg)
	require.NoError(tc.T, err)
	defer os.Remove(decRes.DecryptedFilename)
	require.True(tc.T, decRes.Signed)
	fdata, err := os.ReadFile(decRes.DecryptedFilename)
	require.NoError(tc.T, err)
	require.Equal(tc.T, []byte(encArg.Plaintext), fdata)
}

func testDecryptBogusFile(tc libkb.TestContext, h *SaltpackHandler, u1, u2 *kbtest.FakeUser) {
	ctx := context.Background()
	testFile := "testdata/textfile"
	decFilename := testFile + ".decrypted"

	// this file is not encrypted
	decArg := keybase1.SaltpackDecryptFileArg{EncryptedFilename: filepath.FromSlash(testFile)}
	_, err := h.SaltpackDecryptFile(ctx, decArg)
	require.Error(tc.T, err)
	if exists, _ := libkb.FileExists(filepath.FromSlash(decFilename)); exists {
		os.Remove(filepath.FromSlash(decFilename))
		tc.T.Errorf("%s exists, it should be deleted if there is an error", decFilename)
	}
}

func testEncryptDecryptDirectory(tc libkb.TestContext, h *SaltpackHandler, u1, u2 *kbtest.FakeUser) {
	ctx := context.Background()
	encArg := keybase1.SaltpackEncryptFileArg{
		Filename: filepath.FromSlash("testdata/archive"),
		Opts: keybase1.SaltpackFrontendEncryptOptions{
			Recipients:  []string{u1.Username, u2.Username},
			Signed:      true,
			IncludeSelf: true,
		},
	}
	encRes, err := h.SaltpackEncryptFile(ctx, encArg)
	require.NoError(tc.T, err)
	defer os.Remove(encRes.Filename)
	require.NotEqual(tc.T, encRes.Filename, encArg.Filename)
	require.True(tc.T, strings.HasSuffix(encRes.Filename, ".zip.encrypted.saltpack"))
	require.False(tc.T, encRes.UsedUnresolvedSBS)
	require.Empty(tc.T, encRes.UnresolvedSBSAssertion)

	decArg := keybase1.SaltpackDecryptFileArg{EncryptedFilename: encRes.Filename}
	decRes, err := h.SaltpackDecryptFile(ctx, decArg)
	require.NoError(tc.T, err)
	defer os.Remove(decRes.DecryptedFilename)
	require.Equal(tc.T, encArg.Filename+".zip", decRes.DecryptedFilename)
	require.True(tc.T, decRes.Signed)

	checkZipArchive(tc, decRes.DecryptedFilename)
}

func testSignVerifyDirectory(tc libkb.TestContext, h *SaltpackHandler, u1, u2 *kbtest.FakeUser) {
	ctx := context.Background()
	signArg := keybase1.SaltpackSignFileArg{Filename: filepath.FromSlash("testdata/archive")}
	signedFile, err := h.SaltpackSignFile(ctx, signArg)
	require.NoError(tc.T, err)
	defer os.Remove(signedFile)
	require.NotEqual(tc.T, signedFile, signArg.Filename)
	require.True(tc.T, strings.HasSuffix(signedFile, ".zip.signed.saltpack"))

	verifyArg := keybase1.SaltpackVerifyFileArg{SignedFilename: signedFile}
	verifyRes, err := h.SaltpackVerifyFile(ctx, verifyArg)
	require.NoError(tc.T, err)
	defer os.Remove(verifyRes.VerifiedFilename)
	require.Equal(tc.T, signArg.Filename+".zip", verifyRes.VerifiedFilename)
	require.True(tc.T, verifyRes.Verified)

	checkZipArchive(tc, verifyRes.VerifiedFilename)
}

func filesEqual(tc libkb.TestContext, a, b string) {
	adata, err := os.ReadFile(a)
	require.NoError(tc.T, err)
	bdata, err := os.ReadFile(b)
	require.NoError(tc.T, err)
	require.Equal(tc.T, adata, bdata)
}

func checkZipArchive(tc libkb.TestContext, filename string) {
	r, err := zip.OpenReader(filename)
	require.NoError(tc.T, err)
	defer r.Close()
	// some platforms make `@tmp` entries for the directories, so there
	// can be 11
	if len(r.File) != 9 && len(r.File) != 11 {
		tc.T.Errorf("number of files in zip archive: %d, expected 9 or 11", len(r.File))
	}
	for _, f := range r.File {
		switch filepath.ToSlash(f.Name) {
		case "archive/", "archive/1/", "archive/2/": // skip the directory entries
		case "archive/a.txt":
			checkZipFileEqual(tc, f)
		case "archive/b.txt":
			checkZipFileEqual(tc, f)
		case "archive/c.txt":
			checkZipFileEqual(tc, f)
		case "archive/1/000.log":
			checkZipFileEqual(tc, f)
		case "archive/1/001.log":
			checkZipFileEqual(tc, f)
		case "archive/2/000.log":
			checkZipFileEqual(tc, f)
		default:
			tc.T.Logf("unknown file in zip: %s", f.Name)
		}
	}
}

func checkZipFileEqual(tc libkb.TestContext, f *zip.File) {
	localName := filepath.Join("testdata", f.Name)
	localData, err := os.ReadFile(localName)
	require.NoError(tc.T, err)
	fz, err := f.Open()
	require.NoError(tc.T, err)
	defer fz.Close()
	zipData, err := io.ReadAll(fz)
	require.NoError(tc.T, err)
	require.Equal(tc.T, localData, zipData)
}
