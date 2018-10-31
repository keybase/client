//
//  FilesViewController.m
//  KeybaseShare
//
//  Created by John Zila on 10/25/18.
//  Copyright © 2018 Keybase. All rights reserved.
//

#import "FilesViewController.h"
#import "keybase/keybase.h"

@interface FilesViewController ()
@property NSString* path; // the path we are currently showing
@property NSArray* directoryEntries; // the directory entries at the current path
@end

NSString* const UpOneLevel = @".. [Up one level]";

@implementation FilesViewController

- (void)viewDidLoad {
  [super viewDidLoad];
  
  self.preferredContentSize = CGSizeMake(self.view.frame.size.width, 2*self.view.frame.size.height); // expand
  self.definesPresentationContext = YES;
  [self setPath:@"/"];
  
  // show this spinner on top of the table view until we have parsed the inbox
  UIActivityIndicatorView* av = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleGray];
  [av setTag:self.view.tag+1];
  [self.view addSubview:av];
  [av setTranslatesAutoresizingMaskIntoConstraints:NO];
  [av setHidesWhenStopped:YES];
  [av bringSubviewToFront:self.view];
  [av startAnimating];
  [self.tableView addConstraints:@[
     [NSLayoutConstraint constraintWithItem:av
                                  attribute:NSLayoutAttributeCenterX
                                  relatedBy:NSLayoutRelationEqual
                                     toItem:self.tableView
                                  attribute:NSLayoutAttributeCenterX
                                 multiplier:1 constant:0],
     [NSLayoutConstraint constraintWithItem:av
                                  attribute:NSLayoutAttributeCenterY
                                  relatedBy:NSLayoutRelationEqual
                                     toItem:self.tableView
                                  attribute:NSLayoutAttributeCenterY
                                 multiplier:1 constant:0]
     ]
   ];
  
  [self dispatchFilesBrowser];
}

- (void)dispatchFilesBrowser {
  UIActivityIndicatorView* av = [self.view viewWithTag:self.view.tag + 1];
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSError* error = NULL;
    [self setDirectoryEntries:[NSArray new]];
    NSString* jsonFiles = KeybaseExtensionListPath(self.path, &error); // returns the path list in JSON format
    if (jsonFiles == nil) {
      dispatch_async(dispatch_get_main_queue(), ^{
        NSLog(@"failed to get files: %@", error);
        [av stopAnimating];
      });
      // just show blank in this case
      return;
    }
    [self parseFiles:jsonFiles];
    dispatch_async(dispatch_get_main_queue(), ^{
      [av stopAnimating];
      [self.tableView reloadData];
    });
  });
}

NSInteger sortEntries(NSDictionary* one, NSDictionary* two, void* context) {
  int t1 = [[one objectForKey:@"direntType"] intValue];
  int t2 = [[two objectForKey:@"direntType"] intValue];
  if (t1 == 1 && t2 != 1) {
    return NSOrderedAscending;
  } else if (t2 == 1 && t1 != 1) {
    return NSOrderedDescending;
  } else {
    return [one[@"name"] compare:two[@"name"]];
  }
}

- (void)parseFiles:(NSString*)jsonFiles {
  NSError* error = nil;
  NSData* data = [jsonFiles dataUsingEncoding:NSUTF8StringEncoding];
  NSArray* items = [NSJSONSerialization JSONObjectWithData:data options: NSJSONReadingMutableContainers error: &error];
  NSArray* sortedItems;
  if (!items) {
    NSLog(@"parseFiles: error parsing JSON: %@", error);
    sortedItems = [[NSArray alloc] init];
  } else {
    sortedItems = [items sortedArrayUsingFunction:sortEntries context:NULL];
  }
  if ([self.path isEqualToString:@"/"]) {
    [self setDirectoryEntries:sortedItems];
  } else {
    NSMutableArray* itemsWithBack = [[NSMutableArray alloc] init];
    [itemsWithBack addObject:[[NSDictionary alloc] initWithObjectsAndKeys:
                              UpOneLevel, @"name",
                              [NSNumber numberWithInt:1], @"direntType",
                              nil]];
    [itemsWithBack addObjectsFromArray:sortedItems];
    [self setDirectoryEntries:itemsWithBack];
  }
}

- (void)didReceiveMemoryWarning {
  KeybaseExtensionForceGC();
  [super didReceiveMemoryWarning];
}

#pragma mark - Table view data source

- (NSInteger)numberOfSectionsInTableView:(UITableView *)tableView {
    return 1;
}

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section {
    return [self.directoryEntries count];
}

- (NSDictionary*)getItemAtIndex:(NSIndexPath*)indexPath {
  NSInteger index = [indexPath item];
  return self.directoryEntries[index];
}

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath {
  UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:@"ConvCell"];
  if (NULL == cell) {
    cell = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleDefault reuseIdentifier:@"ConvCell"];
  }
  NSDictionary* item = [self getItemAtIndex:indexPath];
  [[cell textLabel] setText:item[@"name"]];
  if ([[item objectForKey:@"direntType"] intValue] == 1) {
    [[cell textLabel] setTextColor:[UIColor colorWithRed:76.0/255.0 green:142.0/255.0 blue:1 alpha:1]];
  } else {
    [[cell textLabel] setTextColor:[UIColor colorWithRed:0 green:0 blue:0 alpha:1]];
  }
  return cell;
}

- (void)tableView:(UITableView *)tableView didSelectRowAtIndexPath:(NSIndexPath *)indexPath {
  NSDictionary* target = [self getItemAtIndex:indexPath];
  if ([indexPath isEqual:[NSIndexPath indexPathForRow:0 inSection:0]] && [[target objectForKey:@"name"] isEqualToString:UpOneLevel]) {
    // '..' needs to navigate back up
    NSArray* pathElems = [self.path componentsSeparatedByString:@"/"];
    NSArray* upOneDirectory = [pathElems subarrayWithRange:NSMakeRange(0, [pathElems count] - 2)];
    [self setPath:[NSString stringWithFormat:@"%@/", [upOneDirectory componentsJoinedByString:@"/"]]];
    [self dispatchFilesBrowser];
  } else if ([[target objectForKey:@"direntType"] intValue] == 1) {
    [self setPath:[NSString stringWithFormat:@"%@%@/", self.path, target[@"name"]]];
    [self dispatchFilesBrowser];
  } else {
    [tableView deselectRowAtIndexPath:indexPath animated:FALSE];
  }
  // [self.delegate folderSelected:self.path]; // let main view controller know we have something
}

@end
