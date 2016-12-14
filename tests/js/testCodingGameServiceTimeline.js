// tests/js/testCodingGameService.js
//
// Copyright (c) 2016 Endless Mobile Inc.
// All Rights Reserved.
//
// These tests actually exercise the entire timeline to make sure that
// all the events work as intended. The ordering of tests here matters
// since it follows the real timeline structure.

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

const Controller = imports.lib.controller;
const Mocks = imports.mocks.constructors;

function walkTimelineForEventSequence(timeline) {
    let eventSequence = [];
    let seenEvents = [];

    let addTriggerEvent = function(name) {
        let sequencePoints = [{
           type: 'expect-event',
           name: name
        }];

        // If we haven't seen this event before, descend down
        // see what the responses are
        if (seenEvents.indexOf(name) === -1) {
            seenEvents.push(name);
            let event = Controller.findInArray(timeline.events, e => e.name === name);

            // If we couldn't find the event, we have an invalid timeline
            // file. Bail out now
            if (!event) {
                throw new Error('Couldn\'t find event ' + name + ' in timeline');
            }

            // Depending on the type of event, this event may trigger more events
            // and we should recurse into them, but use seenEvents to avoid cycles.
            switch (event.type) {
                case 'input-user':
                    Object.keys(event.data.responses).forEach(function(response) {
                        sequencePoints.push({
                            type: 'chat-response',
                            response: response,
                            event: name,
                            subsequence: event.data.responses[response].map(addTriggerEvent)
                        });
                    });
                    break;
                case 'start-mission':
                    let mission = Controller.findInArray(timeline.missions,
                                                         m => m.name === event.data.name);

                    if (!mission) {
                        throw new Error('Mission ' + mission + ' does not exist');
                    }

                    sequencePoints.push({
                        type: 'start-mission',
                        name: event.data.name,
                        subsequence: mission.start_events.map(addTriggerEvent)
                    });
                    break;
                case 'listen-event':
                    sequencePoints.push({
                        type: 'external-event',
                        name: event.data.name,
                        event: name,
                        subsequence: event.data.received.map(addTriggerEvent)
                    });
                    break;
                case 'wait-for':
                    sequencePoints.push({
                        type: 'wait-for',
                        timeout: event.data.timeout,
                        subsequence: event.data.then.map(addTriggerEvent)
                    });
                    break;
                default:
                    break;
            }
        }

        return sequencePoints;
    }

    // Get the starting events first
    eventSequence = [addTriggerEvent(timeline.start.initial_event)];

    return [seenEvents, eventSequence];
};

describe('Default Game Service Controller Timeline', function () {
    let controller, externalService, chatController, externalEffects, logFile;
    let defaultTimeline = JSON.parse(GLib.file_get_contents('data/timeline.json')[1]);
    defaultTimeline.warnings = [];
    let [seenEvents, eventSequence] = walkTimelineForEventSequence(defaultTimeline);
    beforeAll(function () {
        GLib.setenv('G_SETTINGS_BACKEND', 'memory', true);
        externalService = Mocks.createExternalService();
        chatController = Mocks.createChatController();
        externalEffects = Mocks.createExternalEffects();
        logFile = Mocks.createLogFileWithStructure([]);
        controller = new Controller.CodingGameController(defaultTimeline,
                                                         externalService,
                                                         chatController,
                                                         externalEffects,
                                                         logFile);
    });

    describe('traversed events', function() {
        defaultTimeline.events.map(function(event) {
            return event.name;
        }).forEach(function(name) {
            it('contains ' + name, function() {
                expect(seenEvents).toContain(name);
            });
        });
    });

    let sequencePointTestCaseGenerator = function(sequencePoint) {
        switch(sequencePoint.type) {
            case 'expect-event':
                it('triggered event ' + sequencePoint.name, function() {
                    expect(controller.eventHasOccurred(sequencePoint.name)).toBeTruthy();
                });
                break;
            case 'start-mission':
                describe('started mission ' + sequencePoint.name, function() {
                    beforeAll(function() {
                        externalService.currentMission.and.returnValue(sequencePoint.name);
                    });
                    sequencePoint.subsequence.forEach(function(subsequencePoint) {
                        subsequencePoint.forEach(sequencePointTestCaseGenerator);
                    });
                });
                break;
            case 'chat-response':
                describe(sequencePoint.event + ' received response ' + sequencePoint.response, function() {
                    beforeAll(function() {
                        controller.receiveChatResponse(sequencePoint.event,
                                                       'A response',
                                                       sequencePoint.response);
                    });
                    sequencePoint.subsequence.forEach(function(subsequencePoint) {
                        subsequencePoint.forEach(sequencePointTestCaseGenerator);
                    });
                });
                break;
            case 'external-event':
                describe(sequencePoint.event + ' received external event ' + sequencePoint.name, function() {
                    beforeAll(function() {
                        controller.receiveExternalEvent(sequencePoint.name);
                    });
                    sequencePoint.subsequence.forEach(function(subsequencePoint) {
                        subsequencePoint.forEach(sequencePointTestCaseGenerator);
                    });
                });
                break;
            case 'wait-for':
                describe('would wait ' + sequencePoint.timeout + ' to satisfy ' + sequencePoint.name, function() {
                    sequencePoint.subsequence.forEach(function(subsequencePoint) {
                        subsequencePoint.forEach(sequencePointTestCaseGenerator);
                    });
                });
                break;
            default:
                throw new Error('Don\'t know how to handle sequence ' +
                                'point type ' + sequencePoint.type);
        }
    };

    eventSequence.forEach(function(sequencePointSet) {
        sequencePointSet.forEach(sequencePointTestCaseGenerator);
    });
});
