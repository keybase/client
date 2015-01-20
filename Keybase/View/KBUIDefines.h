//
//  KBUIDefines.h
//  Keybase
//
//  Created by Gabriel on 1/8/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

@import AppKit;
@import QuartzCore;

#import <YOLayout/YOLayout.h>

#import "KBDefines.h"
#import "KBView.h"
#import "KBLookAndFeel.h"
#import "KBImageView.h"
#import "KBTextLabel.h"
#import "KBButton.h"
#import "KBTextField.h"
#import "KBNavigationView.h"
#import "KBTableRowView.h"

#define KBDefaultWidth (360)
#define KBDefaultHeight (600)


#define KBTODO(__SELF__) ([[NSAlert alertWithError:[NSError errorWithDomain:@"Keybase" code:-1 userInfo:@{NSLocalizedDescriptionKey:@"TODO"}]] beginSheetModalForWindow:__SELF__.window completionHandler:nil])