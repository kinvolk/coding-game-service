Coding Game Service
===================

This service controls both the state and interaction of Endless Coding, a game
designed to encourage people to explore the operating system, become users
and learn the skills required to be a software developer.

Architecturally it is divided into a few main components.
 1. A D-Bus service that is resident on the system, listening for events
    and updating its own state accordingly.
 2. A log file which tracks all the relevant game related activity and can
    be replayed at any moment.
 3. A broker that sends messages to other applications, such as a chatbox
    application that displays chat messages.

Chat and Messages
=================

Endless Coding is primarily a text based experience. Multiple "bots" engage
in conversations with the user encouraging them to explore certain areas
of the operating system. Depending on both external events on the system
and user's own interaction with the bots, certain things will be said by the
bots and certain other events will take place.

Internally, the bots are referred to as "actors". Each actor has its own
conversation with the user. Internally, they are all backed by the same
game service, so for instance a response to one actor's message might
trigger a new message by another actor.

The main consumer of the chat messages is the "coding-chatbox" application.
The game service is designed primarly with this usecase in mind. As such,
chat responses are not responses to D-Bus method calls in the usual sense, but
instead sent as new messages to com.endlessm.Coding.Chatbox.

The only relevant methods exposed to external clients are ChatHistory, which
gets the entire chat history for a particular actor and ChatResponse. These
are primarily for use by the coding-chatbox app, to respond to a particular
message-id or to fetch the history of a conversation on startup.

Timeline and Missions
=====================

The entire game follows a non-linear script found in
`data/timeline.json.unvalidated.in`. That file defines missions and events.

Missions are the storyline "arcs" of the game. The currently active mission
is determined by the most recent `start-mission` event that was fired. A
mission's completion state is determined by the number of "artifacts" that
a user has collected. An artifact is considered to have been collected if
some event which caused that artifact to be marked as collected occurred. So
for instance, it might be possible to collect artifacts and partially
complete missions which the user has not seen yet.

Information about the currently active mission is stored in properties
which are made public on the `com.endlessm.CodingGameService` D-Bus object.
Those properties are used by the game manager to display the user's progress
throughout the game itself.

Events are the basic unit of the game. Each mission can start with one
or more events and those events can trigger other events. Missions only start
with an event, they do not have a list of them.

An event can be one of many different types. How the event is handled depends
on its type. An event also always has a name and a `data` field. What is
contained in `data` depends on the type. For instance, some events might
respond to a piece of user input, so their data will contain what to do
on those responses. Other events might change settings and their data contains
more informaton on what to do for that.

Log File
========

Every event that occurs in the game is written to
`$XDG_CONFIG_HOME/com.endlessm.CodingGameService/game-service.log`. The
`CodingGameService` object doesn't have direct access to every entry, only those
mediated through the log file. The log file exposes methods to answer relevant
questions, such as "what is the most recent piece of user input that was
requested" or "what external events should be listened for right now?". The
objective is to ensure that the game service and any clients can always
recover from a crash by examining the log file on startup and replaying
any relevant events.

External Events
===============

Events are usually triggered in one of two ways. The first way is by the
user interacting with the `coding-chatbox` application and responding to
messages there. That calls the `ChatResponse` method on the D-Bus service.

The other way is by other applications calling `ExternalEvent`. This method
is just called with a single string stating what that event was. A call to
`ExternalEvent` is only relevant if the game service was in a state where
it was listening for that event. For example, in the `intro` mission, the
game service becomes interested in the user moving a window. This will
cause the signal `ListenForEvent` to be fired with `move-window`. Any
other application or system service that might want to tell the game service
about a window being moved can then call `ExternalEvent` with `move-window`
when that happens. Applications should not notify the game service of
events unless they recieve the `ListenForEvent` signal as an optimisation.

When an external event occurs, the game service looks up the event which
caused that external event to be listened for and runs any events listed
in its `data.received` member.

When the game service is no longer interested in some event, for instance,
because some timeout happened or the event was already received, it will
emit `StopListeningFor` with that event name. Other applications can
catch this signal and stop running any internal logic to detect whether
that event should be sent.

If applications start up after the game service and they might want to send
events to it, they should call `CurrentlyListeningForEvents` to get all
events which the game service is currently interested in (eg, all those
for which `ListenForEvent` was sent and `StopListeningFor` has not been
sent.
