// controller.js
//
// Copyright (c) 2016 Endless Mobile Inc.
// All Rights Reserved.
//
// The Coding Game Controller ties all the logic for handling game state together into
// a single class, which manages the state of the game and communicates with other
// external components


const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

const Log = imports.lib.log;
const Service = imports.lib.service;

let Config;

try {
    Config = imports.lib.config;
} catch (e) {
    // If this happens, we're likely running in a testing environment
    Config = {
        coding_files_dir: '/',
        coding_copy_files_script: '/copy-files.js'
    };
}

function findInArray(array, callback) {
    let result = array.filter(callback);
    if (!result.length)
        return null;

    return result[0];
}

// resolveGSettingsValue
//
// This function examines a value which is intended to be passed to GSettings
// and checks if any postprocessing should be done on it. For instance, it
// might refer to a file that is in the internal data dirs, so we need to change
// the value to a uri to reflect that.
function resolveGSettingsValue(value, oldValue) {
    if (typeof(value) === 'object') {
        switch(value.type) {
        case 'internal-file-uri':
            let path = GLib.build_filenamev([
                Config.coding_files_dir,
                value.value
            ]);
            return GLib.filename_to_uri(path, null);
        case 'append-to-list-unique':
            let valueSet = Set();
            oldValue.forEach(function(v) {
                valueSet.add(v);
            });
            value.value.forEach(function(addValue) {
                valueSet.add(addValue);
            });
            return [...valueSet];
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
    let eventDescriptorsToRun = findEvents.map(function(e) {
        return findInArray(eventDescriptors, function(responseEvent) {
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

// resolvePath
//
// Takes a path and expands a leading '~' into the user's home directory/.
// Resolves any relative paths by first copying the file from
// cooding_files_dir into the user config dir and then marking the path
// as relative to that.
function resolvePath(path, effects) {
    // Try and resolve the path using Gio.File.parse_name. That will
    // either yield an absolute path, a relative path or NULL.
    let parsedPath = (Gio.File.parse_name(path)).get_path();

    // First, if the path is a relative one, then copy it into
    // the user config dir and use that.
    if (!parsedPath || !GLib.path_is_absolute(parsedPath)) {
        // Couldn't find the file. Perhaps it is a relative path
        // and so we should treat it as relative to the
        // coding files directory. But first copy the relevant
        // file into a directory controlled by the user.
        let userFile = GLib.build_filenamev([
            GLib.get_user_config_dir(),
            'com.endlessm.CodingGameService',
            path
        ]);

        effects.copySourceToTarget(path, userFile);
        return userFile;
    }

    return parsedPath;
}


// getStateForMissionName
//
// Using the descriptors and game service log file, determine the current
// state for the selected mission and return it as an object with
// properties 'descriptor' and 'gameManagerState'
//
// This function will throw an error if the mission cannot be found.
//
// @param {array.Object} descriptors - An array of event descriptors parsed from
//                                     the timeline.json file.
// @param {Log.CodingGameServiceLog} eventLog - An eventLog object containing
//                                              all the currently run events.
// @returns {object} - The state for the current mission.
function getStateForMissionName(name, descriptors, eventLog) {
    // When a mission is started, we look at the very first event in this mission
    // and dispatch that. We also set the active mission name and the points counter
    let missionSpec = null, missionIndex = 0;

    for (; missionIndex < descriptors.missions.length; ++missionIndex) {
        if (descriptors.missions[missionIndex].name === name) {
            missionSpec = descriptors.missions[missionIndex];
            break;
        }
    }

    if (!missionSpec)
        throw new Error('No such mission named ' + name);

    let totalAvailablePoints = missionSpec.artifacts.map(function(a) {
        return a.points;
    }).reduce(function(total, p) {
        return total + p;
    }, 0);

    let completedEventsForMission = eventLog.artifactEventsWithNames(missionSpec.artifacts.map(function(a) {
        return a.name;
    }));

    let totalAccruedPoints = Object.keys(completedEventsForMission).filter(function(k) {
        return completedEventsForMission[k] !== null;
    }).map(function(k) {
        return findInArray(missionSpec.artifacts, function(a) {
            return a.name === k;
        });
    }).reduce(function(total, a) {
        return total + a.points;
    }, 0);

    let earnedArtifacts = eventLog.allUniqueArtifactEvents().map(Lang.bind(this, function(a) {
        for (let mission of descriptors.missions) {
            for (let missionArtifact of mission.artifacts) {
                if (missionArtifact.name === a.data.name)
                    return missionArtifact;
            }
        }

        throw new Error('Couldn\'t find corresponding artifact description for: ' +
                        a.data.name);
    }));

    return {
        descriptor: missionSpec,
        gameManagerState: {
            currentMission: missionSpec.name,
            currentMissionStageNum: missionIndex + 1,
            currentMissionName: missionSpec.short_desc,
            currentMissionDesc: missionSpec.long_desc,
            // In the future we will probably want this to be a per-artifact level,
            // though the current non-linear architecture does not fit well with
            // that (what is the 'next' artifact when there could be many?).
            currentMissionHint: missionSpec.hint,
            currentMissionNumTasksAvailable: Object.keys(completedEventsForMission).length,
            currentMissionNumTasks: Object.keys(completedEventsForMission).filter(function(k) {
                return completedEventsForMission[k] !== null;
            }).length,
            currentMissionPoints: totalAccruedPoints,
            currentMissionPointsAvailable: totalAvailablePoints,
            earnedArtifacts: earnedArtifacts
        }
    };
}

const CodingGameController = new Lang.Class({
    Name: 'CodingGameController',

    _init: function(descriptors, service, chatController, effectsManager, logFile) {
        this.parent();

        this._descriptors = descriptors;
        this._logFile = logFile;
        this._log = new Log.CodingGameServiceLog(this._logFile);
        this._service = service;
        this._chatController = chatController;
        this._effectsManager = effectsManager;

        this._service.connectHandlers({
            dispatchEventByName: Lang.bind(this, this.dispatchEventByName),
            fetchChatHistory: Lang.bind(this, this.fetchChatHistory),
            receiveChatResponse: Lang.bind(this, this.receiveChatResponse),
            receiveExternalEvent: Lang.bind(this, this.receiveExternalEvent),
            receiveOpenAttachment: Lang.bind(this, this.receiveOpenAttachment),
            resetGame: Lang.bind(this, this._resetGame)
        });

        // Log the warnings
        this._descriptors.warnings.forEach(w => log(w));

        this._dispatchTable = {
            'chat-actor': Lang.bind(this, this._dispatchChatEvent),
            'chat-actor-attachment': Lang.bind(this, this._dispatchChatAttachmentEvent),
            'chat-actor-desktop-attachment': Lang.bind(this, this._dispatchChatDesktopAttachmentEvent),
            'chat-user': Lang.bind(this, this._dispatchChatEvent),
            'input-user': Lang.bind(this, this._dispatchInputBubbleEvent),
            'start-mission': Lang.bind(this, this._startMissionEvent),
            'register-artifact': Lang.bind(this, this._registerArtifactEvent),
            'change-setting': Lang.bind(this, this._changeSettingEvent),
            'listen-event': Lang.bind(this, this._listenExternalEvent),
            'receive-event': Lang.bind(this, this._receiveExternalEvent),
            'user-opened-attachment': Lang.bind(this, this._userOpenedAttachment),
            'copy-file': Lang.bind(this, this._copyFileEvent),
            'wait-for': Lang.bind(this, this._waitForEvent),
            'wait-for-complete': Lang.bind(this, this._waitForEventComplete),
            'wait-for-cancelled': Lang.bind(this, this._waitForEventCancelled),
            'modify-app-grid': Lang.bind(this, this._modifyAppGridEvent)
        };

        // Listen for any events which are currently outstanding
        let listeningForTriggers = this._log.activeEventsToListenFor();
        this._listeningEventTriggers = {};

        // Update all the triggers once
        this._listeningEventTriggers = listeningForTriggers;
        this._updateCurrentlyListeningForEventsProp();

        // Re-add any timeouts to the main loop which are currently outstanding.
        // Note that we don't just re-add the timeout, but look at the timestamp
        // to determine how much time has passed since the invocation of the
        // wait-for event and either add it back to the mainloop with a value
        // which takes that time into account or just fire it on the next iteration
        let activeTimeouts = this._log.activeTimeouts();
        Object.keys(activeTimeouts).map(Lang.bind(this, function(name) {
            let timestamp = activeTimeouts[name];
            let event = findInArray(this._descriptors.events, function(e) {
                return e.name === name;
            });

            // Examine the timestamp to see how much time has
            // passed since the wait-for event happened. We only get second
            // level precision here but that's good enough.
            let delta = Date.now() - Date.parse(timestamp);

            // We will allow a negative delta for now and fire those events
            // later once we are done with map()
            return {
                event: event,
                remaining: event.data.timeout - delta
            };
        })).forEach(Lang.bind(this, function(spec) {
            // If the event has a negative remaining time value, then
            // add it with a timeout of zero so that it gets dispatched
            // on the next main loop iteration
            this._completeWaitForEventIn(spec.event, Math.max(spec.remaining, 0));
        }));

        // If we started for the first time, dispatch the very first mission
        let activeMission = this._log.activeMission();

        if (activeMission) {
            // Don't start the active mission. Instead, get the state of the
            // game manager for this mission and set that.
            let missionState = getStateForMissionName(activeMission, this._descriptors, this._log);
            this._service.setGameManagerState(missionState.gameManagerState);
        } else {
            // No active mission. Fire the very first event
            this._startFirstMission();
        }
    },

    eventHasOccurred: function(name) {
        return this._log.eventHasOccurred(name);
    },

    dispatchEventByName: function(name) {
        let enabler = GLib.getenv('CODING_ENABLE_HACKING_MODE');
        if (enabler !== 'IKNOWWHATIAMDOING') {
            throw new Service.ServiceError(Service.Errors.FORBIDDEN,
                                           'Not allowed to dispatch events at will');
        }

        let event = findInArray(this._descriptors.events, function(e) {
            return e.name === name;
        });

        if (event === null) {
            throw new Service.ServiceError(Service.Errors.NO_SUCH_EVENT_ERROR,
                                           'No such event ' + JSON.stringify(name));
        }

        this._dispatch(event);
    },

    fetchChatHistory: function(actor) {
        return this._log.chatLogForActor(actor).map(function(h) {
            return [JSON.stringify(h)];
        });
    },

    receiveChatResponse: function(id, contents, response) {
        let respondingTo = findInArray(this._descriptors.events, function(e) {
            return (e.type === 'chat-actor' || e.type === 'input-user') && e.name === id;
        });

        if (!respondingTo) {
            throw new Service.ServiceError(Service.Errors.NO_SUCH_EVENT_ERROR,
                                           'No such event ' + JSON.stringify(id));
        }

        let eventKeyToRun = findInArray(Object.keys(respondingTo.data.responses), function(r) {
            return r === response;
        });

        if (!eventKeyToRun) {
            throw new Service.ServiceError(Service.Errors.NO_SUCH_RESPONSE_ERROR,
                                           'No such response ' + JSON.stringify(id));
        }

        this._dispatch({
            name: id + '::response',
            type: 'chat-user',
            data: {
                name: id,
                actor: respondingTo.data.actor,
                message: contents,
                styles: respondingTo.data.styles
            }
        });

        let responses = respondingTo.data.responses[eventKeyToRun];
        let toDispatch = findEventsToDispatchInDescriptors(responses,
                                                           this._descriptors.events);
        toDispatch.forEach(Lang.bind(this, function(e) {
            this._dispatch(e);
        }));
    },

    receiveOpenAttachment: function(id) {
        let respondingTo = findInArray(this._descriptors.events, function(e) {
            return (e.type === 'chat-actor-attachment') && e.name === id;
        });

        if (!respondingTo) {
            throw new Service.ServiceError(Service.Errors.NO_SUCH_EVENT_ERROR,
                                           'No such event ' + JSON.stringify(id));
        }

        this._dispatch({
            name: id + '::opened',
            type: 'user-opened-attachment',
            data: {
                name: id,
                actor: respondingTo.data.actor
            }
        });

        let responses = respondingTo.data.attachment.open_event;

        // In some cases responses will not be defined. It is only an optional
        // key
        if (responses) {
            let toDispatch = findEventsToDispatchInDescriptors(responses,
                                                               this._descriptors.events);
            toDispatch.forEach(Lang.bind(this, function(e) {
                this._dispatch(e);
            }));
        }
    },

    receiveExternalEvent: function(id) {
        let eventToTrigger = this._listeningEventTriggers[id];

        if (!eventToTrigger) {
            throw new Service.ServiceError(Service.Errors.IRRELEVANT_EVENT,
                                           'Not listening for event ' + id);
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
    },

    _dispatchInputBubbleEvent: function(event, callback) {
        let entry = callback(event);
        this._chatController.sendChatMessage({
            timestamp: entry.timestamp,
            actor: entry.data.actor,
            input: entry.data.input,
            name: entry.name,
            styles: entry.data.styles ? entry.data.styles : []
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
                name: entry.name,
                styles: entry.data.styles ? entry.data.styles : []
            });
        });

        if (event.type === 'chat-actor') {
            sendMessage(event);
        } else {
            // No sense sending the chat message, just create a log entry
            callback(event);
        }
    },

    _dispatchChatAttachmentEvent: function(event, callback) {
        // Creates a log entry and then sends the attachment to the client
        // but first deep-copy the event.
        event = JSON.parse(JSON.stringify(event));
        event.data.attachment.path = resolvePath(event.data.attachment.path,
                                                 this._effectsManager);
        let entry = callback(event);
        this._chatController.sendChatMessage({
            timestamp: entry.timestamp,
            actor: entry.data.actor,
            attachment: entry.data.attachment,
            name: entry.name,
            styles: entry.data.styles ? entry.data.styles : []
        });
    },

    _dispatchChatDesktopAttachmentEvent: function(event, callback) {
        // Creates a log entry and then sends the desktop attachment to the client
        // but first deep-copy the event.
       
        event = JSON.parse(JSON.stringify(event));
        let attachmentPath = event.data.attachment.path;
		let appName = event.data.attachment.app;
        if (!attachmentPath) {
		    let appInfo = Gio.DesktopAppInfo.new(appName);
            attachmentPath = appInfo.get_filename();
        }
        print(attachmentPath);
        event.data.attachment.path = resolvePath(appDesktopPath,
                                                 this._effectsManager);
        let entry = callback(event);
        this._chatController.sendChatMessage({
            timestamp: entry.timestamp,
            actor: entry.data.actor,
            attachment: entry.data.attachment,
            name: entry.name,
            styles: entry.data.styles ? entry.data.styles : []
        });
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
        let currentMission = this._service.currentMission();

        if (this._service.current_mission) {
            let missionSpec = findInArray(this._descriptors.missions, Lang.bind(this, function(m) {
                return m.name == currentMission;
            }));
            let achievedArtifact = findInArray(missionSpec.artifacts, function(a) {
                return a.name === event.data.name;
            });

            if (achievedArtifact) {
                this._service.completeTaskWithPoints(achievedArtifact);
            }
        }

        callback(event);
    },

    _cancelPendingEventsSafely: function() {
        // First, find all the pending wait-for events and dispatch
        // other events which cause them to be cancelled. This will cause
        // the cancellation to be logged so that re-opening the game
        // service doesn't cause them to get triggered again.
        Object.keys(this._log.activeTimeouts()).forEach(Lang.bind(this, function(name) {
            this._effectsManager.cancelPendingEvent(name);
            this._dispatch({
                name: name + '::cancelled',
                type: 'wait-for-cancelled',
                data: {
                    name: name
                }
            });
        }));

        // Then cancel all remaining timeouts that we don't care aobut.
        this._effectsManager.cancelAllPendingEvents();
    },

    _resetGame: function() {
        // Cancel everything that is pending
        this._cancelPendingEventsSafely();

        // Get all of the settings keys and schemas that
        // we changed so that we can reset them later
        let settingsToReset = this._log.getChangedSettings();
        let modifyAppGridEvents = this._log.reversedAppGridModifications();
        let copyEvents = this._log.reversedCopyFileEvents();
        // Delete game-service.log and then reload the log in memory
        this._logFile.delete(null);
        this._log = new Log.CodingGameServiceLog(this._logFile);

        // Clear all of our settings
        settingsToReset.forEach(Lang.bind(this, function(settingDesc) {
            let settings = new Gio.Settings({ schema: settingDesc.schema });
            this._effectsManager.resetGSettingsValue(settings, settingDesc.key);
        }));

        // Go through all the copy-file events and remove all the copied files.
        copyEvents.forEach(Lang.bind(this, function(e) {
            this._effectsManager.removeFile(e.data.target);
        }));

        // Go through all the app-grid events and apply their reverse event. The
        // list is already reversed, so we'll be going back to front.
        //
        // We assume that actions is always valid here, since it would be impossible
        // to perform and log an event with an invalid action type.
        modifyAppGridEvents.forEach(Lang.bind(this, function(e) {
            switch (e.data.action) {
                case 'add-app':
                    this._effectsManager.removeApplication(e.data.app);
                    break;
                case 'remove-app':
                    this._effectsManager.addApplication(e.data.app);
                    break;
                default:
                    // Crash here, shouldn't be reachable.
                    throw new Error('Unreachable section, should not be possible to have invalid type');
            }
        }));

        // Dispatch the very first mission again
        this._startFirstMission();
    },

    _startFirstMission: function() {
        this._dispatch(findInArray(this._descriptors.events, Lang.bind(this, function(event) {
            return event.name === this._descriptors.start.initial_event
        })));
    },

    _startMission: function(name) {
        // Cancel everything that is pending
        this._cancelPendingEventsSafely();

        // Set the state for the game manager
        let missionState = getStateForMissionName(name, this._descriptors, this._log);
        this._service.setGameManagerState(missionState.gameManagerState);

        // Start dispatching events for this mission
        missionState.descriptor.start_events.forEach(Lang.bind(this, function(start_event) {
            let event = findInArray(this._descriptors.events, function(e) {
                return e.name === start_event;
            });

            if (!event) {
                throw new Error('No such event ' + start_event +
                                ', cannot start mission ' + missionState.descriptor.name);
            }

            this._dispatch(event);
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

        let settings = new Gio.Settings({ settings_schema: schema });
        let value = resolveGSettingsValue(event.data.value,
                                          this._effectsManager.fetchGSettingsValue(settings,
                                                                                   event.data.key,
                                                                                   event.data.variant_type));
        this._effectsManager.changeGSettingsValue(settings,
                                                  event.data.key,
                                                  new GLib.Variant(event.data.variant_type, value));
        callback(event);
    },

    _copyFileEvent: function(event, callback) {
        // First make sure the file exists
        let source = event.data.source;
        let target = event.data.target;

        this._effectsManager.copySourceToTarget(source, target);
        callback(event);
    },

    _updateCurrentlyListeningForEventsProp: function() {
        this._service.listeningForEvents(Object.keys(this._listeningEventTriggers));
    },

    _startListeningFor: function(name, event) {
        this._listeningEventTriggers[name] = event;
        this._updateCurrentlyListeningForEventsProp();
    },

    _stopListeningFor: function(name) {
        delete this._listeningEventTriggers[name];
        this._updateCurrentlyListeningForEventsProp();
    },

    _listenExternalEvent: function(event, callback) {
        this._startListeningFor(event.data.name, event);
        callback(event);
    },

    _receiveExternalEvent: function(event, callback) {
        this._stopListeningFor(event.data.name);
        callback(event);
    },

    _userOpenedAttachment: function(event, callback) {
        // Just log that this occurred
        callback(event);
    },

    _completeWaitForEventIn: function(event, timeout) {
        this._effectsManager.performEventIn(event.name,
                                            timeout,
                                            Lang.bind(this, function() {
            this._dispatch({
                name: event.name + '::completed',
                type: 'wait-for-complete',
                data: {
                    name: event.name
                }
            });

            let toDispatch = findEventsToDispatchInDescriptors(event.data.then,
                                                               this._descriptors.events);
            toDispatch.forEach(Lang.bind(this, function(e) {
                this._dispatch(e);
            }));
        }));
    },

    _waitForEventComplete: function(event, callback) {
        callback(event);
    },

    _waitForEventCancelled: function(event, callback) {
        callback(event);
    },

    _waitForEvent: function(event, callback) {
        callback(event);
        this._completeWaitForEventIn(event, event.data.timeout);
    },

    _modifyAppGridEvent: function(event, callback) {
        let action = event.data.action;

        if (action === 'add-app') {
            let app = event.data.app;

            this._effectsManager.addApplication(app);
        } else if (action === 'remove-app') {
            let app = event.data.app;

            this._effectsManager.removeApplication(app);
        } else {
            throw new Error('Cannot process modify-app-grid event for app ' + event.data.app +
                           ', bad action type ' + action.type);
        }

        callback(event);
    },

    _dispatch: function(event) {
        try {
            this._dispatchTable[event.type](event, Lang.bind(this, function(logEvent) {
                return this._log.handleEvent(logEvent.type, logEvent.name, logEvent.data);
            }));
        } catch (e) {
            logError(e, 'Failed to dispatch ' + JSON.stringify(event));
        }
    }
});
