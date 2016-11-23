#!/usr/bin/env gjs
/* edit-desktop-file.js
 *
 * Copyright (c) 2016 Endless Mobile Inc.
 * All Rights Reserved.
 *
 * Simple script to exercise the desktop file editor.
 */

imports.searchPath.push('.');  // XXX: Kludge.

const DesktopFile = imports.lib.desktopFile;
const System = imports.system;

const usage = [
    'Usage: edit-desktop-file.js <command> <desktop-file-id> [arguments...]',
    '',
    'Available commands:',
    '',
    '   set-command <id> <command-line> [executable]',
    '   set-icon <id> <icon-name-or-path>',
    '   restore <id>',
    '',
];

let showHelp = (ARGV.length === 1 && ARGV[0] === 'help')
    || ARGV.indexOf('--help') !== -1;

if (ARGV.length < 2 || showHelp) {
    usage.map(line => print(line));
    System.exit(showHelp ? 0 : 1);
}

switch (ARGV[0]) {
    case 'restore':
        DesktopFile.restore(ARGV[1]);
        break;
    case 'set-command':
        DesktopFile.setCommand(ARGV[1], ARGV[2], ARGV[3]);
        break;
    case 'set-icon':
        DesktopFile.setIcon(ARGV[1], ARGV[2]);
        break;
    default:
        print('No such command: ' + ARGV[0]);
        usage.map(line => print(line));
        System.exit(1);
}
