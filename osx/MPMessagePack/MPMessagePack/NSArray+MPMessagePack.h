//
//  NSArray+MPMessagePack.h
//  MPMessagePack
//
//  Created by Gabriel on 7/3/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "MPMessagePackWriter.h"

@interface NSArray (MPMessagePack)

- (NSData *)mp_messagePack;

- (NSData *)mp_messagePack:(MPMessagePackWriterOptions)options;

- (NSData *)mp_messagePack:(MPMessagePackWriterOptions)options error:(NSError **)error;

@end
