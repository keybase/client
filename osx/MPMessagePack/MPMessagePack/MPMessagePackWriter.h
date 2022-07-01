//
//  MPMessagePackWriter.h
//  MPMessagePack
//
//  Created by Gabriel on 7/3/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef NS_OPTIONS (NSInteger, MPMessagePackWriterOptions) {
  MPMessagePackWriterOptionsNone = 0,
  MPMessagePackWriterOptionsSortDictionaryKeys = 1 << 0,
};

@interface MPMessagePackWriter : NSObject

- (NSMutableData *)writeObject:(id)obj options:(MPMessagePackWriterOptions)options error:(NSError **)error;

+ (NSMutableData *)writeObject:(id)obj error:(NSError **)error;

+ (NSMutableData *)writeObject:(id)obj options:(MPMessagePackWriterOptions)options error:(NSError **)error;

@end
