//
//  KBOutputBuffer.h
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

@protocol KBWriter
- (NSInteger)write:(const uint8_t *)buffer maxLength:(NSUInteger)maxLength error:(NSError **)error;
- (void)close;
@end

@interface KBWriter : NSObject <KBWriter>

@property (readonly) NSMutableData *data;

+ (instancetype)writer;

@end
