//
//  KBPGPEncryptFileView.h
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBContentView.h"
#import "KBUserPickerView.h"
#import "KBFile.h"

@interface KBPGPEncryptFileView : KBContentView <KBUserPickerViewDelegate>

- (void)addFile:(KBFile *)file;

@end
