package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
)

type Response struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

func main() {
	// Read JSON per line from STDIN, respond with JSON to STDOUT
	in := json.NewDecoder(os.Stdin)
	out := json.NewEncoder(os.Stdout)
	for {
		var v interface{}
		if err := in.Decode(&v); err == io.EOF {
			// Closed
			break
		} else if err != nil {
			err := out.Encode(Response{
				Status:  "error",
				Message: err.Error(),
			})
			if err != nil {
				fmt.Fprintf(os.Stderr, "error: %s", err)
			}
			return
		}

		err := out.Encode(Response{
			Status:  "ok",
			Message: "Parsed message successfully.",
		})
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %s", err)
		}
	}
}
