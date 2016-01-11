# Saltpack ASCII Armor Format

Like PGP, saltpack encrypted and signed messages are binary formats. We need to
wrap them in ASCII armor, to let people paste them into websites and apps that
handle text.

The main building block of this format is a generic bytes-to-characters
encoding, similar to Base64, which we call BaseX. We chose not to use Base64
mainly because we want to avoid special characters. You should be able to paste
an encoded message anywhere, without worrying about how punctuation is
interpreted. Lots of modern applications implement something like Markdown,
where they interpret slashes and underscores as italics and strip them out.
Even something as innocuous as `...` might turn into `…` and break decoding.

We define the BaseX encoding scheme below, in a way that's independent of any
particular alphabet or block size. For saltpack we then select a 62-character
alphabet (all the digits and letters, in ASCII order) and a 32-byte input block
size, which gives us 43-character output blocks and a packing efficiency of
74.42%, compared to Base64's 75%. Finally we specify how the decoder recognizes
the header and footer lines and strips whitespace.

Here's the saltpack armor encoding of the standard lorem ipsum paragraph:

> BEGIN SALTPACK MESSAGE.
>
> I7lAG9yMZ0wAqD2 sOUHnQz6NOuExga WMa8JagoXrIlXO2 cjZukM8JONusQT3 3n7d3nHge2n1aOU AXTTo779PYuO2y7 3We1xXJgVI16Zen TI6UInlynbr9grE zLzZUYe2MQQVEvH g9qDcgNZTKRq61a ynlZYjWZgascz7c 1tDL9iHQBHm3nHl Tsp9RK3xdPabaPU cTKXKxqb1yVd2GB s3dvZNk4QmoAf3L jeZlYvu0GgI7uno EykBRCBDUL8pN2H Lm2P0Lfg8gQdMfs 0jkvLKxuDTaWVvc CZ5l9VGP3pX6VM2 IRMZFIReCt3nv1a oDWMKNeebaEGPpS iXxWsVfZwqUK3K7 h2JMheWsYMsvWPX 8kR2WpulekKqPSH y2tt89L3Qh33RXI vJi305Lc91t7HjJ WQfYWNakquQnjf2 ljGQP9ZqJiRqNA4 3oGpAMOoDuWRSFk 7RdAFeVQDsSr1CD eIFiKcjbNZ6LILU 30a9hAJ9uB0cfVi GpCdR3svMw2Bysi Z5gj8lRqUOGgA57 GWSrfsLlMgZezGI yB0zNqX9SLSpIwI 9l8gOFgoj0BRPGU 0m7OqPgY3zCvlBH 1OmrwpAkA1Wv8.
>
> END SALTPACK MESSAGE.

## BaseX Encoding

The BaseX encoding scheme converts a block of bytes into a block of characters
in some alphabet. It's defined for any alphabet and block size. The goal of the
scheme is to work exactly like base conversion in normal arithmetic. To encode
a block of B bytes with an alphabet of length A:

1. Compute C, the length of the output character block. C is the smallest
   integer such that `256^B <= A^C`. (`^` means "to the power of" here and
   below.) The most direct way to compute C is `ceiling(B*8/log_2(A))`.
2. Interpret the bytes as a big-endian unsigned integer. For blocks longer than
   8 bytes, this usually requires a bignum library.
3. Convert that number into a list of C digits in base A, by repeatedly taking
   the remainder mod A and then dividing by A. Order the digits from most to
   least significant. There may be leading zeroes.
4. Map the digits into the letters in the target alphabet.

To decode a block of C characters with an alphabet of length A:

1. Compute B, the length of the output byte block. B is the largest integer
   such that `256^B <= A^C`. The most direct way to compute B is
   `floor(C*log_2(A)/8)`.
2. Using the alphabet, map the characters in the block into a list of base A
   digits.
3. Multiply those digits by successive powers of A, and sum them together into
   a number, with the leftmost digit being the most significant.
4. Serialize that number as a B-byte big-endian unsigned integer.

Note that unlike Base64, there is no special treatment of "short blocks". Any
block of any length gets encoded with the same rules. But like Base64, when you
use BaseX to encode a stream, you should select a fixed block size and chunk
your input into blocks of that size, with an optional short block at the end.

### Example

Here's an example using our familiar 10-character alphabet, where the letter
`0` is 0, the letter `1` is 1, and so on up to `9`. If we wanted to encode the
2-byte block 0x00ff in this alphabet, we'd do this:

1. Compute C, the length of the output character block. The largest possible
   2-byte value is 65535, so we'll need five decimal digits to represent two
   bytes.
2. Convert the bytes into number. The bytes 0x00ff, interpreted as a big-endian
   unsigned integer, equal 255.
3. Convert the number into digits. The five digit representation of 255, from
   most to least significant, is 0-0-2-5-5.
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

### Illegal Blocks

Any block of bytes is legal for encoding, but some blocks of characters are
illegal for decoding. Two errors can come up:

- The number encoded by the C characters might be too big to fit into B bytes.
  For example in the 10-character alphabet above, the string `70000` is
  illegal, because although 5 characters in that alphabet correspond to 2
  bytes, the number 70000 doesn't fit into 2 bytes.
- C might not be minimal for the corresponding B. For example, a 4-character
  block of digits is too small to encode 2 bytes, and 1 byte only requires 3
  characters, so 4-character blocks are illegal in a 10-character alphabet.

In both cases implementations should return errors, rather than confronting the
eternal mystery of what these blocks could mean.

### Efficient Block Sizes

To pick an efficient block size, it helps to make a table of B and C values,
using the formula for C from above:

    C = ceiling( B * 8 / log_2(A) )

Here's the table for a 62-character alphabet, showing only the block sizes
where efficiency goes up:

<table>
<tr>
  <td><strong>bytes</strong></td>
  <td><strong>characters</strong></td>
  <td><strong>efficiency</strong></td>
</tr>
<tr><td>1  </td> <td>2  </td> <td>50.00%</td></tr>
<tr><td>2  </td> <td>3  </td> <td>66.67%</td></tr>
<tr><td>5  </td> <td>7  </td> <td>71.43%</td></tr>
<tr><td>8  </td> <td>11 </td> <td>72.73%</td></tr>
<tr><td>11 </td> <td>15 </td> <td>73.33%</td></tr>
<tr><td>14 </td> <td>19 </td> <td>73.68%</td></tr>
<tr><td>17 </td> <td>23 </td> <td>73.91%</td></tr>
<tr><td>20 </td> <td>27 </td> <td>74.07%</td></tr>
<tr><td>23 </td> <td>31 </td> <td>74.19%</td></tr>
<tr><td>26 </td> <td>35 </td> <td>74.29%</td></tr>
<tr><td>29 </td> <td>39 </td> <td>74.36%</td></tr>
<tr><td>32 </td> <td>43 </td> <td>74.42%</td></tr>
<tr><td>227</td> <td>305</td> <td>74.43%</td></tr>
</table>


We can compare these efficiency figures to the theoretical maximum for a
62-character alphabet:

    max_efficiency = bits_per_char / bits_per_byte
                   = log_2(62) / 8
                   ≈ 0.7443

The table above helped us pick the 32-byte block size for saltpack. It hits an
efficiency sweet spot without being absurdly large.

### Comparison to Base64

If we use the [64-character Base64
alphabet](https://tools.ietf.org/html/rfc3548#section-3) with BaseX to encode a
block of 3 bytes, the resulting 4 characters are actually identical to the
Base64 encoding. However, the result is not the same for 1- or 2-byte blocks.
That's because when there are leftover bits in the encoding space, Base64
"leans left", [like this](https://en.wikipedia.org/wiki/Base64#Examples):

```
Input:                M      |       a
ASCII:               77      |      97
Bit pattern:  0 1 0 0 1 1 0 1 0 1 1 0 0 0 0 1 _ _
Digits:            19    |    22     |     4
Letters:            T    |     W     |     E
```

Note that the third output character above encodes two trailing bits that will
always be zero. In contrast, BaseX effectively "leans right", packing itself
into the least significant bits of the encoding space, and encoding two leading
bits that will always be zero:

```
Input:                    M      |       a
ASCII:                   77      |      97
Bit pattern:  _ _ 0 1 0 0 1 1 0 1 0 1 1 0 0 0 0 1
Digits:            4     |    53     |    33
Letters:            E    |     1     |     h
```

If Base64 compatibility were a goal, we could have added an extra encoding step
after converting the input bytes to an integer, where we bitshifted that
integer 2 places to the left. (For a 1-byte block, the equivalent would be 4
places to the left.) The general rule for all alphabets and block sizes
could've been to compute the number of "extra bits" available in the encoding
space and do this shift.

However, BaseX doesn't bother with this adjustment, for a few reasons:

- Theoretical Base64 compatiblity isn't worth very much if we don't use a
  64-character alphabet.
- Determining the number of bits to shift takes extra work and makes the
  implementation more complicated.
- Leaning right in the encoding space makes the output easier to eyeball.

The last point is clear when we look at how single-byte blocks are encoded. In
standard Base64, the bytes 0x00, 0x01, and 0x02 encode to `AA`, `AQ`, and `Ag`.
In the same alphabet, BaseX would encodes those bytes as `AA`, `AB`, and `AC`.
The 62-character saltpack alphabet starts with the ASCII numerals, so those
bytes encode to `00`, `01`, and `02`, which is even nicer.

### Comparison to Base85

Similarly, if we use a Base85 alphabet with BaseX to encode a 4-byte
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

We could've generalized this padding scheme to other bases and block sizes. We
would have to be careful with the padding characters, though. We'd want to
strip off as many output characters as possible without overflowing the padding
bytes, and at larger block sizes this is more than one-character-per-byte.
Computing the right number of characters to strip would have a similar shape to
the "extra bits" computation in the previous section.

As with the Base64-compatibility-shift, though, we avoid this sort of scheme
for BaseX. It would have the same drawbacks: limited value, extra complexity,
and a less intuitive encoded result. Also because we have no intention of
replicating the 4-zeroes special case (`z`), or the even-more-obscure 4-spaces
special case (`y`), we wouldn't be able to achieve Base85 decoding
compatibility anyway.

### Comparison to Base65536

[Base65536](https://www.npmjs.com/package/base65536) is an "encoding" that
tries to fit as much data as possible into a tweet. It works because Twitter's
140-character limit is defined over Unicode code points rather than actual
ecoded bytes. So by picking an alphabet of thousands of Unicode characters, we
can encode more than one byte per character. Base65535 is able to fit 255 bytes
into just 128 code points.

BaseX works over any alphabet, including long ones. Which leads us to wonder,
how long can a Twitter alphabet be? The [largest encodable Unicode code
point](https://en.wikipedia.org/wiki/Code_point) is 1,114,111 (U+10FFFF).
However, Twitter does [NFC Unicode
normalization](https://dev.twitter.com/overview/api/counting-characters), so we
have to be careful to avoid [code points that don't have the NFC_Quick_Check
property](http://www.unicode.org/Public/8.0.0/ucd/DerivedNormalizationProps.txt).
We also need to avoid certain [Unicode
categories](http://unicode.org/reports/tr44/#General_Category_Values): the
Control, Format, and Separator categories (because Twitter sometimes strips
them) and the Surrogate category (because it's [invalid in
UTF8](https://en.wikipedia.org/wiki/UTF-8#Invalid_code_points)). What's left,
if we didn't miss anything and until Twitter changes something, is [1,110,602
characters that can pass through a tweet
unscathed](https://gist.github.com/oconnor663/e9c878161e7a63517747#file-alphabet-txt).
How many bytes can we encode with that, if we use a 140-character block?

    B = floor( C * log_2(A) / 8 )
      = floor( 140 * log_2(1110602) / 8 )
      = 351

Here's a tweet [encoding the first 351 bytes of lorem
ipsum](https://twitter.com/oconnor663/status/680171387353448448).

## Framing the BaseX Payload

Before getting to the BaseX payload, the decoder parses the header and footer:

1. Collect input up to the first period, stripping any leading whitespace and
   `>` characters (for compatibility with email clients that use `>` for
   quoting). This is the header.
2. Assert that the header matches

   ```
   BEGIN ([a-zA-Z0-9]+ )?SALTPACK ([a-zA-Z0-9]+ )?MESSAGE.
   ```

   The first optional word is for an application name (like `KEYBASE`) and the
   second is for a message type (like `ENCRYPTED`).
3. Collect input up to the second period, stripping all whitespace and `>`
   characters. This is the payload. If the implementation is streaming, it may
   decode the payload before the following steps.
4. Collect input up to the third period, stripping any leading whitespace and
   `>` characters. This is the footer.
5. Assert that the footer matches the header, with `END` instead of `BEGIN`.

We use periods to delimit the header and footer to make parsing easier.
Although we've been careful to avoid special characters in the payload, we're
not worried about these periods getting garbled (into `…` for example), because
they only occur one at a time.

The payload is decoded like this:

1. Chunk the characters into blocks of 43. The last block may be short.
2. Decode each of these blocks with BaseX, using the 62-character alphabet
   `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz` (all the
   digits and letters, in ASCII order).

Since whitespace gets stripped, the encoder has some flexibility in formatting.
Our encoder emits a space every 15 characters and a newline every 200 words.
That's what felt nicest when we tested it in different terminals and messaging
apps. Because the decoder doesn't rely on this spacing, we can change it in the
future.

Note that the 15-character visible word boundaries are unrelated to the
43-character BaseX block boundaries. The visible words go away when we strip
whitespace.
