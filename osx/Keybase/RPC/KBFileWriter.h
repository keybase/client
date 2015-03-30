//
//  KBFileWriter.h
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBWriter.h"

@interface KBFileWriter : NSObject <KBWriter>

+ (instancetype)fileWriterWithPath:(NSString *)path;

@end
