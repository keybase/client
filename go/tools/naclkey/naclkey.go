// Copyright 2015 Keybase, Inc. All rights reserved. Use of
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

	"github.com/agl/ed25519"
)

var jsonOutput = flag.Bool("json", false, "output json")

func main() {
	flag.Parse()

	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		fmt.Printf("Error generating keys: %s\n", err)
		os.Exit(1)
	}

	if *jsonOutput {
		x := struct {
			Public  string
			Private string
		}{
			Public:  hex.EncodeToString((*pub)[:]),
			Private: hex.EncodeToString((*priv)[:]),
		}
		j, err := json.MarshalIndent(x, "", "    ")
		if err != nil {
			fmt.Printf("JSON marshal error: %s\n", err)
			os.Exit(1)
		}
		fmt.Println(string(j))
	} else {
		fmt.Printf("Public key:  %x\n", *pub)
		fmt.Printf("Private key: %x\n", *priv)
	}
}
