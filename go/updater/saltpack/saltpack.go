// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"fmt"
	"io"
	"os"

	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/updater/util"
	sp "github.com/keybase/saltpack"
	"github.com/keybase/saltpack/basic"
)

// Log is log interface for this package
type Log interface {
	Debugf(s string, args ...interface{})
	Infof(s string, args ...interface{})
}

// VerifyDetachedFileAtPath verifies a file
func VerifyDetachedFileAtPath(path string, signature string, validKIDs map[string]bool, log Log) error {
	file, err := os.Open(path)
	defer util.Close(file)
	if err != nil {
		return err
	}
	err = VerifyDetached(file, signature, validKIDs, log)
	if err != nil {
		return fmt.Errorf("error verifying signature: %s", err)
	}
	return nil
}

func SigningPublicKeyToKeybaseKID(k sp.SigningPublicKey) (ret keybase1.KID) {
	if k == nil {
		return ret
	}
	p := k.ToKID()
	return keybase1.KIDFromRawKey(p, byte(kbcrypto.KIDNaclEddsa))
}

func checkSender(key sp.SigningPublicKey, validKIDs map[string]bool, log Log) error {
	if key == nil {
		return fmt.Errorf("no key")
	}
	kid := SigningPublicKeyToKeybaseKID(key)
	if kid.IsNil() {
		return fmt.Errorf("no KID for key")
	}
	log.Infof("Signed by %s", kid)
	if !validKIDs[kid.String()] {
		return fmt.Errorf("unknown signer KID: %s", kid)
	}
	log.Debugf("Valid KID: %s", kid)
	return nil
}

// VerifyDetached verifies a message signature
func VerifyDetached(reader io.Reader, signature string, validKIDs map[string]bool, log Log) error {
	if reader == nil {
		return fmt.Errorf("no reader")
	}
	check := func(key sp.SigningPublicKey) error {
		return checkSender(key, validKIDs, log)
	}
	return VerifyDetachedCheckSender(reader, []byte(signature), check)
}

// VerifyDetachedCheckSender verifies a message signature
func VerifyDetachedCheckSender(message io.Reader, signature []byte, checkSender func(sp.SigningPublicKey) error) error {
	kr := basic.NewKeyring()
	var skey sp.SigningPublicKey
	var err error
	skey, _, err = sp.Dearmor62VerifyDetachedReader(sp.CheckKnownMajorVersion, message, string(signature), kr)
	if err != nil {
		return err
	}

	if err = checkSender(skey); err != nil {
		return err
	}

	return nil
}
