package libkbfs

import (
	libkb "github.com/keybase/client/go/libkb"
)

type BlockOpsStandard struct {
	config Config
}

func (b *BlockOpsStandard) Get(
	id BlockId, context BlockContext, decryptKey Key, block Block) (
	err error) {
	bserv := b.config.BlockServer()
	// TODO: use server-side block key half along with directory
	// secret key
	var buf []byte
	if buf, err = bserv.Get(id, context); err == nil {
		// decrypt the block and unmarshal it
		crypto := b.config.Crypto()
		var debuf []byte
		// TODO: use server-side block key half along with directory
		// secret key
		if debuf, err = crypto.Decrypt(buf, decryptKey); err == nil {
			err = b.config.Codec().Decode(debuf, block)
		}
	}
	return
}

func (b *BlockOpsStandard) Ready(
	block Block, encryptKey Key) (id BlockId, buf []byte, err error) {
	// TODO: add padding
	// first marshal the block
	var plainbuf []byte
	if plainbuf, err = b.config.Codec().Encode(block); err == nil {
		// then encrypt it
		crypto := b.config.Crypto()
		// TODO: use server-side block key half along with directory
		// secret key
		var enbuf []byte
		if enbuf, err = crypto.Encrypt(plainbuf, encryptKey); err == nil {
			// now get the block ID for the buffer
			if h, err2 := crypto.Hash(enbuf); err2 != nil {
				return id, buf, err2
			} else if nhs, ok := h.(libkb.NodeHashShort); !ok {
				return id, buf, &BadCryptoError{id}
			} else {
				return BlockId(nhs), enbuf, nil
			}
		}
	}
	return
}

func (b *BlockOpsStandard) Put(
	id BlockId, context BlockContext, buf []byte) (err error) {
	bserv := b.config.BlockServer()
	err = bserv.Put(id, context, buf)
	return
}

func (b *BlockOpsStandard) Delete(id BlockId, context BlockContext) error {
	bserv := b.config.BlockServer()
	err := bserv.Delete(id, context)
	return err
}
