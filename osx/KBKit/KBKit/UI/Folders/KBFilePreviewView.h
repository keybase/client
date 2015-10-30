//
//  KBFilePreviewView.h
//  Keybase
//
//  Created by Gabriel on 3/11/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBFile.h"

#import <Tikppa/Tikppa.h>

@interface KBFilePreviewView : YOView

- (void)setFile:(KBFile *)file;

@end
