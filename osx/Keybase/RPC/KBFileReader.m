//
//  KBFileReadBuffer.m
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFileReader.h"

@interface KBFileReader ()
@property NSInputStream *inputStream;
@end


@implementation KBFileReader

+ (instancetype)fileReaderWithPath:(NSString *)path {
  return [KBFileReader readerWithInputStream:[NSInputStream inputStreamWithFileAtPath:path]];
}

@end
