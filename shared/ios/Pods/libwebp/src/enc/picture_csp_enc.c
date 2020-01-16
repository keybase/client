// Copyright 2014 Google Inc. All Rights Reserved.
//
// Use of this source code is governed by a BSD-style license
// that can be found in the COPYING file in the root of the source
// tree. An additional intellectual property rights grant can be found
// in the file PATENTS. All contributing project authors may
// be found in the AUTHORS file in the root of the source tree.
// -----------------------------------------------------------------------------
//
// WebPPicture utils for colorspace conversion
//
// Author: Skal (pascal.massimino@gmail.com)

#include <assert.h>
#include <stdlib.h>
#include <math.h>

#include "src/enc/vp8i_enc.h"
#include "src/utils/random_utils.h"
#include "src/utils/utils.h"
#include "src/dsp/dsp.h"
#include "src/dsp/lossless.h"
#include "src/dsp/yuv.h"

// Uncomment to disable gamma-compression during RGB->U/V averaging
#define USE_GAMMA_COMPRESSION

// If defined, use table to compute x / alpha.
#define USE_INVERSE_ALPHA_TABLE

#ifdef WORDS_BIGENDIAN
// uint32_t 0xff000000 is 0xff,00,00,00 in memory
#define CHANNEL_OFFSET(i) (i)
#else
// uint32_t 0xff000000 is 0x00,00,00,ff in memory
#define CHANNEL_OFFSET(i) (3-(i))
#endif

#define ALPHA_OFFSET CHANNEL_OFFSET(0)

//------------------------------------------------------------------------------
// Detection of non-trivial transparency

// Returns true if alpha[] has non-0xff values.
static int CheckNonOpaque(const uint8_t* alpha, int width, int height,
                          int x_step, int y_step) {
  if (alpha == NULL) return 0;
  WebPInitAlphaProcessing();
  if (x_step == 1) {
    for (; height-- > 0; alpha += y_step) {
      if (WebPHasAlpha8b(alpha, width)) return 1;
    }
  } else {
    for (; height-- > 0; alpha += y_step) {
      if (WebPHasAlpha32b(alpha, width)) return 1;
    }
  }
  return 0;
}

// Checking for the presence of non-opaque alpha.
int WebPPictureHasTransparency(const WebPPicture* picture) {
  if (picture == NULL) return 0;
  if (!picture->use_argb) {
    return CheckNonOpaque(picture->a, picture->width, picture->height,
                          1, picture->a_stride);
  } else {
    const int alpha_offset = ALPHA_OFFSET;
    return CheckNonOpaque((const uint8_t*)picture->argb + alpha_offset,
                          picture->width, picture->height,
                          4, picture->argb_stride * sizeof(*picture->argb));
  }
  return 0;
}

//------------------------------------------------------------------------------
// Code for gamma correction

#if defined(USE_GAMMA_COMPRESSION)

// gamma-compensates loss of resolution during chroma subsampling
#define kGamma 0.80      // for now we use a different gamma value than kGammaF
#define kGammaFix 12     // fixed-point precision for linear values
#define kGammaScale ((1 << kGammaFix) - 1)
#define kGammaTabFix 7   // fixed-point fractional bits precision
#define kGammaTabScale (1 << kGammaTabFix)
#define kGammaTabRounder (kGammaTabScale >> 1)
#define kGammaTabSize (1 << (kGammaFix - kGammaTabFix))

static int kLinearToGammaTab[kGammaTabSize + 1];
static uint16_t kGammaToLinearTab[256];
static volatile int kGammaTablesOk = 0;

static WEBP_TSAN_IGNORE_FUNCTION void InitGammaTables(void) {
  if (!kGammaTablesOk) {
    int v;
    const double scale = (double)(1 << kGammaTabFix) / kGammaScale;
    const double norm = 1. / 255.;
    for (v = 0; v <= 255; ++v) {
      kGammaToLinearTab[v] =
          (uint16_t)(pow(norm * v, kGamma) * kGammaScale + .5);
    }
    for (v = 0; v <= kGammaTabSize; ++v) {
      kLinearToGammaTab[v] = (int)(255. * pow(scale * v, 1. / kGamma) + .5);
    }
    kGammaTablesOk = 1;
  }
}

static WEBP_INLINE uint32_t GammaToLinear(uint8_t v) {
  return kGammaToLinearTab[v];
}

static WEBP_INLINE int Interpolate(int v) {
  const int tab_pos = v >> (kGammaTabFix + 2);    // integer part
  const int x = v & ((kGammaTabScale << 2) - 1);  // fractional part
  const int v0 = kLinearToGammaTab[tab_pos];
  const int v1 = kLinearToGammaTab[tab_pos + 1];
  const int y = v1 * x + v0 * ((kGammaTabScale << 2) - x);   // interpolate
  assert(tab_pos + 1 < kGammaTabSize + 1);
  return y;
}

// Convert a linear value 'v' to YUV_FIX+2 fixed-point precision
// U/V value, suitable for RGBToU/V calls.
static WEBP_INLINE int LinearToGamma(uint32_t base_value, int shift) {
  const int y = Interpolate(base_value << shift);   // final uplifted value
  return (y + kGammaTabRounder) >> kGammaTabFix;    // descale
}

#else

static void InitGammaTables(void) {}
static WEBP_INLINE uint32_t GammaToLinear(uint8_t v) { return v; }
static WEBP_INLINE int LinearToGamma(uint32_t base_value, int shift) {
  return (int)(base_value << shift);
}

#endif    // USE_GAMMA_COMPRESSION

//------------------------------------------------------------------------------
// RGB -> YUV conversion

static int RGBToY(int r, int g, int b, VP8Random* const rg) {
  return (rg == NULL) ? VP8RGBToY(r, g, b, YUV_HALF)
                      : VP8RGBToY(r, g, b, VP8RandomBits(rg, YUV_FIX));
}

static int RGBToU(int r, int g, int b, VP8Random* const rg) {
  return (rg == NULL) ? VP8RGBToU(r, g, b, YUV_HALF << 2)
                      : VP8RGBToU(r, g, b, VP8RandomBits(rg, YUV_FIX + 2));
}

static int RGBToV(int r, int g, int b, VP8Random* const rg) {
  return (rg == NULL) ? VP8RGBToV(r, g, b, YUV_HALF << 2)
                      : VP8RGBToV(r, g, b, VP8RandomBits(rg, YUV_FIX + 2));
}

//------------------------------------------------------------------------------
// Sharp RGB->YUV conversion

static const int kNumIterations = 4;
static const int kMinDimensionIterativeConversion = 4;

// We could use SFIX=0 and only uint8_t for fixed_y_t, but it produces some
// banding sometimes. Better use extra precision.
#define SFIX 2                // fixed-point precision of RGB and Y/W
typedef int16_t fixed_t;      // signed type with extra SFIX precision for UV
typedef uint16_t fixed_y_t;   // unsigned type with extra SFIX precision for W

#define SHALF (1 << SFIX >> 1)
#define MAX_Y_T ((256 << SFIX) - 1)
#define SROUNDER (1 << (YUV_FIX + SFIX - 1))

#if defined(USE_GAMMA_COMPRESSION)

// We use tables of different size and precision for the Rec709 / BT2020
// transfer function.
#define kGammaF (1./0.45)
static uint32_t kLinearToGammaTabS[kGammaTabSize + 2];
#define GAMMA_TO_LINEAR_BITS 14
static uint32_t kGammaToLinearTabS[MAX_Y_T + 1];   // size scales with Y_FIX
static volatile int kGammaTablesSOk = 0;

static WEBP_TSAN_IGNORE_FUNCTION void InitGammaTablesS(void) {
  assert(2 * GAMMA_TO_LINEAR_BITS < 32);  // we use uint32_t intermediate values
  if (!kGammaTablesSOk) {
    int v;
    const double norm = 1. / MAX_Y_T;
    const double scale = 1. / kGammaTabSize;
    const double a = 0.09929682680944;
    const double thresh = 0.018053968510807;
    const double final_scale = 1 << GAMMA_TO_LINEAR_BITS;
    for (v = 0; v <= MAX_Y_T; ++v) {
      const double g = norm * v;
      double value;
      if (g <= thresh * 4.5) {
        value = g / 4.5;
      } else {
        const double a_rec = 1. / (1. + a);
        value = pow(a_rec * (g + a), kGammaF);
      }
      kGammaToLinearTabS[v] = (uint32_t)(value * final_scale + .5);
    }
    for (v = 0; v <= kGammaTabSize; ++v) {
      const double g = scale * v;
      double value;
      if (g <= thresh) {
        value = 4.5 * g;
      } else {
        value = (1. + a) * pow(g, 1. / kGammaF) - a;
      }
      // we already incorporate the 1/2 rounding constant here
      kLinearToGammaTabS[v] =
          (uint32_t)(MAX_Y_T * value) + (1 << GAMMA_TO_LINEAR_BITS >> 1);
    }
    // to prevent small rounding errors to cause read-overflow:
    kLinearToGammaTabS[kGammaTabSize + 1] = kLinearToGammaTabS[kGammaTabSize];
    kGammaTablesSOk = 1;
  }
}

// return value has a fixed-point precision of GAMMA_TO_LINEAR_BITS
static WEBP_INLINE uint32_t GammaToLinearS(int v) {
  return kGammaToLinearTabS[v];
}

static WEBP_INLINE uint32_t LinearToGammaS(uint32_t value) {
  // 'value' is in GAMMA_TO_LINEAR_BITS fractional precision
  const uint32_t v = value * kGammaTabSize;
  const uint32_t tab_pos = v >> GAMMA_TO_LINEAR_BITS;
  // fractional part, in GAMMA_TO_LINEAR_BITS fixed-point precision
  const uint32_t x = v - (tab_pos << GAMMA_TO_LINEAR_BITS);  // fractional part
  // v0 / v1 are in GAMMA_TO_LINEAR_BITS fixed-point precision (range [0..1])
  const uint32_t v0 = kLinearToGammaTabS[tab_pos + 0];
  const uint32_t v1 = kLinearToGammaTabS[tab_pos + 1];
  // Final interpolation. Note that rounding is already included.
  const uint32_t v2 = (v1 - v0) * x;    // note: v1 >= v0.
  const uint32_t result = v0 + (v2 >> GAMMA_TO_LINEAR_BITS);
  return result;
}

#else

static void InitGammaTablesS(void) {}
static WEBP_INLINE uint32_t GammaToLinearS(int v) {
  return (v << GAMMA_TO_LINEAR_BITS) / MAX_Y_T;
}
static WEBP_INLINE uint32_t LinearToGammaS(uint32_t value) {
  return (MAX_Y_T * value) >> GAMMA_TO_LINEAR_BITS;
}

#endif    // USE_GAMMA_COMPRESSION

//------------------------------------------------------------------------------

static uint8_t clip_8b(fixed_t v) {
  return (!(v & ~0xff)) ? (uint8_t)v : (v < 0) ? 0u : 255u;
}

static fixed_y_t clip_y(int y) {
  return (!(y & ~MAX_Y_T)) ? (fixed_y_t)y : (y < 0) ? 0 : MAX_Y_T;
}

//------------------------------------------------------------------------------

static int RGBToGray(int r, int g, int b) {
  const int luma = 13933 * r + 46871 * g + 4732 * b + YUV_HALF;
  return (luma >> YUV_FIX);
}

static uint32_t ScaleDown(int a, int b, int c, int d) {
  const uint32_t A = GammaToLinearS(a);
  const uint32_t B = GammaToLinearS(b);
  const uint32_t C = GammaToLinearS(c);
  const uint32_t D = GammaToLinearS(d);
  return LinearToGammaS((A + B + C + D + 2) >> 2);
}

static WEBP_INLINE void UpdateW(const fixed_y_t* src, fixed_y_t* dst, int w) {
  int i;
  for (i = 0; i < w; ++i) {
    const uint32_t R = GammaToLinearS(src[0 * w + i]);
    const uint32_t G = GammaToLinearS(src[1 * w + i]);
    const uint32_t B = GammaToLinearS(src[2 * w + i]);
    const uint32_t Y = RGBToGray(R, G, B);
    dst[i] = (fixed_y_t)LinearToGammaS(Y);
  }
}

static void UpdateChroma(const fixed_y_t* src1, const fixed_y_t* src2,
                         fixed_t* dst, int uv_w) {
  int i;
  for (i = 0; i < uv_w; ++i) {
    const int r = ScaleDown(src1[0 * uv_w + 0], src1[0 * uv_w + 1],
                            src2[0 * uv_w + 0], src2[0 * uv_w + 1]);
    const int g = ScaleDown(src1[2 * uv_w + 0], src1[2 * uv_w + 1],
                            src2[2 * uv_w + 0], src2[2 * uv_w + 1]);
    const int b = ScaleDown(src1[4 * uv_w + 0], src1[4 * uv_w + 1],
                            src2[4 * uv_w + 0], src2[4 * uv_w + 1]);
    const int W = RGBToGray(r, g, b);
    dst[0 * uv_w] = (fixed_t)(r - W);
    dst[1 * uv_w] = (fixed_t)(g - W);
    dst[2 * uv_w] = (fixed_t)(b - W);
    dst  += 1;
    src1 += 2;
    src2 += 2;
  }
}

static void StoreGray(const fixed_y_t* rgb, fixed_y_t* y, int w) {
  int i;
  for (i = 0; i < w; ++i) {
    y[i] = RGBToGray(rgb[0 * w + i], rgb[1 * w + i], rgb[2 * w + i]);
  }
}

//------------------------------------------------------------------------------

static WEBP_INLINE fixed_y_t Filter2(int A, int B, int W0) {
  const int v0 = (A * 3 + B + 2) >> 2;
  return clip_y(v0 + W0);
}

//------------------------------------------------------------------------------

static WEBP_INLINE fixed_y_t UpLift(uint8_t a) {  // 8bit -> SFIX
  return ((fixed_y_t)a << SFIX) | SHALF;
}

static void ImportOneRow(const uint8_t* const r_ptr,
                         const uint8_t* const g_ptr,
                         const uint8_t* const b_ptr,
                         int step,
                         int pic_width,
                         fixed_y_t* const dst) {
  int i;
  const int w = (pic_width + 1) & ~1;
  for (i = 0; i < pic_width; ++i) {
    const int off = i * step;
    dst[i + 0 * w] = UpLift(r_ptr[off]);
    dst[i + 1 * w] = UpLift(g_ptr[off]);
    dst[i + 2 * w] = UpLift(b_ptr[off]);
  }
  if (pic_width & 1) {  // replicate rightmost pixel
    dst[pic_width + 0 * w] = dst[pic_width + 0 * w - 1];
    dst[pic_width + 1 * w] = dst[pic_width + 1 * w - 1];
    dst[pic_width + 2 * w] = dst[pic_width + 2 * w - 1];
  }
}

static void InterpolateTwoRows(const fixed_y_t* const best_y,
                               const fixed_t* prev_uv,
                               const fixed_t* cur_uv,
                               const fixed_t* next_uv,
                               int w,
                               fixed_y_t* out1,
                               fixed_y_t* out2) {
  const int uv_w = w >> 1;
  const int len = (w - 1) >> 1;   // length to filter
  int k = 3;
  while (k-- > 0) {   // process each R/G/B segments in turn
    // special boundary case for i==0
    out1[0] = Filter2(cur_uv[0], prev_uv[0], best_y[0]);
    out2[0] = Filter2(cur_uv[0], next_uv[0], best_y[w]);

    WebPSharpYUVFilterRow(cur_uv, prev_uv, len, best_y + 0 + 1, out1 + 1);
    WebPSharpYUVFilterRow(cur_uv, next_uv, len, best_y + w + 1, out2 + 1);

    // special boundary case for i == w - 1 when w is even
    if (!(w & 1)) {
      out1[w - 1] = Filter2(cur_uv[uv_w - 1], prev_uv[uv_w - 1],
                            best_y[w - 1 + 0]);
      out2[w - 1] = Filter2(cur_uv[uv_w - 1], next_uv[uv_w - 1],
                            best_y[w - 1 + w]);
    }
    out1 += w;
    out2 += w;
    prev_uv += uv_w;
    cur_uv  += uv_w;
    next_uv += uv_w;
  }
}

static WEBP_INLINE uint8_t ConvertRGBToY(int r, int g, int b) {
  const int luma = 16839 * r + 33059 * g + 6420 * b + SROUNDER;
  return clip_8b(16 + (luma >> (YUV_FIX + SFIX)));
}

static WEBP_INLINE uint8_t ConvertRGBToU(int r, int g, int b) {
  const int u =  -9719 * r - 19081 * g + 28800 * b + SROUNDER;
  return clip_8b(128 + (u >> (YUV_FIX + SFIX)));
}

static WEBP_INLINE uint8_t ConvertRGBToV(int r, int g, int b) {
  const int v = +28800 * r - 24116 * g -  4684 * b + SROUNDER;
  return clip_8b(128 + (v >> (YUV_FIX + SFIX)));
}

static int ConvertWRGBToYUV(const fixed_y_t* best_y, const fixed_t* best_uv,
                            WebPPicture* const picture) {
  int i, j;
  uint8_t* dst_y = picture->y;
  uint8_t* dst_u = picture->u;
  uint8_t* dst_v = picture->v;
  const fixed_t* const best_uv_base = best_uv;
  const int w = (picture->width + 1) & ~1;
  const int h = (picture->height + 1) & ~1;
  const int uv_w = w >> 1;
  const int uv_h = h >> 1;
  for (best_uv = best_uv_base, j = 0; j < picture->height; ++j) {
    for (i = 0; i < picture->width; ++i) {
      const int off = (i >> 1);
      const int W = best_y[i];
      const int r = best_uv[off + 0 * uv_w] + W;
      const int g = best_uv[off + 1 * uv_w] + W;
      const int b = best_uv[off + 2 * uv_w] + W;
      dst_y[i] = ConvertRGBToY(r, g, b);
    }
    best_y += w;
    best_uv += (j & 1) * 3 * uv_w;
    dst_y += picture->y_stride;
  }
  for (best_uv = best_uv_base, j = 0; j < uv_h; ++j) {
    for (i = 0; i < uv_w; ++i) {
      const int off = i;
      const int r = best_uv[off + 0 * uv_w];
      const int g = best_uv[off + 1 * uv_w];
      const int b = best_uv[off + 2 * uv_w];
      dst_u[i] = ConvertRGBToU(r, g, b);
      dst_v[i] = ConvertRGBToV(r, g, b);
    }
    best_uv += 3 * uv_w;
    dst_u += picture->uv_stride;
    dst_v += picture->uv_stride;
  }
  return 1;
}

//------------------------------------------------------------------------------
// Main function

#define SAFE_ALLOC(W, H, T) ((T*)WebPSafeMalloc((W) * (H), sizeof(T)))

static int PreprocessARGB(const uint8_t* r_ptr,
                          const uint8_t* g_ptr,
                          const uint8_t* b_ptr,
                          int step, int rgb_stride,
                          WebPPicture* const picture) {
  // we expand the right/bottom border if needed
  const int w = (picture->width + 1) & ~1;
  const int h = (picture->height + 1) & ~1;
  const int uv_w = w >> 1;
  const int uv_h = h >> 1;
  uint64_t prev_diff_y_sum = ~0;
  int j, iter;

  // TODO(skal): allocate one big memory chunk. But for now, it's easier
  // for valgrind debugging to have several chunks.
  fixed_y_t* const tmp_buffer = SAFE_ALLOC(w * 3, 2, fixed_y_t);   // scratch
  fixed_y_t* const best_y_base = SAFE_ALLOC(w, h, fixed_y_t);
  fixed_y_t* const target_y_base = SAFE_ALLOC(w, h, fixed_y_t);
  fixed_y_t* const best_rgb_y = SAFE_ALLOC(w, 2, fixed_y_t);
  fixed_t* const best_uv_base = SAFE_ALLOC(uv_w * 3, uv_h, fixed_t);
  fixed_t* const target_uv_base = SAFE_ALLOC(uv_w * 3, uv_h, fixed_t);
  fixed_t* const best_rgb_uv = SAFE_ALLOC(uv_w * 3, 1, fixed_t);
  fixed_y_t* best_y = best_y_base;
  fixed_y_t* target_y = target_y_base;
  fixed_t* best_uv = best_uv_base;
  fixed_t* target_uv = target_uv_base;
  const uint64_t diff_y_threshold = (uint64_t)(3.0 * w * h);
  int ok;

  if (best_y_base == NULL || best_uv_base == NULL ||
      target_y_base == NULL || target_uv_base == NULL ||
      best_rgb_y == NULL || best_rgb_uv == NULL ||
      tmp_buffer == NULL) {
    ok = WebPEncodingSetError(picture, VP8_ENC_ERROR_OUT_OF_MEMORY);
    goto End;
  }
  assert(picture->width >= kMinDimensionIterativeConversion);
  assert(picture->height >= kMinDimensionIterativeConversion);

  WebPInitConvertARGBToYUV();

  // Import RGB samples to W/RGB representation.
  for (j = 0; j < picture->height; j += 2) {
    const int is_last_row = (j == picture->height - 1);
    fixed_y_t* const src1 = tmp_buffer + 0 * w;
    fixed_y_t* const src2 = tmp_buffer + 3 * w;

    // prepare two rows of input
    ImportOneRow(r_ptr, g_ptr, b_ptr, step, picture->width, src1);
    if (!is_last_row) {
      ImportOneRow(r_ptr + rgb_stride, g_ptr + rgb_stride, b_ptr + rgb_stride,
                   step, picture->width, src2);
    } else {
      memcpy(src2, src1, 3 * w * sizeof(*src2));
    }
    StoreGray(src1, best_y + 0, w);
    StoreGray(src2, best_y + w, w);

    UpdateW(src1, target_y, w);
    UpdateW(src2, target_y + w, w);
    UpdateChroma(src1, src2, target_uv, uv_w);
    memcpy(best_uv, target_uv, 3 * uv_w * sizeof(*best_uv));
    best_y += 2 * w;
    best_uv += 3 * uv_w;
    target_y += 2 * w;
    target_uv += 3 * uv_w;
    r_ptr += 2 * rgb_stride;
    g_ptr += 2 * rgb_stride;
    b_ptr += 2 * rgb_stride;
  }

  // Iterate and resolve clipping conflicts.
  for (iter = 0; iter < kNumIterations; ++iter) {
    const fixed_t* cur_uv = best_uv_base;
    const fixed_t* prev_uv = best_uv_base;
    uint64_t diff_y_sum = 0;

    best_y = best_y_base;
    best_uv = best_uv_base;
    target_y = target_y_base;
    target_uv = target_uv_base;
    for (j = 0; j < h; j += 2) {
      fixed_y_t* const src1 = tmp_buffer + 0 * w;
      fixed_y_t* const src2 = tmp_buffer + 3 * w;
      {
        const fixed_t* const next_uv = cur_uv + ((j < h - 2) ? 3 * uv_w : 0);
        InterpolateTwoRows(best_y, prev_uv, cur_uv, next_uv, w, src1, src2);
        prev_uv = cur_uv;
        cur_uv = next_uv;
      }

      UpdateW(src1, best_rgb_y + 0 * w, w);
      UpdateW(src2, best_rgb_y + 1 * w, w);
      UpdateChroma(src1, src2, best_rgb_uv, uv_w);

      // update two rows of Y and one row of RGB
      diff_y_sum += WebPSharpYUVUpdateY(target_y, best_rgb_y, best_y, 2 * w);
      WebPSharpYUVUpdateRGB(target_uv, best_rgb_uv, best_uv, 3 * uv_w);

      best_y += 2 * w;
      best_uv += 3 * uv_w;
      target_y += 2 * w;
      target_uv += 3 * uv_w;
    }
    // test exit condition
    if (iter > 0) {
      if (diff_y_sum < diff_y_threshold) break;
      if (diff_y_sum > prev_diff_y_sum) break;
    }
    prev_diff_y_sum = diff_y_sum;
  }
  // final reconstruction
  ok = ConvertWRGBToYUV(best_y_base, best_uv_base, picture);

 End:
  WebPSafeFree(best_y_base);
  WebPSafeFree(best_uv_base);
  WebPSafeFree(target_y_base);
  WebPSafeFree(target_uv_base);
  WebPSafeFree(best_rgb_y);
  WebPSafeFree(best_rgb_uv);
  WebPSafeFree(tmp_buffer);
  return ok;
}
#undef SAFE_ALLOC

//------------------------------------------------------------------------------
// "Fast" regular RGB->YUV

#define SUM4(ptr, step) LinearToGamma(                     \
    GammaToLinear((ptr)[0]) +                              \
    GammaToLinear((ptr)[(step)]) +                         \
    GammaToLinear((ptr)[rgb_stride]) +                     \
    GammaToLinear((ptr)[rgb_stride + (step)]), 0)          \

#define SUM2(ptr) \
    LinearToGamma(GammaToLinear((ptr)[0]) + GammaToLinear((ptr)[rgb_stride]), 1)

#define SUM2ALPHA(ptr) ((ptr)[0] + (ptr)[rgb_stride])
#define SUM4ALPHA(ptr) (SUM2ALPHA(ptr) + SUM2ALPHA((ptr) + 4))

#if defined(USE_INVERSE_ALPHA_TABLE)

static const int kAlphaFix = 19;
// Following table is (1 << kAlphaFix) / a. The (v * kInvAlpha[a]) >> kAlphaFix
// formula is then equal to v / a in most (99.6%) cases. Note that this table
// and constant are adjusted very tightly to fit 32b arithmetic.
// In particular, they use the fact that the operands for 'v / a' are actually
// derived as v = (a0.p0 + a1.p1 + a2.p2 + a3.p3) and a = a0 + a1 + a2 + a3
// with ai in [0..255] and pi in [0..1<<kGammaFix). The constraint to avoid
// overflow is: kGammaFix + kAlphaFix <= 31.
static const uint32_t kInvAlpha[4 * 0xff + 1] = {
  0,  /* alpha = 0 */
  524288, 262144, 174762, 131072, 104857, 87381, 74898, 65536,
  58254, 52428, 47662, 43690, 40329, 37449, 34952, 32768,
  30840, 29127, 27594, 26214, 24966, 23831, 22795, 21845,
  20971, 20164, 19418, 18724, 18078, 17476, 16912, 16384,
  15887, 15420, 14979, 14563, 14169, 13797, 13443, 13107,
  12787, 12483, 12192, 11915, 11650, 11397, 11155, 10922,
  10699, 10485, 10280, 10082, 9892, 9709, 9532, 9362,
  9198, 9039, 8886, 8738, 8594, 8456, 8322, 8192,
  8065, 7943, 7825, 7710, 7598, 7489, 7384, 7281,
  7182, 7084, 6990, 6898, 6808, 6721, 6636, 6553,
  6472, 6393, 6316, 6241, 6168, 6096, 6026, 5957,
  5890, 5825, 5761, 5698, 5637, 5577, 5518, 5461,
  5405, 5349, 5295, 5242, 5190, 5140, 5090, 5041,
  4993, 4946, 4899, 4854, 4809, 4766, 4723, 4681,
  4639, 4599, 4559, 4519, 4481, 4443, 4405, 4369,
  4332, 4297, 4262, 4228, 4194, 4161, 4128, 4096,
  4064, 4032, 4002, 3971, 3942, 3912, 3883, 3855,
  3826, 3799, 3771, 3744, 3718, 3692, 3666, 3640,
  3615, 3591, 3566, 3542, 3518, 3495, 3472, 3449,
  3426, 3404, 3382, 3360, 3339, 3318, 3297, 3276,
  3256, 3236, 3216, 3196, 3177, 3158, 3139, 3120,
  3102, 3084, 3066, 3048, 3030, 3013, 2995, 2978,
  2962, 2945, 2928, 2912, 2896, 2880, 2864, 2849,
  2833, 2818, 2803, 2788, 2774, 2759, 2744, 2730,
  2716, 2702, 2688, 2674, 2661, 2647, 2634, 2621,
  2608, 2595, 2582, 2570, 2557, 2545, 2532, 2520,
  2508, 2496, 2484, 2473, 2461, 2449, 2438, 2427,
  2416, 2404, 2394, 2383, 2372, 2361, 2351, 2340,
  2330, 2319, 2309, 2299, 2289, 2279, 2269, 2259,
  2250, 2240, 2231, 2221, 2212, 2202, 2193, 2184,
  2175, 2166, 2157, 2148, 2139, 2131, 2122, 2114,
  2105, 2097, 2088, 2080, 2072, 2064, 2056, 2048,
  2040, 2032, 2024, 2016, 2008, 2001, 1993, 1985,
  1978, 1971, 1963, 1956, 1949, 1941, 1934, 1927,
  1920, 1913, 1906, 1899, 1892, 1885, 1879, 1872,
  1865, 1859, 1852, 1846, 1839, 1833, 1826, 1820,
  1814, 1807, 1801, 1795, 1789, 1783, 1777, 1771,
  1765, 1759, 1753, 1747, 1741, 1736, 1730, 1724,
  1718, 1713, 1707, 1702, 1696, 1691, 1685, 1680,
  1675, 1669, 1664, 1659, 1653, 1648, 1643, 1638,
  1633, 1628, 1623, 1618, 1613, 1608, 1603, 1598,
  1593, 1588, 1583, 1579, 1574, 1569, 1565, 1560,
  1555, 1551, 1546, 1542, 1537, 1533, 1528, 1524,
  1519, 1515, 1510, 1506, 1502, 1497, 1493, 1489,
  1485, 1481, 1476, 1472, 1468, 1464, 1460, 1456,
  1452, 1448, 1444, 1440, 1436, 1432, 1428, 1424,
  1420, 1416, 1413, 1409, 1405, 1401, 1398, 1394,
  1390, 1387, 1383, 1379, 1376, 1372, 1368, 1365,
  1361, 1358, 1354, 1351, 1347, 1344, 1340, 1337,
  1334, 1330, 1327, 1323, 1320, 1317, 1314, 1310,
  1307, 1304, 1300, 1297, 1294, 1291, 1288, 1285,
  1281, 1278, 1275, 1272, 1269, 1266, 1263, 1260,
  1257, 1254, 1251, 1248, 1245, 1242, 1239, 1236,
  1233, 1230, 1227, 1224, 1222, 1219, 1216, 1213,
  1210, 1208, 1205, 1202, 1199, 1197, 1194, 1191,
  1188, 1186, 1183, 1180, 1178, 1175, 1172, 1170,
  1167, 1165, 1162, 1159, 1157, 1154, 1152, 1149,
  1147, 1144, 1142, 1139, 1137, 1134, 1132, 1129,
  1127, 1125, 1122, 1120, 1117, 1115, 1113, 1110,
  1108, 1106, 1103, 1101, 1099, 1096, 1094, 1092,
  1089, 1087, 1085, 1083, 1081, 1078, 1076, 1074,
  1072, 1069, 1067, 1065, 1063, 1061, 1059, 1057,
  1054, 1052, 1050, 1048, 1046, 1044, 1042, 1040,
  1038, 1036, 1034, 1032, 1030, 1028, 1026, 1024,
  1022, 1020, 1018, 1016, 1014, 1012, 1010, 1008,
  1006, 1004, 1002, 1000, 998, 996, 994, 992,
  991, 989, 987, 985, 983, 981, 979, 978,
  976, 974, 972, 970, 969, 967, 965, 963,
  961, 960, 958, 956, 954, 953, 951, 949,
  948, 946, 944, 942, 941, 939, 937, 936,
  934, 932, 931, 929, 927, 926, 924, 923,
  921, 919, 918, 916, 914, 913, 911, 910,
  908, 907, 905, 903, 902, 900, 899, 897,
  896, 894, 893, 891, 890, 888, 887, 885,
  884, 882, 881, 879, 878, 876, 875, 873,
  872, 870, 869, 868, 866, 865, 863, 862,
  860, 859, 858, 856, 855, 853, 852, 851,
  849, 848, 846, 845, 844, 842, 841, 840,
  838, 837, 836, 834, 833, 832, 830, 829,
  828, 826, 825, 824, 823, 821, 820, 819,
  817, 816, 815, 814, 812, 811, 810, 809,
  807, 806, 805, 804, 802, 801, 800, 799,
  798, 796, 795, 794, 793, 791, 790, 789,
  788, 787, 786, 784, 783, 782, 781, 780,
  779, 777, 776, 775, 774, 773, 772, 771,
  769, 768, 767, 766, 765, 764, 763, 762,
  760, 759, 758, 757, 756, 755, 754, 753,
  752, 751, 750, 748, 747, 746, 745, 744,
  743, 742, 741, 740, 739, 738, 737, 736,
  735, 734, 733, 732, 731, 730, 729, 728,
  727, 726, 725, 724, 723, 722, 721, 720,
  719, 718, 717, 716, 715, 714, 713, 712,
  711, 710, 709, 708, 707, 706, 705, 704,
  703, 702, 701, 700, 699, 699, 698, 697,
  696, 695, 694, 693, 692, 691, 690, 689,
  688, 688, 687, 686, 685, 684, 683, 682,
  681, 680, 680, 679, 678, 677, 676, 675,
  674, 673, 673, 672, 671, 670, 669, 668,
  667, 667, 666, 665, 664, 663, 662, 661,
  661, 660, 659, 658, 657, 657, 656, 655,
  654, 653, 652, 652, 651, 650, 649, 648,
  648, 647, 646, 645, 644, 644, 643, 642,
  641, 640, 640, 639, 638, 637, 637, 636,
  635, 634, 633, 633, 632, 631, 630, 630,
  629, 628, 627, 627, 626, 625, 624, 624,
  623, 622, 621, 621, 620, 619, 618, 618,
  617, 616, 616, 615, 614, 613, 613, 612,
  611, 611, 610, 609, 608, 608, 607, 606,
  606, 605, 604, 604, 603, 602, 601, 601,
  600, 599, 599, 598, 597, 597, 596, 595,
  595, 594, 593, 593, 592, 591, 591, 590,
  589, 589, 588, 587, 587, 586, 585, 585,
  584, 583, 583, 582, 581, 581, 580, 579,
  579, 578, 578, 577, 576, 576, 575, 574,
  574, 573, 572, 572, 571, 571, 570, 569,
  569, 568, 568, 567, 566, 566, 565, 564,
  564, 563, 563, 562, 561, 561, 560, 560,
  559, 558, 558, 557, 557, 556, 555, 555,
  554, 554, 553, 553, 552, 551, 551, 550,
  550, 549, 548, 548, 547, 547, 546, 546,
  545, 544, 544, 543, 543, 542, 542, 541,
  541, 540, 539, 539, 538, 538, 537, 537,
  536, 536, 535, 534, 534, 533, 533, 532,
  532, 531, 531, 530, 530, 529, 529, 528,
  527, 527, 526, 526, 525, 525, 524, 524,
  523, 523, 522, 522, 521, 521, 520, 520,
  519, 519, 518, 518, 517, 517, 516, 516,
  515, 515, 514, 514
};

// Note that LinearToGamma() expects the values to be premultiplied by 4,
// so we incorporate this factor 4 inside the DIVIDE_BY_ALPHA macro directly.
#define DIVIDE_BY_ALPHA(sum, a)  (((sum) * kInvAlpha[(a)]) >> (kAlphaFix - 2))

#else

#define DIVIDE_BY_ALPHA(sum, a) (4 * (sum) / (a))

#endif  // USE_INVERSE_ALPHA_TABLE

static WEBP_INLINE int LinearToGammaWeighted(const uint8_t* src,
                                             const uint8_t* a_ptr,
                                             uint32_t total_a, int step,
                                             int rgb_stride) {
  const uint32_t sum =
      a_ptr[0] * GammaToLinear(src[0]) +
      a_ptr[step] * GammaToLinear(src[step]) +
      a_ptr[rgb_stride] * GammaToLinear(src[rgb_stride]) +
      a_ptr[rgb_stride + step] * GammaToLinear(src[rgb_stride + step]);
  assert(total_a > 0 && total_a <= 4 * 0xff);
#if defined(USE_INVERSE_ALPHA_TABLE)
  assert((uint64_t)sum * kInvAlpha[total_a] < ((uint64_t)1 << 32));
#endif
  return LinearToGamma(DIVIDE_BY_ALPHA(sum, total_a), 0);
}

static WEBP_INLINE void ConvertRowToY(const uint8_t* const r_ptr,
                                      const uint8_t* const g_ptr,
                                      const uint8_t* const b_ptr,
                                      int step,
                                      uint8_t* const dst_y,
                                      int width,
                                      VP8Random* const rg) {
  int i, j;
  for (i = 0, j = 0; i < width; i += 1, j += step) {
    dst_y[i] = RGBToY(r_ptr[j], g_ptr[j], b_ptr[j], rg);
  }
}

static WEBP_INLINE void AccumulateRGBA(const uint8_t* const r_ptr,
                                       const uint8_t* const g_ptr,
                                       const uint8_t* const b_ptr,
                                       const uint8_t* const a_ptr,
                                       int rgb_stride,
                                       uint16_t* dst, int width) {
  int i, j;
  // we loop over 2x2 blocks and produce one R/G/B/A value for each.
  for (i = 0, j = 0; i < (width >> 1); i += 1, j += 2 * 4, dst += 4) {
    const uint32_t a = SUM4ALPHA(a_ptr + j);
    int r, g, b;
    if (a == 4 * 0xff || a == 0) {
      r = SUM4(r_ptr + j, 4);
      g = SUM4(g_ptr + j, 4);
      b = SUM4(b_ptr + j, 4);
    } else {
      r = LinearToGammaWeighted(r_ptr + j, a_ptr + j, a, 4, rgb_stride);
      g = LinearToGammaWeighted(g_ptr + j, a_ptr + j, a, 4, rgb_stride);
      b = LinearToGammaWeighted(b_ptr + j, a_ptr + j, a, 4, rgb_stride);
    }
    dst[0] = r;
    dst[1] = g;
    dst[2] = b;
    dst[3] = a;
  }
  if (width & 1) {
    const uint32_t a = 2u * SUM2ALPHA(a_ptr + j);
    int r, g, b;
    if (a == 4 * 0xff || a == 0) {
      r = SUM2(r_ptr + j);
      g = SUM2(g_ptr + j);
      b = SUM2(b_ptr + j);
    } else {
      r = LinearToGammaWeighted(r_ptr + j, a_ptr + j, a, 0, rgb_stride);
      g = LinearToGammaWeighted(g_ptr + j, a_ptr + j, a, 0, rgb_stride);
      b = LinearToGammaWeighted(b_ptr + j, a_ptr + j, a, 0, rgb_stride);
    }
    dst[0] = r;
    dst[1] = g;
    dst[2] = b;
    dst[3] = a;
  }
}

static WEBP_INLINE void AccumulateRGB(const uint8_t* const r_ptr,
                                      const uint8_t* const g_ptr,
                                      const uint8_t* const b_ptr,
                                      int step, int rgb_stride,
                                      uint16_t* dst, int width) {
  int i, j;
  for (i = 0, j = 0; i < (width >> 1); i += 1, j += 2 * step, dst += 4) {
    dst[0] = SUM4(r_ptr + j, step);
    dst[1] = SUM4(g_ptr + j, step);
    dst[2] = SUM4(b_ptr + j, step);
  }
  if (width & 1) {
    dst[0] = SUM2(r_ptr + j);
    dst[1] = SUM2(g_ptr + j);
    dst[2] = SUM2(b_ptr + j);
  }
}

static WEBP_INLINE void ConvertRowsToUV(const uint16_t* rgb,
                                        uint8_t* const dst_u,
                                        uint8_t* const dst_v,
                                        int width,
                                        VP8Random* const rg) {
  int i;
  for (i = 0; i < width; i += 1, rgb += 4) {
    const int r = rgb[0], g = rgb[1], b = rgb[2];
    dst_u[i] = RGBToU(r, g, b, rg);
    dst_v[i] = RGBToV(r, g, b, rg);
  }
}

static int ImportYUVAFromRGBA(const uint8_t* r_ptr,
                              const uint8_t* g_ptr,
                              const uint8_t* b_ptr,
                              const uint8_t* a_ptr,
                              int step,         // bytes per pixel
                              int rgb_stride,   // bytes per scanline
                              float dithering,
                              int use_iterative_conversion,
                              WebPPicture* const picture) {
  int y;
  const int width = picture->width;
  const int height = picture->height;
  const int has_alpha = CheckNonOpaque(a_ptr, width, height, step, rgb_stride);
  const int is_rgb = (r_ptr < b_ptr);  // otherwise it's bgr

  picture->colorspace = has_alpha ? WEBP_YUV420A : WEBP_YUV420;
  picture->use_argb = 0;

  // disable smart conversion if source is too small (overkill).
  if (width < kMinDimensionIterativeConversion ||
      height < kMinDimensionIterativeConversion) {
    use_iterative_conversion = 0;
  }

  if (!WebPPictureAllocYUVA(picture, width, height)) {
    return 0;
  }
  if (has_alpha) {
    assert(step == 4);
#if defined(USE_GAMMA_COMPRESSION) && defined(USE_INVERSE_ALPHA_TABLE)
    assert(kAlphaFix + kGammaFix <= 31);
#endif
  }

  if (use_iterative_conversion) {
    InitGammaTablesS();
    if (!PreprocessARGB(r_ptr, g_ptr, b_ptr, step, rgb_stride, picture)) {
      return 0;
    }
    if (has_alpha) {
      WebPExtractAlpha(a_ptr, rgb_stride, width, height,
                       picture->a, picture->a_stride);
    }
  } else {
    const int uv_width = (width + 1) >> 1;
    int use_dsp = (step == 3);  // use special function in this case
    // temporary storage for accumulated R/G/B values during conversion to U/V
    uint16_t* const tmp_rgb =
        (uint16_t*)WebPSafeMalloc(4 * uv_width, sizeof(*tmp_rgb));
    uint8_t* dst_y = picture->y;
    uint8_t* dst_u = picture->u;
    uint8_t* dst_v = picture->v;
    uint8_t* dst_a = picture->a;

    VP8Random base_rg;
    VP8Random* rg = NULL;
    if (dithering > 0.) {
      VP8InitRandom(&base_rg, dithering);
      rg = &base_rg;
      use_dsp = 0;   // can't use dsp in this case
    }
    WebPInitConvertARGBToYUV();
    InitGammaTables();

    if (tmp_rgb == NULL) return 0;  // malloc error

    // Downsample Y/U/V planes, two rows at a time
    for (y = 0; y < (height >> 1); ++y) {
      int rows_have_alpha = has_alpha;
      if (use_dsp) {
        if (is_rgb) {
          WebPConvertRGB24ToY(r_ptr, dst_y, width);
          WebPConvertRGB24ToY(r_ptr + rgb_stride,
                              dst_y + picture->y_stride, width);
        } else {
          WebPConvertBGR24ToY(b_ptr, dst_y, width);
          WebPConvertBGR24ToY(b_ptr + rgb_stride,
                              dst_y + picture->y_stride, width);
        }
      } else {
        ConvertRowToY(r_ptr, g_ptr, b_ptr, step, dst_y, width, rg);
        ConvertRowToY(r_ptr + rgb_stride,
                      g_ptr + rgb_stride,
                      b_ptr + rgb_stride, step,
                      dst_y + picture->y_stride, width, rg);
      }
      dst_y += 2 * picture->y_stride;
      if (has_alpha) {
        rows_have_alpha &= !WebPExtractAlpha(a_ptr, rgb_stride, width, 2,
                                             dst_a, picture->a_stride);
        dst_a += 2 * picture->a_stride;
      }
      // Collect averaged R/G/B(/A)
      if (!rows_have_alpha) {
        AccumulateRGB(r_ptr, g_ptr, b_ptr, step, rgb_stride, tmp_rgb, width);
      } else {
        AccumulateRGBA(r_ptr, g_ptr, b_ptr, a_ptr, rgb_stride, tmp_rgb, width);
      }
      // Convert to U/V
      if (rg == NULL) {
        WebPConvertRGBA32ToUV(tmp_rgb, dst_u, dst_v, uv_width);
      } else {
        ConvertRowsToUV(tmp_rgb, dst_u, dst_v, uv_width, rg);
      }
      dst_u += picture->uv_stride;
      dst_v += picture->uv_stride;
      r_ptr += 2 * rgb_stride;
      b_ptr += 2 * rgb_stride;
      g_ptr += 2 * rgb_stride;
      if (has_alpha) a_ptr += 2 * rgb_stride;
    }
    if (height & 1) {    // extra last row
      int row_has_alpha = has_alpha;
      if (use_dsp) {
        if (r_ptr < b_ptr) {
          WebPConvertRGB24ToY(r_ptr, dst_y, width);
        } else {
          WebPConvertBGR24ToY(b_ptr, dst_y, width);
        }
      } else {
        ConvertRowToY(r_ptr, g_ptr, b_ptr, step, dst_y, width, rg);
      }
      if (row_has_alpha) {
        row_has_alpha &= !WebPExtractAlpha(a_ptr, 0, width, 1, dst_a, 0);
      }
      // Collect averaged R/G/B(/A)
      if (!row_has_alpha) {
        // Collect averaged R/G/B
        AccumulateRGB(r_ptr, g_ptr, b_ptr, step, /* rgb_stride = */ 0,
                      tmp_rgb, width);
      } else {
        AccumulateRGBA(r_ptr, g_ptr, b_ptr, a_ptr, /* rgb_stride = */ 0,
                       tmp_rgb, width);
      }
      if (rg == NULL) {
        WebPConvertRGBA32ToUV(tmp_rgb, dst_u, dst_v, uv_width);
      } else {
        ConvertRowsToUV(tmp_rgb, dst_u, dst_v, uv_width, rg);
      }
    }
    WebPSafeFree(tmp_rgb);
  }
  return 1;
}

#undef SUM4
#undef SUM2
#undef SUM4ALPHA
#undef SUM2ALPHA

//------------------------------------------------------------------------------
// call for ARGB->YUVA conversion

static int PictureARGBToYUVA(WebPPicture* picture, WebPEncCSP colorspace,
                             float dithering, int use_iterative_conversion) {
  if (picture == NULL) return 0;
  if (picture->argb == NULL) {
    return WebPEncodingSetError(picture, VP8_ENC_ERROR_NULL_PARAMETER);
  } else if ((colorspace & WEBP_CSP_UV_MASK) != WEBP_YUV420) {
    return WebPEncodingSetError(picture, VP8_ENC_ERROR_INVALID_CONFIGURATION);
  } else {
    const uint8_t* const argb = (const uint8_t*)picture->argb;
    const uint8_t* const a = argb + CHANNEL_OFFSET(0);
    const uint8_t* const r = argb + CHANNEL_OFFSET(1);
    const uint8_t* const g = argb + CHANNEL_OFFSET(2);
    const uint8_t* const b = argb + CHANNEL_OFFSET(3);

    picture->colorspace = WEBP_YUV420;
    return ImportYUVAFromRGBA(r, g, b, a, 4, 4 * picture->argb_stride,
                              dithering, use_iterative_conversion, picture);
  }
}

int WebPPictureARGBToYUVADithered(WebPPicture* picture, WebPEncCSP colorspace,
                                  float dithering) {
  return PictureARGBToYUVA(picture, colorspace, dithering, 0);
}

int WebPPictureARGBToYUVA(WebPPicture* picture, WebPEncCSP colorspace) {
  return PictureARGBToYUVA(picture, colorspace, 0.f, 0);
}

int WebPPictureSharpARGBToYUVA(WebPPicture* picture) {
  return PictureARGBToYUVA(picture, WEBP_YUV420, 0.f, 1);
}
// for backward compatibility
int WebPPictureSmartARGBToYUVA(WebPPicture* picture) {
  return WebPPictureSharpARGBToYUVA(picture);
}

//------------------------------------------------------------------------------
// call for YUVA -> ARGB conversion

int WebPPictureYUVAToARGB(WebPPicture* picture) {
  if (picture == NULL) return 0;
  if (picture->y == NULL || picture->u == NULL || picture->v == NULL) {
    return WebPEncodingSetError(picture, VP8_ENC_ERROR_NULL_PARAMETER);
  }
  if ((picture->colorspace & WEBP_CSP_ALPHA_BIT) && picture->a == NULL) {
    return WebPEncodingSetError(picture, VP8_ENC_ERROR_NULL_PARAMETER);
  }
  if ((picture->colorspace & WEBP_CSP_UV_MASK) != WEBP_YUV420) {
    return WebPEncodingSetError(picture, VP8_ENC_ERROR_INVALID_CONFIGURATION);
  }
  // Allocate a new argb buffer (discarding the previous one).
  if (!WebPPictureAllocARGB(picture, picture->width, picture->height)) return 0;
  picture->use_argb = 1;

  // Convert
  {
    int y;
    const int width = picture->width;
    const int height = picture->height;
    const int argb_stride = 4 * picture->argb_stride;
    uint8_t* dst = (uint8_t*)picture->argb;
    const uint8_t* cur_u = picture->u, *cur_v = picture->v, *cur_y = picture->y;
    WebPUpsampleLinePairFunc upsample =
        WebPGetLinePairConverter(ALPHA_OFFSET > 0);

    // First row, with replicated top samples.
    upsample(cur_y, NULL, cur_u, cur_v, cur_u, cur_v, dst, NULL, width);
    cur_y += picture->y_stride;
    dst += argb_stride;
    // Center rows.
    for (y = 1; y + 1 < height; y += 2) {
      const uint8_t* const top_u = cur_u;
      const uint8_t* const top_v = cur_v;
      cur_u += picture->uv_stride;
      cur_v += picture->uv_stride;
      upsample(cur_y, cur_y + picture->y_stride, top_u, top_v, cur_u, cur_v,
               dst, dst + argb_stride, width);
      cur_y += 2 * picture->y_stride;
      dst += 2 * argb_stride;
    }
    // Last row (if needed), with replicated bottom samples.
    if (height > 1 && !(height & 1)) {
      upsample(cur_y, NULL, cur_u, cur_v, cur_u, cur_v, dst, NULL, width);
    }
    // Insert alpha values if needed, in replacement for the default 0xff ones.
    if (picture->colorspace & WEBP_CSP_ALPHA_BIT) {
      for (y = 0; y < height; ++y) {
        uint32_t* const argb_dst = picture->argb + y * picture->argb_stride;
        const uint8_t* const src = picture->a + y * picture->a_stride;
        int x;
        for (x = 0; x < width; ++x) {
          argb_dst[x] = (argb_dst[x] & 0x00ffffffu) | ((uint32_t)src[x] << 24);
        }
      }
    }
  }
  return 1;
}

//------------------------------------------------------------------------------
// automatic import / conversion

static int Import(WebPPicture* const picture,
                  const uint8_t* rgb, int rgb_stride,
                  int step, int swap_rb, int import_alpha) {
  int y;
  // swap_rb -> b,g,r,a , !swap_rb -> r,g,b,a
  const uint8_t* r_ptr = rgb + (swap_rb ? 2 : 0);
  const uint8_t* g_ptr = rgb + 1;
  const uint8_t* b_ptr = rgb + (swap_rb ? 0 : 2);
  const int width = picture->width;
  const int height = picture->height;

  if (!picture->use_argb) {
    const uint8_t* a_ptr = import_alpha ? rgb + 3 : NULL;
    return ImportYUVAFromRGBA(r_ptr, g_ptr, b_ptr, a_ptr, step, rgb_stride,
                              0.f /* no dithering */, 0, picture);
  }
  if (!WebPPictureAlloc(picture)) return 0;

  VP8LDspInit();
  WebPInitAlphaProcessing();

  if (import_alpha) {
    // dst[] byte order is {a,r,g,b} for big-endian, {b,g,r,a} for little endian
    uint32_t* dst = picture->argb;
    const int do_copy = (ALPHA_OFFSET == 3) && swap_rb;
    assert(step == 4);
    if (do_copy) {
      for (y = 0; y < height; ++y) {
        memcpy(dst, rgb, width * 4);
        rgb += rgb_stride;
        dst += picture->argb_stride;
      }
    } else {
      for (y = 0; y < height; ++y) {
#ifdef WORDS_BIGENDIAN
        // BGRA or RGBA input order.
        const uint8_t* a_ptr = rgb + 3;
        WebPPackARGB(a_ptr, r_ptr, g_ptr, b_ptr, width, dst);
        r_ptr += rgb_stride;
        g_ptr += rgb_stride;
        b_ptr += rgb_stride;
#else
        // RGBA input order. Need to swap R and B.
        VP8LConvertBGRAToRGBA((const uint32_t*)rgb, width, (uint8_t*)dst);
#endif
        rgb += rgb_stride;
        dst += picture->argb_stride;
      }
    }
  } else {
    uint32_t* dst = picture->argb;
    assert(step >= 3);
    for (y = 0; y < height; ++y) {
      WebPPackRGB(r_ptr, g_ptr, b_ptr, width, step, dst);
      r_ptr += rgb_stride;
      g_ptr += rgb_stride;
      b_ptr += rgb_stride;
      dst += picture->argb_stride;
    }
  }
  return 1;
}

// Public API

#if !defined(WEBP_REDUCE_CSP)

int WebPPictureImportBGR(WebPPicture* picture,
                         const uint8_t* rgb, int rgb_stride) {
  return (picture != NULL && rgb != NULL)
             ? Import(picture, rgb, rgb_stride, 3, 1, 0)
             : 0;
}

int WebPPictureImportBGRA(WebPPicture* picture,
                          const uint8_t* rgba, int rgba_stride) {
  return (picture != NULL && rgba != NULL)
             ? Import(picture, rgba, rgba_stride, 4, 1, 1)
             : 0;
}


int WebPPictureImportBGRX(WebPPicture* picture,
                          const uint8_t* rgba, int rgba_stride) {
  return (picture != NULL && rgba != NULL)
             ? Import(picture, rgba, rgba_stride, 4, 1, 0)
             : 0;
}

#endif   // WEBP_REDUCE_CSP

int WebPPictureImportRGB(WebPPicture* picture,
                         const uint8_t* rgb, int rgb_stride) {
  return (picture != NULL && rgb != NULL)
             ? Import(picture, rgb, rgb_stride, 3, 0, 0)
             : 0;
}

int WebPPictureImportRGBA(WebPPicture* picture,
                          const uint8_t* rgba, int rgba_stride) {
  return (picture != NULL && rgba != NULL)
             ? Import(picture, rgba, rgba_stride, 4, 0, 1)
             : 0;
}

int WebPPictureImportRGBX(WebPPicture* picture,
                          const uint8_t* rgba, int rgba_stride) {
  return (picture != NULL && rgba != NULL)
             ? Import(picture, rgba, rgba_stride, 4, 0, 0)
             : 0;
}

//------------------------------------------------------------------------------
