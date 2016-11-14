Defining new event types
========================

In some cases, you might want to define a new type of event in the
game service to perform some action which the game service doesn't currently
do. The best way to do this is to add a new event type and trigger an event
of that name through some other action.

All events must have a `name` `type` and `data` members. The `data` member must
be an object and can contain whatever properties are necessary (though these
should be consistent between events with the same type).

Events are all managed through the `_dispatch` method on `CodingGameService`.
When an event listed in `timeline.json` is passed to `_dispatch`, it will
examine the `type` member and then run the corresponding method in
`this._dispatchTable`.

Methods in `this._dispatchTable` take both the event (exactly as it is
in `timeline.json` and a `callback`. The callback must be called once event
processing is complete as it determines what order and when events will be
written to the log file. Calling `callback` returns a copy of the event with
a `timestamp` member if that is necessary.

If you need to dispatch additional events, the general pattern is to put
those event names in a list under some property of the event's `data` member and
then to run something similar to the the following snippit:

    let toDispatch = findEventsToDispatchInDescriptors(event.data.property,
                                                       this._descriptors.events);
    toDispatch.forEach(Lang.bind(this, function(e) {
        this._dispatch(e);
    }));


