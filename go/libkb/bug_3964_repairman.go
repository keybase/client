// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"errors"
	"time"
)

type bug3964Repairman struct {
	Contextified
}

func newBug3964Repairman(g *GlobalContext) *bug3964Repairman {
	return &bug3964Repairman{Contextified: NewContextified(g)}
}

func (b *bug3964Repairman) attemptRepair(m MetaContext, lksec *LKSec, dkm DeviceKeyMap) (ran bool, serverHalfSet *LKSecServerHalfSet, err error) {
	defer m.Trace("bug3964Repairman#attemptRepair", func() error { return err })()
	var oldKeyring, newKeyring *SKBKeyringFile
	lctx := m.LoginContext()
	oldKeyring, err = lctx.Keyring(m)
	if err != nil {
		return false, nil, err
	}
	newKeyring, serverHalfSet, err = oldKeyring.Bug3964Repair(m, lksec, dkm)
	if err != nil {
		return false, nil, err
	}
	if newKeyring == nil {
		return false, nil, nil
	}
	if err = newKeyring.Save(); err != nil {
		m.Debug("Error saving new keyring: %s", err)
		return false, nil, err
	}
	lctx.ClearKeyring()
	return true, serverHalfSet, err
}

func (b *bug3964Repairman) loadLKSecServerDetails(m MetaContext, lksec *LKSec) (ret DeviceKeyMap, err error) {
	defer m.Trace("bug3964Repairman#loadLKSecServerDetails", func() error { return err })()
	ret, err = lksec.LoadServerDetails(m)
	if err != nil {
		return nil, err
	}
	lksec.SetFullSecret(m)
	return ret, err
}

func (b *bug3964Repairman) updateSecretStore(m MetaContext, nun NormalizedUsername, lksec *LKSec) error {
	fs := lksec.FullSecret()
	ss := b.G().SecretStore()
	if fs.IsNil() {
		m.Warning("Got unexpected nil full secret")
		return ss.ClearSecret(m, nun)
	}
	return ss.StoreSecret(m, nun, fs)
}

func (b *bug3964Repairman) saveRepairmanVisit(nun NormalizedUsername) (err error) {
	defer b.G().Trace("bug3964Repairman#saveRepairmanVisit", func() error { return err })()
	return b.G().Env.GetConfigWriter().SetBug3964RepairTime(nun, time.Now())
}

func (b *bug3964Repairman) postToServer(m MetaContext, serverHalfSet *LKSecServerHalfSet, ppgen PassphraseGeneration, nun NormalizedUsername) (err error) {
	defer m.G().CTrace(m.Ctx(), "bug3964Repairman#postToServer", func() error { return err })()
	if serverHalfSet == nil {
		return errors.New("internal error --- had nil server half set")
	}
	_, err = m.G().API.Post(m, APIArg{
		Endpoint:    "user/bug_3964_repair",
		SessionType: APISessionTypeREQUIRED,
		Args: HTTPArgs{
			"device_id":         S{Val: m.G().Env.GetDeviceIDForUsername(nun).String()},
			"ppgen":             I{Val: int(ppgen)},
			"lks_server_halves": S{Val: serverHalfSet.EncodeToHexList()},
		},
	})
	return err
}

func (b *bug3964Repairman) computeShortCircuit(nun NormalizedUsername) (ss bool, err error) {
	defer b.G().Trace("bug3964Repairman#computeShortCircuit", func() error { return err })()
	repairTime, tmpErr := b.G().Env.GetConfig().GetBug3964RepairTime(nun)

	// Ignore any decoding errors
	if tmpErr != nil {
		b.G().Log.Warning("Problem reading previous bug 3964 repair time: %s", tmpErr)
	}

	if repairTime.IsZero() {
		b.G().Log.Debug("| repair time is zero or wasn't set")
		return false, nil
	}
	var fileTime time.Time
	fileTime, err = StatSKBKeyringMTime(nun, b.G())
	if err != nil {
		return false, err
	}
	ss = !repairTime.Before(fileTime)
	b.G().Log.Debug("| Checking repair-time (%s) v file-write-time (%s): shortCircuit=%v", repairTime, fileTime, ss)
	return ss, nil
}

func (b *bug3964Repairman) fixLKSClientHalf(m MetaContext, lksec *LKSec, ppgen PassphraseGeneration) (err error) {
	defer m.Trace("bug3964Repairman#fixLKSClientHalf", func() error { return err })()
	var me *User
	var encKey GenericKey
	var ctext string

	me, err = LoadMe(NewLoadUserArgWithMetaContext(m))
	if err != nil {
		return err
	}
	encKey, err = me.GetDeviceSubkey()
	if err != nil {
		return err
	}
	// make client half recovery
	kid := encKey.GetKID()
	ctext, err = lksec.EncryptClientHalfRecovery(encKey)
	if err != nil {
		return err
	}

	_, err = b.G().API.Post(m, APIArg{
		Endpoint:    "device/update_lks_client_half",
		SessionType: APISessionTypeREQUIRED,
		Args: HTTPArgs{
			"ppgen":           I{Val: int(ppgen)},
			"kid":             S{Val: kid.String()},
			"lks_client_half": S{Val: ctext},
		},
	})

	return err
}

// Run the engine
func (b *bug3964Repairman) Run(m MetaContext) (err error) {
	defer m.G().CTrace(m.Ctx(), "bug3964Repairman#Run", func() error { return err })()
	lctx := m.LoginContext()
	pps := lctx.PassphraseStreamCache().PassphraseStream()

	var lksec *LKSec
	var ran bool
	var dkm DeviceKeyMap
	var ss bool
	var serverHalfSet *LKSecServerHalfSet
	nun := m.G().Env.GetUsername()

	if m.G().TestOptions.NoBug3964Repair {
		m.G().Log.CDebugf(m.Ctx(), "| short circuit due to test options")
		return nil
	}

	if pps == nil {
		m.G().Log.CDebugf(m.Ctx(), "| Can't run repairman without a passphrase stream")
		return nil
	}

	if ss, err = b.computeShortCircuit(nun); err != nil {
		return err
	}

	if ss {
		// This logline is asserted in testing in bug_3964_repairman_test
		m.G().Log.CDebugf(m.Ctx(), "| Repairman already visited after file update; bailing out")
		return nil
	}

	// This logline is asserted in testing in bug_3964_repairman_test
	m.G().Log.CDebugf(m.Ctx(), "| Repairman wasn't short-circuited")

	lksec, err = pps.ToLKSec(lctx.GetUID())
	if err != nil {
		return err
	}

	if dkm, err = b.loadLKSecServerDetails(m, lksec); err != nil {
		return err
	}

	if ran, serverHalfSet, err = b.attemptRepair(m, lksec, dkm); err != nil {
		return err
	}

	if err != nil {
		return err
	}

	m.G().Log.CDebugf(m.Ctx(), "| SKB keyring repair completed; edits=%v", ran)

	if !ran {
		b.saveRepairmanVisit(nun)
		return nil
	}

	if err := b.fixLKSClientHalf(m, lksec, pps.Generation()); err != nil {
		return err
	}

	if ussErr := b.updateSecretStore(m, nun, lksec); ussErr != nil {
		m.G().Log.CWarningf(m.Ctx(), "Error in secret store manipulation: %s", ussErr)
	} else {
		b.saveRepairmanVisit(nun)
	}

	err = b.postToServer(m, serverHalfSet, pps.Generation(), nun)

	return err
}

func RunBug3964Repairman(m MetaContext) error {
	err := newBug3964Repairman(m.G()).Run(m)
	if err != nil {
		m.G().Log.CDebugf(m.Ctx(), "Error running Bug 3964 repairman: %s", err)
	}
	return err
}
