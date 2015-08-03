//
//  KBPGPOutputFileView.m
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPOutputFileView.h"

#import "KBFileListView.h"
#import "KBPGPOutputFooterView.h"

@interface KBPGPOutputFileView ()
@property KBFileListView *fileListView;
@end

@implementation KBPGPOutputFileView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];

  _fileListView = [[KBFileListView alloc] init];
  _fileListView.imageLabelStyle = KBImageLabelStyleLarge;
  _fileListView.onMenuSelect = ^(KBTableView *tableView, NSIndexPath *indexPath) {
    NSMenu *menu = [[NSMenu alloc] initWithTitle:@""];
    [menu addItemWithTitle:@"Show In Finder" action:@selector(showInFinder:) keyEquivalent:@""];
    return menu;
  };
  [self addSubview:_fileListView];

  KBPGPOutputFooterView *footerView = [[KBPGPOutputFooterView alloc] init];
  [self addSubview:footerView];
  footerView.editButton.targetBlock = ^{
    [self.navigation popViewAnimated:YES];
  };
  footerView.closeButton.targetBlock = ^{ [[self window] close]; };

  self.viewLayout = [YOVBorderLayout layoutWithCenter:_fileListView top:nil bottom:@[footerView] insets:UIEdgeInsetsZero spacing:0];
}

- (void)setFiles:(NSArray *)files {
  [_fileListView addObjects:files animation:NSTableViewAnimationEffectNone];
}

- (void)showInFinder:(id)sender {
  KBFile *file = [_fileListView.dataSource objectAtIndexPath:_fileListView.menuIndexPath];
  [[NSWorkspace sharedWorkspace] activateFileViewerSelectingURLs:@[[NSURL fileURLWithPath:file.path]]];
}

@end
