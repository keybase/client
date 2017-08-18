// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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
			s.G().Log.Warning("Your view of the sender is broken, but forcing through.")
			return nil
		}
		return libkb.IdentifyFailedError{Assertion: arg.Sender.Username, Reason: "sender identity failed"}
	case keybase1.SaltpackSenderType_REVOKED:
		if s.force {
			s.G().Log.Warning("The key that signed this message is revoked, but forcing through.")
			return nil
		}
		return libkb.IdentifyFailedError{Assertion: arg.Sender.Username, Reason: "sender key revoked"}
	case keybase1.SaltpackSenderType_EXPIRED:
		if s.force {
			s.G().Log.Warning("The key that signed this message is expired, but forcing through.")
			return nil
		}
		return libkb.IdentifyFailedError{Assertion: arg.Sender.Username, Reason: "sender key expired"}
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
		why = "The sender of this message is a Keybase user you don't follow"
	case keybase1.SaltpackSenderType_UNKNOWN:
		why = "The sender of this message is unknown to Keybase"
	case keybase1.SaltpackSenderType_ANONYMOUS:
		why = "The sender of this message has chosen to remain anonymous"
	case keybase1.SaltpackSenderType_TRACKING_BROKE:
		why = "You follow the sender of this message, but your view of them is broken"
		def = libkb.PromptDefaultNo
	case keybase1.SaltpackSenderType_REVOKED:
		why = "The key that signed this message has been revoked"
		def = libkb.PromptDefaultNo
	case keybase1.SaltpackSenderType_EXPIRED:
		why = "The key that signed this message has expired"
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
	switch arg.Sender.SenderType {
	case keybase1.SaltpackSenderType_UNKNOWN:
		un = "The signer of this message is unknown to Keybase"
	case keybase1.SaltpackSenderType_TRACKING_OK, keybase1.SaltpackSenderType_NOT_TRACKED:
		un = fmt.Sprintf("Signed by %s", ColorString("bold", arg.Sender.Username))
	case keybase1.SaltpackSenderType_SELF:
		un = fmt.Sprintf("Signed by %s (you)", ColorString("bold", arg.Sender.Username))
	default:
		return fmt.Errorf("Unexpected sender type: %s", arg.Sender.SenderType)
	}
	fmt.Fprintf(w, ColorString("green", fmt.Sprintf("Signature verified. %s.\n", un)))
	if arg.Sender.SenderType == keybase1.SaltpackSenderType_UNKNOWN {
		fmt.Fprintf(w, ColorString("green", fmt.Sprintf("Signing key ID: %s.\n", arg.SigningKID)))
	}

	return nil
}

// This function is responsible for short-circuiting the output of the bad
// message. It returns an error if the --force argument isn't present, and the
// VerifyEngine bubbles that up. This is similar to doNonInteractive above.
func (s *SaltpackUI) SaltpackVerifyBadSender(_ context.Context, arg keybase1.SaltpackVerifyBadSenderArg) error {
	// write messages to stderr
	var message string
	var errorReason string
	switch arg.Sender.SenderType {
	case keybase1.SaltpackSenderType_TRACKING_BROKE:
		message = fmt.Sprintf("Signed by %s, but their tracking statement is broken.", ColorString("bold", arg.Sender.Username))
		errorReason = "tracking statement broken"
	case keybase1.SaltpackSenderType_REVOKED:
		message = fmt.Sprintf("Signed by %s, but the key they used is revoked:\n    %s", ColorString("bold", arg.Sender.Username), arg.SigningKID.String())
		errorReason = "sender key revoked"
	case keybase1.SaltpackSenderType_EXPIRED:
		message = fmt.Sprintf("Signed by %s, but the key they used is expired:\n    %s", ColorString("bold", arg.Sender.Username), arg.SigningKID.String())
		errorReason = "sender key expired"
	default:
		return fmt.Errorf("Unexpected bad sender type: %s", arg.Sender.SenderType)
	}
	w := s.terminal.ErrorWriter()
	fmt.Fprintf(w, ColorString("red", fmt.Sprintf("Problem verifying the sender: %s\n", message)))

	if s.force {
		return nil
	}
	fmt.Fprintf(w, ColorString("red", "Use --force to see the message anyway.\n"))
	return libkb.IdentifyFailedError{Assertion: arg.Sender.Username, Reason: errorReason}
}
