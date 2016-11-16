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

const Config = imports.lib.config;

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

function findInArray(array, callback) {
    let result = array.filter(callback);
    if (!result.length)
        return null;

    return result[0];
}

const CodingGameServiceChatController = new Lang.Class({
    Name: 'CodingGameServiceChatController',

    _init: function() {
        try {
            this._internalChatboxProxy =
                ChatboxService.CodingChatboxProxy.new_for_bus_sync(Gio.BusType.SESSION,
                                                                   0,
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
                         JSON.stringify(message, null, 2));
            }
        }));
    }
});

const CodingGameServiceLog = new Lang.Class({
    Name: 'CodingGameServiceLog',

    _init: function() {
        this._logFile = Gio.File.new_for_path(GLib.build_filenamev([GLib.get_user_config_dir(),
                                                                    'com.endlessm.CodingGameService',
                                                                    'game-service.log'])),
        this._eventLog = [];

        let logContents = '';

        try {
            logContents = this._logFile.load_contents(null)[1];
        } catch (e if e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
            // ignore errors when the file does not exist
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
        let timestamp = new Date().toLocaleString();
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
        } catch(e if e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
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
        } catch(e) {
            logError(e, 'Unable to save game service log');
        }

        return entry;
    },

    chatLogForActor: function(actor) {
        return this._eventLog.filter(function(e) {
            return (e.type === 'chat-actor' ||
                    e.type === 'chat-user' ||
                    e.type == 'input-user') && e.data.actor === actor;
        }).map(function(e) {
            return {
                timestamp: e.timestamp,
                actor: e.data.actor,
                message: e.data.message,
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

    eventHasOccurred: function(name) {
        return this._eventLog.some(function(e) {
            return e.name === name;
        });
    }
});

// environmentObjectToEnvp
//
// Convert an object containing key-value pairs to an array of
// strings that can be passed to exec.
function environmentObjectToEnvp(environment) {
    if (environment) {
        return Object.keys(environment)
                     .map(key => key + '=' + environment[key]);
    } else {
        return null;
    }
}


// environmentAsObject
//
// Get all the environment variables as an object, so that we can merge
// them with new ones.
function environmentAsObject() {
    let environment = {};
    GLib.listenv().forEach(key => environment[key] = GLib.getenv(key));
    return environment;
}

// executeCommandForOutput
//
// Shell out to some process and get its output. If the process
// returns a non-zero environment variable, throw.
//
// Specify user_environment to override environment variables.
function executeCommandForOutput(argv, userEnvironment) {
    let environment = null;

    if (userEnvironment) {
        environment = environmentAsObject();
        Object.keys(userEnvironment).forEach(key => {
            environment[key] = userEnvironment[key];
        });
    }

    let envp = environment ? null : environmentObjectToEnvp(environment);
    let [ok, stdout, stderr, status] = GLib.spawn_sync(null,
                                                       argv,
                                                       envp,
                                                       0,
                                                       null);

    if (!ok) {
        throw new Error('Failed to execute: ' + argv.join(" ") + ", no error " +
                        'message was set');
    }

    // Check the exit status to see if the process failed. This will
    // throw an exception if it did.
    try {
        GLib.spawn_check_exit_status(status);
    } catch (e) {
        throw new Error('Failed to execute ' + argv.join(' ') + ': ' +
                        [String(e), String(stdout), String(stderr)].join('\n'));
    }

    return {
        status: status,
        stdout: String(stdout),
        stderr: String(stderr)
    };
}

// copySourceToTarget
//
// This function will copy a file from the coding_files_dir to a given target path.
// If the user has write permissions for that path (eg, it is within the home
// directory, we write it there directly. Otherwise, we shell out to pkexec and
// another script to copy to another (whitelisted) location.
function copySourceToTarget(source, target) {
    let targetFile = Gio.File.new_for_path(target);

    // We have permission to copy this file.
    if (targetFile.has_prefix(GLib.get_home_dir())) {
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
            "/usr/bin/pkexec",
            Config.coding_copy_files_script,
            source,
            target
        ]);
    }
}

// resolveGSettingsValue
//
// This function examines a value which is intended to be passed to GSettings
// and checks if any postprocessing should be done on it. For instance, it
// might refer to a file that is in the internal data dirs, so we need to change
// the value to a uri to reflect that.
function resolveGSettingsValue(value) {
    if (typeof(value) === 'object') {
        switch(value.type) {
            case 'internal-file-uri':
                return 'file://' + GLib.build_filenamev([
                    Config.coding_files_dir,
                    value.value
                ]);
            default:
                throw new Error('Don\'t know how to handle type ' + value.type);
        }
    }

    return value;
}

// findEventsToDispatchInDecriptors
//
// Takes a list of events and finds the corresponding event entries
// in descriptors so that they can be dispatched. Throws if
// an event was not able to be found.
function findEventsToDispatchInDescriptors(findEvents, eventDescriptors) {
    // We map from events names to event descriptors here to preserve the
    // ordering
    let eventDescriptorsToRun = events.map(function(e) {
        return eventDescriptors.some(function(responseEvent) {
            return responseEvent.name === e;
        });
    });

    // If we can't find them all, throw an internal error here.
    if (findEvents.length !== eventDescriptorsToRun.length) {
        throw new Error('Couldn\'t find descriptors for events: ' +
                        JSON.stringify(findEvents, null, 2) + ', found: ' +
                        JSON.stringify(eventDescriptorsToRun, null, 2));
    }

    return eventDescriptorsToRun;
}


const CodingGameServiceErrorDomain = GLib.quark_from_string('coding-game-service-error');
const CodingGameServiceErrors = {
    NO_SUCH_EVENT_ERROR: 0,
    NO_SUCH_RESPONSE_ERROR: 1,
    IRRELEVANT_EVENT: 2,
    INTERNAL_ERROR: 3
};
const CodingGameService = new Lang.Class({
    Name: 'CodingGameService',
    Extends: CodingGameServiceDBUS.CodingGameServiceSkeleton,

    _init: function(commandLineFile) {
        this.parent();

        this._descriptors = loadTimelineDescriptors(commandLineFile);
        this._log = new CodingGameServiceLog(Gio.File.new_for_path('game-service.log'));
        this._chatController = new CodingGameServiceChatController(ChatboxService.CodingChatboxProxy);
        this._dispatchTable = {
            'chat-actor': Lang.bind(this, this._dispatchChatEvent),
            'chat-user': Lang.bind(this, this._dispatchChatEvent),
            'input-user': Lang.bind(this, this._dispatchInputBubbleEvent),
            'start-mission': Lang.bind(this, this._startMissionEvent),
            'register-artifact': Lang.bind(this, this._registerArtifactEvent),
            'change-setting': Lang.bind(this, this._changeSettingEvent),
            'listen-event': Lang.bind(this, this._listenExternalEvent),
            'receive-event': Lang.bind(this, this._receiveExternalEvent),
            'copy-file': Lang.bind(this, this._copyFileEvent),
            'wait-for': Lang.bind(this, this._waitForEvent)
        };

        // Log the warnings
        this._descriptors.warnings.forEach(w => log(w));

        // Listen for any events which are currently outstanding
        let listeningForTriggers = this._log.activeEventsToListenFor();
        this._listeningEventTriggers = {};
        Object.keys(listeningForTriggers).forEach(Lang.bind(this, function(k) {
            this._startListeningFor(k, listeningForTriggers[k]);
        }));

        // If we started for the first time, dispatch the very first mission
        let activeMission = this._log.activeMission();

        if (activeMission)
            this._startMission(activeMission);
        else
            this._dispatch({
                type: 'start-mission',
                data: {
                    name: this._descriptors.start.initial_mission
                }
            });
    },

    vfunc_handle_chat_history: function(method, actor) {
        try {
            let history = this._log.chatLogForActor(actor).map(function(h) {
                return [JSON.stringify(h)];
            });
            this.complete_chat_history(method, GLib.Variant.new('a(s)', history));
        } catch(e) {
            method.return_error_literal(CodingGameServiceErrorDomain,
                                        CodingGameServiceErrors.INTERNAL_ERROR,
                                        String(e));
        }

        return true;
    },

    vfunc_handle_chat_response: function(method, id, contents, response) {
        try {
            let respondingTo = findInArray(this._descriptors.events, function(e) {
                return (e.type === 'chat-actor' || e.type === 'input-user') && e.name === id;
            });

            if (!respondingTo) {
                method.return_error_literal(CodingGameServiceErrorDomain,
                                            CodingGameServiceErrors.NO_SUCH_EVENT_ERROR,
                                            'No such event ' + JSON.stringify(id));
                return true;
            }

            let eventKeyToRun = findInArray(Object.keys(respondingTo.data.responses), function(r) {
                return r === response;
            });

            if (!eventKeyToRun) {
                method.return_error_literal(CodingGameServiceErrorDomain,
                                            CodingGameServiceErrors.NO_SUCH_RESPONSE_ERROR,
                                            'No such response ' + JSON.stringify(response));
                return true;
            }

            this._dispatch({
                name: id + '::response',
                type: 'chat-user',
                data: {
                    name: id,
                    actor: respondingTo.data.actor,
                    message: contents
                }
            });

            let responses = respondingTo.data.responses[eventKeyToRun];
            let toDispatch = findEventsToDispatchInDescriptors(responses,
                                                               this._descriptors.events);
            toDispatch.forEach(Lang.bind(this, function(e) {
                this._dispatch(e);
            }));

            this.complete_chat_response(method);
        } catch(e) {
            method.return_error_literal(CodingGameServiceErrorDomain,
                                        CodingGameServiceErrors.INTERNAL_ERROR,
                                        String(e));
            logError(e);
        }

        return true;
    },

    vfunc_handle_external_event: function(method, id) {
        try {
            let eventToTrigger = this._listeningEventTriggers[id];

            if (!eventToTrigger) {
                method.return_error_literal(CodingGameServiceErrorDomain,
                                            CodingGameServiceErrors.IRRELEVANT_EVENT,
                                            'Not listening for event ' + id);
                return true;
            }

            // Process an internal event to note that we received the event here
            // which will cause us to stop listening for it and log it.
            this._dispatch({
                name: eventToTrigger.name + '::receive',
                type: 'receive-event',
                data: {
                    name: id
                }
            });

            // Run the other events that happen when this one was triggered and
            // stop listening for this event now.
            let toDispatch = findEventsToDispatchInDescriptors(eventToTrigger.data.received,
                                                               this._descriptors.events);
            toDispatch.forEach(Lang.bind(this, function(e) {
                this._dispatch(e);
            }));

            this.complete_external_event(method);
        } catch (e) {
            logError(e);
            method.return_error_literal(CodingGameServiceErrorDomain,
                                        CodingGameServiceErrors.INTERNAL_ERROR,
                                        String(e));
        }

        return true;
    },

    vfunc_handle_currently_listening_for_events: function(method) {
        try {
            let response = new GLib.Variant('a(s)',
                                            Object.keys(this._listeningEventTriggers).map(k => [k]));
            this.complete_currently_listening_for_events(method, response);
        } catch (e) {
            logError(e);
            method.return_error_literal(CodingGameServiceErrorDomain,
                                        CodingGameServiceErrors.INTERNAL_ERROR,
                                        String(e));
        }

        return true;
    },

    _dispatchInputBubbleEvent: function(event, callback) {
        let entry = callback(event);
        this._chatController.sendChatMessage({
            timestamp: entry.timestamp,
            actor: entry.data.actor,
            input: entry.data.input,
            name: entry.name
        });
    },

    _dispatchChatEvent: function(event, callback) {
        let sendMessage = Lang.bind(this, function(event) {
            // Creates a log entry then sends the message to the client
            let entry = callback(event);
            this._chatController.sendChatMessage({
                timestamp: entry.timestamp,
                actor: entry.data.actor,
                message: entry.data.message,
                name: entry.name
            });
        });

        if (event.type === 'chat-actor') {
            sendMessage(event);
        } else {
            // No sense sending the chat message, just create a log entry
            callback(event);
        }
    },

    _registerArtifactEvent: function(event, callback) {
        // If we have a current mission, update the number of points
        // based on the fact that we ran a new event. Note that the points
        // accrue as soon as an event is run, which is meant to be
        // representative of the fact that it was triggered from other
        // events.
        //
        // This simplifies the design somewhat, since it allows us to
        // keep the notion of events and artifacts separate and does not
        // require us to encode the idea of "passing" or "failing" an
        // event (instead we merely move from one event to another)
        if (this.current_mission) {
            let missionSpec = findInArray(this._descriptors.missions, Lang.bind(this, function(m) {
                return m.name == this.current_mission;
            }));
            let achievedArtifact = findInArray(missionSpec.artifacts, function(a) {
                return a.name === event.data.name;
            });

            if (achievedArtifact) {
                this.current_mission_points += achievedArtifact.points;
                this.current_mission_num_tasks++;
            }
        }

        callback(event);
    },

    _startMission: function(name) {
        // When a mission is started, we look at the very first event in this mission
        // and dispatch that if it has not already been dispatched in the log. We also
        // set the active mission name and the points counter
        let missionSpec = findInArray(this._descriptors.missions, function(m) {
            return m.name === name;
        });

        if (!missionSpec)
            throw new Error('No such mission named ' + name);

        let totalAvailablePoints = missionSpec.artifacts.map(function(a) {
            return a.points;
        }).reduce(function(total, p) {
            return total + p;
        }, 0);

        let completedEvents = this._log.artifactEventsWithNames(missionSpec.artifacts.map(function(a) {
            return a.name;
        }));

        let totalAccruedPoints = Object.keys(completedEvents).filter(function(k) {
            return completedEvents[k] !== null;
        }).map(function(k) {
            return findInArray(missionSpec.artifacts, function(a) {
                return a.name === k;
            });
        }).reduce(function(total, a) {
            return total + a.points;
        }, 0);

        this.current_mission = missionSpec.name;
        this.current_mission_name = missionSpec.short_desc;
        this.current_mission_desc = missionSpec.long_desc;
        this.current_mission_num_tasks_available = Object.keys(completedEvents).length;
        this.current_mission_num_tasks = Object.keys(completedEvents).filter(function(k) {
            return completedEvents[k] !== null;
        }).length;
        this.current_mission_points = totalAccruedPoints;
        this.current_mission_available_points = totalAvailablePoints;

        // Now, if our starting event has not yet occured, trigger it
        missionSpec.start_events.forEach(Lang.bind(this, function(start_event) {
            if (!this._log.eventHasOccurred(start_event)) {
                let event = findInArray(this._descriptors.events, function(e) {
                    return e.name === start_event;
                });

                if (!event) {
                    throw new Error('No such event ' + start_event +
                                    ', cannot start mission ' + missionSpec.name);
                }
     
                this._dispatch(event);
            }
        }));
    },

    _startMissionEvent: function(event, callback) {
        // Create the log entry, then start the mission
        callback(event);
        this._startMission(event.data.name);
    },

    _changeSettingEvent: function(event, callback) {
        let source = Gio.SettingsSchemaSource.get_default();
        let schema = source.lookup(event.data.schema, true);

        // We first do some introspection on the schema to make sure that we can
        // change the value as intended and don't get aborted when we try to
        if (!schema) {
            throw new Error('Cannot process change-setting event ' + event.data.name +
                            ', no such schema ' + event.data.schema);
        }

        if (schema.list_keys().indexOf(event.data.key) === -1) {
            throw new Error('Cannot process change-setting event ' + event.data.name +
                            ', schema ' + event.data.schema + ' has no key ' +
                            event.data.key);
        }

        let value = resolveGSettingsValue(event.data.value);
        let settings = new Gio.Settings({ settings_schema: schema });
        settings.set_value(event.data.key,
                           new GLib.Variant(event.data.variant, value));
        callback(event);
    },

    _copyFileEvent: function(event, callback) {
        /* First make sure the file exists */
        let source = event.data.source;
        let target = event.data.target;

        let souceDataPath = GLib.build_filenamev([
            Config.coding_files_dir,
            source
        ]);

        copySourceToTarget(source, target);
        callback(event);
    },

    _startListeningFor: function(name, event) {
        this.emit_listen_for_event(name);
        this._listeningEventTriggers[name] = event;
    },

    _stopListeningFor: function(name) {
        this.emit_stop_listening_for(name);
        delete this._listeningEventTriggers[name];
    },

    _listenExternalEvent: function(event, callback) {
        this._startListeningFor(event.data.name, event);
        callback(event);
    },

    _receiveExternalEvent: function(event, callback) {
        this._stopListeningFor(event.data.name);
        callback(event);
    },

    _waitForEvent: function(event, callback) {
        callback(event);
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, event.data.timeout, Lang.bind(this, function() {
            let toDispatch = findEventsToDispatchInDescriptors(event.data.then,
                                                               this._descriptors.events);
            toDispatch.forEach(Lang.bind(this, function(e) {
                this._dispatch(e);
            }));
        }));
    },

    _dispatch: function(event) {
        this._dispatchTable[event.type](event, Lang.bind(this, function(logEvent) {
            return this._log.handleEvent(logEvent.type, logEvent.name, logEvent.data);
        }));
    }   
});

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

        this._skeleton = new CodingGameService(this._commandLineFile);
        this._skeleton.export(conn, object_path);
        return true;
    },

    vfunc_dbus_unregister: function(conn, object_path) {
        if (this._skeleton)
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
