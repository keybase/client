package engine

import (
	"crypto"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-crypto/openpgp"
	"github.com/keybase/go-crypto/openpgp/clearsign"
	"github.com/keybase/go-crypto/openpgp/packet"
	"github.com/keybase/go-crypto/openpgp/s2k"
)

const pgpWarningsMsg = `Consonantia, there live the blind texts. Separated they live in Bookmarksgrove
right at the coast of the Semantics, a large language ocean. A small river named
Duden flows by their place and supplies it with the necessary regelialia. It is
a paradisematic country, in which roasted parts of sentences fly into your
mouth. Even the all-powerful Pointing has no control about the blind texts it is
an almost unorthographic life One day however a small line of blind text by the
name of Lorem Ipsum decided to leave for the far World of Grammar. The Big Oxmox
advised her not to do so, because there were thousands of bad Commas, wild
Question Marks and devious Semikoli, but the Little Blind Text didn’t listen.
She packed her seven versalia, put her initial into the belt and made herself on
the way. When she reached the first hills of the Italic Mountains, she had a
last view back on the skyline of her hometown Bookmarksgrove, the headline of
Alphabet Village and the subline of her own road, the Line Lane. Pityful a
rethoric question ran over her cheek, then she continued her way. On her way she
met a copy. The copy warned the Little Blind Text, that where it came from it
would have been rewritten a thousand times and everything that was left from its
origin would be the word "and" and the Little Blind Text should turn around and
return to its own, safe country. But nothing the copy said could convince her
and so it didn’t take long until a few insidious Copy Writers ambushed her, made
her drunk with Longe and Parole and dragged her into their agency, where they
abused her for their projects again and again. And if she hasn’t been rewritten,
then they are still using her.Far far away, behind the word mountains, far from
the countries Vokalia and Consonantia, there live the blind texts. Separated
they live in Bookmarksgrove right at the coast of the Semantics, a large
language ocean. A small river named Duden flows by their place and supplies it
with the necessary regelialia. It is a paradisematic country, in which roasted
parts of sentences fly into your mouth. Even the all-powerful Pointing has no
control about the blind texts it is an almost unorthographic life One`

func generateOpenPGPEntity(ts time.Time, hash crypto.Hash, accepts []crypto.Hash) (*openpgp.Entity, error) {
	// All test keys are RSA-768 because of the ease of generation
	cfg := &packet.Config{
		DefaultHash: hash,
		Time:        func() time.Time { return ts },
		RSABits:     768,
	}
	hashName := libkb.HashToName[hash]
	hashLower := strings.ToLower(hashName)
	entity, err := openpgp.NewEntity("Test "+hashName, "", hashLower+"@example.com", cfg)
	if err != nil {
		return nil, err
	}

	acceptsConverted := []uint8{}
	for _, h := range accepts {
		if v, ok := s2k.HashToHashId(h); ok {
			acceptsConverted = append(acceptsConverted, v)
		}
	}

	// Sign all the identities...
	for _, identity := range entity.Identities {
		identity.SelfSignature.PreferredHash = acceptsConverted
		if err := identity.SelfSignature.SignUserId(identity.UserId.Id, entity.PrimaryKey, entity.PrivateKey, cfg); err != nil {
			panic(err)
		}
	}
	// and the subkeys...
	for _, subkey := range entity.Subkeys {
		if err := subkey.Sig.SignKey(subkey.PublicKey, entity.PrivateKey, cfg); err != nil {
			panic(err)
		}
	}

	return entity, nil
}

type encryptTest struct {
	Name string // Name of the test

	DigestHash crypto.Hash // Hash used for msg digests
	AlicesHash crypto.Hash
	BobsHash   crypto.Hash
	Count      int // How many warnings are expected

	Mode  string // either encrypt, encrypt-and-sign
	Known bool   // whether to check for the key on keybase
}

type pgpWarningsUserBundle struct {
	tc   libkb.TestContext
	key  *libkb.PGPKeyBundle
	user *FakeUser
}

func (e encryptTest) test(t *testing.T, users map[string]map[crypto.Hash]*pgpWarningsUserBundle) {
	t.Logf("Processing PGP warnings test - %s", e.Name)

	now := time.Now()
	supportedHashes := []crypto.Hash{crypto.SHA1, crypto.SHA256}

	// Alice is the:
	// 1) Party encrypting (and optionally signing) to Bob in "encrypt"
	// 2) The verifier / decrypter in all other scenarios
	if _, ok := users["alice"]; !ok {
		users["alice"] = map[crypto.Hash]*pgpWarningsUserBundle{}
	}
	if _, ok := users["alice"][e.AlicesHash]; !ok {
		tc := SetupEngineTest(t, "PGPEncrypt")
		tc.Tp.APIHeaders = map[string]string{"X-Keybase-Sigchain-Compatibility": "1"}

		// Generate Alice's keypair. It'll always be SHA256 as we don't allow
		// the generation of weaker selfsigs in Keybase itself.
		aliceKeys, err := generateOpenPGPEntity(now, e.AlicesHash, supportedHashes)
		require.NoError(t, err, "alice's keys generation")
		aliceBundle := libkb.NewPGPKeyBundle(aliceKeys)

		u := createFakeUserWithPGPSibkeyPregen(tc, aliceBundle)

		users["alice"][e.AlicesHash] = &pgpWarningsUserBundle{
			tc:   tc,
			key:  aliceBundle,
			user: u,
		}
	}
	alice := users["alice"][e.AlicesHash]

	// We'll only run engines as Alice because Bob ~is a phony who uses SHA1~.
	// 24-01-2019: We're also phonies :(
	m := NewMetaContextForTest(alice.tc).WithUIs(libkb.UIs{
		LogUI: alice.tc.G.UI.GetLogUI(),
		IdentifyUI: &FakeIdentifyUI{
			Proofs: map[string]string{},
		},
		SecretUI: alice.user.NewSecretUI(),
		PgpUI:    &TestPgpUI{},
	})

	// Bob is the:
	// 1) Recipient in the "encrypt" scenario
	// 2) Sender in all other scenarios
	// Bob's signatures (both identity sigs and msg digests) can be SHA1.
	// Bob has a cousin called Anonybob who refuses to publish his keys to Keybase,
	// so he sends them over email (the "unknown user" scenario).
	bobName := "bob"
	if !e.Known {
		bobName = "anonybob"
	}
	if _, ok := users[bobName]; !ok {
		users[bobName] = map[crypto.Hash]*pgpWarningsUserBundle{}
	}
	if _, ok := users[bobName][e.BobsHash]; !ok {
		tc := SetupEngineTest(t, "PGPEncrypt")
		tc.Tp.APIHeaders = map[string]string{"X-Keybase-Sigchain-Compatibility": "1"}

		bobKeys, err := generateOpenPGPEntity(now, e.BobsHash, supportedHashes)
		require.NoError(t, err, "bob's keys generation")
		bobBundle := libkb.NewPGPKeyBundle(bobKeys)

		var u *FakeUser
		if e.Known {
			u = createFakeUserWithPGPSibkeyPregen(tc, bobBundle)
		} else {
			importEng := NewPGPKeyImportEngine(alice.tc.G, PGPKeyImportEngineArg{
				Pregen:   bobBundle,
				OnlySave: true,
			})
			require.NoError(t, RunEngine2(m, importEng), "importing pubkey failed")
		}

		users[bobName][e.BobsHash] = &pgpWarningsUserBundle{
			tc:   tc,
			key:  bobBundle,
			user: u,
		}
	}
	bob := users[bobName][e.BobsHash]

	// Both "encrypt" and "encrypt-and-sign" simply run engine.PGPEncrypt
	if e.Mode == "encrypt" || e.Mode == "encrypt-and-sign" {
		sink := libkb.NewBufferCloser()
		arg := &PGPEncryptArg{
			Recips: []string{bob.user.Username},
			Source: strings.NewReader(pgpWarningsMsg),
			Sink:   sink,
			NoSign: e.Mode == "encrypt",
		}
		eng := NewPGPEncrypt(alice.tc.G, arg)
		require.NoErrorf(t, RunEngine2(m, eng), "engine failure [%s]", e.Name)

		require.Greaterf(t, len(sink.Bytes()), 0, "no output [%s]", e.Name)
		require.Lenf(t, eng.warnings, e.Count, "warnings count [%s]", e.Name)
		return
	}

	// "Sign" simply runs engine.PGPSign
	if e.Mode == "sign" {
		sink := libkb.NewBufferCloser()
		arg := &PGPSignArg{
			Source: io.NopCloser(strings.NewReader(pgpWarningsMsg)),
			Sink:   sink,
		}
		eng := NewPGPSignEngine(alice.tc.G, arg)
		require.NoErrorf(t, RunEngine2(m, eng), "engine failure [%s]", e.Name)

		require.Greaterf(t, len(sink.Bytes()), 0, "no output [%s]", e.Name)
		require.Lenf(t, eng.warnings, e.Count, "warnings count [%s]", e.Name)
		return
	}

	cfg := &packet.Config{
		DefaultHash: e.DigestHash,
		Time:        func() time.Time { return now },
	}

	if e.Mode == "verify" {
		// Rather than using PGPSign, we use our custom wrapper methods to make
		// sure that we can set the low level variables.

		// This time there's no recipient, we're generating a message for the
		// sender / signer / verifier using only the recipient's key.
		var (
			clearsignSink = libkb.NewBufferCloser()
			attachedSink  = libkb.NewBufferCloser()
			detachedSink  = libkb.NewBufferCloser()
		)

		var signedBy string
		if e.Known {
			signedBy = bob.user.Username
		}

		// Start with the clearsign sig
		clearsignInput, err := clearsign.Encode(
			clearsignSink,
			bob.key.PrivateKey,
			cfg,
		)
		require.NoErrorf(t, err, "clearsign failure [%s]", e.Name)
		_, err = clearsignInput.Write([]byte(pgpWarningsMsg))
		require.NoErrorf(t, err, "writing to clearsign [%s]", e.Name)
		require.NoErrorf(t, clearsignInput.Close(), "finishing clearsign [%s]", e.Name)
		arg := &PGPVerifyArg{
			Source:   clearsignSink,
			SignedBy: signedBy,
		}
		eng := NewPGPVerify(alice.tc.G, arg)
		require.NoErrorf(t, RunEngine2(m, eng), "engine failure [%s]", e.Name)
		require.Lenf(t, eng.SignatureStatus().Warnings, e.Count, "warnings count [%s]", e.Name)

		// Then process the attached sig
		attachedInput, _, err := libkb.ArmoredAttachedSign(
			attachedSink,
			*bob.key.Entity,
			nil,
			cfg,
		)
		require.NoErrorf(t, err, "attached sign failure [%s]", e.Name)
		_, err = attachedInput.Write([]byte(pgpWarningsMsg))
		require.NoErrorf(t, err, "writing to attached signer [%s]", e.Name)
		require.NoErrorf(t, attachedInput.Close(), "writing to attached sign [%s]", e.Name)
		arg = &PGPVerifyArg{
			Source:   attachedSink,
			SignedBy: signedBy,
		}
		eng = NewPGPVerify(alice.tc.G, arg)
		require.NoErrorf(t, RunEngine2(m, eng), "engine failure [%s]", e.Name)
		require.Lenf(t, eng.SignatureStatus().Warnings, e.Count, "warnings count [%s]", e.Name)

		// Detached signatures are probably the easiest
		require.NoError(t, openpgp.ArmoredDetachSignText(
			detachedSink,
			bob.key.Entity,
			strings.NewReader(pgpWarningsMsg),
			cfg,
		), "detached sign failure")
		arg = &PGPVerifyArg{
			Source:    strings.NewReader(pgpWarningsMsg),
			Signature: detachedSink.Bytes(),
			SignedBy:  signedBy,
		}
		eng = NewPGPVerify(alice.tc.G, arg)
		require.NoErrorf(t, RunEngine2(m, eng), "engine failure [%s]", e.Name)
		require.Lenf(t, eng.SignatureStatus().Warnings, e.Count, "warnings count [%s]", e.Name)

		return
	}

	if e.Mode == "decrypt" {
		// Mostly the same as decrypt, except we're using different code paths
		// to achieve roughly the same effect.

		var (
			clearsignSink       = libkb.NewBufferCloser()
			clearsignOutputSink = libkb.NewBufferCloser()
			attachedSink        = libkb.NewBufferCloser()
			attachedOutputSink  = libkb.NewBufferCloser()
		)

		var signedBy string
		if e.Known {
			signedBy = bob.user.Username
		}

		// Start with the clearsign sig, which technically isn't even something
		// decryptable.
		clearsignInput, err := clearsign.Encode(
			clearsignSink,
			bob.key.PrivateKey,
			cfg,
		)
		require.NoErrorf(t, err, "clearsign failure [%s]", e.Name)
		_, err = clearsignInput.Write([]byte(pgpWarningsMsg))
		require.NoErrorf(t, err, "writing to clearsign [%s]", e.Name)
		require.NoErrorf(t, clearsignInput.Close(), "finishing clearsign [%s]", e.Name)
		arg := &PGPDecryptArg{
			Sink:         clearsignOutputSink,
			Source:       clearsignSink,
			AssertSigned: true,
			SignedBy:     signedBy,
		}
		eng := NewPGPDecrypt(alice.tc.G, arg)
		require.NoErrorf(t, RunEngine2(m, eng), "engine failure [%s]", e.Name)

		// TODO: Y2K-1334 Fix this test
		require.Lenf(t, eng.SignatureStatus().Warnings, e.Count, "warnings count [%s]", e.Name)
		// require.Equalf(t, []byte(pgpWarningsMsg), clearsignOutputSink.Bytes(), "output should be the same as the input [%s]", e.Name)

		// Then process the attached sig
		attachedInput, _, err := libkb.ArmoredAttachedSign(
			attachedSink,
			*bob.key.Entity,
			nil,
			cfg,
		)
		require.NoErrorf(t, err, "attached sign failure [%s]", e.Name)
		_, err = attachedInput.Write([]byte(pgpWarningsMsg))
		require.NoErrorf(t, err, "writing to attached signer [%s]", e.Name)
		require.NoErrorf(t, attachedInput.Close(), "closing the attached signer [%s]", e.Name)
		arg = &PGPDecryptArg{
			Sink:         attachedOutputSink,
			Source:       attachedSink,
			AssertSigned: true,
			SignedBy:     signedBy,
		}
		eng = NewPGPDecrypt(alice.tc.G, arg)
		require.NoErrorf(t, RunEngine2(m, eng), "engine failure [%s]", e.Name)
		require.Lenf(t, eng.SignatureStatus().Warnings, e.Count, "warnings count [%s]", e.Name)
		require.Equalf(t, []byte(pgpWarningsMsg), attachedOutputSink.Bytes(), "output should be the same as the input [%s]", e.Name)

		return
	}
}

func TestPGPWarnings(t *testing.T) {
	users := map[string]map[crypto.Hash]*pgpWarningsUserBundle{}

	// g, _ := errgroup.WithContext(context.Background())
	for _, x := range []encryptTest{
		// Encrypt
		{
			Name:       "Encrypt to a SHA1 recipient",
			AlicesHash: crypto.SHA256,
			BobsHash:   crypto.SHA1,
			Count:      1,
			Mode:       "encrypt",
			Known:      true,
		},

		// Encrypt and sign
		{
			Name:       "Encrypt and sign to a SHA1 recipient",
			AlicesHash: crypto.SHA256,
			BobsHash:   crypto.SHA1,
			Count:      1,
			Mode:       "encrypt-and-sign",
			Known:      true,
		},
		{
			Name:       "Encrypt and sign to a SHA256 recipient",
			AlicesHash: crypto.SHA256,
			BobsHash:   crypto.SHA256,
			Count:      0,
			Mode:       "encrypt-and-sign",
			Known:      true,
		},
		{
			Name:       "Encrypt and sign from SHA1 to a SHA1 recipient",
			AlicesHash: crypto.SHA1,
			BobsHash:   crypto.SHA1,
			Count:      2,
			Mode:       "encrypt-and-sign",
			Known:      true,
		},
		{
			Name:       "Encrypt and sign from SHA1 to a SHA256 recipient",
			AlicesHash: crypto.SHA1,
			BobsHash:   crypto.SHA256,
			Count:      1,
			Mode:       "encrypt-and-sign",
			Known:      true,
		},

		// Sign
		{
			Name:       "Sign using SHA1",
			AlicesHash: crypto.SHA1,
			BobsHash:   crypto.SHA256, // unused
			Count:      1,
			Mode:       "sign",
			Known:      true,
		},
		{
			Name:       "Sign using SHA256",
			AlicesHash: crypto.SHA256,
			BobsHash:   crypto.SHA256, // unused
			Count:      0,
			Mode:       "sign",
			Known:      true,
		},

		// Verify - will run all 3 variants (clearsign / attached / detached)
		{
			Name:       "Verification of a SHA1 sig with a SHA1 self-sig",
			DigestHash: crypto.SHA1,
			AlicesHash: crypto.SHA256,
			BobsHash:   crypto.SHA1,
			Count:      2,
			Mode:       "verify",
			Known:      true,
		},
		{
			Name:       "Verification of a SHA256 sig with a SHA1 self-sig",
			DigestHash: crypto.SHA256,
			AlicesHash: crypto.SHA256,
			BobsHash:   crypto.SHA1,
			Count:      1,
			Mode:       "verify",
		},
		{
			Name:       "Verification of a SHA1 sig with a SHA256 self-sig",
			DigestHash: crypto.SHA1,
			AlicesHash: crypto.SHA256,
			BobsHash:   crypto.SHA256,
			Count:      1,
			Mode:       "verify",
			Known:      true,
		},
		{
			Name:       "Verification of a SHA1 sig with a SHA256 self-sig (unknown)",
			DigestHash: crypto.SHA1,
			AlicesHash: crypto.SHA256,
			BobsHash:   crypto.SHA256,
			Count:      1,
			Mode:       "verify",
			Known:      false,
		},
		{
			Name:       "Verification of a SHA256 sig with a SHA256 self-sig",
			DigestHash: crypto.SHA256,
			AlicesHash: crypto.SHA256,
			BobsHash:   crypto.SHA256,
			Count:      0,
			Mode:       "verify",
		},

		// Decrypt - will run all 2 variants (clearsign / attached)
		{
			Name:       "Decryption of a SHA1 sig with a SHA1 self-sig",
			DigestHash: crypto.SHA1,
			AlicesHash: crypto.SHA256,
			BobsHash:   crypto.SHA1,
			Count:      2,
			Mode:       "decrypt",
			Known:      true,
		},
		{
			Name:       "Decryption of a SHA256 sig with a SHA1 self-sig",
			DigestHash: crypto.SHA256,
			AlicesHash: crypto.SHA256,
			BobsHash:   crypto.SHA1,
			Count:      1,
			Mode:       "decrypt",
		},
		{
			Name:       "Decryption of a SHA1 sig with a SHA256 self-sig",
			DigestHash: crypto.SHA1,
			AlicesHash: crypto.SHA256,
			BobsHash:   crypto.SHA256,
			Count:      1,
			Mode:       "decrypt",
			Known:      true,
		},
		{
			Name:       "Decryption of a SHA256 sig with a SHA256 self-sig",
			DigestHash: crypto.SHA256,
			AlicesHash: crypto.SHA256,
			BobsHash:   crypto.SHA256,
			Count:      0,
			Mode:       "decrypt",
		},
	} {
		x.test(t, users)
	}

	for _, hashesToBundles := range users {
		for _, textBundle := range hashesToBundles {
			textBundle.tc.Cleanup()
		}
	}
}
