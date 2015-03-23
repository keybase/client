//
//  KBReadBuffer.h
//  Keybase
//
//  Created by Gabriel on 3/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface KBReadBuffer : NSObject

@property (readonly) NSData *data;
@property (readonly) NSInteger readIndex;

+ (instancetype)bufferWithData:(NSData *)data;

- (NSData *)read:(NSInteger)length;

@end
