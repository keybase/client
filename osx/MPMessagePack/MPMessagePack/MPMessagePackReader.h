//
//  MPMessagePackReader.h
//  MPMessagePack
//
//  Created by Gabriel on 7/3/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface MPMessagePackReader : NSObject

@property (readonly) size_t index;

- (instancetype)initWithData:(NSData *)data;

- (id)readObject:(NSError **)error;

+ (id)readData:(NSData *)data error:(NSError **)error;

@end
