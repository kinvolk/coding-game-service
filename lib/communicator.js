#!/usr/bin/env gjs
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
                         JSON.stringify(message, null, 2));
            }
        }));
    }
});

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
    },

    addApplication: function(app) {
        this._shellProxy.proxy.AddApplicationRemote(app);
    },

    removeApplication: function(app) {
        this._shellProxy.proxy.RemoveApplicationRemote(app);
    },

    performEventIn: function(event, timeout, callback) {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeout, callback);
    },

    changeGSettingsValue: function(settings, key, value) {
        settings.set_value(key, value);
    }
});

