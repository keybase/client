package engine

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	// keybase_1 "github.com/keybase/client/protocol/go"
)

type PGPUpdateEngine struct {
	selectedFingerprints map[string]bool
	all                  bool
	libkb.Contextified
}

func NewPGPUpdateEngine(fingerprints []string, all bool) *PGPUpdateEngine {
	selectedFingerprints := make(map[string]bool)
	for _, fpString := range fingerprints {
		selectedFingerprints[strings.ToLower(fpString)] = true
	}
	eng := PGPUpdateEngine{
		selectedFingerprints: selectedFingerprints,
		all:                  all,
	}
	return &eng
}

func (e *PGPUpdateEngine) Name() string {
	return "PGPUpdate"
}

func (e *PGPUpdateEngine) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{
		Session: true,
	}
}

func (e *PGPUpdateEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
	}
}

func (e *PGPUpdateEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (e *PGPUpdateEngine) Run(ctx *Context) error {
	if e.all && len(e.selectedFingerprints) > 0 {
		return fmt.Errorf("Cannot use explicit fingerprints with --all.")
	}

	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return err
	}
	fingerprints := me.GetActivePgpFingerprints(false /* not just sibkeys */)
	if len(fingerprints) > 1 && !e.all && len(e.selectedFingerprints) == 0 {
		return fmt.Errorf("You have more than one PGP key. To update all of them, use --all.")
	}

	gpgCLI := libkb.NewGpgCLI(libkb.GpgCLIArg{
		LogUI: ctx.LogUI,
	})
	_, err = gpgCLI.Configure()
	if err != nil {
		return err
	}

	for _, fingerprint := range fingerprints {
		if len(e.selectedFingerprints) > 0 && !e.selectedFingerprints[fingerprint.String()] {
			ctx.LogUI.Warning("Skipping update for key %s", fingerprint.String())
			continue
		}
		bundle, err := gpgCLI.ImportKey(false /* secret */, fingerprint)
		if err != nil {
			_, isNoKey := err.(libkb.NoKeyError)
			if isNoKey {
				ctx.LogUI.Warning(
					"No key matching fingerprint %s found in the GPG keyring.",
					fingerprint.String())
				continue
			} else {
				return err
			}
		}

		keyBlob, err := bundle.Encode()
		if err != nil {
			return err
		}
		ctx.LogUI.Info("Posting update for key %s.", fingerprint.String())
		_, err = G.API.Post(libkb.ApiArg{
			Endpoint:    "key/add",
			NeedSession: true,
			Args: libkb.HttpArgs{
				"public_key": libkb.S{Val: keyBlob},
				"is_update":  libkb.I{Val: 1},
			},
		})
		if err != nil {
			return err
		}
		ctx.LogUI.Info("Update succeeded for key %s.", fingerprint)
	}
	return nil
}
