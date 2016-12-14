// lib/log.js
//
// Copyright (c) 2016 Endless Mobile Inc.
// All Rights Reserved.
//
// The communicator module is responsible for communicating messages to and from
// this service to other services, such as the chatbox itself.

const ChatboxService = imports.gi.ChatboxService;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

const CodingGameServiceLog = new Lang.Class({
    Name: 'CodingGameServiceLog',

    _init: function(logFile) {
        this._logFile = logFile;
        this._eventLog = [];

        let logContents = '[]';

        try {
            logContents = this._logFile.load_contents(null)[1];
        } catch (e if e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
            // ignore errors when the file does not exist
            return;
        } catch (e) {
            logError(e, 'Unable to load game service log');
            return;
        }

        try {
            this._eventLog = JSON.parse(logContents);
        } catch (e) {
            logError(e, 'Unable to parse contents of game service log file');
        }
    },

    handleEvent: function(eventType, eventName, eventData) {
        let timestamp = new Date().toString();
        let entry = {
            type: eventType,
            name: eventName,
            data: eventData,
            timestamp: timestamp
        };

        this._eventLog.push(entry);

        try {
            let logFileDirectory = this._logFile.get_parent();
            logFileDirectory.make_directory_with_parents(null);
        } catch (e if e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
            // Ignore this case
        } catch (e) {
            logError(e, 'Unable to create game service log directory');
            // Keep going -- we'll fail anyway
        }

        try {
            let logContents = JSON.stringify(this._eventLog, null, 2);
            this._logFile.replace_contents(logContents,
                                           null, false,
                                           Gio.FileCreateFlags.NONE, null);
        } catch (e) {
            logError(e, 'Unable to save game service log');
        }

        return entry;
    },

    chatLogForActor: function(actor) {
        return this._eventLog.filter(function(e) {
            return (e.type === 'chat-actor' ||
                    e.type === 'chat-actor-attachment' ||
                    e.type === 'chat-user' ||
                    e.type === 'input-user') && e.data.actor === actor;
        }).map(function(e) {
            return {
                timestamp: e.timestamp,
                actor: e.data.actor,
                message: e.data.message,
                attachment: e.data.attachment,
                name: e.name,
                input: e.data.input,
                type: e.type
            };
        });
    },

    artifactEventsWithNames: function(artifactNames) {
        let eventsToEntries = {};

        artifactNames.forEach(function(e) {
            eventsToEntries[e] = null;
        });

        this._eventLog.filter(function(e) {
            return e.type === 'register-artifact' &&
                   artifactNames.indexOf(e.data.name) !== -1;
        }).forEach(function(e) {
            // Unconditionally overwrite eventsToEntries so that each key
            // in the object corresponds to the latest occurrence of the
            // event
            eventsToEntries[e.data.name] = e;
        });

        return eventsToEntries;
    },

    activeMission: function() {
        let missions = this._eventLog.filter(function(e) {
            return e.type === 'start-mission';
        });

        if (!missions.length)
            return null;

        return missions[missions.length - 1].data.name;
    },

    activeEventsToListenFor: function() {
        let activeListeningEvents = {};

        this._eventLog.filter(function(e) {
            return e.type === 'listen-event' || e.type === 'receive-event';
        }).forEach(function(e) {
            if (e.type === 'listen-event') {
                // Its okay to clobber an existing true value in here
                // since as soon as we receive an event we stop listening
                // for it completely.
                activeListeningEvents[e.data.name] = e;
            } else if (e.type === 'receive-event') {
                delete activeListeningEvents[e.data.name];
            }
        });

        return activeListeningEvents;
    },

    // This function returns pairs of event names and timestamps
    // for each wait-for event. Those timestamps can be used along
    // with the timeout member in order to add new timeouts
    // back to the main loop in case the service is terminated.
    activeTimeouts: function() {
        // This is a mapping of event names to timestamps
        let activeTimeoutEvents = {};

        this._eventLog.filter(function(e) {
            return e.type === 'wait-for' || e.type === 'wait-for-complete'
        }).forEach(function(e) {
            if (e.type === 'wait-for') {
                // Its okay to clobber an existing value here - that
                // just means the timeout would have restarted.
                activeTimeoutEvents[e.name] = e.timestamp;
            } else if (e.type === 'wait-for-complete') {
                if (activeTimeoutEvents[e.data.name]) {
                    delete activeTimeoutEvents[e.data.name];
                }
            }
        });

        return activeTimeoutEvents;
    },

    eventHasOccurred: function(name) {
        return this._eventLog.some(function(e) {
            return e.name === name;
        });
    }
});

