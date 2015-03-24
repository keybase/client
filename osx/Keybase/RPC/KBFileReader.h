//
//  KBFileReadBuffer.h
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBReader.h"

@interface KBFileReader : KBReader <KBReader>

+ (instancetype)fileReaderWithPath:(NSString *)path;

@end
