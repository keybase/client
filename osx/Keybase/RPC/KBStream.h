//
//  KBStream.h
//  Keybase
//
//  Created by Gabriel on 3/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBReader.h"
#import "KBWriter.h"

@interface KBStream : NSObject

@property id<KBReader> reader;
@property id<KBWriter> writer;
@property BOOL binary;

+ (instancetype)streamWithReader:(id<KBReader>)reader writer:(id<KBWriter>)writer binary:(BOOL)binary;

@property (nonatomic) int label;

@end
