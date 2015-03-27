//
//  KBPGPOutputFileView.m
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPOutputFileView.h"

#import "KBFileListView.h"

@interface KBPGPOutputFileView ()
@property KBFileListView *fileListView;
@end

@implementation KBPGPOutputFileView

- (void)viewInit {
  [super viewInit];
  [self setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];

  _fileListView = [[KBFileListView alloc] init];
  _fileListView.scrollView.borderType = NSBezelBorder;
  _fileListView.fileLabelStyle = KBFileLabelStyleLarge;
  _fileListView.menuSelectBlock  = ^(NSIndexPath *indexPath) {
    NSMenu *menu = [[NSMenu alloc] initWithTitle:@""];
    [menu addItemWithTitle:@"Show In Finder" action:@selector(showInFinder:) keyEquivalent:@""];
    return menu;
  };
  [self addSubview:_fileListView];

  YOHBox *footerView = [YOHBox box:@{@"spacing": @"10", @"minSize": @"130,0", @"horizontalAlignment": @"right"}];
  KBButton *closeButton = [KBButton buttonWithText:@"Done" style:KBButtonStyleDefault];
  closeButton.targetBlock = ^{ [[self window] close]; };
  [footerView addSubview:closeButton];
  [self addSubview:footerView];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:_fileListView topView:nil bottomView:footerView insets:UIEdgeInsetsMake(20, 20, 20, 20) spacing:20 maxSize:CGSizeMake(600, 450)]];
}

- (void)setFiles:(NSArray *)files {
  [_fileListView addObjects:files];
}

- (void)showInFinder:(id)sender {
  KBFile *file = [_fileListView.dataSource objectAtIndexPath:_fileListView.menuIndexPath];
  [[NSWorkspace sharedWorkspace] activateFileViewerSelectingURLs:@[[NSURL fileURLWithPath:file.path]]];
}

@end
