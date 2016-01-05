// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type SaltPackUI struct {
	libkb.Contextified
	terminal    libkb.TerminalUI
	interactive bool
	force       bool
}

func (s *SaltPackUI) doNonInteractive(arg keybase1.SaltPackPromptForDecryptArg) error {
	switch arg.Sender.SenderType {
	case keybase1.SaltPackSenderType_TRACKING_BROKE:
		if s.force {
			s.G().Log.Warning("Tracking statement is broken for sender, but forcing through.")
			return nil
		}
		return libkb.IdentifyFailedError{Assertion: arg.Sender.Username, Reason: "tracking broke"}
	default:
		return nil
	}
}

func (s *SaltPackUI) doInteractive(arg keybase1.SaltPackPromptForDecryptArg) error {
	var why string
	def := libkb.PromptDefaultYes
	switch arg.Sender.SenderType {
	case keybase1.SaltPackSenderType_TRACKING_OK:
		return nil
	case keybase1.SaltPackSenderType_NOT_TRACKED:
		why = "The sender of this message is a Keybase user you don't track"
	case keybase1.SaltPackSenderType_UNKNOWN:
		why = "The sender of this message is unknown to Keybase"
	case keybase1.SaltPackSenderType_ANONYMOUS:
		why = "The sender of this message has choosen to remain anonymous"
	case keybase1.SaltPackSenderType_TRACKING_BROKE:
		why = "You track the sender of this message, but their tracking statement is broken"
		def = libkb.PromptDefaultNo
	}
	why += ". Go ahead and decrypt?"
	ok, err := s.terminal.PromptYesNo(PromptDescriptorDecryptInteractive, why, def)
	if err != nil {
		return err
	}
	if !ok {
		return libkb.CanceledError{M: "decryption canceled"}
	}

	return nil
}

func (s *SaltPackUI) SaltPackPromptForDecrypt(_ context.Context, arg keybase1.SaltPackPromptForDecryptArg) (err error) {
	if !s.interactive {
		return s.doNonInteractive(arg)
	}
	return s.doInteractive(arg)
}

func (s *SaltPackUI) SaltPackSignatureSuccess(_ context.Context, arg keybase1.SaltPackSignatureSuccessArg) error {
	var un string
	if arg.Sender.SenderType == keybase1.SaltPackSenderType_UNKNOWN {
		un = "The signer of this message is unknown to Keybase"
	} else {
		un = fmt.Sprintf("Signed by %s", ColorString("bold", arg.Sender.Username))
	}
	s.terminal.Printf(ColorString("green", fmt.Sprintf("Signature verified. %s.\n", un)))
	s.terminal.Printf(ColorString("green", fmt.Sprintf("Signing key ID: %x.\n", arg.SigningKID.ToShortIDString())))

	return nil
}
