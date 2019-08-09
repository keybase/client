// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// users signs up a bunch of users in a development environment

package main

import (
	"crypto/rand"
	"flag"
	"fmt"
	"os"
	"os/exec"
)

var usersCount int
var walletsCount int
var bin string
var home string

func main() {
	parseFlags()
	su := createStandardUsers()
	wu := createWalletUsers()
	fmt.Printf("created %d standard users\n", len(su))
	fmt.Printf("created %d wallet users\n", len(wu))

	f, err := os.Create("out.json")
	if err != nil {
		fmt.Printf("error opening out.json: %s\n", err)
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "[\n")
	for i, u := range su {
		if i != 0 {
			fmt.Fprintf(f, ",\n")
		}
		fmt.Fprintf(f, "\t{\"username\": %q}", u)
	}
	for i, u := range wu {
		if i != 0 || len(su) > 0 {
			fmt.Fprintf(f, ",\n")
		}
		fmt.Fprintf(f, "\t{\"username\": %q}", u)
	}
	fmt.Fprintf(f, "\n]\n")
}

func parseFlags() {
	flag.IntVar(&usersCount, "users", 0, "number of standard users to create")
	flag.IntVar(&walletsCount, "wallets", 0, "number of users with wallets to create")
	flag.StringVar(&bin, "bin", "/usr/local/bin/keybase", "keybase binary path")
	flag.StringVar(&home, "home", "/tmp", "home directory")
	flag.Parse()

	if usersCount == 0 && walletsCount == 0 {
		fmt.Fprintf(os.Stderr, "must specify at least one type of user to create\n\n")
		fmt.Fprintf(os.Stderr, "Usage:\n\n")
		fmt.Fprintf(os.Stderr, "  users [options]\n\n")
		flag.PrintDefaults()
		os.Exit(1)
	}
}

func createStandardUsers() []string {
	if usersCount == 0 {
		return nil
	}
	fmt.Printf("Creating %d standard users:\n", usersCount)
	var users []string
	for i := 0; i < usersCount; i++ {
		username, err := createStandardUser()
		if err != nil {
			fmt.Printf("%d: error %s\n", i+1, err)
			continue
		}
		fmt.Printf("%d: created %s\n", i+1, username)
		users = append(users, username)
	}

	return users
}

func createWalletUsers() []string {
	if walletsCount == 0 {
		return nil
	}
	fmt.Printf("Creating %d users with wallets:\n", walletsCount)
	var users []string
	for i := 0; i < walletsCount; i++ {
		username, err := createWalletUser()
		if err != nil {
			fmt.Printf("%d: error %s\n", i+1, err)
			continue
		}
		fmt.Printf("%d: created %s (with wallet)\n", i+1, username)
		users = append(users, username)
	}

	return users
}

func createStandardUser() (string, error) {
	logout()
	buf := make([]byte, 6)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	username := fmt.Sprintf("ad_%x", buf)
	cmd := exec.Command(bin, "-home", home, "signup", "-batch", "-username", username, "-passphrase", "00000000", "-no-email", "-invite-code", "202020202020202020202020")
	if out, err := cmd.CombinedOutput(); err != nil {
		fmt.Printf("signup error: %s\n", err)
		fmt.Printf("output: %s\n", string(out))
		return "", err
	}
	return username, nil
}

func createWalletUser() (string, error) {
	username, err := createStandardUser()
	if err != nil {
		return "", err
	}

	// accept the disclaimer
	cmd := exec.Command(bin, "-home", home, "wallet", "api", "-m", `{"method": "setup-wallet"}`)
	if out, err := cmd.CombinedOutput(); err != nil {
		fmt.Printf("setup-wallet error: %s\n", err)
		fmt.Printf("output: %s\n", string(out))
		return "", err
	}

	return username, nil
}

func logout() {
	cmd := exec.Command(bin, "-home", home, "logout")
	if out, err := cmd.CombinedOutput(); err != nil {
		fmt.Printf("logout error: %s\n", err)
		fmt.Printf("output: %s\n", string(out))
	}
}
