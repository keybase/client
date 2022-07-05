// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"strings"

	"github.com/keybase/saltpack/encoding/basex"
)

// armorParams specify armor formatting, encoding and punctuation.
type armorParams struct {
	// BytesPerWord is the number of characters in each "word" of output.
	// We'll put spaces between words.
	BytesPerWord int
	// WordsPerLine is the number of words for each line of output. We'll
	// put newlines between two subsequent lines of output.
	WordsPerLine int
	// Punctuation is the byte inserted after the three "sentences" of
	// our encoding -- the header, the body and the footer.
	Punctuation byte
	// Encoding is the basex encoding to use, including strictness parameters
	Encoding *basex.Encoding
}

type armorEncoderStream struct {
	buf     *bytes.Buffer
	footer  string
	encoded io.Writer
	encoder io.WriteCloser
	nWords  int
	params  armorParams
}

func (s *armorEncoderStream) Write(b []byte) (n int, err error) {
	n, err = s.encoder.Write(b)
	if err != nil {
		return n, err
	}
	if err := s.spaceAndOutputBuffer(); err != nil {
		return n, err
	}
	return n, nil
}

func (s *armorEncoderStream) spaceAndOutputBuffer() error {
	for s.buf.Len() > s.params.BytesPerWord {
		buf := s.buf.Next(s.params.BytesPerWord)
		s.nWords++
		sep := byte(' ')
		if s.nWords%s.params.WordsPerLine == 0 {
			sep = byte('\n')
		}
		if _, err := s.encoded.Write(buf); err != nil {
			return err
		}
		if _, err := s.encoded.Write([]byte{sep}); err != nil {
			return err
		}
	}
	return nil
}

func (s *armorEncoderStream) Close() (err error) {
	if err = s.encoder.Close(); err != nil {
		return err
	}
	if err := s.spaceAndOutputBuffer(); err != nil {
		return err
	}
	lst := s.buf.Bytes()
	if _, err := s.encoded.Write([]byte(lst)); err != nil {
		return err
	}
	s.nWords++
	pad := ""
	if len(lst) == s.params.BytesPerWord {
		if s.nWords%s.params.WordsPerLine == 0 {
			pad = "\n"
		} else {
			pad = " "
		}
	}
	if _, err := fmt.Fprintf(s.encoded, "%s%c %s%c\n", pad, s.params.Punctuation, s.footer, s.params.Punctuation); err != nil {
		return err
	}
	return nil
}

// newArmorEncoderStream makes a new Armor encoding stream, using the given encoding
// Pass it an `encoded` stream writer to write the
// encoded stream to.  Also pass a header, and a footer string.  It will
// return an io.WriteCloser on success, that you can write raw (unencoded) data to.
// An error will be returned if there is trouble writing the header to encoded.
//
// To make the output look pretty, a space is inserted every 15 characters of output,
// and a newline is inserted every 200 words.
func newArmorEncoderStream(encoded io.Writer, header string, footer string, params armorParams) (io.WriteCloser, error) {
	ret := &armorEncoderStream{
		buf:     new(bytes.Buffer),
		encoded: encoded,
		footer:  footer,
		params:  params,
	}
	ret.encoder = basex.NewEncoder(params.Encoding, ret.buf)
	if _, err := fmt.Fprintf(encoded, "%s%c ", header, params.Punctuation); err != nil {
		return nil, err
	}
	return ret, nil
}

// armorSeal takes an input plaintext and returns and output armor encoding
// as a string, or an error if a problem was encountered. Also provide a header
// and a footer to frame the message.
func armorSeal(plaintext []byte, header string, footer string, params armorParams) (string, error) {
	var buf bytes.Buffer
	enc, err := newArmorEncoderStream(&buf, header, footer, params)
	if err != nil {
		return "", err
	}
	if _, err := enc.Write(plaintext); err != nil {
		return "", err
	}
	if err := enc.Close(); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// Frame is a way to read the frame out of a Decoder stream.
type Frame interface {
	// GetHeader() returns the header of the frame associated with this stream, or an error
	GetHeader() (string, error)
	// GetFooter() returns the footer of the frame associated with this stream, or an error
	GetFooter() (string, error)
	// GetBrand() returns the brand contained in this frame's header, or an error
	GetBrand() (string, error)
}

type fdsState int

const (
	fdsHeader fdsState = iota
	fdsBody
	fdsFooter
	fdsEndOfStream
)

// HeaderChecker is a function intended to check that an header (the initial part of an armor
// before and not including the first punctuation) is valid. Optionally, it can return some
// information about such frame (tipycally the brand). If the frame is invalid, a non nil
// error should be returned.
type HeaderChecker func(header string) (string, error)

// FrameChecker is a function intended to check the frame of the armor is valid. Optionally,
// it can return some information about such frame (tipycally the brand). If the frame is invalid,
// a non nil error should be returned.
type FrameChecker func(header, footer string) (string, error)

type framedDecoderStream struct {
	header        []byte
	footer        []byte
	frameBrand    string
	state         fdsState
	params        armorParams
	r             *punctuatedReader
	headerChecker HeaderChecker
	frameChecker  FrameChecker
	frameLim      int // The largest frame we'll accept before we show an overflow.
}

func (s *framedDecoderStream) loadHeader() (err error) {
	if s.state == fdsHeader {
		s.header, err = s.r.ReadUntilPunctuation(s.frameLim)
		if err != nil {
			return err
		}
		if s.headerChecker != nil {
			headerStr, err := s.toASCII(s.header)
			if err != nil {
				return err
			}
			s.frameBrand, err = s.headerChecker(headerStr)
			if err != nil {
				return err
			}
		}
		s.state = fdsBody
	}
	return nil
}

// Read from a framedDeecoderStream. The frame is the "BEGIN FOO." block
// at the beginning, and the "END FOO." block at the end.
func (s *framedDecoderStream) Read(p []byte) (n int, err error) {

	if s.state == fdsHeader {
		err = s.loadHeader()
		if err != nil {
			return 0, err
		}
	}

	if s.state == fdsBody {
		n, err = s.r.Read(p)
		if err == ErrPunctuated {
			err = nil
			s.state = fdsFooter
		}
		if err == io.EOF {
			err = io.ErrUnexpectedEOF
		}
		if err != nil {
			return 0, err
		}
	}

	if s.state == fdsFooter {
		s.footer, err = s.r.ReadUntilPunctuation(s.frameLim)
		if err != nil {
			return 0, err
		}
		if s.frameChecker != nil {
			headerStr, err := s.toASCII(s.header)
			if err != nil {
				return 0, err
			}
			footerStr, err := s.toASCII(s.footer)
			if err != nil {
				return 0, err
			}
			if _, err = s.frameChecker(headerStr, footerStr); err != nil {
				return 0, err
			}
		}
		s.state = fdsEndOfStream
	}

	if s.state == fdsEndOfStream {
		err = s.consumeUntilEOF()
		if err == io.EOF && n > 0 {
			err = nil
		}
	}

	return n, err
}

// consume the stream until we hit an EOF. For all data we consume, make
// sure that it's a valid byte as far as our underlying decoder is concerned.
// We might considering clamping down here on the number of characters we're willing
// to accept after the message is over. But for now, we're quite liberal.
func (s *framedDecoderStream) consumeUntilEOF() error {
	var buf [4096]byte
	for {
		n, err := s.r.Read(buf[:])
		if err != nil {
			return err
		}
		if n == 0 {
			return io.EOF
		}
		if !s.isValidByteSequence(buf[0:n]) {
			return ErrTrailingGarbage
		}
	}
}

// isValidByteSequence checks if the byte sequence is valid as far as our
// underlying encoder is concerned.
func (s *framedDecoderStream) isValidByteSequence(p []byte) bool {
	for _, b := range p {
		if !s.params.Encoding.IsValidByte(b) {
			return false
		}
	}
	return true
}

func (s *framedDecoderStream) toASCII(buf []byte) (string, error) {
	if !s.isValidByteSequence(buf) {
		return "", makeErrBadFrame("invalid ASCII sequence")
	}
	return strings.TrimSpace(string(buf)), nil
}

func (s *framedDecoderStream) GetFooter() (string, error) {
	if s.state < fdsFooter {
		return "", fmt.Errorf("the footer can be retrieved only after the stream has been exhausted")
	}
	return s.toASCII(s.footer)
}

func (s *framedDecoderStream) GetHeader() (string, error) {
	if s.state == fdsHeader {
		if err := s.loadHeader(); err != nil {
			return "", err
		}
	}
	return s.toASCII(s.header)
}

func (s *framedDecoderStream) GetBrand() (string, error) {
	if s.state == fdsHeader {
		if err := s.loadHeader(); err != nil {
			return "", err
		}
	}
	return s.frameBrand, nil
}

// newArmorDecoderStream is used to decode armored encoding. It returns a stream you
// can read from, and also a Frame you can query to see what the open/close
// frame markers were. Note that the footer of the Frame can be accessed only after the
// reader has been exhausted.
func newArmorDecoderStream(r io.Reader, params armorParams, headerChecker HeaderChecker, frameChecker FrameChecker) (io.Reader, Frame, error) {
	fds := &framedDecoderStream{r: newPunctuatedReader(r, params.Punctuation), params: params, headerChecker: headerChecker, frameChecker: frameChecker, frameLim: 8192}
	ret := basex.NewDecoder(params.Encoding, fds)
	return ret, fds, nil
}

// armorOpen runs armor stream decoding, but on a string, and it outputs a string.
func armorOpen(msg string, params armorParams, headerChecker HeaderChecker, frameChecker FrameChecker) (body []byte, brand string, header string, footer string, err error) {
	var dec io.Reader
	var frame Frame
	buf := bytes.NewBufferString(msg)
	dec, frame, err = newArmorDecoderStream(buf, params, headerChecker, frameChecker)
	if err != nil {
		return
	}
	body, err = ioutil.ReadAll(dec)
	if err != nil {
		return
	}
	if header, err = frame.GetHeader(); err != nil {
		return
	}
	if footer, err = frame.GetFooter(); err != nil {
		return
	}
	if brand, err = frame.GetBrand(); err != nil {
		return
	}
	return body, brand, header, footer, nil
}
