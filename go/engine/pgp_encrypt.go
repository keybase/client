// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"fmt"
	"io"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/go-crypto/openpgp/armor"
)

type PGPEncryptArg struct {
	Recips       []string // user assertions
	Source       io.Reader
	Sink         io.WriteCloser
	SkipTrack    bool
	NoSign       bool
	NoSelf       bool
	BinaryOutput bool
	KeyQuery     string
	TrackOptions keybase1.TrackOptions
}

// PGPEncrypt encrypts data read from a source into a sink
// for a set of users.  It will track them if necessary.
type PGPEncrypt struct {
	arg *PGPEncryptArg
	me  *libkb.User
	libkb.Contextified
}

// NewPGPEncrypt creates a PGPEncrypt engine.
func NewPGPEncrypt(arg *PGPEncryptArg, g *libkb.GlobalContext) *PGPEncrypt {
	return &PGPEncrypt{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *PGPEncrypt) Name() string {
	return "PGPEncrypt"
}

// GetPrereqs returns the engine prereqs.
func (e *PGPEncrypt) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *PGPEncrypt) RequiredUIs() []libkb.UIKind {
	return nil
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPEncrypt) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&PGPKeyfinder{},
	}
}

// Run starts the engine.
func (e *PGPEncrypt) Run(ctx *Context) error {
	// verify valid options based on logged in state:
	ok, err := IsLoggedIn(e, ctx)
	if err != nil {
		return err
	}

	if !ok {
		// not logged in.  this is fine, unless they requested signing the message.
		if !e.arg.NoSign {
			return libkb.LoginRequiredError{Context: "you must be logged in to sign"}
		}

		// or trying to encrypt for self
		if !e.arg.NoSelf {
			return libkb.LoginRequiredError{Context: "you must be logged in to encrypt for yourself"}
		}
	} else {
		me, err := libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
		if err != nil {
			return err
		}
		e.me = me
	}

	var mykey *libkb.PGPKeyBundle
	var signer *libkb.PGPKeyBundle
	if !e.arg.NoSign {
		ska := libkb.SecretKeyArg{
			Me:       e.me,
			KeyType:  libkb.PGPKeyType,
			KeyQuery: e.arg.KeyQuery,
		}
		key, err := e.G().Keyrings.GetSecretKeyWithPrompt(ctx.LoginContext, ska, ctx.SecretUI, "command-line signature")
		if err != nil {
			return err
		}

		var ok bool
		mykey, ok = key.(*libkb.PGPKeyBundle)
		if !ok {
			return errors.New("Can only sign with PGP keys")
		}
		signer = mykey
	}

	usernames, err := e.verifyUsers(ctx, e.arg.Recips, ok)
	if err != nil {
		return err
	}

	kfarg := &PGPKeyfinderArg{
		Usernames: usernames,
	}

	kf := NewPGPKeyfinder(kfarg, e.G())
	if err := RunEngine(kf, ctx); err != nil {
		return err
	}
	uplus := kf.UsersPlusKeys()

	var writer io.WriteCloser
	if e.arg.BinaryOutput {
		writer = e.arg.Sink
	} else {
		aw, err := armor.Encode(e.arg.Sink, "PGP MESSAGE", libkb.PGPArmorHeaders)
		if err != nil {
			return err
		}
		writer = aw
	}

	ks := newKeyset()
	if !e.arg.NoSelf {
		if mykey == nil {
			// need to load the public key for the logged in user
			mykey, err = e.loadSelfKey()
			if err != nil {
				return err
			}
		}

		// mykey could still be nil
		if mykey != nil {
			ks.Add(mykey)
		}
	}

	for _, up := range uplus {
		for _, k := range up.Keys {
			ks.Add(k)
		}
	}

	recipients := ks.Sorted()
	if err := libkb.PGPEncrypt(e.arg.Source, writer, signer, recipients); err != nil {
		return err
	}
	if !e.arg.BinaryOutput {
		return e.arg.Sink.Close()
	}
	return nil
}

func (e *PGPEncrypt) loadSelfKey() (*libkb.PGPKeyBundle, error) {
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	if err != nil {
		return nil, err
	}

	keys := me.FilterActivePGPKeys(true, e.arg.KeyQuery)
	if len(keys) == 0 {
		return nil, libkb.NoKeyError{Msg: "No PGP key found for encrypting for self"}
	}
	return keys[0], nil
}

func (e *PGPEncrypt) verifyUsers(ctx *Context, assertions []string, loggedIn bool) ([]string, error) {
	var names []string
	for _, userAssert := range assertions {
		var err error
		var username string
		if loggedIn && !e.arg.SkipTrack {
			username, err = e.trackUser(ctx, userAssert)
		} else {
			username, err = e.identifyUser(ctx, userAssert)
		}
		if err != nil {
			return nil, err
		}
		names = append(names, username)
	}
	return names, nil
}

func (e *PGPEncrypt) trackUser(ctx *Context, assertion string) (string, error) {
	e.G().Log.Debug("pgp encrypt: tracking user %q", assertion)
	arg := &TrackEngineArg{
		Me:                e.me,
		UserAssertion:     assertion,
		Options:           e.arg.TrackOptions,
		AllowSelfIdentify: true,
	}
	eng := NewTrackEngine(arg, e.G())
	if err := RunEngine(eng, ctx); err != nil {
		// ignore SelfTrackError
		if _, ok := err.(libkb.SelfTrackError); !ok {
			return "", err
		}
	}
	if eng.User() == nil {
		if e.me != nil {
			panic(fmt.Sprintf("nil user after tracking %q (me = %q)", assertion, e.me.GetName()))
		} else {
			panic(fmt.Sprintf("nil user after tracking %q (me = nil too)", assertion))
		}
	}
	return eng.User().GetName(), nil
}

func (e *PGPEncrypt) identifyUser(ctx *Context, assertion string) (string, error) {
	e.G().Log.Debug("pgp encrypt: identifying user %q", assertion)
	arg := NewIdentifyArg(assertion, false, false)
	eng := NewIdentify(arg, e.G())
	if err := RunEngine(eng, ctx); err != nil {
		return "", err
	}
	return eng.User().GetName(), nil
}

// keyset maintains a set of pgp keys, preserving insertion order.
type keyset struct {
	index []keybase1.KID
	keys  map[keybase1.KID]*libkb.PGPKeyBundle
}

// newKeyset creates an empty keyset.
func newKeyset() *keyset {
	return &keyset{keys: make(map[keybase1.KID]*libkb.PGPKeyBundle)}
}

// Add adds bundle to the keyset.  If a key already exists, it
// will be ignored.
func (k *keyset) Add(bundle *libkb.PGPKeyBundle) {
	kid := bundle.GetKID()
	if _, ok := k.keys[kid]; ok {
		return
	}
	k.keys[kid] = bundle
	k.index = append(k.index, kid)
}

// Sorted returns the unique keys in insertion order.
func (k *keyset) Sorted() []*libkb.PGPKeyBundle {
	var sorted []*libkb.PGPKeyBundle
	for _, kid := range k.index {
		sorted = append(sorted, k.keys[kid])
	}
	return sorted
}
