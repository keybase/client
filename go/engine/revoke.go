package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	// keybase_1 "github.com/keybase/client/protocol/go"
)

type RevokeEngine struct {
	libkb.Contextified
	id       string
	isDevice bool
}

func NewRevokeEngine(id string, isDevice bool) *RevokeEngine {
	eng := RevokeEngine{id: id, isDevice: isDevice}
	return &eng
}

func (e *RevokeEngine) Name() string {
	return "Revoke"
}

func (e *RevokeEngine) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{
		Session: true,
	}
}

func (e *RevokeEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
		libkb.SecretUIKind,
	}
}

func (e *RevokeEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (e *RevokeEngine) getKIDsToRevoke(me *libkb.User) ([]string, error) {
	if e.isDevice {
		currentDevice := e.G().Env.GetDeviceID().String()
		if e.id == currentDevice {
			return nil, fmt.Errorf("Can't revoke the current device.")
		}
		deviceKeys, err := me.GetComputedKeyFamily().GetAllActiveKeysForDevice(e.id)
		if err != nil {
			return nil, err
		}
		return deviceKeys, nil
	} else {
		kid, err := libkb.ImportKID(e.id)
		if err != nil {
			return nil, err
		}
		key := me.GetKeyFamily().FindKey(kid)
		if key == nil {
			return nil, fmt.Errorf("Key %s does not exist.", e.id)
		}
		if !libkb.IsPGP(key) {
			return nil, fmt.Errorf("Key %s is not a PGP key. To revoke device keys, use --device.", e.id)
		}
		for _, activePGPKey := range me.GetComputedKeyFamily().GetActivePgpKeys(false /* sibkeys only */) {
			if activePGPKey.GetKid().String() == e.id {
				return []string{e.id}, nil
			}
		}
		return nil, fmt.Errorf("PGP key %s is not active.", e.id)
	}
}

func (e *RevokeEngine) Run(ctx *Context) error {
	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return err
	}

	kidsToRevoke, err := e.getKIDsToRevoke(me)
	if err != nil {
		return err
	}
	ctx.LogUI.Info("Revoking KIDs:")
	for _, kid := range kidsToRevoke {
		ctx.LogUI.Info("  %s", kid)
	}

	sigKey, _, err := e.G().Keyrings.GetSecretKeyWithPrompt(libkb.SecretKeyArg{
		DeviceKey: true,
		Me:        me,
	}, ctx.SecretUI, "to revoke another key")
	if sigKey == nil {
		return fmt.Errorf("Revocation signing key is nil.")
	}
	if err = sigKey.CheckSecretKey(); err != nil {
		return err
	}

	deviceID := ""
	if e.isDevice {
		deviceID = e.id
	}
	proof, err := me.RevokeKeysProof(sigKey, kidsToRevoke, deviceID)
	if err != nil {
		return err
	}
	sig, _, _, err := libkb.SignJson(proof, sigKey)
	if err != nil {
		return err
	}
	kid := sigKey.GetKid()
	_, err = e.G().API.Post(libkb.ApiArg{
		Endpoint:    "sig/revoke",
		NeedSession: true,
		Args: libkb.HttpArgs{
			"signing_kid": libkb.S{Val: kid.String()},
			"sig":         libkb.S{Val: sig},
		},
	})
	if err != nil {
		return err
	}
	return nil
}
