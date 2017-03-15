package main

import (
	"fmt"
	"io"
	"os"

	"github.com/qrtz/nativemessaging"
)

type Response struct {
	Status  string `json:"status"`
	Message string `json:"message"`
	Client  int    `json:"client"`
}

type Request struct {
	Client int `json:"client"`
}

func main() {
	// Native messages include a prefix which describes the length of each message.
	in := nativemessaging.NewNativeJSONDecoder(os.Stdin)
	out := nativemessaging.NewNativeJSONEncoder(os.Stdout)

	for {
		var resp Response
		var req Request

		err := in.Decode(&req)

		if err == io.EOF {
			// Closed
			break
		} else if err != nil {
			resp.Status = "error"
			resp.Message = err.Error()
		} else {
			// Success
			resp.Status = "ok"
			resp.Message = "Parsed message successfully."
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
