//
//  KBPGPDecryptFileView.h
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBContentView.h"

@interface KBPGPDecryptFileView : KBContentView

- (void)addFile:(KBFile *)file;
- (void)removeFile:(id)sender;

@end
