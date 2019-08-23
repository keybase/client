// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type httpMethod int

const (
	GET httpMethod = iota
	POST
	DELETE
)

func (m httpMethod) String() string {
	switch m {
	case GET:
		return "GET"
	case POST:
		return "POST"
	case DELETE:
		return "DELETE"
	}
	return "<unknown>"
}

type CmdAPICall struct {
	endpoint     string
	method       httpMethod
	args         []keybase1.StringKVPair
	httpStatuses []int
	appStatuses  []int
	JSONPayload  []keybase1.StringKVPair

	parsedHost string

	libkb.Contextified
}

func NewCmdAPICall(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name: "apicall",
		// No "Usage" field makes it hidden in command list.
		ArgumentHelp: "<endpoint>",
		Description:  "Send a request to the API Server",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdAPICall{
				Contextified: libkb.NewContextified(g),
			}, "apicall", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "m, method",
				Usage: "Specify the HTTP method for the request",
			},
			cli.StringSliceFlag{
				Name:  "a, arg",
				Usage: "Specify an argument in the form name=value",
				Value: &cli.StringSlice{},
			},
			cli.StringFlag{
				Name:  "json-payload",
				Usage: "Specify the JSON payload for the POST request",
			},
			cli.IntSliceFlag{
				Name:  "s, status",
				Usage: "Specify an acceptable HTTP status code",
				Value: &cli.IntSlice{},
			},
			cli.IntSliceFlag{
				Name:  "p, appstatus",
				Usage: "Specify an acceptable app status code",
				Value: &cli.IntSlice{},
			},
			cli.BoolFlag{
				Name:  "url",
				Usage: "Pass full keybase.io URL with query parameters instead of an endpoint.",
			},
		},
	}
}

func (c *CmdAPICall) Run() error {
	if c.parsedHost != "" {
		serverURI, err := c.G().Env.GetServerURI()
		if err != nil {
			return err
		}

		if !strings.EqualFold(c.parsedHost, serverURI) {
			return fmt.Errorf("Unexpected host in URL mode: %s. This only works for Keybase API.", c.parsedHost)
		}
		c.G().Log.Info("Parsed URL as endpoint: %q, args: %+v", c.endpoint, c.args)
	}

	dui := c.G().UI.GetDumbOutputUI()
	cli, err := GetAPIServerClient(c.G())
	if err != nil {
		return err
	}

	var res keybase1.APIRes
	switch c.method {
	case GET:
		arg := c.formGetArg()
		res, err = cli.GetWithSession(context.TODO(), arg)
		if err != nil {
			return err
		}
	case POST:
		if c.JSONPayload != nil {
			arg := c.formPostJSONArg()
			res, err = cli.PostJSON(context.TODO(), arg)
		} else {
			arg := c.formPostArg()
			res, err = cli.Post(context.TODO(), arg)
		}

		if err != nil {
			return err
		}
	case DELETE:
		arg := c.formDeleteArg()
		res, err = cli.Delete(context.TODO(), arg)
		if err != nil {
			return err
		}
	}

	dui.Printf("%s", res.Body)
	return nil
}

func (c *CmdAPICall) formGetArg() (res keybase1.GetWithSessionArg) {
	res.Endpoint = c.endpoint
	res.Args = c.args
	res.HttpStatus = c.httpStatuses
	res.AppStatusCode = c.appStatuses
	return
}

func (c *CmdAPICall) formDeleteArg() (res keybase1.DeleteArg) {
	res.Endpoint = c.endpoint
	res.Args = c.args
	res.HttpStatus = c.httpStatuses
	res.AppStatusCode = c.appStatuses
	return
}

func (c *CmdAPICall) formPostArg() (res keybase1.PostArg) {
	res.Endpoint = c.endpoint
	res.Args = c.args
	res.HttpStatus = c.httpStatuses
	res.AppStatusCode = c.appStatuses
	return
}

func (c *CmdAPICall) formPostJSONArg() (res keybase1.PostJSONArg) {
	res.Endpoint = c.endpoint
	res.Args = c.args
	res.HttpStatus = c.httpStatuses
	res.AppStatusCode = c.appStatuses
	res.JSONPayload = c.JSONPayload
	return
}

func (c *CmdAPICall) validateMethod(m string) (httpMethod, error) {
	if m == "" {
		return GET, nil
	} else if strings.ToLower(m) == "post" {
		return POST, nil
	} else if strings.ToLower(m) == "get" {
		return GET, nil
	} else if strings.ToLower(m) == "delete" {
		return DELETE, nil
	}
	return 0, fmt.Errorf("invalid method specified: %s", m)
}

func (c *CmdAPICall) parseArgument(a string) (res keybase1.StringKVPair, err error) {
	toks := strings.Split(a, "=")
	if len(toks) != 2 {
		err = fmt.Errorf("invalid argument: %s", a)
		return
	}
	return keybase1.StringKVPair{Key: toks[0], Value: toks[1]}, nil
}

func (c *CmdAPICall) addArgument(arg keybase1.StringKVPair) {
	c.args = append(c.args, arg)
}

type JSONInput map[string]json.RawMessage

func (c *CmdAPICall) parseJSONPayload(p string) ([]keybase1.StringKVPair, error) {
	var input JSONInput
	err := json.Unmarshal([]byte(p), &input)
	if err != nil {
		return nil, err
	}

	var res []keybase1.StringKVPair
	for k, v := range input {
		res = append(res, keybase1.StringKVPair{Key: k, Value: string(v[:])})
	}

	return res, nil
}

func (c *CmdAPICall) ParseArgv(ctx *cli.Context) error {
	var err error
	nargs := len(ctx.Args())
	if nargs == 0 {
		return fmt.Errorf("endpoint is required")
	} else if nargs != 1 {
		return fmt.Errorf("expected 1 argument (endpoint), got %d: %v", nargs, ctx.Args())
	}

	c.endpoint = ctx.Args()[0]

	if c.method, err = c.validateMethod(ctx.String("method")); err != nil {
		return err
	}

	args := ctx.StringSlice("arg")
	for _, a := range args {
		pa, err := c.parseArgument(a)
		if err != nil {
			return err
		}
		c.addArgument(pa)
	}

	httpStatuses := ctx.IntSlice("status")
	for _, h := range httpStatuses {
		c.httpStatuses = append(c.httpStatuses, h)
	}

	appStatuses := ctx.IntSlice("appstatus")
	for _, a := range appStatuses {
		c.appStatuses = append(c.appStatuses, a)
	}

	payload := ctx.String("json-payload")
	if payload != "" {
		if c.JSONPayload, err = c.parseJSONPayload(payload); err != nil {
			return err
		}
	}

	if ctx.Bool("url") {
		if len(args) != 0 {
			return fmt.Errorf("--url flag and --arg argument are incompatible")
		}
		if c.method == POST {
			return fmt.Errorf("--url flag is incompatible with POST")
		}
		if payload != "" {
			return fmt.Errorf("--url flag and --json-payload argument are incompatible")
		}
		return c.parseEndpointAsURL(ctx)
	}

	return nil
}

func (c *CmdAPICall) parseEndpointAsURL(ctx *cli.Context) error {
	const apiPath string = "/_/api/1.0/"

	u, err := url.Parse(c.endpoint)
	if err != nil {
		return err
	}
	values, err := url.ParseQuery(u.RawQuery)
	if err != nil {
		return err
	}
	// Check host later. During ParseArgv, the environment is not
	// necessarily completely set.
	c.parsedHost = fmt.Sprintf("%s://%s", u.Scheme, u.Host)
	// Allow use of 'keybase.io' out of convenience and make it
	// equivalent to production URI.
	if strings.EqualFold(c.parsedHost, "https://keybase.io") {
		c.parsedHost = libkb.ProductionServerURI
	}
	if !strings.HasPrefix(u.Path, apiPath) {
		return fmt.Errorf("URL path has to be API path: %s", apiPath)
	}
	c.endpoint = strings.TrimPrefix(u.Path, apiPath)
	c.endpoint = strings.TrimSuffix(c.endpoint, ".json")
	for k, vals := range values {
		for _, v := range vals {
			c.addArgument(keybase1.StringKVPair{Key: k, Value: v})
		}
	}
	return nil
}

func (c *CmdAPICall) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
