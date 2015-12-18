# SaltPack ASCII Armor Format

Like PGP, SaltPack encrypted and signed messages are binary formats. We need to
wrap them in an ASCII format, to let people paste them into websites and apps
that handle text.

The main building block of this format is a generic bytes-to-characters
encoding, similar to Base64, which we call Just Numbers. We chose not to use
Base64 mainly because we want to avoid special characters. You should be able
to paste an encoded message anywhere, without worrying about how punctuation is
interpreted. Lots of modern applications implement something like Markdown,
where they interpret slashes and underscores as italics and strip them out.
Even something as innocuous as `...` might turn into `…` and break decoding.

We define the Just Numbers encoding scheme below, in a way that's independent
of any particular alphabet or block size. For SaltPack we then select a
62-character alphabet (all the digits and letters, in ASCII order) and a
32-byte input block size to use with Just Numbers, which gives us a packing
efficiency of 74.42%, compared to Base64's 75%. Finally we design some rules
for spacing and delimiting the output, to make it look nice.

Here's the SaltPack armor encoding of the standard lorem ipsum paragraph:

BEGIN ARMOR.
I7lAG9yMZ0wAqD2 sOUHnQz6NOuExga WMa8JagoXrIlXO2 cjZukM8JONusQT3 3n7d3nHge2n1aOU AXTTo779PYuO2y7 3We1xXJgVI16Zen TI6UInlynbr9grE zLzZUYe2MQQVEvH g9qDcgNZTKRq61a ynlZYjWZgascz7c 1tDL9iHQBHm3nHl Tsp9RK3xdPabaPU cTKXKxqb1yVd2GB s3dvZNk4QmoAf3L jeZlYvu0GgI7uno EykBRCBDUL8pN2H Lm2P0Lfg8gQdMfs 0jkvLKxuDTaWVvc CZ5l9VGP3pX6VM2 IRMZFIReCt3nv1a oDWMKNeebaEGPpS iXxWsVfZwqUK3K7 h2JMheWsYMsvWPX 8kR2WpulekKqPSH y2tt89L3Qh33RXI vJi305Lc91t7HjJ WQfYWNakquQnjf2 ljGQP9ZqJiRqNA4 3oGpAMOoDuWRSFk 7RdAFeVQDsSr1CD eIFiKcjbNZ6LILU 30a9hAJ9uB0cfVi GpCdR3svMw2Bysi Z5gj8lRqUOGgA57 GWSrfsLlMgZezGI yB0zNqX9SLSpIwI 9l8gOFgoj0BRPGU 0m7OqPgY3zCvlBH 1OmrwpAkA1Wv8.
END ARMOR.

## Spacing and Delimiting

The decoder has two pre-processing steps:

1. Drop input up to the first period and after the second period. (Note that
   the second period in the example above comes right *before* "END ARMOR". The
   final period is ignored.)
2. Strip all whitespace.

That gives the encoder some flexibility in formatting. The header and footer
can be anything, as long as the header ends with a period and there's a period
before the footer. Also the word and line spacing can be anything.

Our encoder emits a space every 15 characters and a newline every 200 words.
That's what felt nicest when we tried it with different terminals and messaging
apps. But since our decoder doesn't rely on this spacing, we can change it in
the future.

Note that with the 62-character alphabet we've chosen, the underlying Just
Numbers encoding will turn 32-byte input blocks into 43-character output
blocks. This is unrelated to the 15-character visible word length in our
output; those visible words boundaries go away when we strip whitespace.

## The Just Numbers Encoding

The Just Numbers encoding scheme converts a block of bytes into a block of
characters in some alphabet. It's defined for any alphabet and block size. The
goal of the scheme is to work exactly like base conversion in normal
arithmetic. To encode a block of B bytes with an alphabet of length A:

1. Compute C, the length of the output character block. C is the smallest
   integer such that `256^B <= A^C`.
2. Interpret the byte block as a big-endian unsigned integer. For blocks longer
   than 8 bytes, this usually requires a bignum library.
3. Convert that number into a list of C digits in base A, by repeatedly taking
   the remainder mod A and then dividing by A. Order the digits from most to
   least significant. There may be leading zeroes.
4. Map the digits into the letters in the target alphabet.

To decode a block of C characters with an alphabet of length A:

1. Compute B, the length of the output byte block. B is the largest integer
   such that `256^B <= A^C`.
2. Using the alphabet, map the characters in the block into a list of base A
   digits.
3. Multiply those digits by successive powers of A, and sum them together into
   a number, with the leftmost digit being the most significant.
4. Serialize that number as a B-byte big-endian unsigned integer.

Note that unlike Base64 and Base85, there is no special treatment of "short
blocks". Any block of any length can be encoded. It's the responsibility of the
caller to chunk input into fixed-length blocks, and to choose an alphabet and
block size that make the packing efficient. (The efficiency of a given block
size is `B/C`.)

### Example

Here's an example using our familiar 10-character alphabet, where the letter
`0` is 0, the letter `1` is 1, and so on up to `9`. If we wanted to encode the
2-byte value 0x00ff with this alphabet, we'd do this:

1. Compute C, the length of the output character block. The largest possible
   2-byte value is 65535, so we'll need five decimal digits to represent two
   bytes.
2. Convert the bytes into number. The bytes 0x00ff, interpreted as a big-endian
   unsigned integer, equal 255.
3. Convert the number into digits. The five digit big-endian representation of
   255 is 0-0-2-5-5.
4. Map the digits into letters. In this simple alphabet, the result is `00255`.

To decode `00255` back into bytes, we'd do this:

1. Compute B, the length of the output byte block. The largest possible value
   we can represent in five characters of our alphabet is 99999. That's enough
   for two bytes (max 65535) but not enough for three bytes (max 16777215), so
   B is 2.
2. Map the alphabet characters into a list of numbers. `00255` becomes
   0-0-2-5-5.
3. Sum the digits into a single number. We compute `0*10000 + 0*1000 + 2*100 +
   5*10 + 5` and get 255.
4. Serialize the number into B big-endian unsigned bytes. The number 255 as a
   2-byte big-endian unsigned integer is 0x00ff.

### Comparison to Base64

If we use the [64-character Base64
alphabet](https://tools.ietf.org/html/rfc3548#section-3) with Just Numbers to
encode a block of 3 bytes, the resulting 4 characters are actually identical to
the Base64 encoding. However, the result is not the same for 1- or 2-byte
blocks. That's because when there are leftover bits in the encoding space,
Base64 "leans left", [like
this](https://en.wikipedia.org/wiki/Base64#Examples):

```
Input:                M      |       a
ASCII:               77      |      97
Bit pattern:  0 1 0 0 1 1 0 1 0 1 1 0 0 0 0 1 _ _
Digits:            19    |    22     |     4
Letters:            T    |     W     |     E
```

Note that the third output character above encodes two trailing bits that will
always be zero. In contrast, Just Numbers effectively "leans right", packing
itself into the least significant bits of the encoding space, and encoding two
leading bits that will always be zero:

```
Input:                    M      |       a
ASCII:                   77      |      97
Bit pattern:  _ _ 0 1 0 0 1 1 0 1 0 1 1 0 0 0 0 1
Digits:            4     |    53     |    33
Letters:            E    |     1     |     h
```

If Base64 compatibility were a goal, we could have added an extra encoding step
after converting the input bytes to an integer, where we bitshifted that
integer to the left by 2. (Decoding would then need to shift 2 places back to
the right.) The general rule for any base could have been to compute the number
of "extra bits" available in the encoding space and then to do this shift.

However, Just Numbers doesn't bother with this adjustment, for a few reasons:

- Theoretical Base64 compatiblity isn't worth very much if we don't plan on
  using a 64-character alphabet.
- Determining the number of bits to shift takes extra work and makes the
  implementation more complicated.
- Leaning right in the encoding space makes the output easier to eyeball.

The last point is clear when we look at how single-byte blocks are encoded. In
standard Base64, the bytes 0x00, 0x01, and 0x02 encode to `AA`, `AQ`, and `Ag`.
Using the same alphabet, Just Numbers encodes those bytes as `AA`, `AB`, and
`AC`. The 62-character SaltPack armor alphabet starts with the ASCII numerals,
so those bytes encode to `00`, `01`, and `02`, which is even nicer.

### Comparison to Base85

Similarly, if we use a Base85 alphabet with Just Numbers to encode a 4-byte
block, the result turns out exactly the same as the Base85 encoding of that
block. (Except the block of all zeroes, which some Base85 encodings represent
with `z` as a special case.) But also like Base64, the result is different for
short blocks.

In variants that support short blocks, Base85 encoding pads a short byte block
with zero bytes, and then strips the same number of extra characters off the
end of the encoded string. That much is exactly like Base64. However unlike
Base64, because 85 is not a power of 2, the stripped characters are not
guaranteed to be zero digits. For decoding, Base85 pads the short character
block with `u`, the highest digit in the alphabet. The resulting number is
generally larger than what was encoded, but the difference is guaranteed not to
overflow the extra zero bytes. (There are as many padding bytes as there are
padding digits, and the digits only go up to 84.) So when the padding bytes are
stripped, what's left ends up being the same as what was encoded.

We could have generalized this padding scheme to bases besides 85. We would
have to be careful with the padding characters, though. We'd want to strip off
as many output characters as possible without overflowing the padding bytes,
and at larger block sizes this is more than one-character-per-byte. Computing
the right number of characters to strip would have a similar shape to the
"extra bits" computation in the previous section.

As with the Base64-compatibility-shift, though, we avoid this sort of scheme
for Just Numbers. It would have the same drawbacks: limited value, extra
complexity, and a less intuitive encoded result. Also becase we have no
intention of replicating the four-zeroes special case (`z`), or the even more
obscure four-spaces special case (`y`), we wouldn't be able to achieve Base85
decoding compatibility anyway.
