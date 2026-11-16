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

- (NSArray *)mp_array:(NSError **)error;

@end
