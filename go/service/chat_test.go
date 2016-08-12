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
	boxed, err := handler.sealMessageWithKey(msg, key)
	if err != nil {
		t.Fatal(err)
	}
	if len(boxed.BodyCiphertext.E) == 0 {
		t.Error("after sealMessage, BodyCipherText.E is empty")
	}
}

func TestChatMessageUnbox(t *testing.T) {
	key := cryptKey(t)
	text := "hi"
	msg := textMsg(text)
	handler := &chatLocalHandler{}
	boxed, err := handler.sealMessageWithKey(msg, key)
	if err != nil {
		t.Fatal(err)
	}

	// need to give it a server header...
	boxed.ServerHeader = &chat1.MessageServerHeader{}

	unboxed, err := handler.unboxMessageWithKey(boxed, key)
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
