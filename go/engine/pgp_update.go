// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
)

type PGPUpdateEngine struct {
	selectedFingerprints   map[string]bool
	all                    bool
	duplicatedFingerprints []libkb.PGPFingerprint
	libkb.Contextified
}

func NewPGPUpdateEngine(g *libkb.GlobalContext, fingerprints []string, all bool) *PGPUpdateEngine {
	selectedFingerprints := make(map[string]bool)
	for _, fpString := range fingerprints {
		selectedFingerprints[strings.ToLower(fpString)] = true
	}
	return &PGPUpdateEngine{
		selectedFingerprints: selectedFingerprints,
		all:                  all,
		Contextified:         libkb.NewContextified(g),
	}
}

func (e *PGPUpdateEngine) Name() string {
	return "PGPUpdate"
}

func (e *PGPUpdateEngine) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

func (e *PGPUpdateEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
		libkb.SecretUIKind,
	}
}

func (e *PGPUpdateEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (e *PGPUpdateEngine) Run(m libkb.MetaContext) error {
	if e.all && len(e.selectedFingerprints) > 0 {
		return fmt.Errorf("Cannot use explicit fingerprints with --all.")
	}

	me, err := libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(m))
	if err != nil {
		return err
	}
	fingerprints := me.GetActivePGPFingerprints(false /* not just sibkeys */)
	if len(fingerprints) > 1 && !e.all && len(e.selectedFingerprints) == 0 {
		return fmt.Errorf("You have more than one PGP key. To update all of them, use --all.")
	}

	gpgCLI := libkb.NewGpgCLI(m.G(), m.UIs().LogUI)
	err = gpgCLI.Configure()
	if err != nil {
		return err
	}

	del := libkb.Delegator{
		DelegationType: libkb.DelegationTypePGPUpdate,
		Me:             me,
		Expire:         libkb.KeyExpireIn,
		Contextified:   libkb.NewContextified(e.G()),
	}

	err = del.LoadSigningKey(m, m.UIs().SecretUI)
	if err != nil {
		return err
	}

	for _, fingerprint := range fingerprints {
		if len(e.selectedFingerprints) > 0 && !e.selectedFingerprints[fingerprint.String()] {
			m.UIs().LogUI.Warning("Skipping update for key %s", fingerprint.String())
			continue
		}
		bundle, err := gpgCLI.ImportKey(false /* secret */, fingerprint, "")
		if err != nil {
			_, isNoKey := err.(libkb.NoKeyError)
			if isNoKey {
				m.UIs().LogUI.Warning(
					"No key matching fingerprint %s found in the GPG keyring.",
					fingerprint.String())
				continue
			} else {
				return err
			}
		}

		bundle.InitGPGKey()
		del.NewKey = bundle

		m.UIs().LogUI.Info("Posting update for key %s.", fingerprint.String())
		if err := del.Run(m); err != nil {
			if appStatusErr, ok := err.(libkb.AppStatusError); ok && appStatusErr.Code == libkb.SCKeyDuplicateUpdate {
				m.UIs().LogUI.Info("Key was already up to date.")
				e.duplicatedFingerprints = append(e.duplicatedFingerprints, fingerprint)
				continue
			}
			return err
		}
		m.UIs().LogUI.Info("Update succeeded for key %s.", fingerprint)
	}
	return nil
}
