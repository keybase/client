//
//  KBFileListEditView.h
//  Keybase
//
//  Created by Gabriel on 5/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBFile.h"

@interface KBFileListEditView : YOView

- (NSArray */*of KBFile*/)files;

- (void)addFile:(KBFile *)file;

@end
