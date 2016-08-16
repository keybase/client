package service

// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/gregor/protocol/chat1"
)

func cryptKey(t *testing.T) *keybase1.CryptKey {
	kp, err := libkb.GenerateNaclDHKeyPair()
	if err != nil {
		t.Fatal(err)
	}
	return &keybase1.CryptKey{
		KeyGeneration: 1,
		Key:           keybase1.Bytes32(*kp.Private),
	}
}

func textMsg(text string) keybase1.MessagePlaintext {
	return keybase1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{},
		MessageBodies: []keybase1.MessageBody{
			{Type: chat1.MessageType_TEXT, Text: &keybase1.MessageText{Body: text}},
		},
	}
}

func TestChatMessageBox(t *testing.T) {
	key := cryptKey(t)
	msg := textMsg("hello")
	handler := &chatLocalHandler{}
	boxed, err := handler.boxer.boxMessageWithKey(msg, key)
	if err != nil {
		t.Fatal(err)
	}
	if len(boxed.BodyCiphertext.E) == 0 {
		t.Error("after boxMessage, BodyCipherText.E is empty")
	}
}

func TestChatMessageUnbox(t *testing.T) {
	key := cryptKey(t)
	text := "hi"
	msg := textMsg(text)
	handler := &chatLocalHandler{}
	boxed, err := handler.boxer.boxMessageWithKey(msg, key)
	if err != nil {
		t.Fatal(err)
	}

	// need to give it a server header...
	boxed.ServerHeader = &chat1.MessageServerHeader{}

	unboxed, err := handler.boxer.unboxMessageWithKey(boxed, key)
	if err != nil {
		t.Fatal(err)
	}
	if len(unboxed.MessagePlaintext.MessageBodies) != 1 {
		t.Fatalf("unboxed message bodies: %d, expected 1", len(unboxed.MessagePlaintext.MessageBodies))
	}
	body := unboxed.MessagePlaintext.MessageBodies[0]
	if body.Type != chat1.MessageType_TEXT {
		t.Errorf("body type: %d, expected %d", body.Type, chat1.MessageType_TEXT)
	}
	if body.Text == nil {
		t.Fatal("body.Text is nil")
	}
	if body.Text.Body != text {
		t.Errorf("body text: %q, expected %q", body.Text.Body, text)
	}
}

func TestChatMessageSigned(t *testing.T) {
	key := cryptKey(t)
	msg := textMsg("sign me")
	handler := &chatLocalHandler{}
	boxed, err := handler.boxer.boxMessageWithKey(msg, key)
	if err != nil {
		t.Fatal(err)
	}
	kp, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}
	if err := handler.signMessageBoxed(&boxed, kp); err != nil {
		t.Fatal(err)
	}
	if boxed.HeaderSignature.V != 1 {
		t.Errorf("HeaderSignature.V = %d, expected 1", boxed.HeaderSignature.V)
	}
	if len(boxed.HeaderSignature.S) == 0 {
		t.Error("after signMessageBoxed, HeaderSignature.S is empty")
	}
	if len(boxed.HeaderSignature.K) == 0 {
		t.Error("after signMessageBoxed, HeaderSignature.K is empty")
	}
	if boxed.BodySignature.V != 1 {
		t.Errorf("BodySignature.V = %d, expected 1", boxed.BodySignature.V)
	}
	if len(boxed.BodySignature.S) == 0 {
		t.Error("after signMessageBoxed, BodySignature.S is empty")
	}
	if len(boxed.BodySignature.K) == 0 {
		t.Error("after signMessageBoxed, BodySignature.K is empty")
	}
}
