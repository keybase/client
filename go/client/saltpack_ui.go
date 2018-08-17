// Copyright 2015 Keybase, Inc. All rights reserved. Use of
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
	var err error
	switch arg.Sender.SenderType {
	case keybase1.SaltpackSenderType_TRACKING_BROKE:
		if s.force {
			s.G().Log.Warning("Your view of the sender is broken, but forcing through.")
			return nil
		}
		err = libkb.IdentifyFailedError{Assertion: arg.Sender.Username, Reason: "sender identity failed"}
	case keybase1.SaltpackSenderType_REVOKED:
		if s.force {
			s.G().Log.Warning("The key that authenticated this message is revoked, but forcing through.")
			return nil
		}
		err = libkb.IdentifyFailedError{Assertion: arg.Sender.Username, Reason: "sender key revoked"}
	case keybase1.SaltpackSenderType_EXPIRED:
		if s.force {
			s.G().Log.Warning("The key that authenticated this message is expired, but forcing through.")
			return nil
		}
		err = libkb.IdentifyFailedError{Assertion: arg.Sender.Username, Reason: "sender key expired"}
	case keybase1.SaltpackSenderType_NOT_TRACKED:
		s.G().Log.Warning("The sender of this message is a Keybase user you don't follow. Consider doing so for even stronger security!")
	case keybase1.SaltpackSenderType_TRACKING_OK, keybase1.SaltpackSenderType_SELF, keybase1.SaltpackSenderType_UNKNOWN, keybase1.SaltpackSenderType_ANONYMOUS:
		// No need to issue warnings here
	default:
		panic("unexpected SenderType in SaltpackPromptForDecrypt")
	}
	if err != nil {
		w := s.terminal.ErrorWriter()
		fmt.Fprintf(w, ColorString(s.G(), "red", "Use --force to decrypt anyway.\n"))
	}
	return err
}

func (s *SaltpackUI) doInteractive(arg keybase1.SaltpackPromptForDecryptArg) error {
	def := libkb.PromptDefaultYes
	switch arg.Sender.SenderType {
	case keybase1.SaltpackSenderType_TRACKING_OK, keybase1.SaltpackSenderType_SELF:
		// No need to ask for confirmation in this case.
		return nil
	case keybase1.SaltpackSenderType_TRACKING_BROKE, keybase1.SaltpackSenderType_REVOKED, keybase1.SaltpackSenderType_EXPIRED:
		def = libkb.PromptDefaultNo
	case keybase1.SaltpackSenderType_UNKNOWN, keybase1.SaltpackSenderType_ANONYMOUS, keybase1.SaltpackSenderType_NOT_TRACKED:
		// In this case the default answer is yes.
	default:
		panic("unexpected SenderType in SaltpackPromptForDecrypt")
	}
	ok, err := s.terminal.PromptYesNo(PromptDescriptorDecryptInteractive, "Go ahead and decrypt?", def)
	if err != nil {
		return err
	}
	if !ok {
		return libkb.CanceledError{M: "decryption canceled"}
	}

	return nil
}

func (s *SaltpackUI) SaltpackPromptForDecrypt(_ context.Context, arg keybase1.SaltpackPromptForDecryptArg) (err error) {
	w := s.terminal.ErrorWriter()
	switch arg.Sender.SenderType {
	case keybase1.SaltpackSenderType_TRACKING_OK:
		fmt.Fprintf(w, ColorString(s.G(), "green", fmt.Sprintf("Authored by %s.\n", ColorString(s.G(), "bold", arg.Sender.Username))))
	case keybase1.SaltpackSenderType_NOT_TRACKED:
		fmt.Fprintf(w, ColorString(s.G(), "green", fmt.Sprintf("Authored by %s (whom you do not follow).\n", ColorString(s.G(), "bold", arg.Sender.Username))))
	case keybase1.SaltpackSenderType_UNKNOWN:
		fmt.Fprintf(w, ColorString(s.G(), "green", fmt.Sprintf("The author of this message is unknown to Keybase (key ID: %s).\n", arg.SigningKID)))
	case keybase1.SaltpackSenderType_SELF:
		fmt.Fprintf(w, ColorString(s.G(), "green", fmt.Sprintf("Authored by %s (you).\n", ColorString(s.G(), "bold", arg.Sender.Username))))
	case keybase1.SaltpackSenderType_ANONYMOUS:
		fmt.Fprintf(w, ColorString(s.G(), "green", "The sender of this message has chosen to remain anonymous.\n"))
	case keybase1.SaltpackSenderType_TRACKING_BROKE:
		fmt.Fprintf(w, ColorString(s.G(), "red", fmt.Sprintf("Authored by %s.\nYou follow the sender of this message, but your view of them is broken.\n", ColorString(s.G(), "bold", arg.Sender.Username))))
	case keybase1.SaltpackSenderType_REVOKED:
		fmt.Fprintf(w, ColorString(s.G(), "red", fmt.Sprintf("Authored by %s, however the key that authenticated this message has been revoked (key ID: %s).\n", ColorString(s.G(), "bold", arg.Sender.Username), arg.SigningKID)))
	case keybase1.SaltpackSenderType_EXPIRED:
		fmt.Fprintf(w, ColorString(s.G(), "red", fmt.Sprintf("Authored by %s, however the key that authenticated this message has expired (key ID: %s).\n", ColorString(s.G(), "bold", arg.Sender.Username), arg.SigningKID)))
	default:
		return fmt.Errorf("Unexpected sender type: %s", arg.Sender.SenderType)
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
		un = fmt.Sprintf("The signer of this message is unknown to Keybase.\nSigning key ID: %s", arg.SigningKID)
	case keybase1.SaltpackSenderType_TRACKING_OK:
		un = fmt.Sprintf("Signed by %s", ColorString(s.G(), "bold", arg.Sender.Username))
	case keybase1.SaltpackSenderType_NOT_TRACKED:
		un = fmt.Sprintf("Signed by %s (whom you do not follow)", ColorString(s.G(), "bold", arg.Sender.Username))
		s.G().Log.Warning("The sender of this message is a Keybase user you don't follow. Consider doing so for even stronger security!")
	case keybase1.SaltpackSenderType_SELF:
		un = fmt.Sprintf("Signed by %s (you)", ColorString(s.G(), "bold", arg.Sender.Username))
	default:
		return fmt.Errorf("Unexpected sender type: %s", arg.Sender.SenderType)
	}
	fmt.Fprintf(w, ColorString(s.G(), "green", fmt.Sprintf("%s.\n", un)))
	return nil
}

// SaltpackVerifyBadSender is responsible for short-circuiting the output of the bad
// message. It returns an error if the --force argument isn't present, and the
// VerifyEngine bubbles that up. This is similar to doNonInteractive above.
func (s *SaltpackUI) SaltpackVerifyBadSender(_ context.Context, arg keybase1.SaltpackVerifyBadSenderArg) error {
	// write messages to stderr
	var message string
	var errorReason string
	switch arg.Sender.SenderType {
	case keybase1.SaltpackSenderType_TRACKING_BROKE:
		message = fmt.Sprintf("Signed by %s, but their tracking statement is broken.", ColorString(s.G(), "bold", arg.Sender.Username))
		errorReason = "tracking statement broken"
	case keybase1.SaltpackSenderType_REVOKED:
		message = fmt.Sprintf("Signed by %s, but the key they used is revoked:\n    %s", ColorString(s.G(), "bold", arg.Sender.Username), arg.SigningKID.String())
		errorReason = "sender key revoked"
	case keybase1.SaltpackSenderType_EXPIRED:
		message = fmt.Sprintf("Signed by %s, but the key they used is expired:\n    %s", ColorString(s.G(), "bold", arg.Sender.Username), arg.SigningKID.String())
		errorReason = "sender key expired"
	default:
		return fmt.Errorf("Unexpected bad sender type: %s", arg.Sender.SenderType)
	}
	w := s.terminal.ErrorWriter()
	fmt.Fprintf(w, ColorString(s.G(), "red", fmt.Sprintf("Problem verifying the sender: %s\n", message)))

	if s.force {
		return nil
	}
	fmt.Fprintf(w, ColorString(s.G(), "red", "Use --force to see the message anyway.\n"))
	return libkb.IdentifyFailedError{Assertion: arg.Sender.Username, Reason: errorReason}
}
