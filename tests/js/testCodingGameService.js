// tests/js/testCodingGameService.js
//
// Copyright (c) 2016 Endless Mobile Inc.
// All Rights Reserved.
//
// These unit tests test the underlying functionality in CodingGameController
// (apart from the actual sequencing of events themselves).

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

const Controller = imports.lib.controller;

const MockDescriptors = {
    warnings: [],
    events: [
        {
            name: 'none::event',
            type: 'chat-actor',
            data: {
                actor: 'MEME',
                message: 'Hey you'
            }
        },
    ],
    start: {
        initial_mission: 'none'
    },
    missions: [
        {
            name: 'none',
            short_desc: 'Short Description',
            long_desc: 'Long Description',
            start_events: [
                'none::event'
            ],
            'artifacts': [
            ]
        },
    ]
};
const createChatControllerMock = jasmine.createSpyObj.bind(this, 'ChatControllerMock', [
    'sendChatMessage'
]);
const createExternalServiceMock = jasmine.createSpyObj.bind(this, 'ExternalServiceMock', [
    'connectHandlers',
    'setGameManagerState',
    'currentMission',
    'completeTaskWithPoints',
    'listeningForEvents'
]);
const ExternalEffectsStub = new Lang.Class({
    Name: 'ExternalEffectsStub',

    performEventIn: function(event, timeout, callback) {
        callback();
    },

    changeGSettingsValue: function(settings, key, value) {
    },

    copySourceToTarget: function(settings, key, value) {
    }
});
const createExternalEffectsMock = function() {
    let effects = new ExternalEffectsStub();
    spyOn(effects, 'performEventIn').and.callThrough();
    spyOn(effects, 'changeGSettingsValue');
    spyOn(effects, 'copySourceToTarget');
}

describe ('Game Service Controller', function () {
    beforeEach(function () {
        GLib.setenv('G_SETTINGS_BACKEND', 'memory', true);
    });

    it('constructs', function() {
        let [logFile, logFileStream] = Gio.File.new_tmp("game-service-log-XXXXXX");
        logFileStream.output_stream.write('[]', null);
        new Controller.CodingGameController(MockDescriptors,
                                            createExternalServiceMock(),
                                            createChatControllerMock(),
                                            createExternalEffectsMock(),
                                            logFile);
    });
});
