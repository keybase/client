//
//  NSString+MPMessagePack.h
//  MPMessagePack
//
//  Created by Gabriel on 1/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "MPMessagePackReader.h"

@interface NSData (MPMessagePack)

- (NSString *)mp_hexString;
+ (NSData *)mp_dataFromHexString:(NSString *)str;

- (NSArray *)mp_array:(NSError **)error;
- (NSArray *)mp_array:(MPMessagePackReaderOptions)options error:(NSError **)error;

- (NSDictionary *)mp_dict:(NSError **)error;

- (id)mp_dict:(MPMessagePackReaderOptions)options error:(NSError **)error;

- (id)mp_object:(NSError **)error;

@end
