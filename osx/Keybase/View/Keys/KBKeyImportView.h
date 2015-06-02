//
//  KBKeyImportView.h
//  Keybase
//
//  Created by Gabriel on 3/16/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBContentView.h"

typedef void (^KBKeyImportCompletion)(BOOL imported);

@interface KBKeyImportView : KBContentView

@property (copy) KBKeyImportCompletion completion;

@end
