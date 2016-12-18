// lib/communicator.js
//
// Copyright (c) 2016 Endless Mobile Inc.
// All Rights Reserved.
//
// The communicator module is responsible for communicating messgaes to and from
// this service to other services, such as the chatbox itself.

const ChatboxService = imports.gi.ChatboxService;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

const Config = imports.lib.config;
const ShellAppStore = imports.lib.shellAppStore;

const CodingGameServiceChatController = new Lang.Class({
    Name: 'CodingGameServiceChatController',

    _init: function() {
        try {
            this._internalChatboxProxy =
                ChatboxService.CodingChatboxProxy.new_for_bus_sync(Gio.BusType.SESSION,
                                                                   Gio.DBusProxyFlags.DO_NOT_AUTO_START_AT_CONSTRUCTION,
                                                                   'com.endlessm.Coding.Chatbox',
                                                                   '/com/endlessm/Coding/Chatbox',
                                                                   null);
         } catch (e) {
             logError(e, 'Error occurred in connecting to com.endlesssm.Coding.Chatbox');
         }
    },

    sendChatMessage: function(message) {
        let serialized = JSON.stringify(message);
        this._internalChatboxProxy.call_receive_message(serialized, null, Lang.bind(this, function(source, result) {
            try {
                let [success, returnValue] = this._internalChatboxProxy.call_receive_message_finish(result);
            } catch (e) {
                logError(e,
                         'Failed to send message to chatbox (' +
                         JSON.stringify(message, null, 2) + ')');
            }
        }));
    }
});

// executeCommandForOutput
//
// Shell out to some process and get its output. If the process
// returns a non-zero exit status, throw.
function executeCommandForOutput(argv) {
    let stdout, stderr;
    stdout = stderr = '';

    try {
        let [ok, procStdOut, procStdErr, status] = GLib.spawn_sync(null,
                                                                   argv,
                                                                   null,
                                                                   GLib.SpawnFlags.SEARCH_PATH,
                                                                   null);
        stdout = procStdOut;
        stderr = procStdErr;

        // Check the exit status to see if the process failed. This will
        // throw an exception if it did.
        GLib.spawn_check_exit_status(status);

        return {
            status: status,
            stdout: String(procStdOut),
            stderr: String(procStdErr)
        };
    } catch (e) {
        throw new Error('Failed to execute ' + argv.join(' ') + ': ' +
                        [String(e), String(stdout), String(stderr)].join('\n'));
    }
}

// copySourceToTarget
//
// This function will copy a file from the coding_files_dir to a given target path.
// If the user has write permissions for that path (eg, it is within the home
// directory, we write it there directly. Otherwise, we shell out to pkexec and
// another script to copy to another (whitelisted) location.
function copySourceToTarget(source, target) {
    let targetFile = Gio.File.parse_name(target);

    // We have permission to copy this file.
    if (targetFile.has_prefix(Gio.File.new_for_path(GLib.get_home_dir()))) {
        let sourcePath = GLib.build_filenamev([
            Config.coding_files_dir,
            source
        ]);
        let sourceFile = Gio.File.new_for_path(sourcePath);

        sourceFile.copy(targetFile, Gio.FileCopyFlags.OVERWRITE, null, null);
    } else {
        // We do not have permission to copy this file. Shell out to
        // the coding-copy-files script through pkexec and take the result
        // from there.
        executeCommandForOutput([
            'pkexec',
            Config.coding_copy_files_script,
            source,
            target
        ]);
    }
}

// ExternalEffects
//
// This class manages CodingGameService's interaction with the outside
// world, for instance, changing settings, copying files or adding
// events to the main loop.
//
// It exists as a separate class so that it can be replaced in testing
// scenarios.
const ExternalEffects = new Lang.Class({
    Name: 'ExternalEffects',

    _init: function() {
        this._shellProxy = new ShellAppStore.ShellAppStore();

        // Maps event names to timeouts.
        this._activeTimeouts = {};
    },

    addApplication: function(app) {
        this._shellProxy.proxy.AddApplicationRemote(app);
    },

    removeApplication: function(app) {
        this._shellProxy.proxy.RemoveApplicationRemote(app);
    },

    performEventIn: function(name, timeout, callback) {
        // Calling this function with a name that already has an existing
        // timeout will clobber the old timeout and add the new one. We
        // explicitly remove the old timeout in that case.
        let existingId = this._activeTimeouts[name];
        if (existingId !== null && existingId !== undefined) {
            GLib.source_remove(existingId);
        }

        this._activeTimeouts[name] = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
                                                      timeout,
                                                      Lang.bind(this, function() {
            delete this._activeTimeouts[name];
            callback();
        }));
    },

    // cancelPendingEvent
    //
    // Cancels a pending event by name. Use this for when you know the name
    // of an event to cancel and you need to do something after it has
    // been cancelled. It is a programmer error to call this function
    // with an event that is not pending.
    cancelPendingEvent: function(name) {
        let eventId = this._activeTimeouts[name];
        if (eventId === null || eventId === undefined) {
            throw new Error('No such pending event: ' + name);
        }

        GLib.source_remove(eventId);
        delete this._activeTimeouts[name];
    },

    // cancelAllPendingEvents
    //
    // Cancels all remaining  pending events, regardless of what their names
    // were. Use this when you don't know what events you have to cancel and
    // you don't care what got cancelled.
    cancelAllPendingEvents: function() {
        Object.keys(this._activeTimeouts).forEach(Lang.bind(this, function(name) {
            let eventId = this._activeTimeouts[name];
            GLib.source_remove(eventId);
        }));
        this._activeTimeouts = {};
    },

    changeGSettingsValue: function(settings, key, value) {
        settings.set_value(key, value);
    },

    fetchGSettingsValue: function(settings, key, variant) {
        // Variant is unused here, but we use it in the tests
        // to construct a placeholder
        return settings.get_value(key).deep_unpack();
    },

    resetGSettingsValue: function(settings, key) {
        settings.reset(key);
    },

    copySourceToTarget: function(source, target) {
        copySourceToTarget(source, target);
    }
});

