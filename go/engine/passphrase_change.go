// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	triplesec "github.com/keybase/go-triplesec"
)

// PassphraseChange engine is used for changing the user's passphrase, either
// by replacement or by force.
type PassphraseChange struct {
	arg        *keybase1.PassphraseChangeArg
	me         *libkb.User
	ppStream   *libkb.PassphraseStream
	usingPaper bool
	libkb.Contextified
}

// NewPassphraseChange creates a new engine for changing user passphrases,
// either if the current passphrase is known, or in "force" mode
func NewPassphraseChange(a *keybase1.PassphraseChangeArg, g *libkb.GlobalContext) *PassphraseChange {
	return &PassphraseChange{
		arg:          a,
		Contextified: libkb.NewContextified(g),
	}
}

// Name provides the name of the engine for the engine interface
func (c *PassphraseChange) Name() string {
	return "PassphraseChange"
}

// Prereqs returns engine prereqs
func (c *PassphraseChange) Prereqs() Prereqs {
	if c.arg.Force {
		return Prereqs{}
	}

	return Prereqs{Session: true}
}

// RequiredUIs returns the required UIs.
func (c *PassphraseChange) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.SecretUIKind,
	}
}

// SubConsumers requires the other UI consumers of this engine
func (c *PassphraseChange) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&PaperKeyGen{},
	}
}

// Run the engine
func (c *PassphraseChange) Run(ctx *Context) (err error) {
	c.G().Log.Debug("+ PassphraseChange.Run")
	defer func() {
		c.G().Log.Debug("- PassphraseChange.Run -> %s", libkb.ErrToOk(err))
		c.G().SKBKeyringMu.Unlock()
	}()
	c.G().SKBKeyringMu.Lock()
	c.G().Log.Debug("| Acquired SKBKeyringMu mutex")

	if len(c.arg.Passphrase) < libkb.MinPassphraseLength {
		return libkb.PassphraseError{Msg: "too short"}
	}

	if err = c.loadMe(); err != nil {
		return
	}

	c.G().LoginState().RunSecretSyncer(c.me.GetUID())

	if c.arg.Force {
		err = c.runForcedUpdate(ctx)
	} else {
		err = c.runStandardUpdate(ctx)
	}

	if err == nil {
		c.G().LoginState().RunSecretSyncer(c.me.GetUID())
	}

	return
}

// findDeviceKeys looks for device keys and unlocks them.
func (c *PassphraseChange) findDeviceKeys(ctx *Context) (*keypair, error) {
	return findDeviceKeys(ctx, c, c.me)
}

// findPaperKeys checks if the user has paper keys.  If he/she
// does, it prompts for a paper key phrase.  This is used to
// regenerate paper keys, which are then matched against the
// paper keys found in the keyfamily.
func (c *PassphraseChange) findPaperKeys(ctx *Context) (*keypair, error) {
	kp, err := findPaperKeys(ctx, c.G(), c.me)
	if err != nil {
		c.G().Log.Debug("findPaperKeys error: %s", err)
		return nil, err
	}
	c.G().Log.Debug("findPaperKeys success")
	c.usingPaper = true
	return kp, nil
}

// findUpdateKeys looks for keys to perform the passphrase update.
// The first choice is device keys.  If that fails, it will look
// for backup keys.  If backup keys are necessary, then it will
// also log the user in with the backup keys.
func (c *PassphraseChange) findUpdateKeys(ctx *Context) (*keypair, error) {
	kp, err := c.findDeviceKeys(ctx)
	if err == nil {
		return kp, nil
	}

	kp, err = c.findPaperKeys(ctx)
	if err != nil {
		return nil, err
	}

	// log in with backup keys
	err = c.G().LoginState().LoginWithKey(ctx.LoginContext, c.me, kp.sigKey, nil)
	if err != nil {
		return nil, err
	}

	return kp, nil
}

func (c *PassphraseChange) forceUpdatePassphrase(ctx *Context, sigKey libkb.GenericKey, ppGen libkb.PassphraseGeneration, oldClientHalf libkb.LKSecClientHalf) error {
	// Don't update server-synced pgp keys when recovering.
	// This will render any server-synced pgp keys unrecoverable from the server.
	// TODO would it responsible to ask the server to delete them?
	pgpKeys, nPgpKeysLost, err := c.findAndDecryptPrivatePGPKeysLossy(ctx)
	if err != nil {
		return err
	}

	if nPgpKeysLost > 0 {
		c.G().Log.Debug("PassphraseChange.runForcedUpdate: Losing %v synced keys", nPgpKeysLost)
	}

	var acctErr error
	c.G().LoginState().Account(func(a *libkb.Account) {
		// Ready the update argument; almost done, but we need some more stuff.
		payload, err := c.commonArgs(a, oldClientHalf, pgpKeys, ppGen)
		if err != nil {
			acctErr = err
			return
		}

		// get the new passphrase hash out of the args
		pwh, ok := payload["pwh"].(string)
		if !ok || len(pwh) == 0 {
			acctErr = errors.New("no pwh found in common args")
			return
		}

		// get the new PDPKA5 KID out of the args
		pdpka5kid, ok := payload["pdpka5_kid"].(string)
		if !ok || len(pdpka5kid) == 0 {
			acctErr = errors.New("no pdpka5kid found in common args")
			return
		}

		// Generate a signature with our unlocked sibling key from device.
		proof, err := c.me.UpdatePassphraseProof(sigKey, pwh, ppGen+1, pdpka5kid)
		if err != nil {
			acctErr = err
			return
		}

		sig, _, _, err := libkb.SignJSON(proof, sigKey)
		if err != nil {
			acctErr = err
			return
		}
		payload["sig"] = sig
		payload["signing_kid"] = sigKey.GetKID()

		postArg := libkb.APIArg{
			Endpoint:    "passphrase/sign",
			SessionType: libkb.APISessionTypeREQUIRED,
			JSONPayload: payload,
			SessionR:    a.LocalSession(),
		}

		_, err = c.G().API.PostJSON(postArg)
		if err != nil {
			acctErr = fmt.Errorf("api post to passphrase/sign error: %s", err)
			return
		}

		// Reset passphrase stream cache so that subsequent updates go through
		// without a problem (seee CORE-3933)
		a.ClearStreamCache()
	}, "PassphraseChange.runForcedUpdate")
	if acctErr != nil {
		return acctErr
	}

	return nil
}

// 1. Get keys for decryption and signing
// 2. If necessary, log in with backup keys
// 3. Get lks client half from server
// 4. Post an update passphrase proof
func (c *PassphraseChange) runForcedUpdate(ctx *Context) (err error) {
	c.G().Log.Debug("+ PassphraseChange.runForcedUpdate")
	defer func() {
		c.G().Log.Debug("- PassphraseChange.runForcedUpdate -> %s", libkb.ErrToOk(err))
	}()

	kp, err := c.findUpdateKeys(ctx)
	if err != nil {
		return
	}
	if kp == nil {
		return libkb.NoSecretKeyError{}
	}
	ppGen, oldClientHalf, err := fetchLKS(ctx, c.G(), kp.encKey)
	if err != nil {
		return
	}

	return c.forceUpdatePassphrase(ctx, kp.sigKey, ppGen, oldClientHalf)
}

// runStandardUpdate is for when the user knows the current password.
func (c *PassphraseChange) runStandardUpdate(ctx *Context) (err error) {

	c.G().Log.Debug("+ PassphraseChange.runStandardUpdate")
	defer func() {
		c.G().Log.Debug("- PassphraseChange.runStandardUpdate -> %s", libkb.ErrToOk(err))
	}()

	if len(c.arg.OldPassphrase) == 0 {
		err = c.getVerifiedPassphraseHash(ctx)
	} else {
		err = c.verifySuppliedPassphrase(ctx)
	}
	if err != nil {
		return err
	}

	pgpKeys, err := c.findAndDecryptPrivatePGPKeys(ctx)
	if err != nil {
		return err
	}

	var acctErr error
	c.G().LoginState().Account(func(a *libkb.Account) {
		gen := a.PassphraseStreamCache().PassphraseStream().Generation()
		oldClientHalf := a.PassphraseStreamCache().PassphraseStream().LksClientHalf()

		payload, err := c.commonArgs(a, oldClientHalf, pgpKeys, gen)
		if err != nil {
			acctErr = err
			return
		}

		lp, err := libkb.ComputeLoginPackage(a, "")
		if err != nil {
			acctErr = err
			return
		}

		payload["ppgen"] = gen
		payload["old_pdpka4"] = lp.PDPKA4()
		payload["old_pdpka5"] = lp.PDPKA5()

		postArg := libkb.APIArg{
			Endpoint:    "passphrase/replace",
			SessionType: libkb.APISessionTypeREQUIRED,
			JSONPayload: payload,
			SessionR:    a.LocalSession(),
		}

		_, err = c.G().API.PostJSON(postArg)
		if err != nil {
			acctErr = err
			return
		}

		// Reset passphrase stream cache so that subsequent updates go through
		// without a problem (seee CORE-3933)
		a.ClearStreamCache()
	}, "PassphraseChange.runStandardUpdate")
	if acctErr != nil {
		err = acctErr
		return err
	}

	return nil
}

// commonArgs must be called inside a LoginState().Account(...)
// closure
func (c *PassphraseChange) commonArgs(a *libkb.Account, oldClientHalf libkb.LKSecClientHalf, pgpKeys []libkb.GenericKey, existingGen libkb.PassphraseGeneration) (libkb.JSONPayload, error) {
	// ensure that the login session is loaded
	if err := a.LoadLoginSession(c.me.GetName()); err != nil {
		return nil, err
	}
	salt, err := a.LoginSession().Salt()
	if err != nil {
		return nil, err
	}

	tsec, newPPStream, err := libkb.StretchPassphrase(c.G(), c.arg.Passphrase, salt)
	if err != nil {
		return nil, err
	}
	newPWH := newPPStream.PWHash()
	newClientHalf := newPPStream.LksClientHalf()
	pdpka5kid, err := newPPStream.PDPKA5KID()
	if err != nil {
		return nil, err
	}

	mask := oldClientHalf.ComputeMask(newClientHalf)

	lksch := make(map[keybase1.KID]string)
	devices := c.me.GetComputedKeyFamily().GetAllDevices()
	for _, dev := range devices {
		if !dev.IsActive() {
			continue
		}
		key, err := c.me.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(dev.ID)
		if err != nil {
			return nil, err
		}
		ctext, err := key.EncryptToString(newClientHalf.Bytes(), nil)
		if err != nil {
			return nil, err
		}
		lksch[key.GetKID()] = ctext
	}

	payload := make(libkb.JSONPayload)
	payload["pwh"] = libkb.HexArg(newPWH).String()
	payload["pwh_version"] = triplesec.Version
	payload["lks_mask"] = mask.EncodeToHex()
	payload["lks_client_halves"] = lksch
	payload["pdpka5_kid"] = pdpka5kid.String()

	var encodedKeys []string
	for _, key := range pgpKeys {
		encoded, err := c.encodePrivatePGPKey(key, tsec, existingGen+1)
		if err != nil {
			return nil, err
		}
		encodedKeys = append(encodedKeys, encoded)
	}
	payload["private_keys"] = encodedKeys

	return payload, nil
}

func (c *PassphraseChange) loadMe() (err error) {
	c.me, err = libkb.LoadMe(libkb.NewLoadUserForceArg(c.G()))
	return
}

func (c *PassphraseChange) getVerifiedPassphraseHash(ctx *Context) (err error) {
	c.ppStream, err = c.G().LoginState().GetPassphraseStream(ctx.SecretUI)
	return
}

func (c *PassphraseChange) verifySuppliedPassphrase(ctx *Context) (err error) {
	c.ppStream, err = c.G().LoginState().VerifyPlaintextPassphrase(c.arg.OldPassphrase)
	return
}

// findAndDecryptPrivatePGPKeys gets the user's private pgp keys if any exist and decrypts them.
func (c *PassphraseChange) findAndDecryptPrivatePGPKeys(ctx *Context) ([]libkb.GenericKey, error) {

	var keyList []libkb.GenericKey

	// Using a paper key makes TripleSec-synced keys unrecoverable
	if c.usingPaper {
		c.G().Log.Debug("using a paper key, thus TripleSec-synced keys are unrecoverable")
		return keyList, nil
	}

	// Only use the synced secret keys:
	blocks, err := c.me.AllSyncedSecretKeys(ctx.LoginContext)
	if err != nil {
		return nil, err
	}

	secretRetriever := libkb.NewSecretStore(c.G(), c.me.GetNormalizedName())

	for _, block := range blocks {
		parg := ctx.SecretKeyPromptArg(libkb.SecretKeyArg{}, "passphrase change")
		key, err := block.PromptAndUnlock(parg, secretRetriever, c.me)
		if err != nil {
			return nil, err
		}
		keyList = append(keyList, key)
	}

	return keyList, nil
}

// findAndDecryptPrivatePGPKeysLossy gets the user's private pgp keys if any exist and attempts
// to decrypt them without prompting the user. If any fail to decrypt, they are silently not returned.
// The second return value is the number of keys which were not decrypted.
func (c *PassphraseChange) findAndDecryptPrivatePGPKeysLossy(ctx *Context) ([]libkb.GenericKey, int, error) {

	var keyList []libkb.GenericKey
	nLost := 0

	// Only use the synced secret keys:
	blocks, err := c.me.AllSyncedSecretKeys(ctx.LoginContext)
	if err != nil {
		return nil, 0, err
	}

	secretRetriever := libkb.NewSecretStore(c.G(), c.me.GetNormalizedName())

	for _, block := range blocks {
		key, err := block.UnlockNoPrompt(ctx.LoginContext, secretRetriever)
		if err == nil {
			keyList = append(keyList, key)
		} else {
			if err != libkb.ErrUnlockNotPossible {
				return nil, 0, err
			}
			nLost++
			c.G().Log.Debug("findAndDecryptPrivatePGPKeysLossy: ignoring failure to decrypt key without prompt")
		}
	}

	return keyList, nLost, nil
}

// encodePrivatePGPKey encrypts key with tsec and armor-encodes it.
// It includes the passphrase generation in the data.
func (c *PassphraseChange) encodePrivatePGPKey(key libkb.GenericKey, tsec libkb.Triplesec, gen libkb.PassphraseGeneration) (string, error) {
	skb, err := libkb.ToServerSKB(c.G(), key, tsec, gen)
	if err != nil {
		return "", err
	}

	return skb.ArmoredEncode()
}
