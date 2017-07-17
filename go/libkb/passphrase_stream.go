// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	triplesec "github.com/keybase/go-triplesec"
)

func NewSecureTriplesec(passphrase []byte, salt []byte) (Triplesec, error) {
	return triplesec.NewCipher(passphrase, salt)
}

func StretchPassphrase(g *GlobalContext, passphrase string, salt []byte) (tsec Triplesec, pps *PassphraseStream, err error) {
	if salt == nil {
		err = fmt.Errorf("no salt provided to StretchPassphrase")
		return nil, nil, err
	}
	var tmp []byte
	var fn func(pw []byte, salt []byte) (Triplesec, error)

	if g == nil {
		fn = NewSecureTriplesec
	} else {
		fn = g.NewTriplesec
	}

	tsec, err = fn([]byte(passphrase), salt)
	if err != nil {
		return nil, nil, err
	}
	_, tmp, err = tsec.DeriveKey(extraLen)
	if err != nil {
		return nil, nil, err
	}
	pps = NewPassphraseStream(tmp)
	return tsec, pps, nil
}

const (
	pwhIndex   = 0
	pwhLen     = 32
	eddsaIndex = pwhIndex + pwhLen
	eddsaLen   = 32
	dhIndex    = eddsaIndex + eddsaLen
	dhLen      = 32
	lksIndex   = dhIndex + dhLen
	lksLen     = LKSecLen // == 32
	extraLen   = pwhLen + eddsaLen + dhLen + lksLen
)

type PassphraseStream struct {
	stream []byte
	gen    PassphraseGeneration
}

func NewPassphraseStream(s []byte) *PassphraseStream {
	return &PassphraseStream{
		stream: s,
		gen:    PassphraseGeneration(0),
	}
}

// NewPassphraseStreamLKSecOnly creates a PassphraseStream only with the lks bytes
// (stream[lksIndex:]).  The rest of the stream is zeros.
// This is used to create a passphrase stream from the information in the
// secret store, which only contains the lksec portion of the stream.
func NewPassphraseStreamLKSecOnly(s *LKSec) (*PassphraseStream, error) {

	clientHalf, err := s.ComputeClientHalf()
	if err != nil {
		return nil, err
	}
	stream := make([]byte, extraLen)
	copy(stream[lksIndex:], clientHalf.Bytes())
	ps := &PassphraseStream{
		stream: stream,
		gen:    s.Generation(),
	}
	return ps, nil
}

func (ps *PassphraseStream) SetGeneration(gen PassphraseGeneration) {
	ps.gen = gen
}

func (ps PassphraseStream) PWHash() []byte {
	return ps.stream[pwhIndex:eddsaIndex]
}

func (ps PassphraseStream) EdDSASeed() []byte {
	return ps.stream[eddsaIndex:dhIndex]
}

func (ps PassphraseStream) DHSeed() []byte {
	return ps.stream[dhIndex:lksIndex]
}

func (ps PassphraseStream) LksClientHalf() LKSecClientHalf {
	ret, _ := NewLKSecClientHalfFromBytes(ps.stream[lksIndex:])
	return ret
}

func (ps PassphraseStream) ToLKSec(g *GlobalContext, uid keybase1.UID) (*LKSec, error) {
	ch, err := NewLKSecClientHalfFromBytes(ps.stream[lksIndex:])
	if err != nil {
		return nil, err
	}
	return &LKSec{
		Contextified: NewContextified(g),
		clientHalf:   ch,
		ppGen:        ps.Generation(),
		uid:          uid,
	}, nil
}

func (ps PassphraseStream) PDPKA5KID() (keybase1.KID, error) {
	return seedToPDPKAKID(ps.EdDSASeed())
}

func (ps PassphraseStream) String() string {
	return fmt.Sprintf("pwh:   %x\nEdDSA: %x\nDH:    %x\nlks:   %x",
		ps.PWHash(), ps.EdDSASeed(), ps.DHSeed(), ps.LksClientHalf())
}

// Generation returns the generation of this passphrase stream.
// It is >=0 for valid generation #.  If 0, then we assume the
// passphrase has never been reset.
func (ps PassphraseStream) Generation() PassphraseGeneration {
	return ps.gen
}

// Clone a passphrase stream and return a copy.
func (ps *PassphraseStream) Clone() *PassphraseStream {
	if ps == nil {
		return nil
	}
	arr := make([]byte, len(ps.stream))
	copy(arr, ps.stream)
	return &PassphraseStream{
		stream: arr,
		gen:    ps.gen,
	}
}

func (ps PassphraseStream) Export() keybase1.PassphraseStream {
	return keybase1.PassphraseStream{
		PassphraseStream: ps.stream,
		Generation:       int(ps.gen),
	}
}
