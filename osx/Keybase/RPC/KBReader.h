//
//  KBReader.h
//  Keybase
//
//  Created by Gabriel on 3/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

@protocol KBReader
- (NSData *)read:(NSUInteger)length error:(NSError **)error;
- (void)close;
@end

@interface KBReader : NSObject <KBReader>

+ (instancetype)readerWithData:(NSData *)data;
+ (instancetype)readerWithInputStream:(NSInputStream *)inputStream;

@end
