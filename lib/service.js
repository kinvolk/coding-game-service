// lib/service.js
//
// Copyright (c) 2016 Endless Mobile Inc.
// All Rights Reserved.
//
// This file contains the actual D-Bus service glue code. The class exported
// in this file is intended to be used by a wrapper class to handle method
// calls and set properties. It is intended only to provide a very thin
// layer of abstraction

const CodingGameServiceDBUS = imports.gi.CodingGameService;
const GLib = imports.gi.GLib;
const Lang = imports.lang;

const CodingGameServiceErrorDomain = GLib.quark_from_string('coding-game-service-error');
const Errors = {
    NO_SUCH_EVENT_ERROR: 0,
    NO_SUCH_RESPONSE_ERROR: 1,
    IRRELEVANT_EVENT: 2,
    INTERNAL_ERROR: 3,
    FORBIDDEN: 4
};

function ServiceError(code, message) {
    this.code = code;
    this.message = message;
    this.stack = (new Error()).stack;
}

// artifactForStage
//
// Creates an artifact entry suitable for placing on the D-Bus property
// artifacts
function artifactForStage(artifact, stage) {
    artifact.stage = stage;
    return artifact;
}

// earnedArtifactsVariantForArrayOfObjects
//
// Creates a GVariant suitable for transmission from an array
// of artifact objects
function earnedArtifactsVariantForArrayOfObjects(artifacts) {
    return new GLib.Variant('aa{sv}', artifacts.map(function(artifact) {
        let serialized = {};
        Object.keys(artifact).forEach(function(key) {
            serialized[key] = new GLib.Variant('s', String(artifact[key]));
        });
        return serialized;
    }));
}

// DBUSService
//
// This is intended to be wrapper class which is passed "handlers" for a
// wrapper class to handle events that occur on the service. 
const DBUSService = new Lang.Class({
    Name: 'DBUSService',
    Extends: CodingGameServiceDBUS.CodingGameServiceSkeleton,

    _init: function(connection, objectPath) {
        this.parent();
        this.export(connection, objectPath);
    },

    connectHandlers: function(handlers) {
        this._handlers = handlers;
    },

    vfunc_handle_test_dispatch_event: function(method, name) {
        try {
            this._handlers.dispatchEventByName(name);
            this.complete_test_dispatch_event(method);
        } catch (e if e instanceof ServiceError) {
            method.return_error_literal(CodingGameServiceErrorDomain,
                                        e.code,
                                        e.message);
        } catch (e) {
            method.return_error_literal(CodingGameServiceErrorDomain,
                                        Errors.INTERNAL_ERROR,
                                        String(e));
            logError(e);
        }
        return true;
    },

    vfunc_handle_chat_history: function(method, actor) {
        try {
            let history = this._handlers.fetchChatHistory(actor);
            this.complete_chat_history(method, GLib.Variant.new('a(s)', history));
        } catch (e if e instanceof ServiceError) {
            method.return_error_literal(CodingGameServiceErrorDomain,
                                        e.code,
                                        e.message);
        } catch (e) {
            method.return_error_literal(CodingGameServiceErrorDomain,
                                        Errors.INTERNAL_ERROR,
                                        String(e));
            logError(e);
        }

        return true;
    },

    vfunc_handle_chat_response: function(method, id, contents, response) {
        try {
            this._handlers.receiveChatResponse(id, contents, response);
            this.complete_chat_response(method);
        } catch (e if e instanceof ServiceError) {
            method.return_error_literal(CodingGameServiceErrorDomain,
                                        e.code,
                                        e.message);
        } catch (e) {
            method.return_error_literal(CodingGameServiceErrorDomain,
                                        Errors.INTERNAL_ERROR,
                                        String(e));
            logError(e);
        }

        return true;
    },

    vfunc_handle_external_event: function(method, id) {
        try {
            this._handlers.receiveExternalEvent(id);
            this.complete_external_event(method);
        } catch (e if e instanceof ServiceError) {
            method.return_error_literal(CodingGameServiceErrorDomain,
                                        e.code,
                                        e.message);
        } catch (e) {
            method.return_error_literal(CodingGameServiceErrorDomain,
                                        Errors.INTERNAL_ERROR,
                                        String(e));
            logError(e);
        }

        return true;
    },

    vfunc_handle_reset_game: function(method) {
        try {
            this._handlers.resetGame();
            this.complete_reset_game(method);
        } catch (e) {
            logError(e, 'Could not reset game');
            method.return_error_literal(CodingGameServiceErrorDomain,
                                        Errors.INTERNAL_ERROR,
                                        String(e));
        }
    },

    setGameManagerState: function(properties) {
        this.current_mission = properties.currentMission;
        this.current_mission_stage_num = properties.currentMissionStageNum;
        this.current_mission_name = properties.currentMissionName;
        this.current_mission_desc = properties.currentMissionDesc;
        this.current_mission_hint = properties.currentMissionHint;
        this.current_mission_num_tasks_available = properties.currentMissionNumTasksAvailable;
        this.current_mission_num_tasks = properties.currentMissionNumTasks;
        this.current_mission_available_points = properties.currentMissionPointsAvailable;
        this.current_mission_points = properties.currentMissionPoints;
        this.earned_artifacts = earnedArtifactsVariantForArrayOfObjects(
            properties.earnedArtifacts.map(Lang.bind(this, function(a) {
                return artifactForStage(a, this.current_mission_stage_num)
            }))
        );
    },

    currentMission: function() {
        return this.current_mission;
    },

    completeTaskWithPoints: function(artifact) {
        this.current_mission_points += artifact.points;
        this.current_mission_num_tasks++;
        this.earned_artifacts = earnedArtifactsVariantForArrayOfObjects(
            this.earned_artifacts.deep_unpack().concat([
                artifactForStage(artifact, this.current_mission_stage_num)
            ])
        );
    },

    listeningForEvents: function(events) {
        this.currently_listening_for_events = events;
    }
});

