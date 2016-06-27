// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
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
	}()

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
	// need to be logged in to get a device key (unlocked)
	lin, _, err := IsLoggedIn(c, ctx)
	if err != nil {
		return nil, err
	}
	if !lin {
		return nil, libkb.LoginRequiredError{}
	}

	// Get unlocked device for decryption and signing
	// passing in nil SecretUI since we don't know the passphrase.
	c.G().Log.Debug("runForcedUpdate: getting device encryption key")
	parg := libkb.SecretKeyPromptArg{
		LoginContext: ctx.LoginContext,
		Ska: libkb.SecretKeyArg{
			Me:      c.me,
			KeyType: libkb.DeviceEncryptionKeyType,
		},
		Reason: "change passphrase",
	}
	encKey, err := c.G().Keyrings.GetSecretKeyWithPrompt(parg)
	if err != nil {
		return nil, err
	}
	c.G().Log.Debug("runForcedUpdate: got device encryption key")
	c.G().Log.Debug("runForcedUpdate: getting device signing key")
	parg.Ska.KeyType = libkb.DeviceSigningKeyType
	sigKey, err := c.G().Keyrings.GetSecretKeyWithPrompt(parg)
	if err != nil {
		return nil, err
	}
	c.G().Log.Debug("runForcedUpdate: got device signing key")

	return &keypair{encKey: encKey, sigKey: sigKey}, nil
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

func (c *PassphraseChange) updatePassphrase(ctx *Context, sigKey libkb.GenericKey, ppGen libkb.PassphraseGeneration, oldClientHalf []byte) error {

	pgpKeys, err := c.findAndDecryptPrivatePGPKeys(ctx)
	if err != nil {
		return err
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
			acctErr = fmt.Errorf("no pwh found in common args")
			return
		}

		// Generate a signature with our unlocked sibling key from device.
		proof, err := c.me.UpdatePassphraseProof(sigKey, pwh, ppGen+1)
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
			NeedSession: true,
			JSONPayload: payload,
			SessionR:    a.LocalSession(),
		}

		_, err = c.G().API.PostJSON(postArg)
		if err != nil {
			acctErr = fmt.Errorf("api post to passphrase/sign error: %s", err)
			return
		}
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

	return c.updatePassphrase(ctx, kp.sigKey, ppGen, oldClientHalf)
}

// runStandardUpdate is for when the user knows the current
// password.
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
		oldPWH := a.PassphraseStreamCache().PassphraseStream().PWHash()
		oldClientHalf := a.PassphraseStreamCache().PassphraseStream().LksClientHalf()

		payload, err := c.commonArgs(a, oldClientHalf, pgpKeys, gen)
		if err != nil {
			acctErr = err
			return
		}
		payload["oldpwh"] = libkb.HexArg(oldPWH).String()
		payload["ppgen"] = gen
		postArg := libkb.APIArg{
			Endpoint:    "passphrase/replace",
			NeedSession: true,
			JSONPayload: payload,
			SessionR:    a.LocalSession(),
		}

		_, err = c.G().API.PostJSON(postArg)
		if err != nil {
			acctErr = err
			return
		}
	}, "PassphraseChange.runStandardUpdate")
	if acctErr != nil {
		err = acctErr
		return err
	}

	return nil
}

// commonArgs must be called inside a LoginState().Account(...)
// closure
func (c *PassphraseChange) commonArgs(a *libkb.Account, oldClientHalf []byte, pgpKeys []libkb.GenericKey, existingGen libkb.PassphraseGeneration) (libkb.JSONPayload, error) {
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

	mask := make([]byte, len(oldClientHalf))
	libkb.XORBytes(mask, oldClientHalf, newClientHalf)

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
		ctext, err := key.EncryptToString(newClientHalf, nil)
		if err != nil {
			return nil, err
		}
		lksch[key.GetKID()] = ctext
	}

	payload := make(libkb.JSONPayload)
	payload["pwh"] = libkb.HexArg(newPWH).String()
	payload["pwh_version"] = triplesec.Version
	payload["lks_mask"] = libkb.HexArg(mask).String()
	payload["lks_client_halves"] = lksch

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

// findAndDecryptPrivatePGPKeys gets the user's private pgp keys if
// any exist and decrypts them.
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

// encodePrivatePGPKey encrypts key with tsec and armor-encodes it.
// It includes the passphrase generation in the data.
func (c *PassphraseChange) encodePrivatePGPKey(key libkb.GenericKey, tsec libkb.Triplesec, gen libkb.PassphraseGeneration) (string, error) {
	skb, err := key.ToServerSKB(c.G(), tsec, gen)
	if err != nil {
		return "", err
	}

	return skb.ArmoredEncode()
}
