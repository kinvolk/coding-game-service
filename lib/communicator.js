#!/usr/bin/env gjs
// lib/communicator.js
//
// Copyright (c) 2016 Endless Mobile Inc.
// All Rights Reserved.
//
// The communicator module is responsible for communicating messgaes to and from
// this service to other services, such as the chatbox itself.

const ChatboxService = imports.gi.ChatboxService;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

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

