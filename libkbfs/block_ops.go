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
		if context.GetQuotaSize() != uint32(len(buf)) {
			err = &InconsistentByteCountError{
				ExpectedByteCount: int(context.GetQuotaSize()),
				ByteCount:         len(buf),
			}
			return
		}
		// decrypt the block and unmarshal it
		crypto := b.config.Crypto()
		var debuf []byte
		// TODO: use server-side block key half along with directory
		// secret key
		if debuf, err = crypto.Decrypt(buf, decryptKey); err == nil {
			if len(debuf) > len(buf) {
				err = &TooHighByteCountError{
					ExpectedMaxByteCount: len(buf),
					ByteCount:            len(debuf),
				}
				return
			}
			err = b.config.Codec().Decode(debuf, block)
		}
	}
	return
}

func (b *BlockOpsStandard) Ready(
	block Block, encryptKey Key) (id BlockId, plainSize int, buf []byte, err error) {
	// TODO: add padding
	// first marshal the block
	var plainbuf []byte
	if plainbuf, err = b.config.Codec().Encode(block); err != nil {
		return
	}

	// then encrypt it
	crypto := b.config.Crypto()
	// TODO: use server-side block key half along with directory
	// secret key
	var enbuf []byte
	if enbuf, err = crypto.Encrypt(plainbuf, encryptKey); err != nil {
		return
	}

	if len(enbuf) < len(plainbuf) {
		err = &TooLowByteCountError{
			ExpectedMinByteCount: len(plainbuf),
			ByteCount:            len(enbuf),
		}
		return
	}

	// now get the block ID for the buffer
	var h libkb.NodeHash
	if h, err = crypto.Hash(enbuf); err != nil {
		return
	}

	var nhs libkb.NodeHashShort
	var ok bool
	if nhs, ok = h.(libkb.NodeHashShort); !ok {
		err = &BadCryptoError{id}
		return
	}

	id = BlockId(nhs)
	plainSize = len(plainbuf)
	buf = enbuf
	return
}

func (b *BlockOpsStandard) Put(
	id BlockId, context BlockContext, buf []byte) (err error) {
	if context.GetQuotaSize() != uint32(len(buf)) {
		err = &InconsistentByteCountError{
			ExpectedByteCount: int(context.GetQuotaSize()),
			ByteCount:         len(buf),
		}
		return
	}
	bserv := b.config.BlockServer()
	err = bserv.Put(id, context, buf)
	return
}

func (b *BlockOpsStandard) Delete(id BlockId, context BlockContext) error {
	bserv := b.config.BlockServer()
	err := bserv.Delete(id, context)
	return err
}
