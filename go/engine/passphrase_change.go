package engine

import (
	"encoding/json"
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	triplesec "github.com/keybase/go-triplesec"
)

// PassphraseChange engine is used for changing the user's passphrase, either
// by replacement or by force.
type PassphraseChange struct {
	arg      *keybase1.PassphraseChangeArg
	me       *libkb.User
	ppStream *libkb.PassphraseStream
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

	if err = c.loadMe(); err != nil {
		return
	}

	if err == nil {
		c.G().LoginState().RunSecretSyncer(c.me.GetUID())
	}

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
	lin, err := IsLoggedIn(c, ctx)
	if err != nil {
		return nil, err
	}
	if !lin {
		return nil, libkb.LoginRequiredError{}
	}

	// Get unlocked device for decryption and signing
	ska := libkb.SecretKeyArg{
		Me:      c.me,
		KeyType: libkb.DeviceEncryptionKeyType,
	}
	// passing in nil SecretUI since we don't know the passphrase.
	c.G().Log.Debug("runForcedUpdate: getting device encryption key")
	encKey, _, err := c.G().Keyrings.GetSecretKeyWithPrompt(ctx.LoginContext, ska, nil, "change passphrase")
	if err != nil {
		return nil, err
	}
	c.G().Log.Debug("runForcedUpdate: got device encryption key")
	c.G().Log.Debug("runForcedUpdate: getting device signing key")
	ska.KeyType = libkb.DeviceSigningKeyType
	sigKey, _, err := c.G().Keyrings.GetSecretKeyWithPrompt(ctx.LoginContext, ska, nil, "change passphrase")
	if err != nil {
		return nil, err
	}
	c.G().Log.Debug("runForcedUpdate: got device signing key")

	return &keypair{encKey: encKey, sigKey: sigKey}, nil
}

// findBackupKeys checks if the user has backup keys.  If he/she
// does, it prompts for a backup phrase.  This is used to
// regenerate backup keys, which are then matched against the
// backup keys found in the keyfamily.
func (c *PassphraseChange) findPaperKeys(ctx *Context) (*keypair, error) {
	return findPaperKeys(ctx, c.G(), c.me)
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

// fetchLKS gets the encrypted LKS client half from the server.
// It uses encKey to decrypt it.  It also returns the passphrase
// generation.
func (c *PassphraseChange) fetchLKS(ctx *Context, encKey libkb.GenericKey) (int, []byte, error) {
	res, err := c.G().API.Get(
		libkb.APIArg{
			Endpoint:    "passphrase/recover",
			NeedSession: true,
			Args: libkb.HTTPArgs{
				"kid": encKey.GetKID(),
			},
		})
	if err != nil {
		return 0, nil, err
	}
	ctext, err := res.Body.AtKey("ctext").GetString()
	if err != nil {
		return 0, nil, err
	}
	ppGen, err := res.Body.AtKey("passphrase_generation").GetInt()
	if err != nil {
		return 0, nil, err
	}

	//  Now try to decrypt with the unlocked device key
	msg, _, err := encKey.DecryptFromString(ctext)
	if err != nil {
		return 0, nil, err
	}

	return ppGen, msg, nil
}

func (c *PassphraseChange) updatePassphrase(ctx *Context, sigKey libkb.GenericKey, ppGen int, oldClientHalf []byte) error {
	var acctErr error
	c.G().LoginState().Account(func(a *libkb.Account) {
		// Ready the update argument; almost done, but we need some more stuff.
		args, err := c.commonArgs(a, oldClientHalf)
		if err != nil {
			acctErr = err
			return
		}

		// get the new passphrase hash out of the args
		pwh, ok := (*args)["pwh"]
		if !ok {
			acctErr = fmt.Errorf("no pwh found in common args")
			return
		}

		// Generate a signature with our unlocked sibling key from device.
		proof, err := c.me.UpdatePassphraseProof(sigKey, pwh.String(), ppGen)
		if err != nil {
			acctErr = err
			return
		}

		sig, _, _, err := libkb.SignJSON(proof, sigKey)
		if err != nil {
			acctErr = err
			return
		}
		args.Add("sig", libkb.S{Val: sig})
		args.Add("signing_kid", sigKey.GetKID())

		postArg := libkb.APIArg{
			Endpoint:    "passphrase/sign",
			NeedSession: true,
			Args:        *args,
			SessionR:    a.LocalSession(),
		}

		_, err = c.G().API.Post(postArg)
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
	ppGen, oldClientHalf, err := c.fetchLKS(ctx, kp.encKey)
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

	var acctErr error
	c.G().LoginState().Account(func(a *libkb.Account) {
		gen := a.PassphraseStreamCache().PassphraseStream().Generation()
		oldPWH := a.PassphraseStreamCache().PassphraseStream().PWHash()
		oldClientHalf := a.PassphraseStreamCache().PassphraseStream().LksClientHalf()

		args, err := c.commonArgs(a, oldClientHalf)
		if err != nil {
			acctErr = err
			return
		}
		args.Add("oldpwh", libkb.HexArg(oldPWH))
		args.Add("ppgen", libkb.I{Val: int(gen)})
		postArg := libkb.APIArg{
			Endpoint:    "passphrase/replace",
			NeedSession: true,
			Args:        *args,
			SessionR:    a.LocalSession(),
		}

		_, err = c.G().API.Post(postArg)
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
func (c *PassphraseChange) commonArgs(a *libkb.Account, oldClientHalf []byte) (*libkb.HTTPArgs, error) {
	salt, err := a.LoginSession().Salt()
	if err != nil {
		return nil, err
	}

	_, newPPStream, err := libkb.StretchPassphrase(c.arg.Passphrase, salt)
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
	lkschJSON, err := json.Marshal(lksch)
	if err != nil {
		return nil, err
	}

	return &libkb.HTTPArgs{
		"pwh":               libkb.HexArg(newPWH),
		"pwh_version":       libkb.I{Val: int(triplesec.Version)},
		"lks_mask":          libkb.HexArg(mask),
		"lks_client_halves": libkb.S{Val: string(lkschJSON)},
	}, nil

}

func (c *PassphraseChange) loadMe() (err error) {
	c.me, err = libkb.LoadMe(libkb.LoadUserArg{AllKeys: false, ForceReload: true})
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
