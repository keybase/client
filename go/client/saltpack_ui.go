// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type SaltpackUI struct {
	libkb.Contextified
	terminal    libkb.TerminalUI
	interactive bool
	force       bool
}

func (s *SaltpackUI) doNonInteractive(arg keybase1.SaltpackPromptForDecryptArg) error {
	switch arg.Sender.SenderType {
	case keybase1.SaltpackSenderType_TRACKING_BROKE:
		if s.force {
			s.G().Log.Warning("Tracking statement is broken for sender, but forcing through.")
			return nil
		}
		return libkb.IdentifyFailedError{Assertion: arg.Sender.Username, Reason: "tracking broke"}
	default:
		return nil
	}
}

func (s *SaltpackUI) doInteractive(arg keybase1.SaltpackPromptForDecryptArg) error {
	var why string
	def := libkb.PromptDefaultYes
	switch arg.Sender.SenderType {
	case keybase1.SaltpackSenderType_TRACKING_OK, keybase1.SaltpackSenderType_SELF:
		return nil
	case keybase1.SaltpackSenderType_NOT_TRACKED:
		why = "The sender of this message is a Keybase user you don't track"
	case keybase1.SaltpackSenderType_UNKNOWN:
		why = "The sender of this message is unknown to Keybase"
	case keybase1.SaltpackSenderType_ANONYMOUS:
		why = "The sender of this message has chosen to remain anonymous"
	case keybase1.SaltpackSenderType_TRACKING_BROKE:
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

func (s *SaltpackUI) SaltpackPromptForDecrypt(_ context.Context, arg keybase1.SaltpackPromptForDecryptArg) (err error) {
	if arg.UsedDelegateUI {
		w := s.terminal.ErrorWriter()
		fmt.Fprintf(w, "Message authored by "+ColorString("bold", arg.Sender.Username)+"\n")
	}
	if !s.interactive {
		return s.doNonInteractive(arg)
	}
	return s.doInteractive(arg)
}

func (s *SaltpackUI) SaltpackVerifySuccess(_ context.Context, arg keybase1.SaltpackVerifySuccessArg) error {
	// write messages to stderr
	w := s.terminal.ErrorWriter()
	var un string
	if arg.Sender.SenderType == keybase1.SaltpackSenderType_UNKNOWN {
		un = "The signer of this message is unknown to Keybase"
	} else {
		var you string
		if arg.Sender.SenderType == keybase1.SaltpackSenderType_SELF {
			you = " (you)"
		}
		un = fmt.Sprintf("Signed by %s%s", ColorString("bold", arg.Sender.Username), you)
	}
	fmt.Fprintf(w, ColorString("green", fmt.Sprintf("Signature verified. %s.\n", un)))
	if arg.Sender.SenderType == keybase1.SaltpackSenderType_UNKNOWN {
		fmt.Fprintf(w, ColorString("green", fmt.Sprintf("Signing key ID: %s.\n", arg.SigningKID)))
	}

	return nil
}
