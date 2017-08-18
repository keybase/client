// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// naclkey generates NaCL signing keys.  Use the -json flag
// to output JSON.

package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"os"

	"github.com/keybase/go-crypto/ed25519"
)

// to avoid importing all of libkb, some constants copied from
// libkb/constants.go here:
const (
	KeybaseKIDV1 = 0x01
	KIDNaclEddsa = 0x20
	IDSuffixKID  = 0x0a
)

var jsonOutput = flag.Bool("json", false, "output json")

func main() {
	flag.Parse()

	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		fmt.Printf("Error generating keys: %s\n", err)
		os.Exit(1)
	}

	pubkb := make([]byte, len(pub)+3)
	pubkb[0] = KeybaseKIDV1
	pubkb[1] = KIDNaclEddsa
	copy(pubkb[2:], pub[:])
	pubkb[len(pubkb)-1] = IDSuffixKID

	if *jsonOutput {
		x := struct {
			Public        string
			PublicKeybase string
			Private       string
		}{
			Public:        hex.EncodeToString(pub[:]),
			PublicKeybase: hex.EncodeToString(pubkb),
			Private:       hex.EncodeToString(priv[:]),
		}
		j, err := json.MarshalIndent(x, "", "    ")
		if err != nil {
			fmt.Printf("JSON marshal error: %s\n", err)
			os.Exit(1)
		}
		fmt.Println(string(j))
	} else {
		fmt.Printf("Public key:         %x\n", pub)
		fmt.Printf("Keybase public key: %x\n", pubkb)
		fmt.Printf("Private key:        %x\n", priv)
	}
}
