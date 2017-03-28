// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"encoding/hex"
	"fmt"

	"github.com/keybase/client/go/libkb"
	context "golang.org/x/net/context"
)

type FooEngine struct {
	libkb.Contextified
	name string
}

var _ Engine = (*FooEngine)(nil)

func NewFooEngine(name string, g *libkb.GlobalContext) *FooEngine {
	return &FooEngine{
		Contextified: libkb.NewContextified(g),
		name:         name,
	}
}

func (e *FooEngine) Name() string {
	return "Foo"
}

func (e *FooEngine) Prereqs() Prereqs {
	return Prereqs{}
}

func (e *FooEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
	}
}

func (e *FooEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (e *FooEngine) Run(ctx *Context) (err error) {
	defer e.G().Trace("FooEngine#Run", func() error { return err })()

	e.G().Log.Info("Running foo script: %s", e.name)

	// These scripts are just for manual diddling.
	// If any cause compile errors or headaches, just delete it.
	switch e.name {
	case "tlf-pseudonym-put":
		return e.tlfPseudonymPut(ctx)
	case "tlf-pseudonym-get":
		return e.tlfPseudonymGet(ctx)
	default:
		return fmt.Errorf("no such script")
	}
}

func (e *FooEngine) tlfPseudonymPut(ctx *Context) error {
	// This uses zero keys and stuff, don't use it as an example.

	var tlfID [16]byte
	var hmacKey [32]byte

	tlfID[15] = 22
	n, err := hex.Decode(tlfID[:], []byte("ceb31a65a25a5daeb8b934f893490c16"))
	if err != nil {
		return err
	}
	if n != 16 {
		return fmt.Errorf("bad")
	}

	pnymInfos := []libkb.TlfPseudonymInfo{
		{
			Name:    "/keybase/private/alice32,foobar2",
			ID:      tlfID,
			KeyGen:  1,
			HmacKey: hmacKey,
		},
	}
	e.G().Log.Info("pnymInfos: %+v", pnymInfos)
	pnyms, err := libkb.PostTlfPseudonyms(context.TODO(), e.G(), pnymInfos)
	e.G().Log.Info("pnyms:%+v   err:%+v", pnyms, err)
	if err != nil {
		return err
	}

	return nil
}

func (e *FooEngine) tlfPseudonymGet(ctx *Context) error {
	var pn1 [32]byte
	var pn2 [32]byte
	var pn3 [32]byte
	var pn4 [32]byte

	fillPn := func(dst []byte, src string) error {
		n, err := hex.Decode(dst, []byte(src))
		if err != nil {
			return err
		}
		if n != 32 {
			return fmt.Errorf("bad")
		}
		return nil
	}

	// not authorized (because the tlfid was fake)
	err := fillPn(pn1[:], "ec33cfb41d0a6712cffb40e6257408f6ecb903d893006f31ae690a1bc242636d")
	if err != nil {
		return err
	}

	// completely bogus
	err = fillPn(pn2[:], "abcdcfb41d0a6712cffb40e6257408f6ecb903d893006f31ae690a1bc242636d")
	if err != nil {
		return err
	}

	// real
	// err = fillPn(pn3[:], "eed1003a6cb30db363e47fd8bdc723efc793790dba5ab63f5e0ee74d35083346")
	err = fillPn(pn3[:], "164d2f24b10191120603d30121aabc005b0c51b5b005e0c431e780f7337bee9c")
	if err != nil {
		return err
	}

	pnyms1 := []libkb.TlfPseudonym{pn1, pn2, pn3, pn4}
	pnyms, err := libkb.GetTlfPseudonyms(context.TODO(), e.G(), pnyms1)
	if err != nil {
		return err
	}
	e.G().Log.Info("res: %+v", pnyms)
	for i, pi := range pnyms {
		if pi.Err != nil {
			e.G().Log.Info("res[%v]: Err: %+v", i, pi.Err)
		}
		if pi.Info != nil {
			e.G().Log.Info("res[%v]: Info: %+v", i, pi.Info)
		}
	}
	return nil
}
