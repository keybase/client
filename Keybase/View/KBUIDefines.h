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
#import "KBLookAndFeel.h"
#import "KBImageView.h"
#import "KBLabel.h"
#import "KBButton.h"
#import "KBTextField.h"
#import "KBNavigationView.h"
#import "KBTableRowView.h"
#import "KBWindow.h"
#import "KBTitleView.h"
#import "KBAlert.h"
#import "KBBox.h"
#import "KBLabelRow.h"
#import "KBSplitView.h"
#import "KBScrollView.h"
#import "KBTextCollectionView.h"


#define KBDebugAlert(DESC) ([[NSAlert alertWithError:[NSError errorWithDomain:@"Keybase" code:-1 userInfo:@{NSLocalizedDescriptionKey:DESC}]] beginSheetModalForWindow:[NSApp mainWindow] completionHandler:nil])

#define KBTODO() ([[NSAlert alertWithError:[NSError errorWithDomain:@"Keybase" code:-1 userInfo:@{NSLocalizedDescriptionKey:@"TODO"}]] beginSheetModalForWindow:[NSApp mainWindow] completionHandler:nil])