package engine

import (
	"fmt"
	"os/exec"

	"github.com/keybase/go/libkb"
	keybase_1 "github.com/keybase/protocol/go"
)

// LoadDeviceKey: true => then load the device key as a signer
// else:
// Signer: nil => will make the selected pgp key the primary
// Signer: non-nil => will use Signer to sign selected pgp key
type GPGArg struct {
	Query         string
	Signer        libkb.GenericKey
	LoadDeviceKey bool
}

type GPG struct {
	last *libkb.PgpKeyBundle
}

func NewGPG() *GPG {
	return &GPG{}
}

func (g *GPG) Name() string {
	return "GPG"
}

func (g *GPG) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.GPGUIKind,
		libkb.SecretUIKind,
	}
}

func (g *GPG) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		libkb.NewKeyGen(nil),
	}
}

func (g *GPG) WantsGPG(ctx *Context) (bool, error) {
	gpg := G.GetGpgClient()
	if _, err := gpg.Configure(); err != nil {
		if err == exec.ErrNotFound {
			return false, nil
		}
		return false, err
	}

	// they have gpg

	res, err := ctx.UIG().GPG.WantToAddGPGKey(0)
	if err != nil {
		return false, err
	}
	return res, nil
}

func (g *GPG) Run(ctx *Context, args interface{}, reply interface{}) error {
	arg, ok := args.(GPGArg)
	if !ok {
		return fmt.Errorf("GPG.Run: invalid args type: %T", args)
	}
	if arg.LoadDeviceKey {
		return g.runLoadKey(ctx, arg.Query)
	}
	return g.run(ctx, arg.Signer, arg.Query)
}

func (g *GPG) runLoadKey(ctx *Context, query string) error {
	me, err := libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		return err
	}
	sk, err := me.GetDeviceSibkey()
	if err != nil {
		return err
	}
	return g.run(ctx, sk, query)
}

func (g *GPG) run(ctx *Context, signingKey libkb.GenericKey, query string) error {
	gpg := G.GetGpgClient()
	if _, err := gpg.Configure(); err != nil {
		return err
	}
	index, err, warns := gpg.Index(true, query)
	if err != nil {
		return err
	}
	warns.Warn()

	var gks []keybase_1.GPGKey
	for _, key := range index.Keys {
		gk := keybase_1.GPGKey{
			Algorithm:  fmt.Sprintf("%d%s", key.Bits, key.AlgoString()),
			KeyID:      key.GetFingerprint().ToKeyId(),
			Expiration: key.ExpirationString(),
			Identities: key.GetEmails(),
		}
		gks = append(gks, gk)
	}

	res, err := ctx.UIG().GPG.SelectKeyAndPushOption(keybase_1.SelectKeyAndPushOptionArg{Keys: gks})
	if err != nil {
		return err
	}
	G.Log.Info("SelectKey result: %+v", res)

	var selected *libkb.GpgPrimaryKey
	for _, key := range index.Keys {
		if key.GetFingerprint().ToKeyId() == res.KeyID {
			selected = key
			break
		}
	}

	if selected == nil {
		return nil
	}

	bundle, err := gpg.ImportKey(true, *(selected.GetFingerprint()))
	if err != nil {
		return fmt.Errorf("ImportKey error: %s", err)
	}

	if err := bundle.Unlock("Import of key into keybase keyring", ctx.UIG().Secret); err != nil {
		return fmt.Errorf("bundle Unlock error: %s", err)
	}

	G.Log.Info("Bundle unlocked: %s", selected.GetFingerprint().ToKeyId())

	// this seems a little weird to use keygen to post a key, but...
	arg := &libkb.KeyGenArg{
		Pregen:       bundle,
		DoSecretPush: res.DoSecretPush,
		SigningKey:   signingKey,
		KeyGenUI:     ctx.UIG().KeyGen,
		LoginUI:      ctx.UIG().Login,
		LogUI:        ctx.UIG().Log,
		SecretUI:     ctx.UIG().Secret,
	}
	G.Log.Info("key gen arg: %+v", arg)
	kg := libkb.NewKeyGen(arg)
	if _, err := kg.Run(); err != nil {
		return fmt.Errorf("keygen run error: %s", err)
	}

	G.Log.Info("Key %s imported", selected.GetFingerprint().ToKeyId())

	g.last = bundle

	return nil
}

func (g *GPG) LastKey() *libkb.PgpKeyBundle {
	return g.last
}
