package lambda_proc

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
)

type (
	Handler func(*Context, json.RawMessage) (interface{}, error)

	Context struct {
		AwsRequestID             string `json:"awsRequestId"`
		FunctionName             string `json:"functionName"`
		FunctionVersion          string `json:"functionVersion"`
		Invokeid                 string `json:"invokeid"`
		IsDefaultFunctionVersion bool   `json:"isDefaultFunctionVersion"`
		LogGroupName             string `json:"logGroupName"`
		LogStreamName            string `json:"logStreamName"`
		MemoryLimitInMB          string `json:"memoryLimitInMB"`
	}

	Payload struct {
		// custom event fields
		Event json.RawMessage `json:"event"`

		// default context object
		Context *Context `json:"context"`
	}

	Response struct {
		// Request id is an incremental integer
		// representing the request that has been
		// received by this go proc during it's
		// lifetime
		RequestId int `json:"proc_req_id"`
		// Any errors that occur during processing
		// or are returned by handlers are returned
		Error *string `json:"error"`
		// General purpose output data
		Data interface{} `json:"data"`
	}
)

var requestId int // process req id

func NewErrorResponse(err error) *Response {
	e := err.Error()
	return &Response{
		RequestId: requestId,
		Error:     &e,
	}
}

func NewResponse(data interface{}) *Response {
	return &Response{
		RequestId: requestId,
		Data:      data,
	}
}

func Run(handler Handler) {
	RunStream(handler, os.Stdin, os.Stdout)
}

func RunStream(handler Handler, Stdin io.Reader, Stdout io.Writer) {

	stdin := json.NewDecoder(Stdin)
	stdout := json.NewEncoder(Stdout)

	for ; ; requestId++ {
		if err := func() (err error) {
			defer func() {
				if e := recover(); e != nil {
					err = fmt.Errorf("panic: %v", e)
				}
			}()
			var payload Payload
			if err := stdin.Decode(&payload); err != nil {
				return err
			}
			data, err := handler(payload.Context, payload.Event)
			if err != nil {
				return err
			}
			return stdout.Encode(NewResponse(data))
		}(); err != nil {
			if encErr := stdout.Encode(NewErrorResponse(err)); encErr != nil {
				// bad times
				log.Println("Failed to encode err response!", encErr.Error())
			}
		}
	}

}
