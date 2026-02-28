//
//  MPMessagePackReader.h
//  MPMessagePack
//
//  Created by Gabriel on 7/3/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef NS_OPTIONS (NSInteger, MPMessagePackReaderOptions) {
  MPMessagePackReaderOptionsNone = 0,
  // If set will return a GHODictionary instead of an NSDictionary
  MPMessagePackReaderOptionsUseOrderedDictionary = 1 << 0,
};


@interface MPMessagePackReader : NSObject

@property (readonly) size_t index;

- (instancetype)initWithData:(NSData *)data;
- (instancetype)initWithData:(NSData *)data options:(MPMessagePackReaderOptions)options;

- (id)readObject:(NSError **)error;

+ (id)readData:(NSData *)data error:(NSError **)error;

+ (id)readData:(NSData *)data options:(MPMessagePackReaderOptions)options error:(NSError **)error;

@end
