package main

import (
	"crypto/rand"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os/exec"

	"github.com/buger/jsonparser"
)

var howMany int
var destination string
var bin string
var home string

func main() {
	flag.IntVar(&howMany, "n", 5, "number of accounts to create to fund base account")
	flag.StringVar(&destination, "d", "", "destination account")
	flag.StringVar(&bin, "bin", "/usr/local/bin/keybase", "keybase binary path")
	flag.StringVar(&home, "home", "/tmp", "home directory")
	flag.Parse()
	if howMany <= 0 {
		flag.PrintDefaults()
		log.Fatal("n must be > 0")
	}
	if destination == "" {
		flag.PrintDefaults()
		log.Fatal("destination account required")
	}

	for i := 0; i < howMany; i++ {
		_, err := createWalletUser()
		if err != nil {
			log.Printf("error creating wallet user: %s", err)
			continue
		}
	}
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

	// get the account id
	in := fmt.Sprintf("{\"method\": \"lookup\", \"params\": {\"options\": {\"name\": %q}}}", username)
	cmd = exec.Command(bin, "-home", home, "wallet", "api", "-m", in)
	out, err := cmd.CombinedOutput()
	if err != nil {
		fmt.Printf("lookup error: %s\n", err)
		return "", err
	}
	fmt.Printf("output: %s\n", string(out))
	acctID, err := jsonparser.GetString(out, "result", "accountID")
	if err != nil {
		return "", err
	}
	fmt.Printf("accountID: %s\n", acctID)
	fu := fmt.Sprintf("https://friendbot.stellar.org/?addr=%s", acctID)
	resp, err := http.Get(fu)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	fmt.Printf("friendbot body: %s\n", string(body))
	if err != nil {
		return "", err
	}

	// send most of it to destination
	in = fmt.Sprintf("{\"method\": \"send\", \"params\": {\"options\": {\"recipient\": %q, \"amount\": \"9900\"}}}", destination)
	cmd = exec.Command(bin, "-home", home, "wallet", "api", "-m", in)
	out, err = cmd.CombinedOutput()
	if err != nil {
		fmt.Printf("wallet send error: %s\n", err)
		return "", err
	}
	fmt.Printf("output: %s\n", string(out))

	return username, nil
}

func logout() {
	cmd := exec.Command(bin, "-home", home, "logout")
	if out, err := cmd.CombinedOutput(); err != nil {
		fmt.Printf("logout error: %s\n", err)
		fmt.Printf("output: %s\n", string(out))
	}
}
