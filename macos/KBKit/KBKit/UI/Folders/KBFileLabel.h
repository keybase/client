//
//  KBFolderView.h
//  Keybase
//
//  Created by Gabriel on 3/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>


#import "KBImageLabel.h"
#import "KBRPC.h"
#import "KBFile.h"

@interface KBFileLabel : KBImageLabel

- (void)setFile:(KBFile *)file;

@end
