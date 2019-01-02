//
//  MPMessagePackReader.m
//  MPMessagePack
//
//  Created by Gabriel on 7/3/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "MPMessagePackReader.h"

#include "cmp.h"
#import "MPDefines.h"

#import <GHODictionary/GHODictionary.h>

@interface MPMessagePackReader ()
@property NSData *data;
@property size_t index;
@property MPMessagePackReaderOptions options;
@end

@implementation MPMessagePackReader

- (instancetype)initWithData:(NSData *)data {
  if ((self = [super init])) {
    _data = data;
  }
  return self;
}

- (instancetype)initWithData:(NSData *)data options:(MPMessagePackReaderOptions)options {
  if ((self = [self initWithData:data])) {
    _options = options;
  }
  return self;
}

- (id)readFromContext:(cmp_ctx_t *)context error:(NSError **)error {
  cmp_object_t obj;
  if (!cmp_read_object(context, &obj)) {
    return [self returnNilWithErrorCode:200 description:@"Unable to read object" error:error];
  }

  switch (obj.type) {
    case CMP_TYPE_NIL:
      return [NSNull null];
    case CMP_TYPE_BOOLEAN:
      return obj.as.boolean ? @YES : @NO;
      
    case CMP_TYPE_BIN8:
    case CMP_TYPE_BIN16:
    case CMP_TYPE_BIN32: {
      uint32_t length = obj.as.bin_size;
      if (length == 0) return [NSData data];
      if (length > [_data length]) { // binary data can't be larger than the total data size
        return [self returnNilWithErrorCode:298 description:@"Invalid data length, data might be malformed" error:error];
      }
      NSMutableData *data = [NSMutableData dataWithLength:length];
      bool readSuccess = context->read(context, [data mutableBytes], length);
      if (!readSuccess) {
        return [self returnNilWithErrorCode:202 description:@"Unable to read bytes" error:error];
      }
      return data;
    }

    case CMP_TYPE_POSITIVE_FIXNUM: return @(obj.as.u8);
    case CMP_TYPE_NEGATIVE_FIXNUM:return @(obj.as.s8);
    case CMP_TYPE_FLOAT: return @(obj.as.flt);
    case CMP_TYPE_DOUBLE: return @(obj.as.dbl);
    case CMP_TYPE_UINT8: return @(obj.as.u8);
    case CMP_TYPE_UINT16: return @(obj.as.u16);
    case CMP_TYPE_UINT32: return @(obj.as.u32);
    case CMP_TYPE_UINT64: return @(obj.as.u64);
    case CMP_TYPE_SINT8: return @(obj.as.s8);
    case CMP_TYPE_SINT16: return @(obj.as.s16);
    case CMP_TYPE_SINT32: return @(obj.as.s32);
    case CMP_TYPE_SINT64: return @(obj.as.s64);

    case CMP_TYPE_FIXSTR:
    case CMP_TYPE_STR8:
    case CMP_TYPE_STR16:
    case CMP_TYPE_STR32: {
      uint32_t length = obj.as.str_size;
      if (length == 0) return @"";
      if (length > [_data length]) { // str data can't be larger than the total data size
        return [self returnNilWithErrorCode:298 description:@"Invalid data length, data might be malformed" error:error];
      }
      NSMutableData *data = [NSMutableData dataWithLength:length];
      bool readSuccess = context->read(context, [data mutableBytes], length);
      if (!readSuccess) {
        return [self returnNilWithErrorCode:206 description:@"Unable to read string" error:error];
      }
      NSString *str = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
      if (!str) {
        // Invalid string encoding
        // Other languages have a raw byte string but not Objective-C
        MPErr(@"Invalid string encoding (type=%@), using str instead of bin? We'll have to return an NSData. (%@)", @(obj.type), data);
        return data;
        //return [NSNull null];
      }
      return str;
    }

    case CMP_TYPE_FIXARRAY:
    case CMP_TYPE_ARRAY16:
    case CMP_TYPE_ARRAY32: {
      uint32_t length = obj.as.array_size;
      return [self readArrayFromContext:context length:length error:error];
    }
      
    case CMP_TYPE_FIXMAP:
    case CMP_TYPE_MAP16:
    case CMP_TYPE_MAP32: {
      uint32_t length = obj.as.map_size;
      return [self readDictionaryFromContext:context length:length error:error];
    }
      
    case CMP_TYPE_EXT8:
    case CMP_TYPE_EXT16:
    case CMP_TYPE_EXT32:
    case CMP_TYPE_FIXEXT1:
    case CMP_TYPE_FIXEXT2:
    case CMP_TYPE_FIXEXT4:
    case CMP_TYPE_FIXEXT8:
    case CMP_TYPE_FIXEXT16:{
        // Type and size
        int8_t type = obj.as.ext.type;
        uint32_t length = obj.as.ext.size;
        
        // Read data
        if (length == 0) return [NSData data];
        if (length > [_data length]) { // binary data can't be larger than the total data size
            return [self returnNilWithErrorCode:298 description:@"Invalid data length, data might be malformed" error:error];
        }
        NSMutableData *data = [NSMutableData dataWithLength:length];
        bool readSuccess = context->read(context, [data mutableBytes], length);
        if (!readSuccess) {
            return [self returnNilWithErrorCode:202 description:@"Unable to read bytes" error:error];
        }
        
        // Return a dict with everything
        return @{
          @"type":@(type),
          @"length":@(length),
          @"data":data
        };
    }

    default: {
      return [self returnNilWithErrorCode:201 description:[NSString stringWithFormat:@"Unsupported object type: %@", @(obj.type)] error:error];
    }
  }
}

- (NSMutableArray *)readArrayFromContext:(cmp_ctx_t *)context length:(uint32_t)length error:(NSError **)error {
  NSUInteger capacity = length < 1000 ? length : 1000;
  NSMutableArray *array = [NSMutableArray arrayWithCapacity:capacity];
  for (NSInteger i = 0; i < length; i++) {
    id obj = [self readFromContext:context error:error];
    if (!obj) return nil;
    [array addObject:obj];
  }
  return array;
}

- (NSMutableDictionary *)readDictionaryFromContext:(cmp_ctx_t *)context length:(uint32_t)length error:(NSError **)error {
  NSUInteger capacity = length < 1000 ? length : 1000;

  id dict = nil;
  if ((_options & MPMessagePackReaderOptionsUseOrderedDictionary) == MPMessagePackReaderOptionsUseOrderedDictionary) {
    dict = [[GHODictionary alloc] initWithCapacity:capacity];
  } else {
    dict = [NSMutableDictionary dictionaryWithCapacity:capacity];
  }
  
  for (NSInteger i = 0; i < length; i++) {
    id key = [self readFromContext:context error:error];
    if (!key) return nil;
    id value = [self readFromContext:context error:error];
    if (!value) return nil;
    dict[key] = value;
  }
  return dict;
}

- (id)returnNilWithErrorCode:(NSInteger)errorCode description:(NSString *)description error:(NSError **)error {
  if (error) *error = [NSError errorWithDomain:@"MPMessagePack" code:errorCode userInfo:@{NSLocalizedDescriptionKey: description}];
  return nil;
}

- (size_t)read:(void *)data limit:(size_t)limit {
  if (_index + limit > [_data length]) {
    return 0;
  }
  [_data getBytes:data range:NSMakeRange(_index, limit)];
  
//  NSData *read = [NSData dataWithBytes:data length:limit];
//  NSLog(@"Read bytes: %@", read);
  
  _index += limit;
  return limit;
}

static bool mp_reader(cmp_ctx_t *ctx, void *data, size_t limit) {
  MPMessagePackReader *mp = (__bridge MPMessagePackReader *)ctx->buf;
  return [mp read:data limit:limit];
}

static size_t mp_writer(cmp_ctx_t *ctx, const void *data, size_t count) {
  return 0;
}

- (id)readObject:(NSError **)error {
  cmp_ctx_t ctx;
  cmp_init(&ctx, (__bridge void *)self, mp_reader, mp_writer);
  size_t index = _index;
  id obj = [self readFromContext:&ctx error:error];
  if (error && *error) _index = index;
  return obj;
}

+ (id)readData:(NSData *)data error:(NSError **)error {
  return [self readData:data options:0 error:error];
}

+ (id)readData:(NSData *)data options:(MPMessagePackReaderOptions)options error:(NSError **)error {
  MPMessagePackReader *messagePackReader = [[MPMessagePackReader alloc] initWithData:data options:options];
  id obj = [messagePackReader readObject:error];
  
  if (!obj && error && !*error) {
    *error = [NSError errorWithDomain:@"MPMessagePack" code:299 userInfo:@{NSLocalizedDescriptionKey: @"Unable to read object"}];
    return nil;
  }
  
  return obj;
}

@end
