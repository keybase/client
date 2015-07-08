package engine

import (
	"encoding/json"
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	triplesec "github.com/keybase/go-triplesec"
)

// ChangePassphrase engine is used for changing the user's passphrase, either
// by replacement or by force.
type ChangePassphrase struct {
	arg      *keybase1.ChangePassphraseArg
	me       *libkb.User
	ppStream *libkb.PassphraseStream
	libkb.Contextified
}

// NewChangePassphrase creates a new engine for changing user passphrases,
// either if the current passphrase is known, or in "force" mode
func NewChangePassphrase(a *keybase1.ChangePassphraseArg, g *libkb.GlobalContext) *ChangePassphrase {
	return &ChangePassphrase{
		arg:          a,
		Contextified: libkb.NewContextified(g),
	}
}

// Name provides the name of the engine for the engine interface
func (c *ChangePassphrase) Name() string {
	return "ChangePassphrase"
}

// Prereqs returns engine prereqs
func (c *ChangePassphrase) Prereqs() Prereqs {
	return Prereqs{Session: true}
}

// RequiredUIs returns the required UIs.
func (c *ChangePassphrase) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.SecretUIKind,
	}
}

// SubConsumers requires the other UI consumers of this engine
func (c *ChangePassphrase) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run the engine
func (c *ChangePassphrase) Run(ctx *Context) (err error) {

	c.G().Log.Debug("+ ChangePassphrase.Run")
	defer func() {
		c.G().Log.Debug("- ChangePassphrase.Run -> %s", libkb.ErrToOk(err))
	}()

	if err = c.loadMe(); err != nil {
		return
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

// Strategy:
//  1. Get unlocked device for decryption and signing
func (c *ChangePassphrase) runForcedUpdate(ctx *Context) (err error) {
	c.G().Log.Debug("+ ChangePassphrase.runForcedUpdate")
	defer func() {
		c.G().Log.Debug("- ChangePassphrase.runForcedUpdate -> %s", libkb.ErrToOk(err))
	}()

	// Get unlocked device for decryption and signing
	ska := libkb.SecretKeyArg{
		Me:      c.me,
		KeyType: libkb.DeviceEncryptionKeyType,
	}
	// passing in nil SecretUI since we don't know the passphrase.
	encKey, _, err := c.G().Keyrings.GetSecretKeyWithPrompt(ctx.LoginContext, ska, nil, "change passphrase")
	if err != nil {
		return err
	}
	ska.KeyType = libkb.DeviceSigningKeyType
	sigKey, _, err := c.G().Keyrings.GetSecretKeyWithPrompt(ctx.LoginContext, ska, nil, "change passphrase")
	if err != nil {
		return err
	}

	// First fetch the encrypted LKS client half from the server. Use current device to
	// recover..
	res, err := c.G().API.Get(
		libkb.APIArg{
			Endpoint:    "passphrase/recover",
			NeedSession: true,
			Args: libkb.HTTPArgs{
				"kid": encKey.GetKID(),
			},
		})
	if err != nil {
		return
	}
	ctext, err := res.Body.AtKey("ctext").GetString()
	if err != nil {
		return
	}
	ppGen, err := res.Body.AtKey("passphrase_generation").GetInt()
	if err != nil {
		return
	}

	//  Now try to decrypt with the unlocked device key
	msg, _, err := encKey.DecryptFromString(ctext)
	if err != nil {
		return
	}

	oldClientHalf := msg

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
	}, "ChangePassphrase.runForcedUpdate")
	if acctErr != nil {
		err = acctErr
		return
	}

	return
}

// runStandardUpdate is for when the user knows the current
// password.
func (c *ChangePassphrase) runStandardUpdate(ctx *Context) (err error) {

	c.G().Log.Debug("+ ChangePassphrase.runStandardUpdate")
	defer func() {
		c.G().Log.Debug("- ChangePassphrase.runStandardUpdate -> %s", libkb.ErrToOk(err))
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
	}, "ChangePassphrase.runStandardUpdate")
	if acctErr != nil {
		err = acctErr
		return err
	}

	return nil
}

// commonArgs must be called inside a LoginState().Account(...)
// closure
func (c *ChangePassphrase) commonArgs(a *libkb.Account, oldClientHalf []byte) (*libkb.HTTPArgs, error) {
	salt, err := a.LoginSession().Salt()
	if err != nil {
		return nil, err
	}

	_, newPPStream, err := libkb.StretchPassphrase(c.arg.NewPassphrase, salt)
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

func (c *ChangePassphrase) loadMe() (err error) {
	c.me, err = libkb.LoadMe(libkb.LoadUserArg{AllKeys: false, ForceReload: true})
	return
}

func (c *ChangePassphrase) getVerifiedPassphraseHash(ctx *Context) (err error) {
	c.ppStream, err = c.G().LoginState().GetPassphraseStream(ctx.SecretUI)
	return
}

func (c *ChangePassphrase) verifySuppliedPassphrase(ctx *Context) (err error) {
	c.ppStream, err = c.G().LoginState().VerifyPlaintextPassphrase(c.arg.OldPassphrase)
	return
}
