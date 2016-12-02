#!/usr/bin/env gjs
// coding-game-service.js
//
// Copyright (c) 2016 Endless Mobile Inc.
// All Rights Reserved.
//
// The Coding Game Service is the central place where timelines about game state
// progression are kept. This service essentially administers a large JSON file
// with a history of all events and can reconstruct chatbox conversations from that.
//
// It reads another JSON file which is a predefined "script" for what should
// happen on particular actions, for instance, showing another chatbox
// message, or waiting for a particular event. It is designed to be stateful, unlike
// showmehow-service, which is stateless.

const ChatboxService = imports.gi.ChatboxService;
const CodingGameServiceDBUS = imports.gi.CodingGameService;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

// This is a hack to cause CodingGameService js resources to get loaded
const CodingGameServiceResource = imports.gi.CodingGameService.get_resource();  // eslint-disable-line no-unused-vars

const Lang = imports.lang;
const System = imports.system;

// Put ourself in the search path. Note that we have the least priority.
// This will allow us to run locally against non-packed files that
// are already on disk if the user sets GJS_PATH appropriately.
imports.searchPath.push('resource:///com/endlessm/coding-game-service');

const Communicator = imports.lib.communicator;
const Config = imports.lib.config;
const Log = imports.lib.log;
const Service = imports.lib.service;
const ShellAppStore = imports.lib.shellAppStore;

// loadTimelineDescriptors
//
// Attempts to load timeline descriptors from a file.
//
// The default case is to load the descriptors from the internal resource
// file that makes up CodingGameService's binary. However, we first:
//  1. Look at the command line to see if a file was provided there
//  2. Look in $XDG_CONFIG_HOME/com.endlessm.CodingGameService for a file
//     called 'timeline.json'
//  3. Use the internal resource named 'data/timeline.json'
//
// The first two are assumed to be 'untrusted' - they will be validated
// before being loaded in. If there are any errors, we try to use
// what we can, but will add in an 'errors' entry to signify that
// there were some errors that should be dealt with. Client applications
// may query for errors and display them appropriately. This is
// to help the lesson authors quickly catch problems.
//
// Returns an array of timeline descriptors.
function loadTimelineDescriptors(cmdlineFile) {
    let filesToTry = [
        cmdlineFile,
        Gio.File.new_for_path(GLib.build_filenamev([GLib.get_user_config_dir(),
                                                    'com.endlessm.CodingGameService',
                                                    'timeline.json'])),
        Gio.File.new_for_uri('resource:///com/endlessm/coding-game-service/data/timeline.json')
    ];

    let warnings = [];
    let descriptors = null;

    // Here we use a 'dumb' for loop, since we need to update
    // warnings if a filename didn't exist
    for (let i = 0; i < filesToTry.length; ++i) {
        let file = filesToTry[i];
        if (!file)
            continue;

        try {
            let contents = file.load_contents(null)[1];
            descriptors = JSON.parse(contents);
        } catch (e if e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
            continue;
        } catch (e) {
            // Add the warnings anyway even if we weren't successful, since
            // the developer might still be interested in them.
            warnings.push('Unable to load ' + file.get_parse_name() + ': ' + String(e));
        }

        // If we were successful, then break here, otherwise try and load
        // the next file.
        //
        // Note that success is defined as 'we were able to partially load
        // a file.'
        if (descriptors)
            break;
    }

    // Add a 'warnings' key to descriptors.
    descriptors.warnings = warnings;
    return descriptors;
}

const CodingGameServiceApplication = new Lang.Class({
    Name: 'CodingGameServiceApplication',
    Extends: Gio.Application,

    _init: function(params) {
        this.parent(params);
        this._skeleton = null;
        this._commandLineFile = null;

        this.add_main_option('timeline-file', 'l'.charCodeAt(0), GLib.OptionFlags.NONE, GLib.OptionArg.FILENAME,
                             'Use this file for timeline', 'PATH');
    },

    vfunc_startup: function() {
        this.parent();
        this.hold();
    },

    vfunc_handle_local_options: function(options) {
        let timelineFileVal = options.lookup_value('timeline-file', new GLib.VariantType('ay'));
        if (timelineFileVal)
            this._commandLineFile = Gio.File.new_for_path(timelineFileVal.get_bytestring().toString());

        // Continue default processing...
        return -1;
    },

    vfunc_dbus_register: function(conn, object_path) {
        this.parent(conn, object_path);
        let logFileForPath = Gio.File.new_for_path(GLib.build_filenamev([GLib.get_user_config_dir(),
                                                                         'com.endlessm.CodingGameService',
                                                                         'game-service.log']))

        this._skeleton = new Service.DBUSService(conn, object_path);
        this._controller = new Controller.CodingGameController(loadTimelineDescriptors(this._commandLineFile),
                                                               this._skeleton,
                                                               new Communicator.CodingGameServiceChatController(ChatboxService.CodingChatboxProxy),
                                                               new Communicator.ExternalEffects(),
                                                               logFileForPath);
        return true;
    },

    vfunc_dbus_unregister: function(conn, object_path) {
        if (this._skeleton && this._skeleton.has_connection(conn))
            this._skeleton.unexport();

        this.parent(conn, object_path);
    }
});

let args = [System.programInvocationName].concat(ARGV);
let application = new CodingGameServiceApplication({
    application_id: 'com.endlessm.CodingGameService.Service',
    flags: Gio.ApplicationFlags.IS_SERVICE
});
application.run(args);
