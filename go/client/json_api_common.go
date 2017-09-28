package client

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

// ErrInvalidOptions is returned when the options aren't valid.
type ErrInvalidOptions struct {
	method  string
	version int
	err     error
}

func (e ErrInvalidOptions) Error() string {
	return fmt.Sprintf("invalid %s v%d options: %s", e.method, e.version, e.err)
}

type ErrInvalidMethod struct {
	name    string
	version int
}

func (e ErrInvalidMethod) Error() string {
	return fmt.Sprintf("invalid v%d method %q", e.version, e.name)
}

type ErrInvalidVersion struct {
	version int
}

func (e ErrInvalidVersion) Error() string {
	return fmt.Sprintf("invalid version %d", e.version)
}

type ErrInvalidJSON struct {
	message string
}

func (e ErrInvalidJSON) Error() string {
	return fmt.Sprintf("invalid JSON: %s", e.message)
}

// Call represents a JSON api call.
type Call struct {
	Jsonrpc string
	ID      int
	Method  string
	Params  Params
}

// Params represents the `params` portion of the JSON api call.
type Params struct {
	Version int
	Options json.RawMessage
}

// CallError is the result when there is an error.
type CallError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// Reply is returned with the results of procressing a Call.
type Reply struct {
	Jsonrpc string      `json:"jsonrpc,omitempty"`
	ID      int         `json:"id,omitempty"`
	Error   *CallError  `json:"error,omitempty"`
	Result  interface{} `json:"result,omitempty"`
}

// cmdAPI contains common functionality for json api commands
type cmdAPI struct {
	indent     bool
	inputFile  string
	outputFile string
	message    string
}

func newCmdAPI(cl *libcmdline.CommandLine, cmd libcmdline.Command, usage, description string) cli.Command {
	return cli.Command{
		Name:  "api",
		Usage: usage,
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "api", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "p, pretty",
				Usage: "Output pretty (indented) JSON.",
			},
			cli.StringFlag{
				Name:  "m",
				Usage: "Specify JSON as string instead of stdin",
			},
			cli.StringFlag{
				Name:  "i, infile",
				Usage: "Specify JSON input file (stdin default)",
			},
			cli.StringFlag{
				Name:  "o, outfile",
				Usage: "Specify output file (stdout default)",
			},
		},
		Description: description,
	}
}

func (c *cmdAPI) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("api takes no arguments")
	}
	c.indent = ctx.Bool("pretty")
	c.inputFile = ctx.String("infile")
	c.outputFile = ctx.String("outfile")
	c.message = ctx.String("m")

	if len(c.message) > 0 && len(c.inputFile) > 0 {
		return errors.New("specify -m or -i, but not both")
	}

	return nil
}

func (c *cmdAPI) SetMessage(m string) {
	c.message = m
}

func (c *cmdAPI) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}

type handler interface {
	handle(ctx context.Context, c Call, w io.Writer) error
}

func (c *cmdAPI) runHandler(h handler) error {
	var r io.Reader
	r = os.Stdin
	if len(c.message) > 0 {
		r = strings.NewReader(c.message)
	} else if len(c.inputFile) > 0 {
		f, err := os.Open(c.inputFile)
		if err != nil {
			return err
		}
		defer f.Close()
		r = f
	}

	var w io.Writer
	w = os.Stdout
	if len(c.outputFile) > 0 {
		f, err := os.Create(c.outputFile)
		if err != nil {
			return err
		}
		defer f.Close()
		w = f
	}

	return c.decode(context.Background(), r, w, h)
}

func (c *cmdAPI) decode(ctx context.Context, r io.Reader, w io.Writer, h handler) error {
	dec := json.NewDecoder(r)
	for {
		var c Call
		if err := dec.Decode(&c); err == io.EOF {
			break
		} else if err != nil {
			if err == io.ErrUnexpectedEOF {
				return ErrInvalidJSON{message: "expected more JSON in input"}
			}
			return err
		}

		if err := h.handle(ctx, c, w); err != nil {
			return err
		}
	}

	return nil

}
