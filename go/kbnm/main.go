package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
)

type Response struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

func discardPrefix(b *bufio.Reader, until string) error {
	for {
		c, err := b.Peek(1)
		if err != nil {
			return err
		}
		if string(c) == until {
			return nil
		}
		if _, err = b.Discard(1); err != nil {
			return err
		}
	}
}

func main() {
	// Read JSON per line from STDIN, respond with JSON to STDOUT
	bufin := bufio.NewReader(os.Stdin)
	out := json.NewEncoder(os.Stdout)

	for {
		// Skip initial form feed delimiter
		err := discardPrefix(bufin, "{")
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %s", err)
			return
		}

		in := json.NewDecoder(bufin)

		var v interface{}
		err = in.Decode(&v)

		if err == io.EOF {
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
			// Restart decoder
			in = json.NewDecoder(os.Stdin)
			continue
		}

		err = out.Encode(Response{
			Status:  "ok",
			Message: "Parsed message successfully.",
		})
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %s", err)
		}
	}
}
