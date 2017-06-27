package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"os"

	"github.com/keybase/client/go/kbnm/installer"
	"github.com/qrtz/nativemessaging"
)

// internalVersion is the logical version of this code (rather than build).
const internalVersion = "1.3"

// Version is the build version of kbnm, overwritten during build with metadata.
var Version = "dev"

// Response from the kbnm service
type Response struct {
	Client  int         `json:"client"`
	Status  string      `json:"status"`
	Message string      `json:"message"`
	Result  interface{} `json:"result,omitempty"`
}

// Request to the kbnm service
type Request struct {
	Client int    `json:"client"`
	Method string `json:"method"`
	To     string `json:"to"`
	Body   string `json:"body"`
}

var plainFlag = flag.Bool("plain", false, "newline-delimited JSON IO, no length prefix")
var versionFlag = flag.Bool("version", false, "print the version and exit")
var overlayFlag = flag.String("overlay", "", "install/uninstall within an overlay path")

// process consumes a single message
func process(h *handler, in nativemessaging.JSONDecoder, out nativemessaging.JSONEncoder) error {
	var resp Response
	var req Request

	// If input fails to parse, we can't guarantee future inputs will
	// get into a parseable state so we abort after sending an error
	// response.
	abortErr := in.Decode(&req)

	var err error
	if abortErr == nil {
		resp.Result, err = h.Handle(&req)
	}

	if err == io.EOF {
		// Closed
		return err
	} else if err != nil {
		resp.Status = "error"
		resp.Message = err.Error()
	} else {
		// Success
		resp.Status = "ok"
	}
	resp.Client = req.Client

	err = out.Encode(resp)
	if err != nil {
		// TODO: Log this somewhere?
		fmt.Fprintf(os.Stderr, "error: %s", err)
		os.Exit(1)
	}

	return abortErr
}

func exit(code int, msg string, a ...interface{}) {
	fmt.Fprintf(os.Stderr, msg+"\n", a...)
	os.Exit(code)
}

func main() {
	flag.Parse()

	if *versionFlag {
		fmt.Printf("%s-%s\n", internalVersion, Version)
		os.Exit(0)
	}

	switch flag.Arg(0) {
	case "install":
		kbnmPath, err := findKeybaseBinary(kbnmBinary)
		if err != nil {
			exit(2, "error finding kbnm binary: %s", err)
		}
		log.Print("installing: ", kbnmPath)
		if err := installer.InstallKBNM(*overlayFlag, kbnmPath); err != nil {
			exit(2, "error installing kbnm whitelist: %s", err)
		}
		exit(0, "Installed NativeMessaging whitelists.")
	case "uninstall":
		if err := installer.UninstallKBNM(*overlayFlag); err != nil {
			exit(2, "error uninstalling kbnm whitelist: %s", err)
		}
		exit(0, "Uninstalled NativeMessaging whitelists.")
	}

	// Native messages include a prefix which describes the length of each message.
	var in nativemessaging.JSONDecoder
	var out nativemessaging.JSONEncoder

	if *plainFlag {
		// Used for testing interactively
		in = json.NewDecoder(os.Stdin)
		out = json.NewEncoder(os.Stdout)
	} else {
		// Used as part of the NativeMessaging API
		in = nativemessaging.NewNativeJSONDecoder(os.Stdin)
		out = nativemessaging.NewNativeJSONEncoder(os.Stdout)
	}

	h := Handler()

	for {
		err := process(h, in, out)
		if err == io.EOF {
			// Clean close
			break
		}
		if err != nil {
			exit(1, "stream processig error: %s", err)
		}
	}
}
