package httpjson

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"

	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/support/render/problem"
)

var (
	errorType   = reflect.TypeOf((*error)(nil)).Elem()
	contextType = reflect.TypeOf((*context.Context)(nil)).Elem()
)

var DefaultResponse = json.RawMessage(`{"message":"ok"}`)

type handler struct {
	fv           reflect.Value
	inType       reflect.Type
	inValue      reflect.Value
	readFromBody bool
	cType        contentType
}

// ReqBodyHandler returns an HTTP Handler for function fn.
// If fn has an input type, it will try to decode the request body into the
// function's input type.
// If fn returns a non-nil error, the handler will use problem.Render.
// Please refer to funcParamType for the allowed function signature.
// The caller of this function should probably panic on the returned error, if
// any.
func ReqBodyHandler(fn interface{}, cType contentType) (http.Handler, error) {
	fv := reflect.ValueOf(fn)
	inType, err := funcParamType(fv)
	if err != nil {
		return nil, errors.Wrap(err, "parsing function prototype")
	}

	return &handler{fv, inType, reflect.Value{}, inType != nil, cType}, nil
}

// Handler returns an HTTP Handler for function fn.
// If fn returns a non-nil error, the handler will use problem.Render.
// Please refer to funcParamType for the allowed function signature.
// The caller of this function should probably panic on the returned error, if
// any.
func Handler(fn, param interface{}, cType contentType) (http.Handler, error) {
	fv := reflect.ValueOf(fn)
	inType, err := funcParamType(fv)
	if err != nil {
		return nil, errors.Wrap(err, "parsing function prototype")
	}

	var inValue reflect.Value
	if inType != nil {
		inValue = reflect.ValueOf(param)
	}

	return &handler{fv, inType, inValue, false, cType}, nil
}

func (h *handler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	res, err := h.executeFunc(ctx, req)
	if err != nil {
		problem.Render(ctx, w, err)
		return
	}

	Render(w, res, h.cType)
}

// executeFunc executes the function provided in the handler together with the
// provided param value, if any, in the handler.
func (h *handler) executeFunc(ctx context.Context, req *http.Request) (interface{}, error) {
	var a []reflect.Value
	a = append(a, reflect.ValueOf(ctx))
	if h.inType != nil {
		if h.readFromBody {
			inPtr := reflect.New(h.inType)
			err := read(req.Body, inPtr.Interface())
			if err != nil {
				return nil, err
			}
			a = append(a, inPtr.Elem())
		} else {
			a = append(a, h.inValue)
		}
	}

	var (
		res interface{}
		err error
	)
	rv := h.fv.Call(a)
	switch n := len(rv); {
	case n == 0:
		res = &DefaultResponse
	case n == 1:
		if h.fv.Type().Out(0).Implements(errorType) {
			res = &DefaultResponse
			err, _ = rv[0].Interface().(error)
		} else {
			res = rv[0].Interface()
		}
	case n == 2:
		res = rv[0].Interface()
		err, _ = rv[1].Interface().(error)
	}

	return res, err
}

// ExecuteFunc executes the fn with the param after checking whether the
// function signature is valid or not by calling Handler.
// The first return value is the result that fn returns.
// The second return value is a boolean indicating whether the caller should
// panic on the err or not. If it's true, it means the caller can process the
// error normally; if it's false, it means the caller should probably panic on
// the error.
// The third return value is an error either from Handler() or from fn, if any.
func ExecuteFunc(ctx context.Context, fn, param interface{}, cType contentType) (interface{}, bool, error) {
	dontPanic := true
	h, err := Handler(fn, param, cType)
	if err != nil {
		dontPanic = false
		return nil, dontPanic, err
	}

	res, err := h.(*handler).executeFunc(ctx, nil)
	return res, dontPanic, err
}

// funcParamType checks whether fv is valid. We only accept nonvariadic
// functions with certain signatures.
// The allowed function signature is as following:
//
//   func fn(ctx context.Context, an_optional_param) (at_most_two_return_values)
//
// The caller must provide a function with at least 1 input (request context)
// and up to 2 inputs, and up to 2 return values. If there are two return
// values, the second value has to be error type.
func funcParamType(fv reflect.Value) (reflect.Type, error) {
	ft := fv.Type()

	if ft.Kind() != reflect.Func || ft.IsVariadic() || ft.NumIn() > 2 || ft.NumIn() == 0 || !ft.In(0).Implements(contextType) {
		return nil, fmt.Errorf("%s must be nonvariadic func and has at most one parameter other than context", ft.String())
	}

	var paramType reflect.Type
	if ft.NumIn() == 2 {
		paramType = ft.In(1)
	}

	if n := ft.NumOut(); n == 2 && !ft.Out(1).Implements(errorType) {
		return nil, fmt.Errorf("%s: second return value must be an error", ft.String())
	} else if n > 2 {
		return nil, fmt.Errorf("%s can have at most two return values", ft.String())
	}

	return paramType, nil
}
