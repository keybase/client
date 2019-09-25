#ifdef __OBJC__
#import <UIKit/UIKit.h>
#else
#ifndef FOUNDATION_EXPORT
#if defined(__cplusplus)
#define FOUNDATION_EXPORT extern "C"
#else
#define FOUNDATION_EXPORT extern
#endif
#endif
#endif

#import "bit_reader_inl_utils.h"
#import "bit_reader_utils.h"
#import "bit_writer_utils.h"
#import "color_cache_utils.h"
#import "endian_inl_utils.h"
#import "filters_utils.h"
#import "huffman_encode_utils.h"
#import "huffman_utils.h"
#import "quant_levels_dec_utils.h"
#import "quant_levels_utils.h"
#import "random_utils.h"
#import "rescaler_utils.h"
#import "thread_utils.h"
#import "utils.h"
#import "common_sse2.h"
#import "common_sse41.h"
#import "dsp.h"
#import "lossless.h"
#import "lossless_common.h"
#import "mips_macro.h"
#import "msa_macro.h"
#import "neon.h"
#import "quant.h"
#import "yuv.h"
#import "backward_references_enc.h"
#import "cost_enc.h"
#import "histogram_enc.h"
#import "vp8i_enc.h"
#import "vp8li_enc.h"
#import "alphai_dec.h"
#import "common_dec.h"
#import "vp8i_dec.h"
#import "vp8li_dec.h"
#import "vp8_dec.h"
#import "webpi_dec.h"
#import "animi.h"
#import "muxi.h"
#import "webp/decode.h"
#import "webp/demux.h"
#import "webp/encode.h"
#import "webp/format_constants.h"
#import "webp/mux.h"
#import "webp/mux_types.h"
#import "webp/types.h"

FOUNDATION_EXPORT double libwebpVersionNumber;
FOUNDATION_EXPORT const unsigned char libwebpVersionString[];

