package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"

	"github.com/qrtz/nativemessaging"
)

// Response from the kbnm service
type Response struct {
	Status  string `json:"status"`
	Message string `json:"message"`
	Client  int    `json:"client"`
}

// Request to the kbnm service
type Request struct {
	Client int    `json:"client"`
	Method string `json:"method"`
	To     string `json:"to"`
	Body   string `json:"body"`
}

var plain = flag.Bool("plain", false, "line-delimited JSON IO, no length prefix")

func main() {
	flag.Parse()

	// Native messages include a prefix which describes the length of each message.
	var in nativemessaging.JSONDecoder
	var out nativemessaging.JSONEncoder

	if *plain {
		// Used for testing interactively
		in = json.NewDecoder(os.Stdin)
		out = json.NewEncoder(os.Stdout)
	} else {
		// Used as part of the NativeMessaging API
		in = nativemessaging.NewNativeJSONDecoder(os.Stdin)
		out = nativemessaging.NewNativeJSONEncoder(os.Stdout)
	}

	for {
		var resp Response
		var req Request

		err := in.Decode(&req)

		if err == nil {
			err = handle(&req)
		}

		if err == io.EOF {
			// Closed
			break
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
			return
		}
	}
}
