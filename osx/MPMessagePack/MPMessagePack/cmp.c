#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "cmp.h"

static const uint32_t version = 10;
static const uint32_t mp_version = 5;

enum {
  POSITIVE_FIXNUM_MARKER = 0x00,
  FIXMAP_MARKER          = 0x80,
  FIXARRAY_MARKER        = 0x90,
  FIXSTR_MARKER          = 0xA0,
  NIL_MARKER             = 0xC0,
  FALSE_MARKER           = 0xC2,
  TRUE_MARKER            = 0xC3,
  BIN8_MARKER            = 0xC4,
  BIN16_MARKER           = 0xC5,
  BIN32_MARKER           = 0xC6,
  EXT8_MARKER            = 0xC7,
  EXT16_MARKER           = 0xC8,
  EXT32_MARKER           = 0xC9,
  FLOAT_MARKER           = 0xCA,
  DOUBLE_MARKER          = 0xCB,
  U8_MARKER              = 0xCC,
  U16_MARKER             = 0xCD,
  U32_MARKER             = 0xCE,
  U64_MARKER             = 0xCF,
  S8_MARKER              = 0xD0,
  S16_MARKER             = 0xD1,
  S32_MARKER             = 0xD2,
  S64_MARKER             = 0xD3,
  FIXEXT1_MARKER         = 0xD4,
  FIXEXT2_MARKER         = 0xD5,
  FIXEXT4_MARKER         = 0xD6,
  FIXEXT8_MARKER         = 0xD7,
  FIXEXT16_MARKER        = 0xD8,
  STR8_MARKER            = 0xD9,
  STR16_MARKER           = 0xDA,
  STR32_MARKER           = 0xDB,
  ARRAY16_MARKER         = 0xDC,
  ARRAY32_MARKER         = 0xDD,
  MAP16_MARKER           = 0xDE,
  MAP32_MARKER           = 0xDF,
  NEGATIVE_FIXNUM_MARKER = 0xE0
};

enum {
  FIXARRAY_SIZE        = 0xF,
  FIXMAP_SIZE          = 0xF,
  FIXSTR_SIZE          = 0x1F
};

enum {
  ERROR_NONE,
  STR_DATA_LENGTH_TOO_LONG_ERROR,
  BIN_DATA_LENGTH_TOO_LONG_ERROR,
  ARRAY_LENGTH_TOO_LONG_ERROR,
  MAP_LENGTH_TOO_LONG_ERROR,
  INPUT_VALUE_TOO_LARGE_ERROR,
  FIXED_VALUE_WRITING_ERROR,
  TYPE_MARKER_READING_ERROR,
  TYPE_MARKER_WRITING_ERROR,
  DATA_READING_ERROR,
  DATA_WRITING_ERROR,
  EXT_TYPE_READING_ERROR,
  EXT_TYPE_WRITING_ERROR,
  INVALID_TYPE_ERROR,
  LENGTH_READING_ERROR,
  LENGTH_WRITING_ERROR,
  ERROR_MAX
};

const char *cmp_error_messages[ERROR_MAX + 1] = {
  "No Error",
  "Specified string data length is too long (> 0xFFFFFFFF)",
  "Specified binary data length is too long (> 0xFFFFFFFF)",
  "Specified array length is too long (> 0xFFFFFFFF)",
  "Specified map length is too long (> 0xFFFFFFFF)",
  "Input value is too large",
  "Error writing fixed value",
  "Error reading type marker",
  "Error writing type marker",
  "Error reading packed data",
  "Error writing packed data",
  "Error reading ext type",
  "Error writing ext type",
  "Invalid type",
  "Error reading size",
  "Error writing size",
  "Max Error"
};

static const int32_t _i = 1;
#define is_bigendian() ((*(char *)&_i) == 0)

static uint16_t be16(uint16_t x) {
  char *b = (char *)&x;
  
  if (!is_bigendian()) {
    char swap = 0;
    
    swap = b[0];
    b[0] = b[1];
    b[1] = swap;
  }
  
  return x;
}

static uint32_t be32(uint32_t x) {
  char *b = (char *)&x;
  
  if (!is_bigendian()) {
    char swap = 0;
    
    swap = b[0];
    b[0] = b[3];
    b[3] = swap;
    
    swap = b[1];
    b[1] = b[2];
    b[2] = swap;
  }
  
  return x;
}

static uint64_t be64(uint64_t x) {
  char *b = (char *)&x;
  
  if (!is_bigendian()) {
    char swap = 0;
    
    swap = b[0];
    b[0] = b[7];
    b[7] = swap;
    
    swap = b[1];
    b[1] = b[6];
    b[6] = swap;
    
    swap = b[2];
    b[2] = b[5];
    b[5] = swap;
    
    swap = b[3];
    b[3] = b[4];
    b[4] = swap;
  }
  
  return x;
}

static float befloat(float x) {
  char *b = (char *)&x;
  
  if (!is_bigendian()) {
    char swap = 0;
    
    swap = b[0];
    b[0] = b[3];
    b[3] = swap;
    
    swap = b[1];
    b[1] = b[2];
    b[2] = swap;
  }
  
  return x;
}

static double bedouble(double x) {
  char *b = (char *)&x;
  
  if (!is_bigendian()) {
    char swap = 0;
    
    swap = b[0];
    b[0] = b[7];
    b[7] = swap;
    
    swap = b[1];
    b[1] = b[6];
    b[6] = swap;
    
    swap = b[2];
    b[2] = b[5];
    b[5] = swap;
    
    swap = b[3];
    b[3] = b[4];
    b[4] = swap;
  }
  
  return x;
}

static bool read_byte(cmp_ctx_t *ctx, uint8_t *x) {
  return ctx->read(ctx, x, sizeof(uint8_t));
}

static bool write_byte(cmp_ctx_t *ctx, uint8_t x) {
  return (ctx->write(ctx, &x, sizeof(uint8_t)) == (sizeof(uint8_t)));
}

static bool read_type_marker(cmp_ctx_t *ctx, uint8_t *marker) {
  if (read_byte(ctx, marker))
    return true;
  
  ctx->error = TYPE_MARKER_READING_ERROR;
  return false;
}

static bool write_type_marker(cmp_ctx_t *ctx, uint8_t marker) {
  if (write_byte(ctx, marker))
    return true;
  
  ctx->error = TYPE_MARKER_WRITING_ERROR;
  return false;
}

static bool write_fixed_value(cmp_ctx_t *ctx, uint8_t value) {
  if (write_byte(ctx, value))
    return true;
  
  ctx->error = FIXED_VALUE_WRITING_ERROR;
  return false;
}

void cmp_init(cmp_ctx_t *ctx, void *buf, cmp_reader read, cmp_writer write) {
  ctx->error = ERROR_NONE;
  ctx->buf = buf;
  ctx->read = read;
  ctx->write = write;
}

uint32_t cmp_version(void) {
  return version;
}

uint32_t cmp_mp_version(void) {
  return mp_version;
}

const char* cmp_strerror(cmp_ctx_t *ctx) {
  if (ctx->error > ERROR_NONE && ctx->error < ERROR_MAX)
    return cmp_error_messages[ctx->error];
  
  return "";
}

bool cmp_write_pfix(cmp_ctx_t *ctx, uint8_t c) {
  if (c <= 0x7F)
    return write_fixed_value(ctx, c);
  
  ctx->error = INPUT_VALUE_TOO_LARGE_ERROR;
  return false;
}

bool cmp_write_nfix(cmp_ctx_t *ctx, int8_t c) {
  if (c >= -32 && c <= -1)
    return write_fixed_value(ctx, c);
  
  ctx->error = INPUT_VALUE_TOO_LARGE_ERROR;
  return false;
}

bool cmp_write_sfix(cmp_ctx_t *ctx, int8_t c) {
  if (c >= 0)
    return cmp_write_pfix(ctx, c);
  if (c >= -32 && c <= -1)
    return cmp_write_nfix(ctx, c);
  
  ctx->error = INPUT_VALUE_TOO_LARGE_ERROR;
  return false;
}

bool cmp_write_s8(cmp_ctx_t *ctx, int8_t c) {
  if (!write_type_marker(ctx, S8_MARKER))
    return false;
  
  return ctx->write(ctx, &c, sizeof(int8_t));
}

bool cmp_write_s16(cmp_ctx_t *ctx, int16_t s) {
  if (!write_type_marker(ctx, S16_MARKER))
    return false;
  
  s = be16(s);
  
  return ctx->write(ctx, &s, sizeof(int16_t));
}

bool cmp_write_s32(cmp_ctx_t *ctx, int32_t i) {
  if (!write_type_marker(ctx, S32_MARKER))
    return false;
  
  i = be32(i);
  
  return ctx->write(ctx, &i, sizeof(int32_t));
}

bool cmp_write_s64(cmp_ctx_t *ctx, int64_t l) {
  if (!write_type_marker(ctx, S64_MARKER))
    return false;
  
  l = be64(l);
  
  return ctx->write(ctx, &l, sizeof(int64_t));
}

bool cmp_write_sint(cmp_ctx_t *ctx, int64_t d) {
  if (d >= 0)
    return cmp_write_uint(ctx, d);
  if (d >= -32)
    return cmp_write_nfix(ctx, d);
  if (d >= -128)
    return cmp_write_s8(ctx, d);
  if (d >= -32768)
    return cmp_write_s16(ctx, d);
  if (d >= (-2147483647 - 1))
    return cmp_write_s32(ctx, (int32_t)d);
  
  return cmp_write_s64(ctx, d);
}

bool cmp_write_ufix(cmp_ctx_t *ctx, uint8_t c) {
  return cmp_write_pfix(ctx, c);
}

bool cmp_write_u8(cmp_ctx_t *ctx, uint8_t c) {
  if (!write_type_marker(ctx, U8_MARKER))
    return false;
  
  return ctx->write(ctx, &c, sizeof(uint8_t));
}

bool cmp_write_u16(cmp_ctx_t *ctx, uint16_t s) {
  if (!write_type_marker(ctx, U16_MARKER))
    return false;
  
  s = be16(s);
  
  return ctx->write(ctx, &s, sizeof(uint16_t));
}

bool cmp_write_u32(cmp_ctx_t *ctx, uint32_t i) {
  if (!write_type_marker(ctx, U32_MARKER))
    return false;
  
  i = be32(i);
  
  return ctx->write(ctx, &i, sizeof(uint32_t));
}

bool cmp_write_u64(cmp_ctx_t *ctx, uint64_t l) {
  if (!write_type_marker(ctx, U64_MARKER))
    return false;
  
  l = be64(l);
  
  return ctx->write(ctx, &l, sizeof(uint64_t));
}

bool cmp_write_uint(cmp_ctx_t *ctx, uint64_t u) {
  if (u <= 0x7F)
    return cmp_write_pfix(ctx, u);
  if (u <= 0xFF)
    return cmp_write_u8(ctx, u);
  if (u <= 0xFFFF)
    return cmp_write_u16(ctx, u);
  if (u <= 0xFFFFFFFF)
    return cmp_write_u32(ctx, (uint32_t)u);
  
  return cmp_write_u64(ctx, u);
}

bool cmp_write_float(cmp_ctx_t *ctx, float f) {
  if (!write_type_marker(ctx, FLOAT_MARKER))
    return false;
  
  f = befloat(f);
  
  return ctx->write(ctx, &f, sizeof(float));
}

bool cmp_write_double(cmp_ctx_t *ctx, double d) {
  if (!write_type_marker(ctx, DOUBLE_MARKER))
    return false;
  
  d = bedouble(d);
  
  return ctx->write(ctx, &d, sizeof(double));
}

bool cmp_write_nil(cmp_ctx_t *ctx) {
  return write_type_marker(ctx, NIL_MARKER);
}

bool cmp_write_true(cmp_ctx_t *ctx) {
  return write_type_marker(ctx, TRUE_MARKER);
}

bool cmp_write_false(cmp_ctx_t *ctx) {
  return write_type_marker(ctx, FALSE_MARKER);
}

bool cmp_write_bool(cmp_ctx_t *ctx, bool b) {
  if (b)
    return cmp_write_true(ctx);
  
  return cmp_write_false(ctx);
}

bool cmp_write_u8_as_bool(cmp_ctx_t *ctx, uint8_t b) {
  if (b)
    return cmp_write_true(ctx);
  
  return cmp_write_false(ctx);
}

bool cmp_write_fixstr_marker(cmp_ctx_t *ctx, uint8_t size) {
  if (size <= FIXSTR_SIZE)
    return write_fixed_value(ctx, FIXSTR_MARKER | size);
  
  ctx->error = INPUT_VALUE_TOO_LARGE_ERROR;
  return false;
}

bool cmp_write_fixstr(cmp_ctx_t *ctx, const char *data, uint8_t size) {
  if (!cmp_write_fixstr_marker(ctx, size))
    return false;
  
  if (size == 0)
    return true;
  
  if (ctx->write(ctx, data, size))
    return true;
  
  ctx->error = DATA_WRITING_ERROR;
  return false;
}

bool cmp_write_str8_marker(cmp_ctx_t *ctx, uint8_t size) {
  if (!write_type_marker(ctx, STR8_MARKER))
    return false;
  
  if (ctx->write(ctx, &size, sizeof(uint8_t)))
    return true;
  
  ctx->error = LENGTH_WRITING_ERROR;
  return false;
}

bool cmp_write_str8(cmp_ctx_t *ctx, const char *data, uint8_t size) {
  if (!cmp_write_str8_marker(ctx, size))
    return false;
  
  if (size == 0)
    return true;
  
  if (ctx->write(ctx, data, size))
    return true;
  
  ctx->error = DATA_WRITING_ERROR;
  return false;
}

bool cmp_write_str16_marker(cmp_ctx_t *ctx, uint16_t size) {
  if (!write_type_marker(ctx, STR16_MARKER))
    return false;
  
  size = be16(size);
  
  if (ctx->write(ctx, &size, sizeof(uint16_t)))
    return true;
  
  ctx->error = LENGTH_WRITING_ERROR;
  return false;
}

bool cmp_write_str16(cmp_ctx_t *ctx, const char *data, uint16_t size) {
  if (!cmp_write_str16_marker(ctx, size))
    return false;
  
  if (size == 0)
    return true;
  
  if (ctx->write(ctx, data, size))
    return true;
  
  ctx->error = DATA_WRITING_ERROR;
  return false;
}

bool cmp_write_str32_marker(cmp_ctx_t *ctx, uint32_t size) {
  if (!write_type_marker(ctx, STR32_MARKER))
    return false;
  
  size = be32(size);
  
  if (ctx->write(ctx, &size, sizeof(uint32_t)))
    return true;
  
  ctx->error = LENGTH_WRITING_ERROR;
  return false;
}

bool cmp_write_str32(cmp_ctx_t *ctx, const char *data, uint32_t size) {
  if (!cmp_write_str32_marker(ctx, size))
    return false;
  
  if (size == 0)
    return true;
  
  if (ctx->write(ctx, data, size))
    return true;
  
  ctx->error = DATA_WRITING_ERROR;
  return false;
}

bool cmp_write_str_marker(cmp_ctx_t *ctx, uint32_t size) {
  if (size <= FIXSTR_SIZE)
    return cmp_write_fixstr_marker(ctx, size);
  if (size <= 0xFF)
    return cmp_write_str8_marker(ctx, size);
  if (size <= 0xFFFF)
    return cmp_write_str16_marker(ctx, size);
  
  return cmp_write_str32_marker(ctx, size);
}

bool cmp_write_str(cmp_ctx_t *ctx, const char *data, uint32_t size) {
  if (size <= FIXSTR_SIZE)
    return cmp_write_fixstr(ctx, data, size);
  if (size <= 0xFF)
    return cmp_write_str8(ctx, data, size);
  if (size <= 0xFFFF)
    return cmp_write_str16(ctx, data, size);
  
  return cmp_write_str32(ctx, data, size);
}

bool cmp_write_bin8_marker(cmp_ctx_t *ctx, uint8_t size) {
  if (!write_type_marker(ctx, BIN8_MARKER))
    return false;
  
  if (ctx->write(ctx, &size, sizeof(uint8_t)))
    return true;
  
  ctx->error = LENGTH_WRITING_ERROR;
  return false;
}

bool cmp_write_bin8(cmp_ctx_t *ctx, const void *data, uint8_t size) {
  if (!cmp_write_bin8_marker(ctx, size))
    return false;
  
  if (size == 0)
    return true;
  
  if (ctx->write(ctx, data, size))
    return true;
  
  ctx->error = DATA_WRITING_ERROR;
  return false;
}

bool cmp_write_bin16_marker(cmp_ctx_t *ctx, uint16_t size) {
  if (!write_type_marker(ctx, BIN16_MARKER))
    return false;
  
  size = be16(size);
  
  if (ctx->write(ctx, &size, sizeof(uint16_t)))
    return true;
  
  ctx->error = LENGTH_WRITING_ERROR;
  return false;
}

bool cmp_write_bin16(cmp_ctx_t *ctx, const void *data, uint16_t size) {
  if (!cmp_write_bin16_marker(ctx, size))
    return false;
  
  if (size == 0)
    return true;
  
  if (ctx->write(ctx, data, size))
    return true;
  
  ctx->error = DATA_WRITING_ERROR;
  return false;
}

bool cmp_write_bin32_marker(cmp_ctx_t *ctx, uint32_t size) {
  if (!write_type_marker(ctx, BIN32_MARKER))
    return false;
  
  size = be32(size);
  
  if (ctx->write(ctx, &size, sizeof(uint32_t)))
    return true;
  
  ctx->error = LENGTH_WRITING_ERROR;
  return false;
}

bool cmp_write_bin32(cmp_ctx_t *ctx, const void *data, uint32_t size) {
  if (!cmp_write_bin32_marker(ctx, size))
    return false;
  
  if (size == 0)
    return true;
  
  if (ctx->write(ctx, data, size))
    return true;
  
  ctx->error = DATA_WRITING_ERROR;
  return false;
}

bool cmp_write_bin_marker(cmp_ctx_t *ctx, uint32_t size) {
  if (size <= 0xFF)
    return cmp_write_bin8_marker(ctx, size);
  if (size <= 0xFFFF)
    return cmp_write_bin16_marker(ctx, size);
  
  return cmp_write_bin32_marker(ctx, size);
}

bool cmp_write_bin(cmp_ctx_t *ctx, const void *data, uint32_t size) {
  if (size <= 0xFF)
    return cmp_write_bin8(ctx, data, size);
  if (size <= 0xFFFF)
    return cmp_write_bin16(ctx, data, size);
  
  return cmp_write_bin32(ctx, data, size);
}

bool cmp_write_fixarray(cmp_ctx_t *ctx, uint8_t size) {
  if (size <= FIXARRAY_SIZE)
    return write_fixed_value(ctx, FIXARRAY_MARKER | size);
  
  ctx->error = INPUT_VALUE_TOO_LARGE_ERROR;
  return false;
}

bool cmp_write_array16(cmp_ctx_t *ctx, uint16_t size) {
  if (!write_type_marker(ctx, ARRAY16_MARKER))
    return false;
  
  size = be16(size);
  
  if (ctx->write(ctx, &size, sizeof(uint16_t)))
    return true;
  
  ctx->error = LENGTH_WRITING_ERROR;
  return false;
}

bool cmp_write_array32(cmp_ctx_t *ctx, uint32_t size) {
  if (!write_type_marker(ctx, ARRAY32_MARKER))
    return false;
  
  size = be32(size);
  
  if (ctx->write(ctx, &size, sizeof(uint32_t)))
    return true;
  
  ctx->error = LENGTH_WRITING_ERROR;
  return false;
}

bool cmp_write_array(cmp_ctx_t *ctx, uint32_t size) {
  if (size <= FIXARRAY_SIZE)
    return cmp_write_fixarray(ctx, size);
  if (size <= 0xFFFF)
    return cmp_write_array16(ctx, size);
  
  return cmp_write_array32(ctx, size);
}

bool cmp_write_fixmap(cmp_ctx_t *ctx, uint8_t size) {
  if (size <= FIXMAP_SIZE)
    return write_fixed_value(ctx, FIXMAP_MARKER | size);
  
  ctx->error = INPUT_VALUE_TOO_LARGE_ERROR;
  return false;
}

bool cmp_write_map16(cmp_ctx_t *ctx, uint16_t size) {
  if (!write_type_marker(ctx, MAP16_MARKER))
    return false;
  
  size = be16(size);
  
  if (ctx->write(ctx, &size, sizeof(uint16_t)))
    return true;
  
  ctx->error = LENGTH_WRITING_ERROR;
  return false;
}

bool cmp_write_map32(cmp_ctx_t *ctx, uint32_t size) {
  if (!write_type_marker(ctx, MAP32_MARKER))
    return false;
  
  size = be32(size);
  
  if (ctx->write(ctx, &size, sizeof(uint32_t)))
    return true;
  
  ctx->error = LENGTH_WRITING_ERROR;
  return false;
}

bool cmp_write_map(cmp_ctx_t *ctx, uint32_t size) {
  if (size <= FIXMAP_SIZE)
    return cmp_write_fixmap(ctx, size);
  if (size <= 0xFFFF)
    return cmp_write_map16(ctx, size);
  
  return cmp_write_map32(ctx, size);
}

bool cmp_write_fixext1_marker(cmp_ctx_t *ctx, int8_t type) {
  if (!write_type_marker(ctx, FIXEXT1_MARKER))
    return false;
  
  if (ctx->write(ctx, &type, sizeof(int8_t)))
    return true;
  
  ctx->error = EXT_TYPE_WRITING_ERROR;
  return false;
}

bool cmp_write_fixext1(cmp_ctx_t *ctx, int8_t type, const void *data) {
  if (!cmp_write_fixext1_marker(ctx, type))
    return false;
  
  if (ctx->write(ctx, data, 1))
    return true;
  
  ctx->error = DATA_WRITING_ERROR;
  return false;
}

bool cmp_write_fixext2_marker(cmp_ctx_t *ctx, int8_t type) {
  if (!write_type_marker(ctx, FIXEXT2_MARKER))
    return false;
  
  if (ctx->write(ctx, &type, sizeof(int8_t)))
    return true;
  
  ctx->error = EXT_TYPE_WRITING_ERROR;
  return false;
}

bool cmp_write_fixext2(cmp_ctx_t *ctx, int8_t type, const void *data) {
  if (!cmp_write_fixext2_marker(ctx, type))
    return false;
  
  if (ctx->write(ctx, data, 2))
    return true;
  
  ctx->error = DATA_WRITING_ERROR;
  return false;
}

bool cmp_write_fixext4_marker(cmp_ctx_t *ctx, int8_t type) {
  if (!write_type_marker(ctx, FIXEXT4_MARKER))
    return false;
  
  if (ctx->write(ctx, &type, sizeof(int8_t)))
    return true;
  
  ctx->error = EXT_TYPE_WRITING_ERROR;
  return false;
}

bool cmp_write_fixext4(cmp_ctx_t *ctx, int8_t type, const void *data) {
  if (!cmp_write_fixext4_marker(ctx, type))
    return false;
  
  if (ctx->write(ctx, data, 4))
    return true;
  
  ctx->error = DATA_WRITING_ERROR;
  return false;
}

bool cmp_write_fixext8_marker(cmp_ctx_t *ctx, int8_t type) {
  if (!write_type_marker(ctx, FIXEXT8_MARKER))
    return false;
  
  if (ctx->write(ctx, &type, sizeof(int8_t)))
    return true;
  
  ctx->error = EXT_TYPE_WRITING_ERROR;
  return false;
}

bool cmp_write_fixext8(cmp_ctx_t *ctx, int8_t type, const void *data) {
  if (!cmp_write_fixext8_marker(ctx, type))
    return false;
  
  if (ctx->write(ctx, data, 8))
    return true;
  
  ctx->error = DATA_WRITING_ERROR;
  return false;
}

bool cmp_write_fixext16_marker(cmp_ctx_t *ctx, int8_t type) {
  if (!write_type_marker(ctx, FIXEXT16_MARKER))
    return false;
  
  if (ctx->write(ctx, &type, sizeof(int8_t)))
    return true;
  
  ctx->error = EXT_TYPE_WRITING_ERROR;
  return false;
}

bool cmp_write_fixext16(cmp_ctx_t *ctx, int8_t type, const void *data) {
  if (!cmp_write_fixext16_marker(ctx, type))
    return false;
  
  if (ctx->write(ctx, data, 16))
    return true;
  
  ctx->error = DATA_WRITING_ERROR;
  return false;
}

bool cmp_write_ext8_marker(cmp_ctx_t *ctx, int8_t type, uint8_t size) {
  if (!write_type_marker(ctx, EXT8_MARKER))
    return false;
  
  if (!ctx->write(ctx, &size, sizeof(uint8_t))) {
    ctx->error = LENGTH_WRITING_ERROR;
    return false;
  }
  
  if (ctx->write(ctx, &type, sizeof(int8_t)))
    return true;
  
  ctx->error = EXT_TYPE_WRITING_ERROR;
  return false;
}

bool cmp_write_ext8(cmp_ctx_t *ctx, int8_t tp, uint8_t sz, const void *data) {
  if (!cmp_write_ext8_marker(ctx, tp, sz))
    return false;
  
  if (ctx->write(ctx, data, sz))
    return true;
  
  ctx->error = DATA_WRITING_ERROR;
  return false;
}

bool cmp_write_ext16_marker(cmp_ctx_t *ctx, int8_t type, uint16_t size) {
  if (!write_type_marker(ctx, EXT16_MARKER))
    return false;
  
  size = be16(size);
  
  if (!ctx->write(ctx, &size, sizeof(uint16_t))) {
    ctx->error = LENGTH_WRITING_ERROR;
    return false;
  }
  
  if (ctx->write(ctx, &type, sizeof(int8_t)))
    return true;
  
  ctx->error = EXT_TYPE_WRITING_ERROR;
  return false;
}

bool cmp_write_ext16(cmp_ctx_t *ctx, int8_t tp, uint16_t sz, const void *data) {
  if (!cmp_write_ext16_marker(ctx, tp, sz))
    return false;
  
  if (ctx->write(ctx, data, sz))
    return true;
  
  ctx->error = DATA_WRITING_ERROR;
  return false;
}

bool cmp_write_ext32_marker(cmp_ctx_t *ctx, int8_t type, uint32_t size) {
  if (!write_type_marker(ctx, EXT32_MARKER))
    return false;
  
  size = be32(size);
  
  if (!ctx->write(ctx, &size, sizeof(uint32_t))) {
    ctx->error = LENGTH_WRITING_ERROR;
    return false;
  }
  
  if (ctx->write(ctx, &type, sizeof(int8_t)))
    return true;
  
  ctx->error = EXT_TYPE_WRITING_ERROR;
  return false;
}

bool cmp_write_ext32(cmp_ctx_t *ctx, int8_t tp, uint32_t sz, const void *data) {
  if (!cmp_write_ext32_marker(ctx, tp, sz))
    return false;
  
  if (ctx->write(ctx, data, sz))
    return true;
  
  ctx->error = DATA_WRITING_ERROR;
  return false;
}

bool cmp_write_ext_marker(cmp_ctx_t *ctx, int8_t tp, uint32_t sz) {
  if (sz == 1)
    return cmp_write_fixext1_marker(ctx, tp);
  if (sz == 2)
    return cmp_write_fixext2_marker(ctx, tp);
  if (sz == 4)
    return cmp_write_fixext4_marker(ctx, tp);
  if (sz == 8)
    return cmp_write_fixext8_marker(ctx, tp);
  if (sz == 16)
    return cmp_write_fixext16_marker(ctx, tp);
  if (sz <= 0xFF)
    return cmp_write_ext8_marker(ctx, tp, sz);
  if (sz <= 0xFFFF)
    return cmp_write_ext16_marker(ctx, tp, sz);
  
  return cmp_write_ext32_marker(ctx, tp, sz);
}

bool cmp_write_ext(cmp_ctx_t *ctx, int8_t tp, uint32_t sz, const void *data) {
  if (sz == 1)
    return cmp_write_fixext1(ctx, tp, data);
  if (sz == 2)
    return cmp_write_fixext2(ctx, tp, data);
  if (sz == 4)
    return cmp_write_fixext4(ctx, tp, data);
  if (sz == 8)
    return cmp_write_fixext8(ctx, tp, data);
  if (sz == 16)
    return cmp_write_fixext16(ctx, tp, data);
  if (sz <= 0xFF)
    return cmp_write_ext8(ctx, tp, sz, data);
  if (sz <= 0xFFFF)
    return cmp_write_ext16(ctx, tp, sz, data);
  
  return cmp_write_ext32(ctx, tp, sz, data);
}

bool cmp_write_object(cmp_ctx_t *ctx, cmp_object_t *obj) {
  switch(obj->type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
      return cmp_write_pfix(ctx, obj->as.u8);
    case CMP_TYPE_FIXMAP:
      return cmp_write_fixmap(ctx, obj->as.map_size);
    case CMP_TYPE_FIXARRAY:
      return cmp_write_fixarray(ctx, obj->as.array_size);
    case CMP_TYPE_FIXSTR:
      return cmp_write_fixstr_marker(ctx, obj->as.str_size);
    case CMP_TYPE_NIL:
      return cmp_write_nil(ctx);
    case CMP_TYPE_BOOLEAN:
      if (obj->as.boolean)
        return cmp_write_true(ctx);
      return cmp_write_false(ctx);
    case CMP_TYPE_BIN8:
      return cmp_write_bin8_marker(ctx, obj->as.bin_size);
    case CMP_TYPE_BIN16:
      return cmp_write_bin16_marker(ctx, obj->as.bin_size);
    case CMP_TYPE_BIN32:
      return cmp_write_bin32_marker(ctx, obj->as.bin_size);
    case CMP_TYPE_EXT8:
      return cmp_write_ext8_marker(ctx, obj->as.ext.type, obj->as.ext.size);
    case CMP_TYPE_EXT16:
      return cmp_write_ext16_marker(ctx, obj->as.ext.type, obj->as.ext.size);
    case CMP_TYPE_EXT32:
      return cmp_write_ext32_marker(ctx, obj->as.ext.type, obj->as.ext.size);
    case CMP_TYPE_FLOAT:
      return cmp_write_float(ctx, obj->as.flt);
    case CMP_TYPE_DOUBLE:
      return cmp_write_double(ctx, obj->as.dbl);
    case CMP_TYPE_UINT8:
      return cmp_write_u8(ctx, obj->as.u8);
    case CMP_TYPE_UINT16:
      return cmp_write_u16(ctx, obj->as.u16);
    case CMP_TYPE_UINT32:
      return cmp_write_u32(ctx, obj->as.u32);
    case CMP_TYPE_UINT64:
      return cmp_write_u64(ctx, obj->as.u64);
    case CMP_TYPE_SINT8:
      return cmp_write_s8(ctx, obj->as.s8);
    case CMP_TYPE_SINT16:
      return cmp_write_s16(ctx, obj->as.s16);
    case CMP_TYPE_SINT32:
      return cmp_write_s32(ctx, obj->as.s32);
    case CMP_TYPE_SINT64:
      return cmp_write_s64(ctx, obj->as.s64);
    case CMP_TYPE_FIXEXT1:
      return cmp_write_fixext1_marker(ctx, obj->as.ext.type);
    case CMP_TYPE_FIXEXT2:
      return cmp_write_fixext2_marker(ctx, obj->as.ext.type);
    case CMP_TYPE_FIXEXT4:
      return cmp_write_fixext4_marker(ctx, obj->as.ext.type);
    case CMP_TYPE_FIXEXT8:
      return cmp_write_fixext8_marker(ctx, obj->as.ext.type);
    case CMP_TYPE_FIXEXT16:
      return cmp_write_fixext16_marker(ctx, obj->as.ext.type);
    case CMP_TYPE_STR8:
      return cmp_write_str8_marker(ctx, obj->as.str_size);
    case CMP_TYPE_STR16:
      return cmp_write_str16_marker(ctx, obj->as.str_size);
    case CMP_TYPE_STR32:
      return cmp_write_str32_marker(ctx, obj->as.str_size);
    case CMP_TYPE_ARRAY16:
      return cmp_write_array16(ctx, obj->as.array_size);
    case CMP_TYPE_ARRAY32:
      return cmp_write_array32(ctx, obj->as.array_size);
    case CMP_TYPE_MAP16:
      return cmp_write_map16(ctx, obj->as.map_size);
    case CMP_TYPE_MAP32:
      return cmp_write_map32(ctx, obj->as.map_size);
    case CMP_TYPE_NEGATIVE_FIXNUM:
      return cmp_write_nfix(ctx, obj->as.s8);
    default:
      ctx->error = INVALID_TYPE_ERROR;
      return false;
  }
}

bool cmp_read_pfix(cmp_ctx_t *ctx, uint8_t *c) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_POSITIVE_FIXNUM) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  *c = obj.as.u8;
  return true;
}

bool cmp_read_nfix(cmp_ctx_t *ctx, int8_t *c) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_NEGATIVE_FIXNUM) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  *c = obj.as.s8;
  return true;
}

bool cmp_read_sfix(cmp_ctx_t *ctx, int8_t *c) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  switch (obj.type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
    case CMP_TYPE_NEGATIVE_FIXNUM:
      *c = obj.as.s8;
      return true;
    default:
      ctx->error = INVALID_TYPE_ERROR;
      return false;
  }
}

bool cmp_read_s8(cmp_ctx_t *ctx, int8_t *c) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_SINT8) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  *c = obj.as.s8;
  return true;
}

bool cmp_read_s16(cmp_ctx_t *ctx, int16_t *s) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_SINT16) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  *s = obj.as.s16;
  return true;
}

bool cmp_read_s32(cmp_ctx_t *ctx, int32_t *i) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_SINT32) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  *i = obj.as.s32;
  return true;
}

bool cmp_read_s64(cmp_ctx_t *ctx, int64_t *l) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_SINT64) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  *l = obj.as.s64;
  return true;
}

bool cmp_read_char(cmp_ctx_t *ctx, int8_t *c) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  switch (obj.type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
    case CMP_TYPE_NEGATIVE_FIXNUM:
    case CMP_TYPE_SINT8:
      *c = obj.as.s8;
      return true;
    case CMP_TYPE_UINT8:
      if (obj.as.u8 <= 127) {
        *c = obj.as.u8;
        return true;
      }
    default:
      ctx->error = INVALID_TYPE_ERROR;
      return false;
  }
}

bool cmp_read_short(cmp_ctx_t *ctx, int16_t *s) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  switch (obj.type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
    case CMP_TYPE_NEGATIVE_FIXNUM:
    case CMP_TYPE_SINT8:
      *s = obj.as.s8;
      return true;
    case CMP_TYPE_UINT8:
      *s = obj.as.u8;
      return true;
    case CMP_TYPE_SINT16:
      *s = obj.as.s16;
      return true;
    case CMP_TYPE_UINT16:
      if (obj.as.u16 <= 32767) {
        *s = obj.as.u16;
        return true;
      }
    default:
      ctx->error = INVALID_TYPE_ERROR;
      return false;
  }
}

bool cmp_read_int(cmp_ctx_t *ctx, int32_t *i) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  switch (obj.type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
    case CMP_TYPE_NEGATIVE_FIXNUM:
    case CMP_TYPE_SINT8:
      *i = obj.as.s8;
      return true;
    case CMP_TYPE_UINT8:
      *i = obj.as.u8;
      return true;
    case CMP_TYPE_SINT16:
      *i = obj.as.s16;
      return true;
    case CMP_TYPE_UINT16:
      *i = obj.as.u16;
      return true;
    case CMP_TYPE_SINT32:
      *i = obj.as.s32;
      return true;
    case CMP_TYPE_UINT32:
      if (obj.as.u32 <= 2147483647) {
        *i = obj.as.u32;
        return true;
      }
    default:
      ctx->error = INVALID_TYPE_ERROR;
      return false;
  }
}

bool cmp_read_long(cmp_ctx_t *ctx, int64_t *d) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  switch (obj.type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
    case CMP_TYPE_NEGATIVE_FIXNUM:
    case CMP_TYPE_SINT8:
      *d = obj.as.s8;
      return true;
    case CMP_TYPE_UINT8:
      *d = obj.as.u8;
      return true;
    case CMP_TYPE_SINT16:
      *d = obj.as.s16;
      return true;
    case CMP_TYPE_UINT16:
      *d = obj.as.u16;
      return true;
    case CMP_TYPE_SINT32:
      *d = obj.as.s32;
      return true;
    case CMP_TYPE_UINT32:
      *d = obj.as.u32;
      return true;
    case CMP_TYPE_SINT64:
      *d = obj.as.s64;
      return true;
    case CMP_TYPE_UINT64:
      if (obj.as.u64 <= 9223372036854775807) {
        *d = obj.as.u64;
        return true;
      }
    default:
      ctx->error = INVALID_TYPE_ERROR;
      return false;
  }
}

bool cmp_read_sinteger(cmp_ctx_t *ctx, int64_t *d) {
  return cmp_read_long(ctx, d);
}

bool cmp_read_ufix(cmp_ctx_t *ctx, uint8_t *c) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_NEGATIVE_FIXNUM) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  *c = obj.as.u8;
  return true;
}

bool cmp_read_u8(cmp_ctx_t *ctx, uint8_t *c) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_UINT8) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  *c = obj.as.u8;
  return true;
}

bool cmp_read_u16(cmp_ctx_t *ctx, uint16_t *s) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_UINT16) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  *s = obj.as.u16;
  return true;
}

bool cmp_read_u32(cmp_ctx_t *ctx, uint32_t *i) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_UINT32) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  *i = obj.as.u32;
  return true;
}

bool cmp_read_u64(cmp_ctx_t *ctx, uint64_t *l) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_UINT64) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  *l = obj.as.u64;
  return true;
}

bool cmp_read_uchar(cmp_ctx_t *ctx, uint8_t *c) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  switch (obj.type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
    case CMP_TYPE_UINT8:
      *c = obj.as.u8;
      return true;
    default:
      ctx->error = INVALID_TYPE_ERROR;
      return false;
  }
}

bool cmp_read_ushort(cmp_ctx_t *ctx, uint16_t *s) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  switch (obj.type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
    case CMP_TYPE_UINT8:
      *s = obj.as.u8;
      return true;
    case CMP_TYPE_UINT16:
      *s = obj.as.u16;
      return true;
    default:
      ctx->error = INVALID_TYPE_ERROR;
      return false;
  }
}

bool cmp_read_uint(cmp_ctx_t *ctx, uint32_t *i) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  switch (obj.type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
    case CMP_TYPE_UINT8:
      *i = obj.as.u8;
      return true;
    case CMP_TYPE_UINT16:
      *i = obj.as.u16;
      return true;
    case CMP_TYPE_UINT32:
      *i = obj.as.u32;
      return true;
    default:
      ctx->error = INVALID_TYPE_ERROR;
      return false;
  }
}

bool cmp_read_ulong(cmp_ctx_t *ctx, uint64_t *u) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  switch (obj.type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
    case CMP_TYPE_UINT8:
      *u = obj.as.u8;
      return true;
    case CMP_TYPE_UINT16:
      *u = obj.as.u16;
      return true;
    case CMP_TYPE_UINT32:
      *u = obj.as.u32;
      return true;
    case CMP_TYPE_UINT64:
      *u = obj.as.u64;
      return true;
    default:
      ctx->error = INVALID_TYPE_ERROR;
      return false;
  }
}

bool cmp_read_uinteger(cmp_ctx_t *ctx, uint64_t *d) {
  return cmp_read_ulong(ctx, d);
}

bool cmp_read_float(cmp_ctx_t *ctx, float *f) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_FLOAT) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  *f = obj.as.flt;
  
  return true;
}

bool cmp_read_double(cmp_ctx_t *ctx, double *d) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_DOUBLE) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  *d = obj.as.dbl;
  
  return true;
}

bool cmp_read_nil(cmp_ctx_t *ctx) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type == CMP_TYPE_NIL)
    return true;
  
  ctx->error = INVALID_TYPE_ERROR;
  return false;
}

bool cmp_read_bool(cmp_ctx_t *ctx, bool *b) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_BOOLEAN) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  if (obj.as.boolean)
    *b = true;
  else
    *b = false;
  
  return true;
}

bool cmp_read_bool_as_u8(cmp_ctx_t *ctx, uint8_t *b) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_BOOLEAN) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  if (obj.as.boolean)
    *b = 1;
  else
    *b = 0;
  
  return true;
}

bool cmp_read_str_size(cmp_ctx_t *ctx, uint32_t *size) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  switch (obj.type) {
    case CMP_TYPE_FIXSTR:
    case CMP_TYPE_STR8:
    case CMP_TYPE_STR16:
    case CMP_TYPE_STR32:
      *size = obj.as.str_size;
      return true;
    default:
      ctx->error = INVALID_TYPE_ERROR;
      return false;
  }
}

bool cmp_read_str(cmp_ctx_t *ctx, char *data, uint32_t *size) {
  uint32_t str_size = 0;
  
  if (!cmp_read_str_size(ctx, &str_size))
    return false;
  
  if ((str_size + 1) > *size) {
    *size = str_size;
    ctx->error = STR_DATA_LENGTH_TOO_LONG_ERROR;
    return false;
  }
  
  if (!ctx->read(ctx, data, str_size)) {
    ctx->error = DATA_READING_ERROR;
    return false;
  }
  
  data[str_size] = 0;
  
  *size = str_size;
  return true;
}

bool cmp_read_bin_size(cmp_ctx_t *ctx, uint32_t *size) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  switch (obj.type) {
    case CMP_TYPE_BIN8:
    case CMP_TYPE_BIN16:
    case CMP_TYPE_BIN32:
      *size = obj.as.bin_size;
      return true;
    default:
      ctx->error = INVALID_TYPE_ERROR;
      return false;
  }
}

bool cmp_read_bin(cmp_ctx_t *ctx, void *data, uint32_t *size) {
  uint32_t bin_size = 0;
  
  if (!cmp_read_bin_size(ctx, &bin_size))
    return false;
  
  if (bin_size > *size) {
    ctx->error = BIN_DATA_LENGTH_TOO_LONG_ERROR;
    return false;
  }
  
  if (!ctx->read(ctx, data, bin_size)) {
    ctx->error = DATA_READING_ERROR;
    return false;
  }
  
  *size = bin_size;
  return true;
}

bool cmp_read_array(cmp_ctx_t *ctx, uint32_t *size) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  switch (obj.type) {
    case CMP_TYPE_FIXARRAY:
    case CMP_TYPE_ARRAY16:
    case CMP_TYPE_ARRAY32:
      *size = obj.as.array_size;
      return true;
    default:
      ctx->error = INVALID_TYPE_ERROR;
      return false;
  }
}

bool cmp_read_map(cmp_ctx_t *ctx, uint32_t *size) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  switch (obj.type) {
    case CMP_TYPE_FIXMAP:
    case CMP_TYPE_MAP16:
    case CMP_TYPE_MAP32:
      *size = obj.as.map_size;
      return true;
    default:
      ctx->error = INVALID_TYPE_ERROR;
      return false;
  }
}

bool cmp_read_fixext1_marker(cmp_ctx_t *ctx, int8_t *type) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_FIXEXT1) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  *type = obj.as.ext.type;
  return true;
}

bool cmp_read_fixext1(cmp_ctx_t *ctx, int8_t *type, void *data) {
  if (!cmp_read_fixext1_marker(ctx, type))
    return false;
  
  if (ctx->read(ctx, data, 1))
    return true;
  
  ctx->error = DATA_READING_ERROR;
  return false;
}

bool cmp_read_fixext2_marker(cmp_ctx_t *ctx, int8_t *type) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_FIXEXT2) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  *type = obj.as.ext.type;
  return true;
}

bool cmp_read_fixext2(cmp_ctx_t *ctx, int8_t *type, void *data) {
  if (!cmp_read_fixext2_marker(ctx, type))
    return false;
  
  if (ctx->read(ctx, data, 2))
    return true;
  
  ctx->error = DATA_READING_ERROR;
  return false;
}

bool cmp_read_fixext4_marker(cmp_ctx_t *ctx, int8_t *type) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_FIXEXT4) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  *type = obj.as.ext.type;
  return true;
}

bool cmp_read_fixext4(cmp_ctx_t *ctx, int8_t *type, void *data) {
  if (!cmp_read_fixext4_marker(ctx, type))
    return false;
  
  if (ctx->read(ctx, data, 4))
    return true;
  
  ctx->error = DATA_READING_ERROR;
  return false;
}

bool cmp_read_fixext8_marker(cmp_ctx_t *ctx, int8_t *type) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_FIXEXT8) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  *type = obj.as.ext.type;
  return true;
}

bool cmp_read_fixext8(cmp_ctx_t *ctx, int8_t *type, void *data) {
  if (!cmp_read_fixext8_marker(ctx, type))
    return false;
  
  if (ctx->read(ctx, data, 8))
    return true;
  
  ctx->error = DATA_READING_ERROR;
  return false;
}

bool cmp_read_fixext16_marker(cmp_ctx_t *ctx, int8_t *type) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_FIXEXT16) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  *type = obj.as.ext.type;
  return true;
}

bool cmp_read_fixext16(cmp_ctx_t *ctx, int8_t *type, void *data) {
  if (!cmp_read_fixext16_marker(ctx, type))
    return false;
  
  if (ctx->read(ctx, data, 16))
    return true;
  
  ctx->error = DATA_READING_ERROR;
  return false;
}

bool cmp_read_ext8_marker(cmp_ctx_t *ctx, int8_t *type, uint8_t *size) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_EXT8) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  *type = obj.as.ext.type;
  *size = obj.as.ext.size;
  
  return true;
}

bool cmp_read_ext8(cmp_ctx_t *ctx, int8_t *type, uint8_t *size, void *data) {
  if (!cmp_read_ext8_marker(ctx, type, size))
    return false;
  
  if (ctx->read(ctx, data, *size))
    return true;
  
  ctx->error = DATA_READING_ERROR;
  return false;
}

bool cmp_read_ext16_marker(cmp_ctx_t *ctx, int8_t *type, uint16_t *size) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_EXT16) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  *type = obj.as.ext.type;
  *size = obj.as.ext.size;
  
  return true;
}

bool cmp_read_ext16(cmp_ctx_t *ctx, int8_t *type, uint16_t *size, void *data) {
  if (!cmp_read_ext16_marker(ctx, type, size))
    return false;
  
  if (ctx->read(ctx, data, *size))
    return true;
  
  ctx->error = DATA_READING_ERROR;
  return false;
}

bool cmp_read_ext32_marker(cmp_ctx_t *ctx, int8_t *type, uint32_t *size) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  if (obj.type != CMP_TYPE_EXT32) {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  *type = obj.as.ext.type;
  *size = obj.as.ext.size;
  
  return true;
}

bool cmp_read_ext32(cmp_ctx_t *ctx, int8_t *type, uint32_t *size, void *data) {
  if (!cmp_read_ext32_marker(ctx, type, size))
    return false;
  
  if (ctx->read(ctx, data, *size))
    return true;
  
  ctx->error = DATA_READING_ERROR;
  return false;
}

bool cmp_read_ext_marker(cmp_ctx_t *ctx, int8_t *type, uint32_t *size) {
  cmp_object_t obj;
  
  if (!cmp_read_object(ctx, &obj))
    return false;
  
  switch (obj.type) {
    case CMP_TYPE_FIXEXT1:
    case CMP_TYPE_FIXEXT2:
    case CMP_TYPE_FIXEXT4:
    case CMP_TYPE_FIXEXT8:
    case CMP_TYPE_FIXEXT16:
    case CMP_TYPE_EXT8:
    case CMP_TYPE_EXT16:
    case CMP_TYPE_EXT32:
      *type = obj.as.ext.type;
      *size = obj.as.ext.size;
      return true;
    default:
      ctx->error = INVALID_TYPE_ERROR;
      return false;
  }
}

bool cmp_read_ext(cmp_ctx_t *ctx, int8_t *type, uint32_t *size, void *data) {
  if (!cmp_read_ext_marker(ctx, type, size))
    return false;
  
  if (ctx->read(ctx, data, *size))
    return true;
  
  ctx->error = DATA_READING_ERROR;
  return false;
}

bool cmp_read_object(cmp_ctx_t *ctx, cmp_object_t *obj) {
  uint8_t type_marker = 0;
  
  if (!read_type_marker(ctx, &type_marker))
    return false;
  
  if (type_marker <= 0x7F) {
    obj->type = CMP_TYPE_POSITIVE_FIXNUM;
    obj->as.u8 = type_marker;
  }
  else if (type_marker <= 0x8F) {
    obj->type = CMP_TYPE_FIXMAP;
    obj->as.map_size = type_marker & FIXMAP_SIZE;
  }
  else if (type_marker <= 0x9F) {
    obj->type = CMP_TYPE_FIXARRAY;
    obj->as.array_size = type_marker & FIXARRAY_SIZE;
  }
  else if (type_marker <= 0xBF) {
    obj->type = CMP_TYPE_FIXSTR;
    obj->as.str_size = type_marker & FIXSTR_SIZE;
  }
  else if (type_marker == NIL_MARKER) {
    obj->type = CMP_TYPE_NIL;
    obj->as.u8 = 0;
  }
  else if (type_marker == FALSE_MARKER) {
    obj->type = CMP_TYPE_BOOLEAN;
    obj->as.boolean = false;
  }
  else if (type_marker == TRUE_MARKER) {
    obj->type = CMP_TYPE_BOOLEAN;
    obj->as.boolean = true;
  }
  else if (type_marker == BIN8_MARKER) {
    obj->type = CMP_TYPE_BIN8;
    if (!ctx->read(ctx, &obj->as.u8, sizeof(uint8_t))) {
      ctx->error = LENGTH_READING_ERROR;
      return false;
    }
    obj->as.bin_size = obj->as.u8;
  }
  else if (type_marker == BIN16_MARKER) {
    obj->type = CMP_TYPE_BIN16;
    if (!ctx->read(ctx, &obj->as.u16, sizeof(uint16_t))) {
      ctx->error = LENGTH_READING_ERROR;
      return false;
    }
    obj->as.bin_size = be16(obj->as.u16);
  }
  else if (type_marker == BIN32_MARKER) {
    obj->type = CMP_TYPE_BIN32;
    if (!ctx->read(ctx, &obj->as.u32, sizeof(uint32_t))) {
      ctx->error = LENGTH_READING_ERROR;
      return false;
    }
    obj->as.bin_size = be32(obj->as.u32);
  }
  else if (type_marker == EXT8_MARKER) {
    uint8_t ext_size;
    int8_t ext_type;
    
    obj->type = CMP_TYPE_EXT8;
    if (!ctx->read(ctx, &ext_size, sizeof(uint8_t))) {
      ctx->error = LENGTH_READING_ERROR;
      return false;
    }
    if (!ctx->read(ctx, &ext_type, sizeof(int8_t))) {
      ctx->error = EXT_TYPE_READING_ERROR;
      return false;
    }
    obj->as.ext.size = ext_size;
    obj->as.ext.type = ext_type;
  }
  else if (type_marker == EXT16_MARKER) {
    int8_t ext_type;
    uint16_t ext_size;
    
    obj->type = CMP_TYPE_EXT16;
    if (!ctx->read(ctx, &ext_size, sizeof(uint16_t))) {
      ctx->error = LENGTH_READING_ERROR;
      return false;
    }
    if (!ctx->read(ctx, &ext_type, sizeof(int8_t))) {
      ctx->error = EXT_TYPE_READING_ERROR;
      return false;
    }
    obj->as.ext.size = be16(ext_size);
    obj->as.ext.type = ext_type;
  }
  else if (type_marker == EXT32_MARKER) {
    int8_t ext_type;
    uint32_t ext_size;
    
    obj->type = CMP_TYPE_EXT32;
    if (!ctx->read(ctx, &ext_size, sizeof(uint32_t))) {
      ctx->error = LENGTH_READING_ERROR;
      return false;
    }
    if (!ctx->read(ctx, &ext_type, sizeof(int8_t))) {
      ctx->error = EXT_TYPE_READING_ERROR;
      return false;
    }
    obj->as.ext.size = be32(ext_size);
    obj->as.ext.type = ext_type;
  }
  else if (type_marker == FLOAT_MARKER) {
    obj->type = CMP_TYPE_FLOAT;
    if (!ctx->read(ctx, &obj->as.flt, sizeof(float))) {
      ctx->error = DATA_READING_ERROR;
      return false;
    }
    obj->as.flt = befloat(obj->as.flt);
  }
  else if (type_marker == DOUBLE_MARKER) {
    obj->type = CMP_TYPE_DOUBLE;
    if (!ctx->read(ctx, &obj->as.dbl, sizeof(double))) {
      ctx->error = DATA_READING_ERROR;
      return false;
    }
    obj->as.dbl = bedouble(obj->as.dbl);
  }
  else if (type_marker == U8_MARKER) {
    obj->type = CMP_TYPE_UINT8;
    if (!ctx->read(ctx, &obj->as.u8, sizeof(uint8_t))) {
      ctx->error = DATA_READING_ERROR;
      return false;
    }
  }
  else if (type_marker == U16_MARKER) {
    obj->type = CMP_TYPE_UINT16;
    if (!ctx->read(ctx, &obj->as.u16, sizeof(uint16_t))) {
      ctx->error = DATA_READING_ERROR;
      return false;
    }
    obj->as.u16 = be16(obj->as.u16);
  }
  else if (type_marker == U32_MARKER) {
    obj->type = CMP_TYPE_UINT32;
    if (!ctx->read(ctx, &obj->as.u32, sizeof(uint32_t))) {
      ctx->error = DATA_READING_ERROR;
      return false;
    }
    obj->as.u32 = be32(obj->as.u32);
  }
  else if (type_marker == U64_MARKER) {
    obj->type = CMP_TYPE_UINT64;
    if (!ctx->read(ctx, &obj->as.u64, sizeof(uint64_t))) {
      ctx->error = DATA_READING_ERROR;
      return false;
    }
    obj->as.u64 = be64(obj->as.u64);
  }
  else if (type_marker == S8_MARKER) {
    obj->type = CMP_TYPE_SINT8;
    if (!ctx->read(ctx, &obj->as.s8, sizeof(int8_t))) {
      ctx->error = DATA_READING_ERROR;
      return false;
    }
  }
  else if (type_marker == S16_MARKER) {
    obj->type = CMP_TYPE_SINT16;
    if (!ctx->read(ctx, &obj->as.s16, sizeof(int16_t))) {
      ctx->error = DATA_READING_ERROR;
      return false;
    }
    obj->as.s16 = be16(obj->as.s16);
  }
  else if (type_marker == S32_MARKER) {
    obj->type = CMP_TYPE_SINT32;
    if (!ctx->read(ctx, &obj->as.s32, sizeof(int32_t))) {
      ctx->error = DATA_READING_ERROR;
      return false;
    }
    obj->as.s32 = be32(obj->as.s32);
  }
  else if (type_marker == S64_MARKER) {
    obj->type = CMP_TYPE_SINT64;
    if (!ctx->read(ctx, &obj->as.s64, sizeof(int64_t))) {
      ctx->error = DATA_READING_ERROR;
      return false;
    }
    obj->as.s64 = be64(obj->as.s64);
  }
  else if (type_marker == FIXEXT1_MARKER) {
    obj->type = CMP_TYPE_FIXEXT1;
    if (!ctx->read(ctx, &obj->as.ext.type, sizeof(int8_t))) {
      ctx->error = EXT_TYPE_READING_ERROR;
      return false;
    }
    obj->as.ext.size = 1;
  }
  else if (type_marker == FIXEXT2_MARKER) {
    obj->type = CMP_TYPE_FIXEXT2;
    if (!ctx->read(ctx, &obj->as.ext.type, sizeof(int8_t))) {
      ctx->error = EXT_TYPE_READING_ERROR;
      return false;
    }
    obj->as.ext.size = 2;
  }
  else if (type_marker == FIXEXT4_MARKER) {
    obj->type = CMP_TYPE_FIXEXT4;
    if (!ctx->read(ctx, &obj->as.ext.type, sizeof(int8_t))) {
      ctx->error = EXT_TYPE_READING_ERROR;
      return false;
    }
    obj->as.ext.size = 4;
  }
  else if (type_marker == FIXEXT8_MARKER) {
    obj->type = CMP_TYPE_FIXEXT8;
    if (!ctx->read(ctx, &obj->as.ext.type, sizeof(int8_t))) {
      ctx->error = EXT_TYPE_READING_ERROR;
      return false;
    }
    obj->as.ext.size = 8;
  }
  else if (type_marker == FIXEXT16_MARKER) {
    obj->type = CMP_TYPE_FIXEXT16;
    if (!ctx->read(ctx, &obj->as.ext.type, sizeof(int8_t))) {
      ctx->error = EXT_TYPE_READING_ERROR;
      return false;
    }
    obj->as.ext.size = 16;
  }
  else if (type_marker == STR8_MARKER) {
    obj->type = CMP_TYPE_STR8;
    if (!ctx->read(ctx, &obj->as.u8, sizeof(uint8_t))) {
      ctx->error = DATA_READING_ERROR;
      return false;
    }
    obj->as.str_size = obj->as.u8;
  }
  else if (type_marker == STR16_MARKER) {
    obj->type = CMP_TYPE_STR16;
    if (!ctx->read(ctx, &obj->as.u16, sizeof(uint16_t))) {
      ctx->error = DATA_READING_ERROR;
      return false;
    }
    obj->as.str_size = be16(obj->as.u16);
  }
  else if (type_marker == STR32_MARKER) {
    obj->type = CMP_TYPE_STR32;
    if (!ctx->read(ctx, &obj->as.u32, sizeof(uint32_t))) {
      ctx->error = DATA_READING_ERROR;
      return false;
    }
    obj->as.str_size = be32(obj->as.u32);
  }
  else if (type_marker == ARRAY16_MARKER) {
    obj->type = CMP_TYPE_ARRAY16;
    if (!ctx->read(ctx, &obj->as.u16, sizeof(uint16_t))) {
      ctx->error = DATA_READING_ERROR;
      return false;
    }
    obj->as.array_size = be16(obj->as.u16);
  }
  else if (type_marker == ARRAY32_MARKER) {
    obj->type = CMP_TYPE_ARRAY32;
    if (!ctx->read(ctx, &obj->as.u32, sizeof(uint32_t))) {
      ctx->error = DATA_READING_ERROR;
      return false;
    }
    obj->as.array_size = be32(obj->as.u32);
  }
  else if (type_marker == MAP16_MARKER) {
    obj->type = CMP_TYPE_MAP16;
    if (!ctx->read(ctx, &obj->as.u16, sizeof(uint16_t))) {
      ctx->error = DATA_READING_ERROR;
      return false;
    }
    obj->as.map_size = be16(obj->as.u16);
  }
  else if (type_marker == MAP32_MARKER) {
    obj->type = CMP_TYPE_MAP32;
    if (!ctx->read(ctx, &obj->as.u32, sizeof(uint32_t))) {
      ctx->error = DATA_READING_ERROR;
      return false;
    }
    obj->as.map_size = be32(obj->as.u32);
  }
  else if (type_marker >= NEGATIVE_FIXNUM_MARKER) {
    obj->type = CMP_TYPE_NEGATIVE_FIXNUM;
    obj->as.s8 = type_marker;
  }
  else {
    ctx->error = INVALID_TYPE_ERROR;
    return false;
  }
  
  return true;
}

bool cmp_object_is_char(cmp_object_t *obj) {
  switch (obj->type) {
    case CMP_TYPE_NEGATIVE_FIXNUM:
    case CMP_TYPE_SINT8:
      return true;
    default:
      return false;
  }
}

bool cmp_object_is_short(cmp_object_t *obj) {
  switch (obj->type) {
    case CMP_TYPE_NEGATIVE_FIXNUM:
    case CMP_TYPE_SINT8:
    case CMP_TYPE_SINT16:
      return true;
    default:
      return false;
  }
}

bool cmp_object_is_int(cmp_object_t *obj) {
  switch (obj->type) {
    case CMP_TYPE_NEGATIVE_FIXNUM:
    case CMP_TYPE_SINT8:
    case CMP_TYPE_SINT16:
    case CMP_TYPE_SINT32:
      return true;
    default:
      return false;
  }
}

bool cmp_object_is_long(cmp_object_t *obj) {
  switch (obj->type) {
    case CMP_TYPE_NEGATIVE_FIXNUM:
    case CMP_TYPE_SINT8:
    case CMP_TYPE_SINT16:
    case CMP_TYPE_SINT32:
    case CMP_TYPE_SINT64:
      return true;
    default:
      return false;
  }
}

bool cmp_object_is_sinteger(cmp_object_t *obj) {
  return cmp_object_is_long(obj);
}

bool cmp_object_is_uchar(cmp_object_t *obj) {
  switch (obj->type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
    case CMP_TYPE_UINT8:
      return true;
    default:
      return false;
  }
}

bool cmp_object_is_ushort(cmp_object_t *obj) {
  switch (obj->type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
    case CMP_TYPE_UINT8:
      return true;
    case CMP_TYPE_UINT16:
      return true;
    default:
      return false;
  }
}

bool cmp_object_is_uint(cmp_object_t *obj) {
  switch (obj->type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
    case CMP_TYPE_UINT8:
    case CMP_TYPE_UINT16:
    case CMP_TYPE_UINT32:
      return true;
    default:
      return false;
  }
}

bool cmp_object_is_ulong(cmp_object_t *obj) {
  switch (obj->type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
    case CMP_TYPE_UINT8:
    case CMP_TYPE_UINT16:
    case CMP_TYPE_UINT32:
    case CMP_TYPE_UINT64:
      return true;
    default:
      return false;
  }
}

bool cmp_object_is_uinteger(cmp_object_t *obj) {
  return cmp_object_is_ulong(obj);
}

bool cmp_object_is_float(cmp_object_t *obj) {
  if (obj->type == CMP_TYPE_FLOAT)
    return true;
  
  return false;
}

bool cmp_object_is_double(cmp_object_t *obj) {
  if (obj->type == CMP_TYPE_DOUBLE)
    return true;
  
  return false;
}

bool cmp_object_is_nil(cmp_object_t *obj) {
  if (obj->type == CMP_TYPE_NIL)
    return true;
  
  return false;
}

bool cmp_object_is_bool(cmp_object_t *obj) {
  if (obj->type == CMP_TYPE_BOOLEAN)
    return true;
  
  return false;
}

bool cmp_object_is_str(cmp_object_t *obj) {
  switch (obj->type) {
    case CMP_TYPE_FIXSTR:
    case CMP_TYPE_STR8:
    case CMP_TYPE_STR16:
    case CMP_TYPE_STR32:
      return true;
    default:
      return false;
  }
}

bool cmp_object_is_bin(cmp_object_t *obj) {
  switch (obj->type) {
    case CMP_TYPE_BIN8:
    case CMP_TYPE_BIN16:
    case CMP_TYPE_BIN32:
      return true;
    default:
      return false;
  }
}

bool cmp_object_is_array(cmp_object_t *obj) {
  switch (obj->type) {
    case CMP_TYPE_FIXARRAY:
    case CMP_TYPE_ARRAY16:
    case CMP_TYPE_ARRAY32:
      return true;
    default:
      return false;
  }
}

bool cmp_object_is_map(cmp_object_t *obj) {
  switch (obj->type) {
    case CMP_TYPE_FIXMAP:
    case CMP_TYPE_MAP16:
    case CMP_TYPE_MAP32:
      return true;
    default:
      return false;
  }
}

bool cmp_object_is_ext(cmp_object_t *obj) {
  switch (obj->type) {
    case CMP_TYPE_FIXEXT1:
    case CMP_TYPE_FIXEXT2:
    case CMP_TYPE_FIXEXT4:
    case CMP_TYPE_FIXEXT8:
    case CMP_TYPE_FIXEXT16:
    case CMP_TYPE_EXT8:
    case CMP_TYPE_EXT16:
    case CMP_TYPE_EXT32:
      return true;
    default:
      return false;
  }
}

bool cmp_object_as_char(cmp_object_t *obj, int8_t *c) {
  switch (obj->type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
    case CMP_TYPE_NEGATIVE_FIXNUM:
    case CMP_TYPE_SINT8:
      *c = obj->as.s8;
      return true;
    case CMP_TYPE_UINT8:
      if (obj->as.u8 <= 127) {
        *c = obj->as.s8;
        return true;
      }
  }
  
  return false;
}

bool cmp_object_as_short(cmp_object_t *obj, int16_t *s) {
  switch (obj->type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
    case CMP_TYPE_NEGATIVE_FIXNUM:
    case CMP_TYPE_SINT8:
      *s = obj->as.s8;
      return true;
    case CMP_TYPE_UINT8:
      *s = obj->as.u8;
      return true;
    case CMP_TYPE_SINT16:
      *s = obj->as.s16;
      return true;
    case CMP_TYPE_UINT16:
      if (obj->as.u16 <= 32767) {
        *s = obj->as.u16;
        return true;
      }
  }
  
  return false;
}

bool cmp_object_as_int(cmp_object_t *obj, int32_t *i) {
  switch (obj->type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
    case CMP_TYPE_NEGATIVE_FIXNUM:
    case CMP_TYPE_SINT8:
      *i = obj->as.s8;
      return true;
    case CMP_TYPE_UINT8:
      *i = obj->as.u8;
      return true;
    case CMP_TYPE_SINT16:
      *i = obj->as.s16;
      return true;
    case CMP_TYPE_UINT16:
      *i = obj->as.u16;
      return true;
    case CMP_TYPE_SINT32:
      *i = obj->as.s32;
      return true;
    case CMP_TYPE_UINT32:
      if (obj->as.u32 <= 2147483647) {
        *i = obj->as.u32;
        return true;
      }
  }
  
  return false;
}

bool cmp_object_as_long(cmp_object_t *obj, int64_t *d) {
  switch (obj->type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
    case CMP_TYPE_NEGATIVE_FIXNUM:
    case CMP_TYPE_SINT8:
      *d = obj->as.s8;
      return true;
    case CMP_TYPE_UINT8:
      *d = obj->as.u8;
      return true;
    case CMP_TYPE_SINT16:
      *d = obj->as.s16;
      return true;
    case CMP_TYPE_UINT16:
      *d = obj->as.u16;
      return true;
    case CMP_TYPE_SINT32:
      *d = obj->as.s32;
      return true;
    case CMP_TYPE_UINT32:
      *d = obj->as.u32;
      return true;
    case CMP_TYPE_SINT64:
      *d = obj->as.s64;
      return true;
    case CMP_TYPE_UINT64:
      if (obj->as.u64 <= 9223372036854775807) {
        *d = obj->as.u64;
        return true;
      }
  }
  
  return false;
}

bool cmp_object_as_sinteger(cmp_object_t *obj, int64_t *d) {
  return cmp_object_as_long(obj, d);
}

bool cmp_object_as_uchar(cmp_object_t *obj, uint8_t *c) {
  switch (obj->type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
    case CMP_TYPE_UINT8:
      *c = obj->as.u8;
      return true;
  }
  
  return false;
}

bool cmp_object_as_ushort(cmp_object_t *obj, uint16_t *s) {
  switch (obj->type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
    case CMP_TYPE_UINT8:
      *s = obj->as.u8;
      return true;
    case CMP_TYPE_UINT16:
      *s = obj->as.u16;
      return true;
  }
  
  return false;
}

bool cmp_object_as_uint(cmp_object_t *obj, uint32_t *i) {
  switch (obj->type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
    case CMP_TYPE_UINT8:
      *i = obj->as.u8;
      return true;
    case CMP_TYPE_UINT16:
      *i = obj->as.u16;
      return true;
    case CMP_TYPE_UINT32:
      *i = obj->as.u32;
      return true;
  }
  
  return false;
}

bool cmp_object_as_ulong(cmp_object_t *obj, uint64_t *u) {
  switch (obj->type) {
    case CMP_TYPE_POSITIVE_FIXNUM:
    case CMP_TYPE_UINT8:
      *u = obj->as.u8;
      return true;
    case CMP_TYPE_UINT16:
      *u = obj->as.u16;
      return true;
    case CMP_TYPE_UINT32:
      *u = obj->as.u32;
      return true;
    case CMP_TYPE_UINT64:
      *u = obj->as.u64;
      return true;
  }
  
  return false;
}

bool cmp_object_as_uinteger(cmp_object_t *obj, uint64_t *d) {
  return cmp_object_as_ulong(obj, d);
}

bool cmp_object_as_float(cmp_object_t *obj, float *f) {
  if (obj->type == CMP_TYPE_FLOAT) {
    *f = obj->as.flt;
    return true;
  }
  
  return false;
}

bool cmp_object_as_double(cmp_object_t *obj, double *d) {
  if (obj->type == CMP_TYPE_DOUBLE) {
    *d = obj->as.dbl;
    return true;
  }
  
  return false;
}

bool cmp_object_as_bool(cmp_object_t *obj, bool *b) {
  if (obj->type == CMP_TYPE_BOOLEAN) {
    if (obj->as.boolean)
      *b = true;
    else
      *b = false;
    
    return true;
  }
  
  return false;
}

bool cmp_object_as_str(cmp_object_t *obj, uint32_t *size) {
  switch (obj->type) {
    case CMP_TYPE_FIXSTR:
    case CMP_TYPE_STR8:
    case CMP_TYPE_STR16:
    case CMP_TYPE_STR32:
      *size = obj->as.str_size;
      return true;
  }
  
  return false;
}

bool cmp_object_as_bin(cmp_object_t *obj, uint32_t *size) {
  switch (obj->type) {
    case CMP_TYPE_BIN8:
    case CMP_TYPE_BIN16:
    case CMP_TYPE_BIN32:
      *size = obj->as.bin_size;
      return true;
  }
  
  return false;
}

bool cmp_object_as_array(cmp_object_t *obj, uint32_t *size) {
  switch (obj->type) {
    case CMP_TYPE_FIXARRAY:
    case CMP_TYPE_ARRAY16:
    case CMP_TYPE_ARRAY32:
      *size = obj->as.array_size;
      return true;
  }
  
  return false;
}

bool cmp_object_as_map(cmp_object_t *obj, uint32_t *size) {
  switch (obj->type) {
    case CMP_TYPE_FIXMAP:
    case CMP_TYPE_MAP16:
    case CMP_TYPE_MAP32:
      *size = obj->as.map_size;
      return true;
  }
  
  return false;
}

bool cmp_object_as_ext(cmp_object_t *obj, int8_t *type, uint32_t *size) {
  switch (obj->type) {
    case CMP_TYPE_FIXEXT1:
    case CMP_TYPE_FIXEXT2:
    case CMP_TYPE_FIXEXT4:
    case CMP_TYPE_FIXEXT8:
    case CMP_TYPE_FIXEXT16:
    case CMP_TYPE_EXT8:
    case CMP_TYPE_EXT16:
    case CMP_TYPE_EXT32:
      *type = obj->as.ext.type;
      *size = obj->as.ext.size;
      return true;
  }
  
  return false;
}

/* vi: set et ts=2 sw=2: */
