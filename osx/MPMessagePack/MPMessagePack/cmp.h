#ifndef CMP_H__
#define CMP_H__

struct cmp_ctx_s;

typedef bool   (*cmp_reader)(struct cmp_ctx_s *ctx, void *data, size_t limit);
typedef size_t (*cmp_writer)(struct cmp_ctx_s *ctx, const void *data,
                             size_t count);

enum {
  CMP_TYPE_POSITIVE_FIXNUM, /*  0 */
  CMP_TYPE_FIXMAP,          /*  1 */
  CMP_TYPE_FIXARRAY,        /*  2 */
  CMP_TYPE_FIXSTR,          /*  3 */
  CMP_TYPE_NIL,             /*  4 */
  CMP_TYPE_BOOLEAN,         /*  5 */
  CMP_TYPE_BIN8,            /*  6 */
  CMP_TYPE_BIN16,           /*  7 */
  CMP_TYPE_BIN32,           /*  8 */
  CMP_TYPE_EXT8,            /*  9 */
  CMP_TYPE_EXT16,           /* 10 */
  CMP_TYPE_EXT32,           /* 11 */
  CMP_TYPE_FLOAT,           /* 12 */
  CMP_TYPE_DOUBLE,          /* 13 */
  CMP_TYPE_UINT8,           /* 14 */
  CMP_TYPE_UINT16,          /* 15 */
  CMP_TYPE_UINT32,          /* 16 */
  CMP_TYPE_UINT64,          /* 17 */
  CMP_TYPE_SINT8,           /* 18 */
  CMP_TYPE_SINT16,          /* 19 */
  CMP_TYPE_SINT32,          /* 20 */
  CMP_TYPE_SINT64,          /* 21 */
  CMP_TYPE_FIXEXT1,         /* 22 */
  CMP_TYPE_FIXEXT2,         /* 23 */
  CMP_TYPE_FIXEXT4,         /* 24 */
  CMP_TYPE_FIXEXT8,         /* 25 */
  CMP_TYPE_FIXEXT16,        /* 26 */
  CMP_TYPE_STR8,            /* 27 */
  CMP_TYPE_STR16,           /* 28 */
  CMP_TYPE_STR32,           /* 29 */
  CMP_TYPE_ARRAY16,         /* 30 */
  CMP_TYPE_ARRAY32,         /* 31 */
  CMP_TYPE_MAP16,           /* 32 */
  CMP_TYPE_MAP32,           /* 33 */
  CMP_TYPE_NEGATIVE_FIXNUM  /* 34 */
};

typedef struct cmp_ext_s {
  int8_t type;
  uint32_t size;
} cmp_ext_t;

union cmp_object_data_u {
  bool      boolean;
  uint8_t   u8;
  uint16_t  u16;
  uint32_t  u32;
  uint64_t  u64;
  int8_t    s8;
  int16_t   s16;
  int32_t   s32;
  int64_t   s64;
  float     flt;
  double    dbl;
  uint32_t  array_size;
  uint32_t  map_size;
  uint32_t  str_size;
  uint32_t  bin_size;
  cmp_ext_t ext;
};

typedef struct cmp_ctx_s {
  uint8_t     error;
  void       *buf;
  cmp_reader  read;
  cmp_writer  write;
} cmp_ctx_t;

typedef struct cmp_object_s {
  uint8_t type;
  union cmp_object_data_u as;
} cmp_object_t;

#ifdef __cplusplus
extern "C" {
#endif
  
  /*
   * ============================================================================
   * === Main API
   * ============================================================================
   */
  
  /* Initializes a CMP context */
  void cmp_init(cmp_ctx_t *ctx, void *buf, cmp_reader read, cmp_writer write);
  
  /* Returns CMP's version */
  uint32_t cmp_version(void);
  
  /* Returns the MessagePack version employed by CMP */
  uint32_t cmp_mp_version(void);
  
  /* Returns a string description of a CMP context's error */
  const char* cmp_strerror(cmp_ctx_t *ctx);
  
  /* Writes a signed integer to the backend */
  bool cmp_write_sint(cmp_ctx_t *ctx, int64_t d);
  
  /* Writes an unsigned integer to the backend */
  bool cmp_write_uint(cmp_ctx_t *ctx, uint64_t u);
  
  /* Writes a single-precision float to the backend */
  bool cmp_write_float(cmp_ctx_t *ctx, float f);
  
  /* Writes a double-precision float to the backend */
  bool cmp_write_double(cmp_ctx_t *ctx, double d);
  
  /* Writes NULL to the backend */
  bool cmp_write_nil(cmp_ctx_t *ctx);
  
  /* Writes true to the backend */
  bool cmp_write_true(cmp_ctx_t *ctx);
  
  /* Writes false to the backend */
  bool cmp_write_false(cmp_ctx_t *ctx);
  
  /* Writes a boolean value to the backend */
  bool cmp_write_bool(cmp_ctx_t *ctx, bool b);
  
  /*
   * Writes an unsigned char's value to the backend as a boolean.  This is useful
   * if you are using a different boolean type in your application.
   */
  bool cmp_write_u8_as_bool(cmp_ctx_t *ctx, uint8_t b);
  
  /*
   * Writes a string to the backend; according to the MessagePack spec, this must
   * be encoded using UTF-8, but CMP leaves that job up to the programmer.
   */
  bool cmp_write_str(cmp_ctx_t *ctx, const char *data, uint32_t size);
  
  /*
   * Writes the string marker to the backend.  This is useful if you are writing
   * data in chunks instead of a single shot.
   */
  bool cmp_write_str_marker(cmp_ctx_t *ctx, uint32_t size);
  
  /* Writes binary data to the backend */
  bool cmp_write_bin(cmp_ctx_t *ctx, const void *data, uint32_t size);
  
  /*
   * Writes the binary data marker to the backend.  This is useful if you are
   * writing data in chunks instead of a single shot.
   */
  bool cmp_write_bin_marker(cmp_ctx_t *ctx, uint32_t size);
  
  /* Writes an array to the backend. */
  bool cmp_write_array(cmp_ctx_t *ctx, uint32_t size);
  
  /* Writes a map to the backend. */
  bool cmp_write_map(cmp_ctx_t *ctx, uint32_t size);
  
  /* Writes an extended type to the backend */
  bool cmp_write_ext(cmp_ctx_t *ctx, int8_t type, uint32_t size,
                     const void *data);
  
  /*
   * Writes the extended type marker to the backend.  This is useful if you want
   * to write the type's data in chunks instead of a single shot.
   */
  bool cmp_write_ext_marker(cmp_ctx_t *ctx, int8_t type, uint32_t size);
  
  /* Writes an object to the backend */
  bool cmp_write_object(cmp_ctx_t *ctx, cmp_object_t *obj);
  
  /* Reads a signed integer that fits inside a signed char */
  bool cmp_read_char(cmp_ctx_t *ctx, int8_t *c);
  
  /* Reads a signed integer that fits inside a signed short */
  bool cmp_read_short(cmp_ctx_t *ctx, int16_t *s);
  
  /* Reads a signed integer that fits inside a signed int */
  bool cmp_read_int(cmp_ctx_t *ctx, int32_t *i);
  
  /* Reads a signed integer that fits inside a signed long */
  bool cmp_read_long(cmp_ctx_t *ctx, int64_t *d);
  
  /* Reads a signed integer */
  bool cmp_read_sinteger(cmp_ctx_t *ctx, int64_t *d);
  
  /* Reads an unsigned integer that fits inside an unsigned char */
  bool cmp_read_uchar(cmp_ctx_t *ctx, uint8_t *c);
  
  /* Reads an unsigned integer that fits inside an unsigned short */
  bool cmp_read_ushort(cmp_ctx_t *ctx, uint16_t *s);
  
  /* Reads an unsigned integer that fits inside an unsigned int */
  bool cmp_read_uint(cmp_ctx_t *ctx, uint32_t *i);
  
  /* Reads an unsigned integer that fits inside an unsigned long */
  bool cmp_read_ulong(cmp_ctx_t *ctx, uint64_t *u);
  
  /* Reads an unsigned integer */
  bool cmp_read_uinteger(cmp_ctx_t *ctx, uint64_t *u);
  
  /* Reads a single-precision float from the backend */
  bool cmp_read_float(cmp_ctx_t *ctx, float *f);
  
  /* Reads a double-precision float from the backend */
  bool cmp_read_double(cmp_ctx_t *ctx, double *d);
  
  /* "Reads" (more like "skips") a NULL value from the backend */
  bool cmp_read_nil(cmp_ctx_t *ctx);
  
  /* Reads a boolean from the backend */
  bool cmp_read_bool(cmp_ctx_t *ctx, bool *b);
  
  /*
   * Reads a boolean as an unsigned char from the backend; this is useful if your
   * application uses a different boolean type.
   */
  bool cmp_read_bool_as_u8(cmp_ctx_t *ctx, uint8_t *b);
  
  /* Reads a string's size from the backend */
  bool cmp_read_str_size(cmp_ctx_t *ctx, uint32_t *size);
  
  /*
   * Reads a string from the backend; according to the spec, the string's data
   * ought to be encoded using UTF-8,
   */
  bool cmp_read_str(cmp_ctx_t *ctx, char *data, uint32_t *size);
  
  /* Reads the size of packed binary data from the backend */
  bool cmp_read_bin_size(cmp_ctx_t *ctx, uint32_t *size);
  
  /* Reads packed binary data from the backend */
  bool cmp_read_bin(cmp_ctx_t *ctx, void *data, uint32_t *size);
  
  /* Reads an array from the backend */
  bool cmp_read_array(cmp_ctx_t *ctx, uint32_t *size);
  
  /* Reads a map from the backend */
  bool cmp_read_map(cmp_ctx_t *ctx, uint32_t *size);
  
  /* Reads the extended type's marker from the backend */
  bool cmp_read_ext_marker(cmp_ctx_t *ctx, int8_t *type, uint32_t *size);
  
  /* Reads an extended type from the backend */
  bool cmp_read_ext(cmp_ctx_t *ctx, int8_t *type, uint32_t *size, void *data);
  
  /* Reads an object from the backend */
  bool cmp_read_object(cmp_ctx_t *ctx, cmp_object_t *obj);
  
  /*
   * ============================================================================
   * === Specific API
   * ============================================================================
   */
  
  bool cmp_write_pfix(cmp_ctx_t *ctx, uint8_t c);
  bool cmp_write_nfix(cmp_ctx_t *ctx, int8_t c);
  
  bool cmp_write_sfix(cmp_ctx_t *ctx, int8_t c);
  bool cmp_write_s8(cmp_ctx_t *ctx, int8_t c);
  bool cmp_write_s16(cmp_ctx_t *ctx, int16_t s);
  bool cmp_write_s32(cmp_ctx_t *ctx, int32_t i);
  bool cmp_write_s64(cmp_ctx_t *ctx, int64_t l);
  
  bool cmp_write_ufix(cmp_ctx_t *ctx, uint8_t c);
  bool cmp_write_u8(cmp_ctx_t *ctx, uint8_t c);
  bool cmp_write_u16(cmp_ctx_t *ctx, uint16_t s);
  bool cmp_write_u32(cmp_ctx_t *ctx, uint32_t i);
  bool cmp_write_u64(cmp_ctx_t *ctx, uint64_t l);
  
  bool cmp_write_fixstr_marker(cmp_ctx_t *ctx, uint8_t size);
  bool cmp_write_fixstr(cmp_ctx_t *ctx, const char *data, uint8_t size);
  bool cmp_write_str8_marker(cmp_ctx_t *ctx, uint8_t size);
  bool cmp_write_str8(cmp_ctx_t *ctx, const char *data, uint8_t size);
  bool cmp_write_str16_marker(cmp_ctx_t *ctx, uint16_t size);
  bool cmp_write_str16(cmp_ctx_t *ctx, const char *data, uint16_t size);
  bool cmp_write_str32_marker(cmp_ctx_t *ctx, uint32_t size);
  bool cmp_write_str32(cmp_ctx_t *ctx, const char *data, uint32_t size);
  
  bool cmp_write_bin8_marker(cmp_ctx_t *ctx, uint8_t size);
  bool cmp_write_bin8(cmp_ctx_t *ctx, const void *data, uint8_t size);
  bool cmp_write_bin16_marker(cmp_ctx_t *ctx, uint16_t size);
  bool cmp_write_bin16(cmp_ctx_t *ctx, const void *data, uint16_t size);
  bool cmp_write_bin32_marker(cmp_ctx_t *ctx, uint32_t size);
  bool cmp_write_bin32(cmp_ctx_t *ctx, const void *data, uint32_t size);
  
  bool cmp_write_fixarray(cmp_ctx_t *ctx, uint8_t size);
  bool cmp_write_array16(cmp_ctx_t *ctx, uint16_t size);
  bool cmp_write_array32(cmp_ctx_t *ctx, uint32_t size);
  
  bool cmp_write_fixmap(cmp_ctx_t *ctx, uint8_t size);
  bool cmp_write_map16(cmp_ctx_t *ctx, uint16_t size);
  bool cmp_write_map32(cmp_ctx_t *ctx, uint32_t size);
  
  bool cmp_write_fixext1_marker(cmp_ctx_t *ctx, int8_t type);
  bool cmp_write_fixext1(cmp_ctx_t *ctx, int8_t type, const void *data);
  bool cmp_write_fixext2_marker(cmp_ctx_t *ctx, int8_t type);
  bool cmp_write_fixext2(cmp_ctx_t *ctx, int8_t type, const void *data);
  bool cmp_write_fixext4_marker(cmp_ctx_t *ctx, int8_t type);
  bool cmp_write_fixext4(cmp_ctx_t *ctx, int8_t type, const void *data);
  bool cmp_write_fixext8_marker(cmp_ctx_t *ctx, int8_t type);
  bool cmp_write_fixext8(cmp_ctx_t *ctx, int8_t type, const void *data);
  bool cmp_write_fixext16_marker(cmp_ctx_t *ctx, int8_t type);
  bool cmp_write_fixext16(cmp_ctx_t *ctx, int8_t type, const void *data);
  
  bool cmp_write_ext8_marker(cmp_ctx_t *ctx, int8_t type, uint8_t size);
  bool cmp_write_ext8(cmp_ctx_t *ctx, int8_t type, uint8_t size,
                      const void *data);
  bool cmp_write_ext16_marker(cmp_ctx_t *ctx, int8_t type, uint16_t size);
  bool cmp_write_ext16(cmp_ctx_t *ctx, int8_t type, uint16_t size,
                       const void *data);
  bool cmp_write_ext32_marker(cmp_ctx_t *ctx, int8_t type, uint32_t size);
  bool cmp_write_ext32(cmp_ctx_t *ctx, int8_t type, uint32_t size,
                       const void *data);
  
  bool cmp_read_pfix(cmp_ctx_t *ctx, uint8_t *c);
  bool cmp_read_nfix(cmp_ctx_t *ctx, int8_t *c);
  
  bool cmp_read_sfix(cmp_ctx_t *ctx, int8_t *c);
  bool cmp_read_s8(cmp_ctx_t *ctx, int8_t *c);
  bool cmp_read_s16(cmp_ctx_t *ctx, int16_t *s);
  bool cmp_read_s32(cmp_ctx_t *ctx, int32_t *i);
  bool cmp_read_s64(cmp_ctx_t *ctx, int64_t *l);
  
  bool cmp_read_ufix(cmp_ctx_t *ctx, uint8_t *c);
  bool cmp_read_u8(cmp_ctx_t *ctx, uint8_t *c);
  bool cmp_read_u16(cmp_ctx_t *ctx, uint16_t *s);
  bool cmp_read_u32(cmp_ctx_t *ctx, uint32_t *i);
  bool cmp_read_u64(cmp_ctx_t *ctx, uint64_t *l);
  
  bool cmp_read_fixext1_marker(cmp_ctx_t *ctx, int8_t *type);
  bool cmp_read_fixext1(cmp_ctx_t *ctx, int8_t *type, void *data);
  bool cmp_read_fixext2_marker(cmp_ctx_t *ctx, int8_t *type);
  bool cmp_read_fixext2(cmp_ctx_t *ctx, int8_t *type, void *data);
  bool cmp_read_fixext4_marker(cmp_ctx_t *ctx, int8_t *type);
  bool cmp_read_fixext4(cmp_ctx_t *ctx, int8_t *type, void *data);
  bool cmp_read_fixext8_marker(cmp_ctx_t *ctx, int8_t *type);
  bool cmp_read_fixext8(cmp_ctx_t *ctx, int8_t *type, void *data);
  bool cmp_read_fixext16_marker(cmp_ctx_t *ctx, int8_t *type);
  bool cmp_read_fixext16(cmp_ctx_t *ctx, int8_t *type, void *data);
  
  bool cmp_read_ext8_marker(cmp_ctx_t *ctx, int8_t *type, uint8_t *size);
  bool cmp_read_ext8(cmp_ctx_t *ctx, int8_t *type, uint8_t *size, void *data);
  bool cmp_read_ext16_marker(cmp_ctx_t *ctx, int8_t *type, uint16_t *size);
  bool cmp_read_ext16(cmp_ctx_t *ctx, int8_t *type, uint16_t *size, void *data);
  bool cmp_read_ext32_marker(cmp_ctx_t *ctx, int8_t *type, uint32_t *size);
  bool cmp_read_ext32(cmp_ctx_t *ctx, int8_t *type, uint32_t *size, void *data);
  
  /*
   * ============================================================================
   * === Object API
   * ============================================================================
   */
  
  bool cmp_object_is_char(cmp_object_t *obj);
  bool cmp_object_is_short(cmp_object_t *obj);
  bool cmp_object_is_int(cmp_object_t *obj);
  bool cmp_object_is_long(cmp_object_t *obj);
  bool cmp_object_is_sinteger(cmp_object_t *obj);
  bool cmp_object_is_uchar(cmp_object_t *obj);
  bool cmp_object_is_ushort(cmp_object_t *obj);
  bool cmp_object_is_uint(cmp_object_t *obj);
  bool cmp_object_is_ulong(cmp_object_t *obj);
  bool cmp_object_is_uinteger(cmp_object_t *obj);
  bool cmp_object_is_float(cmp_object_t *obj);
  bool cmp_object_is_double(cmp_object_t *obj);
  bool cmp_object_is_nil(cmp_object_t *obj);
  bool cmp_object_is_bool(cmp_object_t *obj);
  bool cmp_object_is_str(cmp_object_t *obj);
  bool cmp_object_is_bin(cmp_object_t *obj);
  bool cmp_object_is_array(cmp_object_t *obj);
  bool cmp_object_is_map(cmp_object_t *obj);
  bool cmp_object_is_ext(cmp_object_t *obj);
  
  bool cmp_object_as_char(cmp_object_t *obj, int8_t *c);
  bool cmp_object_as_short(cmp_object_t *obj, int16_t *s);
  bool cmp_object_as_int(cmp_object_t *obj, int32_t *i);
  bool cmp_object_as_long(cmp_object_t *obj, int64_t *d);
  bool cmp_object_as_sinteger(cmp_object_t *obj, int64_t *d);
  bool cmp_object_as_uchar(cmp_object_t *obj, uint8_t *c);
  bool cmp_object_as_ushort(cmp_object_t *obj, uint16_t *s);
  bool cmp_object_as_uint(cmp_object_t *obj, uint32_t *i);
  bool cmp_object_as_ulong(cmp_object_t *obj, uint64_t *u);
  bool cmp_object_as_uinteger(cmp_object_t *obj, uint64_t *u);
  bool cmp_object_as_float(cmp_object_t *obj, float *f);
  bool cmp_object_as_double(cmp_object_t *obj, double *d);
  bool cmp_object_as_bool(cmp_object_t *obj, bool *b);
  bool cmp_object_as_str(cmp_object_t *obj, uint32_t *size);
  bool cmp_object_as_bin(cmp_object_t *obj, uint32_t *size);
  bool cmp_object_as_array(cmp_object_t *obj, uint32_t *size);
  bool cmp_object_as_map(cmp_object_t *obj, uint32_t *size);
  bool cmp_object_as_ext(cmp_object_t *obj, int8_t *type, uint32_t *size);
  
#ifdef __cplusplus
} /* extern "C" */
#endif

#endif /* CMP_H__ */

/* vi: set et ts=2 sw=2: */
